import prisma from "./prisma.js";
import { websocketBroadcast } from "./websocket-broadcast.js";
import { smartNotificationRouter } from "./smart-notification-router.js";
import type { NotificationType, NotificationChannel } from "@prisma/client";
import axios from "axios";
import { telegramService } from "./telegram.service.js";
import {
  notificationSpamDetector,
  type SpamCheckResult,
} from "./notification-spam-detector.js";

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  channels?: NotificationChannel[];
  scheduledFor?: Date;
  sourceType?: string;
  sourceId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
  skipSpamCheck?: boolean; // Allow bypassing spam check for critical notifications
}

export interface CreateNotificationResult {
  notification: any | null;
  spamCheck: SpamCheckResult;
  blocked: boolean;
}

class NotificationService {
  /**
   * Create and send a notification with spam detection
   */
  async createNotification(
    input: CreateNotificationInput,
  ): Promise<CreateNotificationResult> {
    const {
      userId,
      title,
      message,
      type = "INFO",
      channels = ["IN_APP", "PUSH"],
      scheduledFor,
      sourceType,
      sourceId,
      actionUrl,
      actionLabel,
      metadata = {},
      skipSpamCheck = false,
    } = input;

    // Spam detection check (skip for scheduled or if explicitly bypassed)
    let spamCheck: SpamCheckResult = {
      allowed: true,
      reason: "Spam check skipped",
    };

    if (!scheduledFor && !skipSpamCheck) {
      spamCheck = await notificationSpamDetector.checkNotification(
        userId,
        title,
        message,
        sourceType,
      );

      if (!spamCheck.allowed) {
        console.log(
          `[NotificationService] Notification blocked by spam detector: ${spamCheck.reason}`,
        );
        return {
          notification: null,
          spamCheck,
          blocked: true,
        };
      }
    }

    // Determine optimal channels based on user presence and configuration
    let finalChannels: NotificationChannel[] = channels;
    if (!scheduledFor) {
      const optimizedChannels =
        await smartNotificationRouter.getOptimalChannels(userId, channels);
      finalChannels = optimizedChannels;

      // Log channel selection for debugging
      if (finalChannels.includes("TELEGRAM" as any)) {
        console.log(
          `[NotificationService] Notification will be sent via Telegram (primary channel)`,
        );
      } else if (finalChannels.includes("CHAT" as any)) {
        console.log(
          `[NotificationService] User is active in web - notification routed to chat`,
        );
      } else {
        console.log(
          `[NotificationService] Using default channels: ${finalChannels.join(", ")}`,
        );
      }
    }

    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        channels: finalChannels,
        scheduledFor,
        sourceType,
        sourceId,
        actionUrl,
        actionLabel,
        metadata: {
          ...metadata,
          spamCheckTopic: spamCheck.matchedTopic,
          originalChannels: channels, // Store original channels for reference
          routedChannels: finalChannels, // Track which channels were actually used
        },
        sentAt: scheduledFor ? null : new Date(),
      },
    });

    // Send immediately if not scheduled
    if (!scheduledFor) {
      await this.sendNotification(notification.id);

      // Record the notification was sent for spam tracking
      await notificationSpamDetector.recordNotificationSent(
        userId,
        title,
        message,
        notification.id,
        sourceType,
      );
    }

    return {
      notification,
      spamCheck,
      blocked: false,
    };
  }

  /**
   * Create notification without spam check (for backward compatibility)
   * @deprecated Use createNotification with skipSpamCheck: true instead
   */
  async createNotificationUnchecked(
    input: Omit<CreateNotificationInput, "skipSpamCheck">,
  ) {
    return this.createNotification({ ...input, skipSpamCheck: true });
  }

  /**
   * Record that user interacted with a notification (resets cooldown)
   */
  async recordUserInteraction(notificationId: string): Promise<void> {
    await notificationSpamDetector.recordUserResponse("", notificationId);
  }

  /**
   * Send a notification through configured channels
   */
  async sendNotification(notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { user: true },
    });

    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    // Send through each channel
    const promises = notification.channels.map(
      (channel: NotificationChannel | string) => {
        switch (channel) {
          case "IN_APP":
            return this.sendInApp(notification);
          case "PUSH":
            return this.sendPush(notification);
          case "EMAIL":
            return this.sendEmail(notification);
          case "WEBHOOK":
            return this.sendWebhook(notification);
          case "PUSHOVER":
            return this.sendPushover(notification);
          case "TELEGRAM":
            return this.sendTelegram(notification);
          case "CHAT":
            return smartNotificationRouter.sendToChat(notification);
          default:
            return Promise.resolve();
        }
      },
    );

    await Promise.all(promises);

    // Update sentAt
    await prisma.notification.update({
      where: { id: notificationId },
      data: { sentAt: new Date() },
    });

    return notification;
  }

  /**
   * Send in-app notification via WebSocket
   */
  private async sendInApp(notification: any) {
    websocketBroadcast.sendNotification(notification.userId, {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      readAt: notification.readAt,
      sourceType: notification.sourceType,
      sourceId: notification.sourceId,
      actionUrl: notification.actionUrl,
      metadata: notification.metadata,
      createdAt: notification.createdAt.toISOString(),
    });
  }

  /**
   * Send push notification (via WebSocket for now, can be extended with FCM/APNs)
   */
  private async sendPush(notification: any) {
    // Currently uses WebSocket; can be extended with Firebase Cloud Messaging
    await this.sendInApp(notification);
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmail(notification: any) {
    // TODO: Implement email sending (e.g., via SendGrid, SES)
    console.log(
      `[NotificationService] Email notification: ${notification.title}`,
    );
  }

  /**
   * Send webhook notification (placeholder)
   */
  private async sendWebhook(notification: any) {
    // TODO: Implement webhook calls
    console.log(
      `[NotificationService] Webhook notification: ${notification.title}`,
    );
  }

  /**
   * Send Pushover notification (public method for use by notification tool)
   */
  async sendPushover(notification: any) {
    try {
      // Get user settings with Pushover credentials
      const settings = await prisma.userSettings.findUnique({
        where: { userId: notification.userId },
      });

      if (!settings?.pushoverUserKey) {
        console.log(
          `[NotificationService] Pushover user key not configured for user ${notification.userId}`,
        );
        return;
      }

      // Use user's API token or fall back to a default app token
      const apiToken =
        settings.pushoverApiToken || process.env.PUSHOVER_APP_TOKEN;

      if (!apiToken) {
        console.log(`[NotificationService] Pushover API token not configured`);
        return;
      }

      // Prepare Pushover payload (all values must be strings for URLSearchParams)
      const payload: Record<string, string> = {
        token: apiToken,
        user: settings.pushoverUserKey,
        title: notification.title,
        message: notification.message,
      };

      // Add priority based on notification type
      switch (notification.type) {
        case "ERROR":
          payload.priority = "1"; // High priority
          payload.sound = "siren";
          break;
        case "WARNING":
          payload.priority = "0"; // Normal priority
          payload.sound = "pushover";
          break;
        case "SUCCESS":
          payload.priority = "-1"; // Low priority, no sound
          payload.sound = "magic";
          break;
        default:
          payload.priority = "0";
      }

      // Add action URL if available
      if (notification.actionUrl) {
        payload.url = notification.actionUrl;
        payload.url_title = notification.actionLabel || "Open";
      }

      // Send to Pushover API
      const response = await axios.post(
        "https://api.pushover.net/1/messages.json",
        new URLSearchParams(payload).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      if (response.data.status === 1) {
        console.log(
          `[NotificationService] Pushover notification sent: ${notification.title}`,
        );
      } else {
        console.error(`[NotificationService] Pushover error:`, response.data);
      }
    } catch (error: any) {
      console.error(
        `[NotificationService] Failed to send Pushover notification:`,
        error.message,
      );
    }
  }

  /**
   * Send Telegram notification
   */
  async sendTelegram(notification: any) {
    try {
      const success = await telegramService.sendNotification(
        notification.userId,
        notification.title,
        notification.message,
        notification.actionUrl,
      );

      if (success) {
        console.log(
          `[NotificationService] Telegram notification sent: ${notification.title}`,
        );
      }
    } catch (error: any) {
      console.error(
        `[NotificationService] Failed to send Telegram notification:`,
        error.message,
      );
    }
  }

  /**
   * Mark notification as read and record user interaction (resets spam cooldown)
   */
  async markAsRead(notificationId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Record user interaction to reset cooldown for this topic
    if (result.count > 0) {
      await notificationSpamDetector.recordUserResponse(userId, notificationId);
    }

    return result;
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {},
  ) {
    const { limit = 50, offset = 0, unreadOnly = false } = options;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      total,
      limit,
      offset,
    };
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications() {
    const now = new Date();

    const scheduled = await prisma.notification.findMany({
      where: {
        scheduledFor: {
          lte: now,
        },
        sentAt: null,
      },
    });

    for (const notification of scheduled) {
      try {
        await this.sendNotification(notification.id);
      } catch (error) {
        console.error(
          `Failed to send scheduled notification ${notification.id}:`,
          error,
        );
      }
    }

    return scheduled.length;
  }
}

export const notificationService = new NotificationService();
