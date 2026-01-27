/**
 * Audio Session Manager Service
 * 
 * Universal audio ingestion system supporting multiple devices and protocols:
 * - Browsers (WebSocket primary, SSE fallback)
 * - Mobile apps (WebSocket/HTTP hybrid)
 * - Wearables (HTTP POST with polling)
 * - IoT devices (HTTP streaming)
 * 
 * Features:
 * - Device registration and management
 * - Session lifecycle (create, resume, complete)
 * - Chunk reassembly and ordering
 * - Transparent protocol fallback
 * - Resumable uploads for intermittent connectivity
 */

import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import prisma from './prisma.js';
import { DeviceType, SessionStatus, ConnectionProtocol, ChunkStatus } from '@prisma/client';
import { ContinuousListeningService, ContinuousListeningConfig } from './continuous-listening.js';

// ==================== Types ====================

export interface DeviceCapabilities {
  codecs: ('pcm16' | 'opus' | 'aac' | 'wav' | 'mp3')[];
  sampleRates: number[];
  protocols: ('websocket' | 'http' | 'sse')[];
  maxChunkDuration?: number; // seconds
  supportsResuming?: boolean;
  supportsBinary?: boolean;
}

export interface AudioFormat {
  codec: string;
  sampleRate: number;
  channels: number;
  bitDepth?: number;
}

export interface DeviceRegistration {
  userId: string;
  deviceType: DeviceType;
  deviceName?: string;
  userAgent?: string;
  capabilities?: DeviceCapabilities;
}

export interface SessionConfig {
  userId: string;
  deviceId: string;
  audioFormat?: AudioFormat;
  preferredProtocol?: ConnectionProtocol;
}

export interface ChunkData {
  sessionId: string;
  sequence: number;
  audioData: Buffer;
  audioFormat?: string;
  sampleRate?: number;
  isFinal?: boolean;
}

export interface SessionEvent {
  id: number;
  type: 'vad_status' | 'speaker_status' | 'transcript' | 'command_detected' | 'memory_stored' | 'error' | 'session_state';
  timestamp: number;
  data: any;
  delivered?: boolean;
}

export interface SessionInfo {
  id: string;
  status: SessionStatus;
  protocol: ConnectionProtocol;
  chunksReceived: number;
  bytesReceived: number;
  lastChunkAt: Date | null;
  pendingEventsCount: number;
  startedAt: Date;
}

// ==================== Audio Session Manager ====================

export class AudioSessionManager extends EventEmitter {
  private activeSessions: Map<string, ContinuousListeningService> = new Map();
  private sessionEventBuffers: Map<string, SessionEvent[]> = new Map();
  private sessionEventCounters: Map<string, number> = new Map();
  
  constructor() {
    super();
  }

  // ==================== Device Management ====================

  /**
   * Register a new audio device
   */
  async registerDevice(registration: DeviceRegistration): Promise<{ deviceId: string; deviceToken: string }> {
    const deviceToken = this.generateDeviceToken();
    
    const device = await prisma.audioDevice.create({
      data: {
        userId: registration.userId,
        deviceType: registration.deviceType,
        deviceName: registration.deviceName,
        deviceToken,
        userAgent: registration.userAgent,
        capabilities: registration.capabilities ? JSON.parse(JSON.stringify(registration.capabilities)) : {},
        isActive: true,
      },
    });

    console.log(`📱 Audio device registered: ${device.id} (${registration.deviceType})`);
    
    return {
      deviceId: device.id,
      deviceToken,
    };
  }

  /**
   * Get device by token
   */
  async getDeviceByToken(deviceToken: string): Promise<any> {
    return prisma.audioDevice.findUnique({
      where: { deviceToken },
      include: { sessions: { where: { status: { in: ['ACTIVE', 'PAUSED'] } } } },
    });
  }

  /**
   * Get user's registered devices
   */
  async getUserDevices(userId: string): Promise<any[]> {
    return prisma.audioDevice.findMany({
      where: { userId, isActive: true },
      orderBy: { lastSeen: 'desc' },
    });
  }

