import prisma from "./prisma.js";
import { websocketBroadcast } from "./websocket-broadcast.js";
import { NotificationChannel } from "@prisma/client";

/**
 * Smart Notification Router Service
 *
 * Determines where notifications should be routed based on user presence
 * If user is active in web interface: route to chat
 * Otherwise: use standard channels
 */

class SmartNotificationRouterService {
  /**
   * Check if user is currently active in web interface
   */
  async isUserActiveInWeb(userId: string): Promise<boolean> {
    try {
      const presence = await prisma.userPresence.findUnique({
        where: { userId },
      });

      if (!presence) {
        return false;
      }

      // Consider user active if they were active in the last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const isRecentlyActive = presence.lastActiveAt > twoMinutesAgo;

      return presence.isOnline && isRecentlyActive;
    } catch (error) {
      console.error(
        "[SmartNotificationRouter] Error checking user presence:",
        error,
      );
      return false;
    }
  }

  /**
   * Route notification based on user presence
   * If active in web: return 'CHAT'
   * Otherwise: return original channels
   */
  async getOptimalChannels(
    userId: string,
    preferredChannels: NotificationChannel[] = [NotificationChannel.IN_APP, NotificationChannel.PUSH],
  ): Promise<NotificationChannel[]> {
    const isActive = await this.isUserActiveInWeb(userId);

    if (isActive) {
      // User is actively viewing web interface - use chat channel
      return [NotificationChannel.CHAT];
    }

    // User is not active in web - use standard channels
    return preferredChannels;
  }

  /**
   * Send notification to chat as a system message
   * This integrates the notification into the chat interface
   */
  async sendToChat(notification: any) {
    try {
      // Create a system chat message from the notification
      const chatMessage = {
        type: "notification",
        timestamp: new Date().toISOString(),
        data: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          notificationType: notification.type,
          sourceType: notification.sourceType,
          sourceId: notification.sourceId,
          actionUrl: notification.actionUrl,
          actionLabel: notification.actionLabel,
          metadata: notification.metadata,
        },
      };

      // Broadcast to user via WebSocket with CHAT channel
      websocketBroadcast.sendToUser(notification.userId, {
        type: "chat.notification",
        timestamp: Date.now(),
        data: chatMessage,
      });

      console.log(
        `[SmartNotificationRouter] Sent notification ${notification.id} to chat for user ${notification.userId}`,
      );
    } catch (error) {
      console.error("[SmartNotificationRouter] Error sending to chat:", error);
      throw error;
    }
  }

  /**
   * Check if notification should use elegant sound
   * Returns true if notification is being sent to chat (user is active)
   */
  async shouldPlayElegantSound(userId: string): Promise<boolean> {
    return this.isUserActiveInWeb(userId);
  }
}

export const smartNotificationRouter = new SmartNotificationRouterService();
