/**
 * Universal Audio Ingestion Controller
 * 
 * REST API endpoints for multi-device audio streaming with transparent fallback.
 * Supports:
 * - Device registration and management
 * - Session lifecycle (create, resume, close)
 * - Chunked audio upload (resumable)
 * - SSE event delivery
 * - HTTP polling fallback
 */

import { Router, Request, Response, NextFunction } from 'express';
import { audioSessionManager, DeviceCapabilities, AudioFormat } from '../services/audio-session-manager.js';
import { DeviceType, ConnectionProtocol } from '@prisma/client';

const router = Router();

// ==================== Types ====================

interface AuthenticatedRequest extends Request {
  userId?: string;
}

// ==================== Middleware ====================

/**
 * Extract userId from authenticated request
 */
const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// ==================== Device Management ====================

/**
 * POST /api/audio/devices/register
 * Register a new audio device
 */
router.post('/devices/register', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceType, deviceName, capabilities } = req.body;

    if (!deviceType || !Object.values(DeviceType).includes(deviceType)) {
      return res.status(400).json({ 
        error: 'Invalid device type',
        validTypes: Object.values(DeviceType),
      });
    }

    const userAgent = req.headers['user-agent'];

    const result = await audioSessionManager.registerDevice({
      userId: req.userId!,
      deviceType: deviceType as DeviceType,
      deviceName,
      userAgent,
      capabilities: capabilities as DeviceCapabilities,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/audio/devices
 * List user's registered devices
 */
router.get('/devices', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const devices = await audioSessionManager.getUserDevices(req.userId!);
    
    res.json({
      devices: devices.map(d => ({
        id: d.id,
        deviceType: d.deviceType,
        deviceName: d.deviceName,
        capabilities: d.capabilities,
        lastSeen: d.lastSeen,
        lastProtocol: d.lastProtocol,
        isActive: d.isActive,
        createdAt: d.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('List devices error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/audio/devices/:deviceId
 * Unregister a device
 */
router.delete('/devices/:deviceId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await audioSessionManager.unregisterDevice(
      req.params.deviceId,
      req.userId!
    );

    if (!success) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Unregister device error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Session Management ====================

/**
 * POST /api/audio/sessions
 * Create a new audio session
 */
router.post('/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId, deviceToken, audioFormat, preferredProtocol } = req.body;

    // Allow authentication via deviceToken OR deviceId
    let resolvedDeviceId = deviceId;
    
    if (!deviceId && deviceToken) {
      const device = await audioSessionManager.getDeviceByToken(deviceToken);
      if (!device || device.userId !== req.userId) {
        return res.status(403).json({ error: 'Invalid device token' });
      }
      resolvedDeviceId = device.id;
    }

    if (!resolvedDeviceId) {
      return res.status(400).json({ error: 'deviceId or deviceToken required' });
    }

    const result = await audioSessionManager.createSession({
      userId: req.userId!,
      deviceId: resolvedDeviceId,
      audioFormat: audioFormat as AudioFormat,
      preferredProtocol: preferredProtocol as ConnectionProtocol,
    });

    // Update device activity
    await audioSessionManager.updateDeviceActivity(
      resolvedDeviceId,
      result.protocol,
      req.ip || req.socket.remoteAddress
    );

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/audio/sessions/:sessionId
 * Get session info (also used for polling)
 */
router.get('/sessions/:sessionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await audioSessionManager.getSession(
      req.params.sessionId,
      req.userId!
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error: any) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/audio/sessions/:sessionId/resume
 * Resume an interrupted session
 */
router.post('/sessions/:sessionId/resume', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lastSequence } = req.body;

    const result = await audioSessionManager.resumeSession(
      req.params.sessionId,
      req.userId!,
      lastSequence
    );

    if (!result.success) {
      return res.status(404).json({ error: 'Session not found or cannot be resumed' });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Resume session error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/audio/sessions/:sessionId
 * Close a session
 */
router.delete('/sessions/:sessionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await audioSessionManager.closeSession(
      req.params.sessionId,
      req.userId!
    );

    if (!success) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Close session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Audio Upload ====================

/**
 * POST /api/audio/sessions/:sessionId/chunks
 * Upload an audio chunk
 * Supports:
 * - Binary body (raw audio)
 * - JSON body with base64 audio
 * - Multipart form data
 */
router.post('/sessions/:sessionId/chunks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    
    // Get chunk metadata from headers or body
    const sequence = parseInt(
      req.headers['x-chunk-sequence'] as string || 
      req.body?.sequence || 
      '0'
    );
    const isFinal = 
      req.headers['x-is-final'] === 'true' || 
      req.body?.isFinal === true;
    const audioFormat = 
      req.headers['x-audio-format'] as string || 
      req.body?.audioFormat || 
      'pcm16';
    const sampleRate = parseInt(
      req.headers['x-sample-rate'] as string || 
      req.body?.sampleRate || 
      '16000'
    );

    // Get audio data
    let audioData: Buffer;
    
    if (Buffer.isBuffer(req.body)) {
      // Raw binary body
      audioData = req.body;
    } else if (req.body?.audioData) {
      // Base64 encoded in JSON
      audioData = Buffer.from(req.body.audioData, 'base64');
    } else if (req.body?.audio) {
      // Alternative field name
      audioData = Buffer.from(req.body.audio, 'base64');
    } else {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // Process the chunk
    const result = await audioSessionManager.processChunk({
      sessionId,
      sequence,
      audioData,
      audioFormat,
      sampleRate,
      isFinal,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      chunkId: result.chunkId,
      sequence,
      bytesReceived: audioData.length,
    });
  } catch (error: any) {
    console.error('Chunk upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Event Delivery ====================

/**
 * GET /api/audio/sessions/:sessionId/events
 * Server-Sent Events endpoint for real-time updates
 */
router.get('/sessions/:sessionId/events', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId;

    // Verify session belongs to user
    const session = await audioSessionManager.getSession(sessionId, req.userId!);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ sessionId, timestamp: Date.now() })}\n\n`);

    // Listen for session events
    const eventHandler = (event: any) => {
      if (res.writableEnded) return;
      
      res.write(`event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
      
      // Mark as delivered
      audioSessionManager.markEventsDelivered(sessionId, [event.id]);
    };

    audioSessionManager.on(`session:${sessionId}:event`, eventHandler);

    // Send any pending events
    const pendingEvents = audioSessionManager.getEventsForPolling(sessionId);
    for (const event of pendingEvents) {
      res.write(`event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
    }

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      res.write(`:heartbeat\n\n`);
    }, 15000);

    // Clean up on close
    req.on('close', () => {
      clearInterval(heartbeat);
      audioSessionManager.off(`session:${sessionId}:event`, eventHandler);
    });
  } catch (error: any) {
    console.error('SSE setup error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * GET /api/audio/sessions/:sessionId/events/poll
 * HTTP polling fallback for events
 */
router.get('/sessions/:sessionId/events/poll', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    const afterEventId = req.query.afterEventId 
      ? parseInt(req.query.afterEventId as string) 
      : undefined;

    // Verify session belongs to user
    const session = await audioSessionManager.getSession(sessionId, req.userId!);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const events = audioSessionManager.getEventsForPolling(sessionId, afterEventId);

    res.json({
      events,
      lastEventId: events.length > 0 ? events[events.length - 1].id : afterEventId || 0,
      sessionStatus: session.status,
    });
  } catch (error: any) {
    console.error('Event polling error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Batch Upload (Alternative) ====================

/**
 * POST /api/audio/sessions/:sessionId/upload
 * Single-request audio upload for short recordings
 * Useful for wearables that batch audio before upload
 */
router.post('/sessions/:sessionId/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    
    // Verify session
    const session = await audioSessionManager.getSession(sessionId, req.userId!);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { audio, audioFormat, sampleRate, chunks } = req.body;

    // Support either single audio blob or pre-chunked array
    if (chunks && Array.isArray(chunks)) {
      // Process multiple chunks
      const results = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const result = await audioSessionManager.processChunk({
          sessionId,
          sequence: chunk.sequence || i,
          audioData: Buffer.from(chunk.audio, 'base64'),
          audioFormat: chunk.audioFormat || audioFormat || 'pcm16',
          sampleRate: chunk.sampleRate || sampleRate || 16000,
          isFinal: i === chunks.length - 1,
        });
        results.push(result);
      }

      res.json({
        success: true,
        chunksProcessed: results.length,
        results,
      });
    } else if (audio) {
      // Single audio blob - process as one chunk
      const audioData = Buffer.from(audio, 'base64');
      
      const result = await audioSessionManager.processChunk({
        sessionId,
        sequence: 0,
        audioData,
        audioFormat: audioFormat || 'pcm16',
        sampleRate: sampleRate || 16000,
        isFinal: true,
      });

      res.json({
        success: result.success,
        chunkId: result.chunkId,
        bytesReceived: audioData.length,
        error: result.error,
      });
    } else {
      res.status(400).json({ error: 'No audio data provided' });
    }
  } catch (error: any) {
    console.error('Batch upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
