/**
 * Event Delivery Service
 * 
 * Multi-protocol event delivery with transparent fallback.
 * Handles:
 * - WebSocket (primary for browsers)
 * - Server-Sent Events (fallback)
 * - HTTP Polling (final fallback for wearables)
 * 
 * Features:
 * - Automatic protocol detection and switching
 * - Event buffering for unreliable connections
 * - Delivery confirmation and retry
 * - Connection health monitoring
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { Response } from 'express';

// ==================== Types ====================

export interface DeliveryEvent {
  id: number;
  type: string;
  timestamp: number;
  data: any;
  delivered: boolean;
  attempts: number;
  lastAttemptAt?: number;
}

export interface ConnectionState {
  sessionId: string;
  protocol: 'websocket' | 'sse' | 'polling';
  connectedAt: number;
  lastActivityAt: number;
  eventsDelivered: number;
  eventsFailed: number;
}

interface WebSocketConnection {
  ws: WebSocket;
  userId: string;
  sessionId: string;
  connectedAt: number;
}

interface SSEConnection {
  res: Response;
  userId: string;
  sessionId: string;
  connectedAt: number;
}

// ==================== Event Delivery Service ====================

export class EventDeliveryService extends EventEmitter {
  // Active connections by session ID
  private wsConnections: Map<string, WebSocketConnection> = new Map();
  private sseConnections: Map<string, SSEConnection[]> = new Map();
  
  // Event buffers for each session (for polling and retry)
  private eventBuffers: Map<string, DeliveryEvent[]> = new Map();
  private eventCounters: Map<string, number> = new Map();
  
  // Connection states for monitoring
  private connectionStates: Map<string, ConnectionState> = new Map();
  
  // Configuration
  private readonly maxBufferSize = 200;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor() {
    super();
    
    // Clean up old events periodically
    setInterval(() => this.cleanupOldEvents(), 60000);
  }

  // ==================== WebSocket Management ====================

  /**
   * Register a WebSocket connection for a session
   */
  registerWebSocket(sessionId: string, userId: string, ws: WebSocket): void {
    // Close existing connection if any
    const existing = this.wsConnections.get(sessionId);
    if (existing) {
      try {
        existing.ws.close(4003, 'New connection established');
      } catch (e) {
        // Ignore close errors
      }
    }

    this.wsConnections.set(sessionId, {
      ws,
      userId,
      sessionId,
      connectedAt: Date.now(),
    });

    this.updateConnectionState(sessionId, 'websocket');
    
    // Initialize buffer if needed
    if (!this.eventBuffers.has(sessionId)) {
      this.eventBuffers.set(sessionId, []);
      this.eventCounters.set(sessionId, 0);
    }

    // Handle WebSocket close
    ws.on('close', () => {
      const conn = this.wsConnections.get(sessionId);
      if (conn?.ws === ws) {
        this.wsConnections.delete(sessionId);
        this.emit('connection:closed', { sessionId, protocol: 'websocket' });
      }
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
    });

    console.log(`📡 WebSocket registered for session ${sessionId}`);

    // Deliver any pending events
    this.deliverPendingEvents(sessionId);
  }

  /**
   * Unregister a WebSocket connection
   */
  unregisterWebSocket(sessionId: string): void {
    this.wsConnections.delete(sessionId);
  }

  // ==================== SSE Management ====================

  /**
   * Register an SSE connection for a session
   */
  registerSSE(sessionId: string, userId: string, res: Response): void {
    let connections = this.sseConnections.get(sessionId);
    if (!connections) {
      connections = [];
      this.sseConnections.set(sessionId, connections);
    }

    const connection: SSEConnection = {
      res,
      userId,
      sessionId,
      connectedAt: Date.now(),
    };

    connections.push(connection);
    this.updateConnectionState(sessionId, 'sse');

    // Initialize buffer if needed
    if (!this.eventBuffers.has(sessionId)) {
      this.eventBuffers.set(sessionId, []);
      this.eventCounters.set(sessionId, 0);
    }

    // Handle connection close
    res.on('close', () => {
      const conns = this.sseConnections.get(sessionId);
      if (conns) {
        const index = conns.indexOf(connection);
        if (index > -1) {
          conns.splice(index, 1);
        }
        if (conns.length === 0) {
          this.sseConnections.delete(sessionId);
          this.emit('connection:closed', { sessionId, protocol: 'sse' });
        }
      }
    });

    console.log(`📡 SSE registered for session ${sessionId}`);

    // Deliver any pending events
    this.deliverPendingEvents(sessionId);
  }

  // ==================== Event Delivery ====================

  /**
   * Deliver an event to a session with automatic protocol fallback
   * Returns true if delivered immediately, false if buffered for polling
   */
  async deliverEvent(sessionId: string, event: Omit<DeliveryEvent, 'id' | 'delivered' | 'attempts'>): Promise<boolean> {
    // Create full event
    const counter = (this.eventCounters.get(sessionId) || 0) + 1;
    this.eventCounters.set(sessionId, counter);

    const fullEvent: DeliveryEvent = {
      ...event,
      id: counter,
      delivered: false,
      attempts: 0,
    };

    // Add to buffer
    this.bufferEvent(sessionId, fullEvent);

    // Try WebSocket first (fastest)
    if (this.deliverViaWebSocket(sessionId, fullEvent)) {
      return true;
    }

    // Try SSE (fallback)
    if (this.deliverViaSSE(sessionId, fullEvent)) {
      return true;
    }

    // Event will be delivered via polling
    this.emit('event:buffered', { sessionId, eventId: fullEvent.id });
    return false;
  }

  /**
   * Deliver event via WebSocket
   */
  private deliverViaWebSocket(sessionId: string, event: DeliveryEvent): boolean {
    const conn = this.wsConnections.get(sessionId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      conn.ws.send(JSON.stringify({
        type: event.type,
        id: event.id,
        timestamp: event.timestamp,
        data: event.data,
      }));

      event.delivered = true;
      event.attempts++;
      event.lastAttemptAt = Date.now();

      this.updateConnectionActivity(sessionId, true);
      return true;
    } catch (error) {
      console.error(`WebSocket delivery error for session ${sessionId}:`, error);
      this.updateConnectionActivity(sessionId, false);
      return false;
    }
  }

  /**
   * Deliver event via SSE
   */
  private deliverViaSSE(sessionId: string, event: DeliveryEvent): boolean {
    const connections = this.sseConnections.get(sessionId);
    if (!connections || connections.length === 0) {
      return false;
    }

    let delivered = false;

    for (const conn of connections) {
      try {
        if (!conn.res.writableEnded) {
          conn.res.write(`event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
          delivered = true;
        }
      } catch (error) {
        console.error(`SSE delivery error for session ${sessionId}:`, error);
      }
    }

    if (delivered) {
      event.delivered = true;
      event.attempts++;
      event.lastAttemptAt = Date.now();
      this.updateConnectionActivity(sessionId, true);
    }

    return delivered;
  }

  /**
   * Deliver pending events after connection is established
   */
  private deliverPendingEvents(sessionId: string): void {
    const events = this.eventBuffers.get(sessionId);
    if (!events) return;

    const pending = events.filter(e => !e.delivered);
    
    for (const event of pending) {
      if (this.deliverViaWebSocket(sessionId, event)) {
        continue;
      }
      if (this.deliverViaSSE(sessionId, event)) {
        continue;
      }
      // Still not delivered, will be available for polling
      break;
    }
  }

  // ==================== Polling Support ====================

  /**
   * Get events for HTTP polling (used by wearables/IoT)
   */
  getEventsForPolling(sessionId: string, afterEventId?: number): DeliveryEvent[] {
    const events = this.eventBuffers.get(sessionId) || [];
    
    const filteredEvents = afterEventId 
      ? events.filter(e => e.id > afterEventId && !e.delivered)
      : events.filter(e => !e.delivered);

    // Mark as delivered
    filteredEvents.forEach(e => {
      e.delivered = true;
      e.attempts++;
      e.lastAttemptAt = Date.now();
    });

    this.updateConnectionState(sessionId, 'polling');
    this.updateConnectionActivity(sessionId, true);

    return filteredEvents;
  }

  /**
   * Confirm event delivery (for acknowledgment-based delivery)
   */
  confirmDelivery(sessionId: string, eventIds: number[]): void {
    const events = this.eventBuffers.get(sessionId);
    if (!events) return;

    const idSet = new Set(eventIds);
    events.forEach(e => {
      if (idSet.has(e.id)) {
        e.delivered = true;
      }
    });
  }

  // ==================== Buffer Management ====================

  /**
   * Add event to buffer
   */
  private bufferEvent(sessionId: string, event: DeliveryEvent): void {
    let events = this.eventBuffers.get(sessionId);
    if (!events) {
      events = [];
      this.eventBuffers.set(sessionId, events);
    }

    events.push(event);

    // Trim buffer if too large (keep recent events)
    if (events.length > this.maxBufferSize) {
      // Remove oldest delivered events first
      const deliveredOld = events.filter(e => e.delivered);
      if (deliveredOld.length > 50) {
        const toRemove = deliveredOld.slice(0, deliveredOld.length - 50);
        for (const evt of toRemove) {
          const idx = events.indexOf(evt);
          if (idx > -1) events.splice(idx, 1);
        }
      }
      
      // If still too large, remove oldest
      while (events.length > this.maxBufferSize) {
        events.shift();
      }
    }
  }

  /**
   * Clean up old delivered events
   */
  private cleanupOldEvents(): void {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const cutoff = Date.now() - maxAge;

    for (const [sessionId, events] of this.eventBuffers) {
      const remaining = events.filter(e => 
        !e.delivered || e.timestamp > cutoff
      );
      
      if (remaining.length !== events.length) {
        this.eventBuffers.set(sessionId, remaining);
      }
    }
  }

  /**
   * Clear all events for a session
   */
  clearBuffer(sessionId: string): void {
    this.eventBuffers.delete(sessionId);
    this.eventCounters.delete(sessionId);
  }

  // ==================== Connection State ====================

  /**
   * Update connection state
   */
  private updateConnectionState(sessionId: string, protocol: 'websocket' | 'sse' | 'polling'): void {
    const existing = this.connectionStates.get(sessionId);
    
    this.connectionStates.set(sessionId, {
      sessionId,
      protocol,
      connectedAt: existing?.connectedAt || Date.now(),
      lastActivityAt: Date.now(),
      eventsDelivered: existing?.eventsDelivered || 0,
      eventsFailed: existing?.eventsFailed || 0,
    });
  }

  /**
   * Update connection activity
   */
  private updateConnectionActivity(sessionId: string, success: boolean): void {
    const state = this.connectionStates.get(sessionId);
    if (state) {
      state.lastActivityAt = Date.now();
      if (success) {
        state.eventsDelivered++;
      } else {
        state.eventsFailed++;
      }
    }
  }

  /**
   * Get connection state for a session
   */
  getConnectionState(sessionId: string): ConnectionState | null {
    return this.connectionStates.get(sessionId) || null;
  }

  /**
   * Check if session has an active connection
   */
  hasActiveConnection(sessionId: string): boolean {
    return this.wsConnections.has(sessionId) || 
           (this.sseConnections.get(sessionId)?.length || 0) > 0;
  }

  /**
   * Get the current protocol for a session
   */
  getCurrentProtocol(sessionId: string): 'websocket' | 'sse' | 'polling' | null {
    if (this.wsConnections.has(sessionId)) {
      return 'websocket';
    }
    if ((this.sseConnections.get(sessionId)?.length || 0) > 0) {
      return 'sse';
    }
    return this.connectionStates.get(sessionId)?.protocol || null;
  }

  // ==================== Cleanup ====================

  /**
   * Clean up all resources for a session
   */
  cleanup(sessionId: string): void {
    // Close WebSocket
    const wsConn = this.wsConnections.get(sessionId);
    if (wsConn) {
      try {
        wsConn.ws.close(1000, 'Session ended');
      } catch (e) {
        // Ignore
      }
      this.wsConnections.delete(sessionId);
    }

    // Close SSE connections
    const sseConns = this.sseConnections.get(sessionId);
    if (sseConns) {
      for (const conn of sseConns) {
        try {
          conn.res.end();
        } catch (e) {
          // Ignore
        }
      }
      this.sseConnections.delete(sessionId);
    }

    // Clear buffers
    this.clearBuffer(sessionId);
    this.connectionStates.delete(sessionId);
  }

  /**
   * Get stats for monitoring
   */
  getStats(): {
    activeWebSockets: number;
    activeSSE: number;
    totalBufferedEvents: number;
    sessionCount: number;
  } {
    let totalBuffered = 0;
    for (const events of this.eventBuffers.values()) {
      totalBuffered += events.filter(e => !e.delivered).length;
    }

    let sseCount = 0;
    for (const conns of this.sseConnections.values()) {
      sseCount += conns.length;
    }

    return {
      activeWebSockets: this.wsConnections.size,
      activeSSE: sseCount,
      totalBufferedEvents: totalBuffered,
      sessionCount: this.connectionStates.size,
    };
  }
}

// Singleton instance
export const eventDeliveryService = new EventDeliveryService();