  /**
   * Update device last seen
   */
  async updateDeviceActivity(deviceId: string, protocol?: string, ipAddress?: string): Promise<void> {
    await prisma.audioDevice.update({
      where: { id: deviceId },
      data: {
        lastSeen: new Date(),
        lastProtocol: protocol,
        lastIpAddress: ipAddress,
      },
    });
  }

  /**
   * Unregister a device
   */
  async unregisterDevice(deviceId: string, userId: string): Promise<boolean> {
    const device = await prisma.audioDevice.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) return false;

    // Close any active sessions
    await prisma.universalAudioSession.updateMany({
      where: { deviceId, status: { in: ['ACTIVE', 'PAUSED', 'CONNECTING'] } },
      data: { status: 'DISCONNECTED', completedAt: new Date() },
    });

    // Soft delete the device
    await prisma.audioDevice.update({
      where: { id: deviceId },
      data: { isActive: false },
    });

    return true;
  }

  // ==================== Session Management ====================

  /**
   * Create a new audio session
   */
  async createSession(config: SessionConfig): Promise<{
    sessionId: string;
    uploadUrl: string;
    eventUrl: string;
    protocol: ConnectionProtocol;
  }> {
    // Verify device belongs to user
    const device = await prisma.audioDevice.findFirst({
      where: { id: config.deviceId, userId: config.userId, isActive: true },
    });

    if (!device) {
      throw new Error('Device not found or inactive');
    }

    // Determine best protocol based on device capabilities
    const protocol = this.selectProtocol(device.capabilities as any, config.preferredProtocol);

    // Create session in database
    const session = await prisma.universalAudioSession.create({
      data: {
        userId: config.userId,
        deviceId: config.deviceId,
        status: 'CONNECTING',
        protocol,
        audioFormat: config.audioFormat ? JSON.parse(JSON.stringify(config.audioFormat)) : {
          codec: 'pcm16',
          sampleRate: 16000,
          channels: 1,
          bitDepth: 16,
        },
      },
    });

    // Initialize event buffer
    this.sessionEventBuffers.set(session.id, []);
    this.sessionEventCounters.set(session.id, 0);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎙️ [AUDIO SESSION] New continuous audio session starting`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📋 Session ID: ${session.id}`);
    console.log(`👤 User ID: ${config.userId}`);
    console.log(`📱 Device ID: ${config.deviceId}`);
    console.log(`🔌 Protocol: ${protocol}`);
    console.log(`🎵 Audio Format: ${JSON.stringify(config.audioFormat || { codec: 'pcm16', sampleRate: 16000, channels: 1 })}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);

    // Initialize the continuous listening service for this session
    console.log(`\n🔧 [AUDIO SESSION] Initializing continuous listening service...`);
    await this.initializeListeningService(session.id, config.userId);
    console.log(`✅ [AUDIO SESSION] Session ${session.id} is now active and listening`);
    console.log(`${'='.repeat(60)}\n`)

    return {
      sessionId: session.id,
      uploadUrl: `/api/audio/sessions/${session.id}/chunks`,
      eventUrl: `/api/audio/sessions/${session.id}/events`,
      protocol,
    };
  }

  /**
   * Get session info
   */
  async getSession(sessionId: string, userId: string): Promise<SessionInfo | null> {
    const session = await prisma.universalAudioSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) return null;

    const pendingEvents = this.sessionEventBuffers.get(sessionId) || [];

    return {
      id: session.id,
      status: session.status,
      protocol: session.protocol,
      chunksReceived: session.chunksReceived,
      bytesReceived: session.bytesReceived,
      lastChunkAt: session.lastChunkAt,
      pendingEventsCount: pendingEvents.filter(e => !e.delivered).length,
      startedAt: session.startedAt,
    };
  }

  /**
   * Resume an interrupted session
   */
  async resumeSession(sessionId: string, userId: string, lastSequence?: number): Promise<{
    success: boolean;
    missingChunks: number[];
    nextExpectedSequence: number;
  }> {
    const session = await prisma.universalAudioSession.findFirst({
      where: { id: sessionId, userId, status: { in: ['PAUSED', 'DISCONNECTED', 'ERROR'] } },
    });

    if (!session) {
      return { success: false, missingChunks: [], nextExpectedSequence: 0 };
    }

    // Identify missing chunks
    const chunks = await prisma.audioChunk.findMany({
      where: { sessionId },
      select: { sequence: true },
      orderBy: { sequence: 'asc' },
    });

    const receivedSequences = new Set(chunks.map(c => c.sequence));
    const missingChunks: number[] = [];
    
    for (let i = 0; i <= session.lastChunkSeq; i++) {
      if (!receivedSequences.has(i)) {
        missingChunks.push(i);
      }
    }

    // Update session status
    await prisma.universalAudioSession.update({
      where: { id: sessionId },
      data: {
        status: 'RESUMING',
        resumedAt: new Date(),
        missingChunks,
      },
    });

    // Re-initialize listening service if needed
    if (!this.activeSessions.has(sessionId)) {
      await this.initializeListeningService(sessionId, userId);
    }

    console.log(`🔄 Session resumed: ${sessionId} (missing: ${missingChunks.length} chunks)`);

    return {
      success: true,
      missingChunks,
      nextExpectedSequence: session.lastChunkSeq + 1,
    };
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await prisma.universalAudioSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) return false;

    // Stop the listening service
    const service = this.activeSessions.get(sessionId);
    if (service) {
      service.stop();
      this.activeSessions.delete(sessionId);
    }

    // Clean up event buffers
    this.sessionEventBuffers.delete(sessionId);
    this.sessionEventCounters.delete(sessionId);

    // Update database
    await prisma.universalAudioSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ [AUDIO SESSION] Session closed: ${sessionId}`);
    console.log(`⏰ Ended at: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    return true;
  }

  // ==================== Chunk Processing ====================

  /**
   * Process an incoming audio chunk
   */
  async processChunk(chunkData: ChunkData): Promise<{
    success: boolean;
    chunkId?: string;
    error?: string;
  }> {
    const session = await prisma.universalAudioSession.findUnique({
      where: { id: chunkData.sessionId },
    });

    if (!session) {
      console.log(`❌ [CHUNK] Session not found: ${chunkData.sessionId}`);
      return { success: false, error: 'Session not found' };
    }

    if (!['ACTIVE', 'RESUMING', 'CONNECTING'].includes(session.status)) {
      console.log(`❌ [CHUNK] Session not active: ${chunkData.sessionId} (status: ${session.status})`);
      return { success: false, error: `Session not active (status: ${session.status})` };
    }

    try {
      // Store chunk in database
      const chunk = await prisma.audioChunk.create({
        data: {
          sessionId: chunkData.sessionId,
          sequence: chunkData.sequence,
          isFinal: chunkData.isFinal || false,
          audioData: chunkData.audioData,
          audioFormat: chunkData.audioFormat || 'pcm16',
          sampleRate: chunkData.sampleRate || 16000,
          durationMs: Math.round((chunkData.audioData.length / (chunkData.sampleRate || 16000) / 2) * 1000),
          bytesReceived: chunkData.audioData.length,
          status: 'RECEIVED',
        },
      });

      // Update session stats
      await prisma.universalAudioSession.update({
        where: { id: chunkData.sessionId },
        data: {
          status: 'ACTIVE',
          chunksReceived: { increment: 1 },
          bytesReceived: { increment: chunkData.audioData.length },
          lastChunkSeq: Math.max(session.lastChunkSeq, chunkData.sequence),
          lastChunkAt: new Date(),
        },
      });

      // Process through continuous listening service
      const service = this.activeSessions.get(chunkData.sessionId);
      if (service) {
        const result = await service.processAudioChunk({
          data: chunkData.audioData,
          timestamp: Date.now(),
          sampleRate: chunkData.sampleRate || 16000,
        });

        // Log VAD result for visibility
        if (result.data?.isSpeech) {
          console.log(`🎤 [VAD] Speech detected in chunk #${chunkData.sequence} (session: ${chunkData.sessionId.slice(0, 8)}...)`);
        }

        // Mark chunk as processed
        await prisma.audioChunk.update({
          where: { id: chunk.id },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
            vadDetected: result.data?.isSpeech,
          },
        });
      }

      // Handle final chunk
      if (chunkData.isFinal) {
        await this.handleFinalChunk(chunkData.sessionId);
      }

      return { success: true, chunkId: chunk.id };
    } catch (error: any) {
      console.error(`Chunk processing error for session ${chunkData.sessionId}:`, error);
      
      // Log error in session
      await prisma.universalAudioSession.update({
        where: { id: chunkData.sessionId },
        data: {
          errorCount: { increment: 1 },
          lastError: error.message,
          lastErrorAt: new Date(),
        },
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Handle the final chunk of a session
   */
  private async handleFinalChunk(sessionId: string): Promise<void> {
    await prisma.universalAudioSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETING' },
    });

    // Process any remaining audio
    const service = this.activeSessions.get(sessionId);
    if (service) {
      service.stop();
    }

    // Queue completion event
    this.queueEvent(sessionId, {
      type: 'session_state',
      data: { status: 'COMPLETING' },
    });
  }

  // ==================== Event Management ====================

  /**
   * Queue an event for delivery
   */
  queueEvent(sessionId: string, event: Omit<SessionEvent, 'id' | 'timestamp' | 'delivered'>): void {
    const events = this.sessionEventBuffers.get(sessionId);
    if (!events) return;

    const counter = (this.sessionEventCounters.get(sessionId) || 0) + 1;
    this.sessionEventCounters.set(sessionId, counter);

    const fullEvent: SessionEvent = {
      ...event,
      id: counter,
      timestamp: Date.now(),
      delivered: false,
    };

    events.push(fullEvent);

    // Emit for WebSocket/SSE delivery
    this.emit(`session:${sessionId}:event`, fullEvent);

    // Keep buffer size manageable (last 100 events)
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
  }

  /**
   * Get pending events for polling
   */
  getEventsForPolling(sessionId: string, afterEventId?: number): SessionEvent[] {
    const events = this.sessionEventBuffers.get(sessionId) || [];
    
    const filteredEvents = afterEventId 
      ? events.filter(e => e.id > afterEventId)
      : events.filter(e => !e.delivered);

    // Mark as delivered
    filteredEvents.forEach(e => e.delivered = true);

    return filteredEvents;
  }

  /**
   * Mark events as delivered (for WebSocket/SSE confirmation)
   */
  markEventsDelivered(sessionId: string, eventIds: number[]): void {
    const events = this.sessionEventBuffers.get(sessionId);
    if (!events) return;

    const idSet = new Set(eventIds);
    events.forEach(e => {
      if (idSet.has(e.id)) {
        e.delivered = true;
      }
    });
  }

  // ==================== Protocol Selection ====================

  /**
   * Select the best protocol based on device capabilities
   */
  private selectProtocol(
    capabilities: DeviceCapabilities | null,
    preferred?: ConnectionProtocol
  ): ConnectionProtocol {
    if (preferred) return preferred;
    
    if (!capabilities?.protocols) {
      return 'WEBSOCKET'; // Default for browsers
    }

    // Priority: WebSocket > SSE > HTTP
    if (capabilities.protocols.includes('websocket')) {
      return 'WEBSOCKET';
    }
    if (capabilities.protocols.includes('sse')) {
      return 'SSE';
    }
    return 'HTTP_POLLING';
  }

  // ==================== Internal Helpers ====================

  /**
   * Initialize the continuous listening service for a session
   */
  private async initializeListeningService(sessionId: string, userId: string): Promise<void> {
    console.log(`\n🔧 [INIT] Loading configuration for session ${sessionId}...`);
    
    // Get user settings
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    // Get speaker profile if available
    const speakerProfile = await prisma.speakerProfile.findFirst({
      where: { userId, isEnrolled: true },
    });

    console.log(`📝 [INIT] User settings loaded: ${settings ? 'custom' : 'defaults'}`);
    console.log(`🗣️ [INIT] Speaker profile: ${speakerProfile ? `enrolled (${speakerProfile.id})` : 'not enrolled'}`);

    const config: ContinuousListeningConfig = {
      userId,
      wakeWord: settings?.wakeWord || 'Hey Brain',
      wakeWordSensitivity: settings?.wakeWordSensitivity || 0.8,
      minImportanceThreshold: settings?.minImportanceThreshold || 0.3,
      silenceDetectionMs: settings?.silenceDetectionMs || 1500,
      vadSensitivity: settings?.vadSensitivity || 0.5,
      speakerConfidenceThreshold: settings?.speakerConfidenceThreshold || 0.7,
      speakerProfileId: speakerProfile?.id,
      centroidEmbedding: speakerProfile?.centroidEmbedding 
        ? (speakerProfile.centroidEmbedding as number[])
        : undefined,
    };

    console.log(`⚙️ [INIT] Configuration applied:`);
    console.log(`   - Wake word: "${config.wakeWord}" (sensitivity: ${config.wakeWordSensitivity})`);
    console.log(`   - VAD sensitivity: ${config.vadSensitivity}`);
    console.log(`   - Silence detection: ${config.silenceDetectionMs}ms`);
    console.log(`   - Min importance threshold: ${config.minImportanceThreshold}`);
    console.log(`   - Speaker confidence threshold: ${config.speakerConfidenceThreshold}`);

    const service = new ContinuousListeningService(config);

    // Forward events to session event queue
    service.on('vad_status', (data) => {
      this.queueEvent(sessionId, { type: 'vad_status', data });
    });

    service.on('speaker_status', (data) => {
      this.queueEvent(sessionId, { type: 'speaker_status', data });
    });

    service.on('transcript', (data) => {
      this.queueEvent(sessionId, { type: 'transcript', data });
    });

    service.on('command_detected', (data) => {
      this.queueEvent(sessionId, { type: 'command_detected', data });
    });

    service.on('memory_stored', (data) => {
      this.queueEvent(sessionId, { type: 'memory_stored', data });
    });

    service.on('error', (data) => {
      this.queueEvent(sessionId, { type: 'error', data });
    });

    this.activeSessions.set(sessionId, service);
  }

  /**
   * Generate a secure device token
   */
  private generateDeviceToken(): string {
    return `dev_${randomBytes(32).toString('hex')}`;
  }

  // ==================== Cleanup ====================

  /**
   * Clean up stale sessions
   */
  async cleanupStaleSessions(maxAgeMinutes: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    const staleSessions = await prisma.universalAudioSession.findMany({
      where: {
        status: { in: ['ACTIVE', 'CONNECTING', 'RESUMING'] },
        updatedAt: { lt: cutoff },
      },
    });

    for (const session of staleSessions) {
      // Clean up in-memory state
      this.activeSessions.delete(session.id);
      this.sessionEventBuffers.delete(session.id);
      this.sessionEventCounters.delete(session.id);
    }

    // Update database
    const result = await prisma.universalAudioSession.updateMany({
      where: {
        status: { in: ['ACTIVE', 'CONNECTING', 'RESUMING'] },
        updatedAt: { lt: cutoff },
      },
      data: {
        status: 'DISCONNECTED',
        completedAt: new Date(),
      },
    });

    if (result.count > 0) {
      console.log(`🧹 Cleaned up ${result.count} stale audio sessions`);
    }

    return result.count;
  }
}

// Singleton instance
export const audioSessionManager = new AudioSessionManager();
