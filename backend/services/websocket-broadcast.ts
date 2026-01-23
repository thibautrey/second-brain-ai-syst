/**
 * WebSocket Broadcast Service
 *
 * Centralized service for broadcasting events to connected WebSocket clients.
 * Used by various services to send real-time updates to users.
 */

import { WebSocket } from "ws";

export interface BroadcastMessage {
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

class WebSocketBroadcastService {
  private userConnections: Map<string, WebSocket> = new Map();

  /**
   * Register a WebSocket connection for a user
   */
  registerConnection(userId: string, ws: WebSocket): void {
    // Close existing connection if any
    const existingConn = this.userConnections.get(userId);
    if (existingConn && existingConn.readyState === WebSocket.OPEN) {
      existingConn.close(4003, "New connection established");
    }
    this.userConnections.set(userId, ws);
  }

  /**
   * Remove a WebSocket connection for a user
   */
  removeConnection(userId: string): void {
    this.userConnections.delete(userId);
  }

  /**
   * Get connection for a user
   */
  getConnection(userId: string): WebSocket | undefined {
    return this.userConnections.get(userId);
  }

  /**
   * Check if user is connected
   */
  isConnected(userId: string): boolean {
    const ws = this.userConnections.get(userId);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send a message to a specific user
   */
  sendToUser(userId: string, message: BroadcastMessage): boolean {
    const ws = this.userConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Failed to send message to user ${userId}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Broadcast a message to all connected users
   */
  broadcastToAll(message: BroadcastMessage): void {
    for (const [userId, ws] of this.userConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to broadcast to user ${userId}:`, error);
        }
      }
    }
  }

  /**
   * Get count of active connections
   */
  getActiveConnectionCount(): number {
    let count = 0;
    for (const ws of this.userConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        count++;
      }
    }
    return count;
  }

  // ==================== Long Running Task Events ====================

  /**
   * Send task started event
   */
  sendTaskStarted(userId: string, taskId: string, taskName: string): void {
    this.sendToUser(userId, {
      type: "task:started",
      timestamp: Date.now(),
      data: { taskId, taskName },
    });
  }

  /**
   * Send task progress update
   */
  sendTaskProgress(
    userId: string,
    taskId: string,
    progress: number,
    currentStep: string | null,
    completedSteps: number,
    totalSteps: number,
  ): void {
    this.sendToUser(userId, {
      type: "task:progress",
      timestamp: Date.now(),
      data: {
        taskId,
        progress,
        currentStep,
        completedSteps,
        totalSteps,
      },
    });
  }

  /**
   * Send step completed event
   */
  sendStepCompleted(
    userId: string,
    taskId: string,
    stepName: string,
    stepOrder: number,
  ): void {
    this.sendToUser(userId, {
      type: "task:step_completed",
      timestamp: Date.now(),
      data: { taskId, stepName, stepOrder },
    });
  }

  /**
   * Send task checkpoint event
   */
  sendTaskCheckpoint(userId: string, taskId: string, summary: string): void {
    this.sendToUser(userId, {
      type: "task:checkpoint",
      timestamp: Date.now(),
      data: { taskId, summary },
    });
  }

  /**
   * Send task completed event
   */
  sendTaskCompleted(
    userId: string,
    taskId: string,
    taskName: string,
    summary: string | null,
  ): void {
    this.sendToUser(userId, {
      type: "task:completed",
      timestamp: Date.now(),
      data: { taskId, taskName, summary },
    });
  }

  /**
   * Send task failed event
   */
  sendTaskFailed(
    userId: string,
    taskId: string,
    taskName: string,
    error: string,
  ): void {
    this.sendToUser(userId, {
      type: "task:failed",
      timestamp: Date.now(),
      data: { taskId, taskName, error },
    });
  }

  /**
   * Send task paused event
   */
  sendTaskPaused(userId: string, taskId: string, taskName: string): void {
    this.sendToUser(userId, {
      type: "task:paused",
      timestamp: Date.now(),
      data: { taskId, taskName },
    });
  }

  /**
   * Send task cancelled event
   */
  sendTaskCancelled(userId: string, taskId: string, taskName: string): void {
    this.sendToUser(userId, {
      type: "task:cancelled",
      timestamp: Date.now(),
      data: { taskId, taskName },
    });
  }

  // ==================== Notification Events ====================

  /**
   * Send notification to user
   */
  sendNotification(userId: string, notification: any): void {
    this.sendToUser(userId, {
      type: "notification",
      timestamp: Date.now(),
      data: notification,
    });
  }
}

// Export singleton instance
export const wsBroadcastService = new WebSocketBroadcastService();

// Also export as websocketBroadcast for compatibility
export const websocketBroadcast = wsBroadcastService;
