/**
 * Notification WebSocket Client
 *
 * Manages WebSocket connection for real-time notifications
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

export class NotificationClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1s
  private maxReconnectDelay = 30000; // Max 30s

  private notificationCallbacks: Set<NotificationCallback> = new Set();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();

  private authToken: string | null = null;
  private isIntentionallyClosed = false;

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

    try {
      // Construct WebSocket URL with auth token
      const baseWsUrl = getNotificationWebSocketUrl();
      const wsUrl = `${baseWsUrl}?token=${encodeURIComponent(this.authToken)}`;

      console.log("[NotificationClient] Connecting to:", baseWsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error("[NotificationClient] Connection error:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log("[NotificationClient] Connected");
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
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
    console.error("[NotificationClient] WebSocket error:", error);
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log("[NotificationClient] Disconnected:", event.code, event.reason);
    this.notifyConnectionCallbacks(false);

    // Attempt reconnection unless intentionally closed
    if (!this.isIntentionallyClosed) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[NotificationClient] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff with jitter
    const jitter = Math.random() * 1000;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) + jitter,
      this.maxReconnectDelay,
    );

    console.log(
      `[NotificationClient] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
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

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

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
