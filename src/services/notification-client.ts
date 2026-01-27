/**
 * Notification WebSocket Client
 *
 * Manages WebSocket connection for real-time notifications with fallback mechanisms:
 * 1. WebSocket (primary) - real-time push notifications
 * 2. HTTP Polling (fallback) - for environments where WebSocket fails (Cloudflare, proxies, etc)
 *
 * Features:
 * - Transparent fallback to polling when WebSocket fails
 * - Exponential backoff with jitter for reconnection
 * - Automatic protocol switching based on error conditions
 * - Completely transparent to subscribers (no error notifications)
 */

import type { Notification } from "../types/tools";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Derive WebSocket URL from API URL
 * Converts http/https to ws/wss protocol
 */
function getNotificationWebSocketUrl(): string {
  const apiUrl = new URL(API_BASE_URL);
  const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${apiUrl.host}/ws/notifications`;
}

export type NotificationCallback = (notification: Notification) => void;
export type ConnectionCallback = (connected: boolean) => void;

export type ConnectionProtocol = "websocket" | "polling";
export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "fallback";

export class NotificationClient {
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private pollingInterval: number | null = null;

  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 15; // Increased to allow more fallback attempts
  private reconnectDelay = 1000; // Start with 1s
  private maxReconnectDelay = 30000; // Max 30s

  private notificationCallbacks: Set<NotificationCallback> = new Set();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();

  private authToken: string | null = null;
  private isIntentionallyClosed = false;
  private currentProtocol: ConnectionProtocol = "websocket";
  private connectionState: ConnectionState = "disconnected";
  private lastPolledAt: number = 0;

  /**
   * Connect to WebSocket server
   */
  connect(authToken: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[NotificationClient] Already connected");
      return;
    }

    this.authToken = authToken;
    this.isIntentionallyClosed = false;
    this.reconnectAttempts = 0;

    this.establishConnection();
  }

  /**
   * Establish WebSocket connection
   */
  private establishConnection(): void {
    if (!this.authToken) {
      console.error("[NotificationClient] No auth token provided");
      return;
    }

    this.connectionState = "connecting";

    try {
      // Construct WebSocket URL with auth token
      const baseWsUrl = getNotificationWebSocketUrl();
      const wsUrl = `${baseWsUrl}?token=${encodeURIComponent(this.authToken)}`;

      console.log("[NotificationClient] Attempting WebSocket connection to:", baseWsUrl);
      this.ws = new WebSocket(wsUrl);
      
      // Set binary type to arraybuffer for proper frame handling
      this.ws.binaryType = "arraybuffer";

      // Timeout for WebSocket connection attempt
      const timeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          console.log("[NotificationClient] WebSocket connection timeout, falling back to polling");
          this.ws?.close();
          this.handleConnectionFailed();
        }
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.handleOpen.call(this);
      };
      
      this.ws.onmessage = this.handleMessage.bind(this);
      
      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        this.handleError.call(this, error);
      };
      
      this.ws.onclose = (event) => {
        clearTimeout(timeout);
        this.handleClose.call(this, event);
      };
    } catch (error) {
      console.error("[NotificationClient] WebSocket creation failed, will try polling:", error);
      this.handleConnectionFailed();
    }
  }

  /**
   * Handle WebSocket connection failure - trigger fallback to polling
   */
  private handleConnectionFailed(): void {
    this.cleanup();
    
    // Only try fallback if we haven't hit max attempts
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.tryFallback();
    } else {
      console.error("[NotificationClient] Max reconnection attempts reached");
      this.connectionState = "disconnected";
      this.notifyConnectionCallbacks(false);
    }
  }

  /**
   * Switch to polling fallback
   */
  private async startPolling(): Promise<void> {
    console.log("[NotificationClient] Starting polling fallback");
    this.currentProtocol = "polling";
    this.connectionState = "fallback";
    this.reconnectAttempts = 0;
    this.notifyConnectionCallbacks(true); // Connection is "fallback-connected"

    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 5;

    // Poll for notifications every 3 seconds (less aggressive than audio polling)
    this.pollingInterval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/notifications/poll?since=${this.lastPolledAt}`,
          {
            headers: {
              Authorization: `Bearer ${this.authToken}`,
            },
          }
        );

        if (response.ok) {
          consecutiveFailures = 0; // Reset on success
          const data = await response.json();
          this.lastPolledAt = Date.now();

          // Process notifications
          if (Array.isArray(data.notifications)) {
            for (const notification of data.notifications) {
              this.notifyNotificationCallbacks(notification);
              this.showBrowserNotification(notification);
            }
          }
        } else if (response.status === 401) {
          // Auth failed - stop polling
          console.log("[NotificationClient] Polling auth failed, stopping");
          this.stopPolling();
          this.notifyConnectionCallbacks(false);
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            console.log("[NotificationClient] Too many polling failures, will retry WebSocket");
            this.stopPolling();
            this.scheduleReconnect();
          }
        }
      } catch (error) {
        console.error("[NotificationClient] Polling error:", error);
        consecutiveFailures++;
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.log("[NotificationClient] Polling error threshold reached, will retry WebSocket");
          this.stopPolling();
          this.scheduleReconnect();
        }
      }
    }, 3000);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Try fallback to polling
   */
  private tryFallback(): void {
    console.log("[NotificationClient] Attempting fallback to polling protocol");
    this.startPolling();
  }

  /**
   * Clean up all connection resources
   */
  private cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopPolling();
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log("[NotificationClient] WebSocket connected successfully");
    this.currentProtocol = "websocket";
    this.connectionState = "connected";
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.stopPolling(); // Stop polling if it was active as fallback
    this.notifyConnectionCallbacks(true);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      console.log("[NotificationClient] Message received:", message);

      // Handle notification messages
      if (message.type === "notification") {
        const notification: Notification = message.data;
        this.notifyNotificationCallbacks(notification);

        // Show browser notification if permission granted
        this.showBrowserNotification(notification);
      }

      // Handle ping/pong for keepalive
      if (message.type === "ping") {
        this.send({ type: "pong", timestamp: Date.now() });
      }
    } catch (error) {
      console.error("[NotificationClient] Failed to parse message:", error);
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Event): void {
    console.error("[NotificationClient] WebSocket error, will attempt fallback:", error);
    // Don't close here - let onclose handler deal with cleanup and fallback
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log(
      "[NotificationClient] WebSocket disconnected:",
      event.code,
      event.reason || "no reason"
    );
    this.notifyConnectionCallbacks(false);

    // Check if this is a proxy/Cloudflare error (abnormal closure)
    const isProxyError = event.code === 1006 || event.code === 1015 || !event.wasClean;

    // Attempt reconnection unless intentionally closed
    if (!this.isIntentionallyClosed) {
      if (isProxyError && this.connectionState === "connecting") {
        // Proxy error during initial connection - go straight to fallback
        console.log(
          "[NotificationClient] Proxy/Cloudflare error detected during connection, using polling fallback"
        );
        this.handleConnectionFailed();
      } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // Try regular reconnection
        this.scheduleReconnect();
      } else {
        // Max attempts reached, try fallback polling
        console.log(
          "[NotificationClient] Max reconnection attempts reached, switching to polling"
        );
        this.tryFallback();
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Check if we should try fallback instead
    if (this.reconnectAttempts >= this.maxReconnectAttempts - 1) {
      console.log("[NotificationClient] Approaching max attempts, will use polling fallback");
      this.reconnectAttempts++;
      this.tryFallback();
      return;
    }

    this.reconnectAttempts++;
    this.connectionState = "reconnecting";

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    console.log(
      `[NotificationClient] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.establishConnection();
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.cleanup();
    this.connectionState = "disconnected";
    this.notifyConnectionCallbacks(false);
  }

  /**
   * Send message to WebSocket server
   */
  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("[NotificationClient] Cannot send, not connected");
    }
  }

  /**
   * Show browser notification
   */
  private async showBrowserNotification(
    notification: Notification,
  ): Promise<void> {
    if (!("Notification" in window)) {
      console.warn("[NotificationClient] Browser notifications not supported");
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    try {
      // If service worker is available, use it
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(notification.title, {
          body: notification.message,
          icon: "/icon-192.png",
          badge: "/badge-72.png",
          tag: notification.id,
          requireInteraction:
            notification.type === "ERROR" || notification.type === "WARNING",
          data: {
            id: notification.id,
            actionUrl: notification.actionUrl,
            authToken: this.authToken,
          },
        } as NotificationOptions);
      } else {
        // Fallback to basic Notification API
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: "/icon-192.png",
          tag: notification.id,
        });

        browserNotification.onclick = () => {
          if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
          }
          browserNotification.close();
        };
      }
    } catch (error) {
      console.error("[NotificationClient] Failed to show notification:", error);
    }
  }

  /**
   * Subscribe to notification events
   */
  onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.notificationCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to connection status events
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);

    // Immediately notify of current state
    const isConnected = this.ws?.readyState === WebSocket.OPEN;
    callback(isConnected);

    // Return unsubscribe function
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * Notify all notification callbacks
   */
  private notifyNotificationCallbacks(notification: Notification): void {
    this.notificationCallbacks.forEach((callback) => {
      try {
        callback(notification);
      } catch (error) {
        console.error("[NotificationClient] Callback error:", error);
      }
    });
  }

  /**
   * Notify all connection callbacks
   */
  private notifyConnectionCallbacks(connected: boolean): void {
    this.connectionCallbacks.forEach((callback) => {
      try {
        callback(connected);
      } catch (error) {
        console.error("[NotificationClient] Callback error:", error);
      }
    });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Request notification permission
   */
  static async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      console.warn("[NotificationClient] Browser notifications not supported");
      return "denied";
    }

    if (Notification.permission === "granted") {
      return "granted";
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  /**
   * Check if notifications are supported and permitted
   */
  static isSupported(): boolean {
    return "Notification" in window;
  }

  /**
   * Get current permission status
   */
  static getPermission(): NotificationPermission {
    if (!("Notification" in window)) {
      return "denied";
    }
    return Notification.permission;
  }
}

// Export singleton instance
export const notificationClient = new NotificationClient();
