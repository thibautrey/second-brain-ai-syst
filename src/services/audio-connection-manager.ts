/**
 * Audio Connection Manager
 *
 * Manages audio streaming connections with transparent fallback:
 * 1. WebSocket (primary) - lowest latency, bidirectional
 * 2. SSE + HTTP POST (fallback) - for environments where WebSocket fails
 * 3. HTTP Polling (final fallback) - for wearables and restrictive networks
 *
 * Features:
 * - Automatic protocol detection and switching
 * - Exponential backoff with jitter for reconnection
 * - Chunk size adaptation for network conditions
 * - Session resumption for interrupted connections
 * - Completely transparent to the user (no error notifications)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Protocol configuration
// Cloudflare Free plan has limited WebSocket support, so default to SSE in production
const FORCE_PROTOCOL = import.meta.env.VITE_AUDIO_PROTOCOL as ConnectionProtocol | undefined;
const IS_PRODUCTION = import.meta.env.PROD || API_BASE_URL.startsWith("https://");
const DEFAULT_PROTOCOL: ConnectionProtocol = FORCE_PROTOCOL || (IS_PRODUCTION ? "sse" : "websocket");

// ==================== Types ====================

export type ConnectionProtocol = "websocket" | "sse" | "polling";
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "fallback";

export interface ConnectionConfig {
  // Device identification
  deviceType?: "BROWSER" | "MOBILE_APP" | "WEARABLE";
  deviceName?: string;

  // Audio format
  audioFormat?: {
    codec: string;
    sampleRate: number;
    channels: number;
  };

  // Connection preferences
  preferredProtocol?: ConnectionProtocol;
  enableFallback?: boolean;

  // Reconnection settings
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;

  // Chunk settings
  initialChunkSize?: number;
  minChunkSize?: number;
  adaptiveChunkSize?: boolean;
}

export interface ConnectionStats {
  protocol: ConnectionProtocol;
  state: ConnectionState;
  reconnectAttempts: number;
  chunksent: number;
  bytesSent: number;
  eventsReceived: number;
  lastActivityAt: number;
  sessionId: string | null;
  deviceId: string | null;
}

export interface SessionEvent {
  id: number;
  type: string;
  timestamp: number;
  data: any;
}

type EventHandler = (event: SessionEvent) => void;

// Custom error for session/device validation failures
class SessionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionValidationError";
  }
}

// ==================== Audio Connection Manager ====================

export class AudioConnectionManager {
  private config: Required<ConnectionConfig>;
  private state: ConnectionState = "disconnected";
  private protocol: ConnectionProtocol = "websocket";

  // Connection resources
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private pollingInterval: number | null = null;

  // Session state
  private sessionId: string | null = null;
  private deviceId: string | null = null;
  private deviceToken: string | null = null;
  private token: string | null = null;

  // Chunk tracking
  private chunkSequence: number = 0;
  private chunkSize: number;
  private lastEventId: number = 0;

  // Reconnection state
  private reconnectAttempts: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  // Stats
  private stats: ConnectionStats;

  // Event handlers
  private eventHandlers: Set<EventHandler> = new Set();
  private stateChangeHandlers: Set<(state: ConnectionState) => void> =
    new Set();

  constructor(config: ConnectionConfig = {}) {
    this.config = {
      deviceType: config.deviceType || "BROWSER",
      deviceName: config.deviceName || this.detectDeviceName(),
      audioFormat: config.audioFormat || {
        codec: "pcm16",
        sampleRate: 16000,
        channels: 1,
      },
      preferredProtocol: config.preferredProtocol || DEFAULT_PROTOCOL,
      enableFallback: config.enableFallback ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      initialReconnectDelay: config.initialReconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      initialChunkSize: config.initialChunkSize ?? 4096,
      minChunkSize: config.minChunkSize ?? 512,
      adaptiveChunkSize: config.adaptiveChunkSize ?? true,
    };

    this.chunkSize = this.config.initialChunkSize;

    this.stats = {
      protocol: this.protocol,
      state: this.state,
      reconnectAttempts: 0,
      chunksent: 0,
      bytesSent: 0,
      eventsReceived: 0,
      lastActivityAt: 0,
      sessionId: null,
      deviceId: null,
    };
  }

  // ==================== Public API ====================

  /**
   * Connect to the audio streaming service
   */
  async connect(): Promise<boolean> {
    this.token = localStorage.getItem("authToken");
    if (!this.token) {
      console.error("AudioConnectionManager: No auth token");
      return false;
    }

    this.setState("connecting");

    // Track retry attempts for session creation
    let sessionRetryCount = 0;
    const maxSessionRetries = 2;

    while (sessionRetryCount <= maxSessionRetries) {
      try {
        // Try to use existing device ID from localStorage
        const storedDeviceId = localStorage.getItem("audioDeviceId");
        const storedDeviceToken = localStorage.getItem("audioDeviceToken");
        
        // Validate existing device if we have one
        if (storedDeviceId && storedDeviceToken && !this.deviceId) {
          const isValid = await this.validateDevice(storedDeviceId);
          if (isValid) {
            this.deviceId = storedDeviceId;
            this.deviceToken = storedDeviceToken;
            this.stats.deviceId = storedDeviceId;
          } else {
            // Clear stale device data
            console.log("AudioConnectionManager: Clearing stale device data");
            this.clearStoredCredentials();
          }
        }

        // Register device if needed
        if (!this.deviceId) {
          await this.registerDevice();
        }

        // Create session
        await this.createSession();

        // Connect with preferred protocol
        await this.connectWithProtocol(this.config.preferredProtocol);

        return true;
      } catch (error) {
        console.error("AudioConnectionManager: Connection failed", error);
        
        // Check if this is a session/device validation error
        if (error instanceof SessionValidationError) {
          sessionRetryCount++;
          console.log(`AudioConnectionManager: Session validation failed, retry ${sessionRetryCount}/${maxSessionRetries}`);
          
          // Clear all stored credentials and start fresh
          this.clearStoredCredentials();
          this.deviceId = null;
          this.deviceToken = null;
          this.sessionId = null;
          
          if (sessionRetryCount <= maxSessionRetries) {
            continue; // Retry with fresh credentials
          }
        }
        
        this.handleConnectionError();
        return false;
      }
    }
    
    return false;
  }

  /**
   * Clear stored credentials (device/session)
   */
  private clearStoredCredentials(): void {
    localStorage.removeItem("audioDeviceId");
    localStorage.removeItem("audioDeviceToken");
  }

  /**
   * Validate if a device ID is still valid
   */
  private async validateDevice(deviceId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/audio/devices`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.devices?.some((d: any) => d.id === deviceId && d.isActive);
    } catch {
      return false;
    }
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
    this.cleanup();
    this.setState("disconnected");
    this.reconnectAttempts = 0;
    // Clear internal state so next connect starts fresh
    this.sessionId = null;
    this.deviceId = null;
    this.deviceToken = null;
    this.stats.sessionId = null;
    this.stats.deviceId = null;
  }

  /**
   * Send audio chunk
   */
  async sendAudioChunk(
    audioData: ArrayBuffer,
    isFinal: boolean = false
  ): Promise<boolean> {
    if (this.state !== "connected" && this.state !== "fallback") {
      return false;
    }

    const sequence = this.chunkSequence++;

    try {
      if (this.protocol === "websocket" && this.ws?.readyState === WebSocket.OPEN) {
        // Send via WebSocket (binary)
        this.ws.send(audioData);
        this.updateStats(audioData.byteLength);
        return true;
      } else {
        // Send via HTTP POST
        return await this.sendChunkViaHttp(audioData, sequence, isFinal);
      }
    } catch (error) {
      console.error("AudioConnectionManager: Failed to send chunk", error);

      // Adapt chunk size on error
      if (this.config.adaptiveChunkSize) {
        this.reduceChunkSize();
      }

      return false;
    }
  }

  /**
   * Add event handler
   */
  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Add state change handler
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateChangeHandlers.add(handler);
    return () => this.stateChangeHandlers.delete(handler);
  }

  /**
   * Get current stats
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Get current state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get current chunk size (for audio processor)
   */
  getChunkSize(): number {
    return this.chunkSize;
  }

  // ==================== Device & Session Management ====================

  private async registerDevice(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/audio/devices/register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceType: this.config.deviceType,
        deviceName: this.config.deviceName,
        capabilities: {
          codecs: ["pcm16"],
          sampleRates: [16000],
          protocols: ["websocket", "http", "sse"],
          supportsBinary: true,
          supportsResuming: true,
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to register device");
    }

    const data = await response.json();
    this.deviceId = data.deviceId;
    this.deviceToken = data.deviceToken;
    this.stats.deviceId = data.deviceId;

    // Store for future sessions
    localStorage.setItem("audioDeviceId", data.deviceId);
    localStorage.setItem("audioDeviceToken", data.deviceToken);
  }

  private async createSession(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/audio/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId: this.deviceId,
        audioFormat: this.config.audioFormat,
        preferredProtocol: this.protocolToBackend(this.config.preferredProtocol),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Check for device-related errors that need credential refresh
      if (response.status === 400 || response.status === 404 || response.status === 403) {
        throw new SessionValidationError(
          errorData.error || "Device or session validation failed"
        );
      }
      throw new Error(errorData.error || "Failed to create session");
    }

    const data = await response.json();
    this.sessionId = data.sessionId;
    this.stats.sessionId = data.sessionId;
    this.chunkSequence = 0;
    this.lastEventId = 0;
  }

  // ==================== Protocol Connections ====================

  private async connectWithProtocol(
    protocol: ConnectionProtocol
  ): Promise<void> {
    this.protocol = protocol;
    this.stats.protocol = protocol;

    switch (protocol) {
      case "websocket":
        await this.connectWebSocket();
        break;
      case "sse":
        await this.connectSSE();
        break;
      case "polling":
        await this.startPolling();
        break;
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const apiUrl = new URL(API_BASE_URL);
      const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${apiUrl.host}/ws/continuous-listen?token=${this.token}&sessionId=${this.sessionId}`;

      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      
      // Set binary type to arraybuffer for proper frame handling
      // This is important for Cloudflare and other proxies
      ws.binaryType = "arraybuffer";

      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error("WebSocket connection timeout"));
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.setState("connected");
        this.reconnectAttempts = 0;
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          // Handle both string and ArrayBuffer messages
          const data = event.data instanceof ArrayBuffer 
            ? new TextDecoder().decode(event.data)
            : event.data;
          const message = JSON.parse(data);
          this.handleEvent(message);
        } catch (error) {
          console.error("AudioConnectionManager: Failed to parse message", error);
        }
      };

      ws.onerror = (error) => {
        // Don't log error details - handle silently
        // But check for frame errors which indicate Cloudflare/proxy issues
        clearTimeout(timeout);
        
        // If we get an error while connecting, immediately try fallback
        // This helps with Cloudflare Free plan which may reject WebSocket upgrades
        if (this.state === "connecting" && this.config.enableFallback) {
          console.log("AudioConnectionManager: WebSocket error during connect, will fallback to SSE");
        }
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        
        // Check for specific close codes that indicate proxy/Cloudflare issues
        // 1006 = Abnormal closure (often from proxy interference)
        // 1015 = TLS handshake failure
        const isProxyError = event.code === 1006 || event.code === 1015 || !event.wasClean;
        
        if (this.state === "connected") {
          // Unexpected close - try to reconnect or fallback
          if (isProxyError && this.config.enableFallback) {
            // Skip reconnect attempts, go straight to fallback for proxy errors
            console.log("AudioConnectionManager: Proxy/Cloudflare error detected, falling back to SSE");
            this.tryFallback();
          } else {
            this.handleConnectionLost();
          }
        } else if (this.state === "connecting") {
          // Failed to connect - try fallback
          reject(new Error(`WebSocket closed: ${event.code} (${event.reason || 'no reason'})`));
        }
      };
    });
  }

  private async connectSSE(): Promise<void> {
    // Pre-validate session before opening SSE connection
    // This allows us to catch 401/404 errors and trigger proper recovery
    const validationResponse = await fetch(
      `${API_BASE_URL}/api/audio/sessions/${this.sessionId}`,
      {
        headers: { Authorization: `Bearer ${this.token}` },
      }
    );

    if (!validationResponse.ok) {
      // Session is invalid - throw SessionValidationError to trigger recovery
      if (validationResponse.status === 401 || validationResponse.status === 404) {
        console.log(`AudioConnectionManager: Session validation failed (${validationResponse.status})`);
        throw new SessionValidationError("Session not found or unauthorized");
      }
      throw new Error(`Session validation failed: ${validationResponse.status}`);
    }

    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${API_BASE_URL}/api/audio/sessions/${this.sessionId}/events?token=${this.token}`
      );
      this.eventSource = eventSource;

      const timeout = setTimeout(() => {
        if (eventSource.readyState !== EventSource.OPEN) {
          eventSource.close();
          reject(new Error("SSE connection timeout"));
        }
      }, 10000);

      eventSource.onopen = () => {
        clearTimeout(timeout);
        // Set to 'connected' if SSE is the preferred protocol, 'fallback' otherwise
        this.setState(this.config.preferredProtocol === "sse" ? "connected" : "fallback");
        this.reconnectAttempts = 0;
        resolve();
      };

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleEvent(message);
        } catch (error) {
          console.error("AudioConnectionManager: Failed to parse SSE message", error);
        }
      };

      eventSource.onerror = () => {
        clearTimeout(timeout);
        if (this.state === "connected" || this.state === "fallback") {
          this.handleConnectionLost();
        } else {
          reject(new Error("SSE connection failed"));
        }
      };
    });
  }

  private async startPolling(): Promise<void> {
    // Validate session before starting polling
    const validationResponse = await fetch(
      `${API_BASE_URL}/api/audio/sessions/${this.sessionId}`,
      {
        headers: { Authorization: `Bearer ${this.token}` },
      }
    );

    if (!validationResponse.ok) {
      if (validationResponse.status === 401 || validationResponse.status === 404) {
        throw new SessionValidationError("Session not found or unauthorized for polling");
      }
      throw new Error(`Session validation failed: ${validationResponse.status}`);
    }

    this.setState("fallback");
    this.reconnectAttempts = 0;

    // Track consecutive failures for session validity
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 5;

    // Poll for events every 2 seconds
    this.pollingInterval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/audio/sessions/${this.sessionId}/events/poll?afterEventId=${this.lastEventId}`,
          {
            headers: { Authorization: `Bearer ${this.token}` },
          }
        );

        if (response.ok) {
          consecutiveFailures = 0; // Reset on success
          const data = await response.json();
          for (const event of data.events) {
            this.handleEvent(event);
          }
          if (data.lastEventId) {
            this.lastEventId = data.lastEventId;
          }
        } else if (response.status === 401 || response.status === 404) {
          // Session is invalid - stop polling and trigger reconnection
          console.log("AudioConnectionManager: Polling detected invalid session");
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
          }
          this.handleSessionInvalidated();
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            console.log("AudioConnectionManager: Too many polling failures");
            this.handleConnectionLost();
          }
        }
      } catch (error) {
        consecutiveFailures++;
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.log("AudioConnectionManager: Too many polling errors");
          this.handleConnectionLost();
        }
      }
    }, 2000);
  }

  /**
   * Handle session becoming invalid during active connection
   * This triggers a full reconnection with fresh session
   */
  private handleSessionInvalidated(): void {
    console.log("AudioConnectionManager: Session invalidated, will create new session");
    this.cleanup(true);
    this.clearStoredCredentials();
    this.deviceId = null;
    this.deviceToken = null;
    this.sessionId = null;
    this.reconnectAttempts = 0;
    
    // Attempt to reconnect with fresh session
    this.connect().then(success => {
      if (!success) {
        console.log("AudioConnectionManager: Failed to create new session after invalidation");
        this.setState("disconnected");
      }
    });
  }

  // ==================== Chunk Sending ====================

  private async sendChunkViaHttp(
    audioData: ArrayBuffer,
    sequence: number,
    isFinal: boolean
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/audio/sessions/${this.sessionId}/chunks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            "X-Chunk-Sequence": String(sequence),
            "X-Is-Final": String(isFinal),
          },
          body: JSON.stringify({
            audioData: this.arrayBufferToBase64(audioData),
            sequence,
            isFinal,
            audioFormat: "pcm16",
            sampleRate: 16000,
          }),
        }
      );

      if (response.ok) {
        this.updateStats(audioData.byteLength);
        return true;
      }

      // Check for session invalidation
      if (response.status === 401 || response.status === 404) {
        console.log("AudioConnectionManager: Chunk upload detected invalid session");
        this.handleSessionInvalidated();
        return false;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // ==================== Error Handling & Recovery ====================

  private handleConnectionError(): void {
    if (!this.config.enableFallback) {
      this.setState("disconnected");
      return;
    }

    // Try fallback protocols
    this.tryFallback();
  }

  private handleConnectionLost(): void {
    // Don't show error to user - handle transparently
    this.cleanup(false);

    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.config.enableFallback) {
      this.tryFallback();
    } else {
      this.setState("disconnected");
    }
  }

  private scheduleReconnect(): void {
    this.setState("reconnecting");
    this.reconnectAttempts++;

    const delay = Math.min(
      this.config.initialReconnectDelay *
        Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    const finalDelay = delay + jitter;

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connectWithProtocol(this.protocol);
      } catch {
        this.handleConnectionLost();
      }
    }, finalDelay);
  }

  private async tryFallback(): Promise<void> {
    this.reconnectAttempts = 0;

    // Protocol fallback order
    const fallbackOrder: ConnectionProtocol[] = ["websocket", "sse", "polling"];
    const currentIndex = fallbackOrder.indexOf(this.protocol);
    const nextProtocol = fallbackOrder[currentIndex + 1];

    if (nextProtocol) {
      console.log(
        `AudioConnectionManager: Falling back to ${nextProtocol}`
      );
      try {
        await this.connectWithProtocol(nextProtocol);
      } catch (error) {
        // If it's a session validation error, don't try more fallbacks
        // The session itself is invalid and needs to be recreated
        if (error instanceof SessionValidationError) {
          console.log("AudioConnectionManager: Session invalid, cannot use fallback protocols");
          throw error; // Propagate up to trigger session recreation
        }
        // Try next fallback for other errors
        await this.tryFallback();
      }
    } else {
      // All protocols failed - start polling as final fallback
      await this.startPolling();
    }
  }

  // ==================== Event Handling ====================

  private handleEvent(event: SessionEvent): void {
    this.stats.eventsReceived++;
    this.stats.lastActivityAt = Date.now();
    
    if (event.id) {
      this.lastEventId = Math.max(this.lastEventId, event.id);
    }

    // Dispatch to all handlers
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("AudioConnectionManager: Event handler error", error);
      }
    }
  }

  // ==================== State Management ====================

  private setState(newState: ConnectionState): void {
    if (this.state === newState) return;
    
    this.state = newState;
    this.stats.state = newState;

    for (const handler of this.stateChangeHandlers) {
      try {
        handler(newState);
      } catch (error) {
        console.error("AudioConnectionManager: State handler error", error);
      }
    }
  }

  // ==================== Chunk Size Adaptation ====================

  private reduceChunkSize(): void {
    const newSize = Math.max(
      this.config.minChunkSize,
      Math.floor(this.chunkSize / 2)
    );

    if (newSize !== this.chunkSize) {
      console.log(
        `AudioConnectionManager: Reducing chunk size from ${this.chunkSize} to ${newSize}`
      );
      this.chunkSize = newSize;
    }
  }

  // ==================== Utilities ====================

  private cleanup(clearSession: boolean = true): void {
    if (this.ws) {
      this.ws.close(1000, "Cleanup");
      this.ws = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (clearSession) {
      this.sessionId = null;
      this.stats.sessionId = null;
    }
  }

  private updateStats(bytes: number): void {
    this.stats.chunksent++;
    this.stats.bytesSent += bytes;
    this.stats.lastActivityAt = Date.now();
  }

  private detectDeviceName(): string {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return "iOS Device";
    if (/Android/.test(ua)) return "Android Device";
    if (/Mac/.test(ua)) return "Mac Browser";
    if (/Windows/.test(ua)) return "Windows Browser";
    if (/Linux/.test(ua)) return "Linux Browser";
    return "Web Browser";
  }

  private protocolToBackend(
    protocol: ConnectionProtocol
  ): "WEBSOCKET" | "SSE" | "HTTP_POLLING" {
    switch (protocol) {
      case "websocket":
        return "WEBSOCKET";
      case "sse":
        return "SSE";
      case "polling":
        return "HTTP_POLLING";
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// Singleton for easy access
let connectionManagerInstance: AudioConnectionManager | null = null;

export function getAudioConnectionManager(
  config?: ConnectionConfig
): AudioConnectionManager {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new AudioConnectionManager(config);
  }
  return connectionManagerInstance;
}

export function resetAudioConnectionManager(): void {
  if (connectionManagerInstance) {
    connectionManagerInstance.disconnect();
    connectionManagerInstance = null;
  }
}
