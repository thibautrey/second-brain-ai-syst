/**
 * Training Session SSE Service
 *
 * Manages Server-Sent Events connections for training session updates.
 * Allows clients to subscribe to real-time training progress updates.
 */

import { Response } from "express";

interface TrainingUpdate {
  id: string;
  progress: number;
  currentStep: string | null;
  status: string;
  errorMessage?: string;
}

interface SSEClient {
  userId: string;
  res: Response;
}

class TrainingSSEService {
  private clients: Map<string, SSEClient[]> = new Map();

  /**
   * Add a new SSE client for a user
   */
  addClient(userId: string, res: Response): void {
    const existingClients = this.clients.get(userId) || [];
    existingClients.push({ userId, res });
    this.clients.set(userId, existingClients);

    console.log(
      `[SSE] Client connected for user ${userId}. Total clients: ${existingClients.length}`,
    );
  }

  /**
   * Remove an SSE client
   */
  removeClient(userId: string, res: Response): void {
    const existingClients = this.clients.get(userId) || [];
    const filtered = existingClients.filter((client) => client.res !== res);

    if (filtered.length === 0) {
      this.clients.delete(userId);
    } else {
      this.clients.set(userId, filtered);
    }

    console.log(
      `[SSE] Client disconnected for user ${userId}. Remaining clients: ${filtered.length}`,
    );
  }

  /**
   * Send a training update to all clients for a specific user
   */
  notifyUser(userId: string, update: TrainingUpdate): void {
    const userClients = this.clients.get(userId);

    if (!userClients || userClients.length === 0) {
      return;
    }

    const eventData = JSON.stringify(update);

    for (const client of userClients) {
      try {
        client.res.write(`data: ${eventData}\n\n`);
      } catch (error) {
        console.error(`[SSE] Error sending to client:`, error);
        // Remove broken client
        this.removeClient(userId, client.res);
      }
    }
  }

  /**
   * Notify all clients for a specific user that training sessions have been updated
   * This sends the full list of active sessions
   */
  notifySessionsUpdate(userId: string, sessions: TrainingUpdate[]): void {
    const userClients = this.clients.get(userId);

    if (!userClients || userClients.length === 0) {
      return;
    }

    const eventData = JSON.stringify({
      type: "sessions_update",
      sessions,
    });

    for (const client of userClients) {
      try {
        client.res.write(`data: ${eventData}\n\n`);
      } catch (error) {
        console.error(`[SSE] Error sending to client:`, error);
        this.removeClient(userId, client.res);
      }
    }
  }

  /**
   * Send a heartbeat to keep connections alive
   */
  sendHeartbeat(): void {
    for (const [userId, clients] of this.clients.entries()) {
      for (const client of clients) {
        try {
          client.res.write(`: heartbeat\n\n`);
        } catch (error) {
          this.removeClient(userId, client.res);
        }
      }
    }
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    let count = 0;
    for (const clients of this.clients.values()) {
      count += clients.length;
    }
    return count;
  }
}

// Singleton instance
export const trainingSSEService = new TrainingSSEService();

// Start heartbeat interval (every 30 seconds)
setInterval(() => {
  trainingSSEService.sendHeartbeat();
}, 30000);
