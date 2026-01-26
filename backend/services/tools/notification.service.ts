/**
 * Notification Service
 *
 * Built-in tool for user notifications.
 * Supports multiple channels: in-app, email, push, webhooks.
 * Includes spam detection with exponential backoff.
 */

import prisma from "../prisma.js";
import { NotificationType, NotificationChannel, Prisma } from "@prisma/client";
import { notificationSpamDetector, type SpamCheckResult } from "../notification-spam-detector.js";

// ==================== Types ====================

export interface CreateNotificationInput {
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

export interface SendNotificationResult {
  notification: any | null;
  spamCheck: SpamCheckResult;
  blocked: boolean;
}

export interface NotificationFilters {
  type?: NotificationType | NotificationType[];
  isRead?: boolean;
  isDismissed?: boolean;
  sourceType?: string;
  since?: Date;
}

export interface NotificationListOptions {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "scheduledFor";
  sortOrder?: "asc" | "desc";
}

// ==================== Service ====================

export class NotificationService {
  /**
   * Automatically configure notification channels based on user settings.
   * If Pushover is configured, it replaces browser PUSH notifications with PUSHOVER
   * and ensures PUSHOVER is included in the channels list (unless explicitly empty).
   * 
   * Note: This method performs a database query to check user settings.
   * For high-volume scenarios, consider implementing caching of user settings.
   */
  private async configureChannels(
    userId: string,
    channels?: NotificationChannel[],
  ): Promise<NotificationChannel[]> {
    // Get user settings to check if Pushover is configured
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { pushoverUserKey: true },
    });

    // If channels were explicitly provided (even if empty), use them as base
    // If not provided (undefined), default to IN_APP
    let configuredChannels =
      channels !== undefined ? [...channels] : [NotificationChannel.IN_APP];

    // Only apply Pushover routing if user has it configured AND channels is not explicitly empty
    if (
      userSettings?.pushoverUserKey &&
      userSettings.pushoverUserKey.trim() !== "" &&
      configuredChannels.length > 0
    ) {
      // Replace PUSH channel with PUSHOVER for better mobile notifications
      configuredChannels = configuredChannels.map((channel) =>
        channel === NotificationChannel.PUSH
          ? NotificationChannel.PUSHOVER
          : channel,
      );

      // Auto-add PUSHOVER if not already included
      // This ensures Pushover is always used when configured, unless user explicitly chose no channels
      if (!configuredChannels.includes(NotificationChannel.PUSHOVER)) {
        configuredChannels.push(NotificationChannel.PUSHOVER);
      }
    }

    return configuredChannels;
  }

  /**
   * Create and send a notification immediately with spam detection
   */
  async sendNotification(userId: string, input: CreateNotificationInput): Promise<SendNotificationResult> {
    // Spam detection check (skip if explicitly bypassed)
    let spamCheck: SpamCheckResult = { allowed: true, reason: "Spam check skipped" };
    
    if (!input.skipSpamCheck) {
      spamCheck = await notificationSpamDetector.checkNotification(
        userId,
        input.title,
        input.message,
        input.sourceType
      );

      if (!spamCheck.allowed) {
        console.log(
          `[NotificationToolService] Notification blocked by spam detector: ${spamCheck.reason}`
        );
        return {
          notification: null,
          spamCheck,
          blocked: true,
        };
      }
    }

    // Automatically configure channels based on user settings
    const channels = await this.configureChannels(userId, input.channels);

    const notification = await prisma.notification.create({
      data: {
        userId,
        title: input.title,
        message: input.message,
        type: input.type ?? NotificationType.INFO,
        channels,
        scheduledFor: null,
        sentAt: new Date(),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        metadata: {
          ...(input.metadata ?? {}),
          spamCheckTopic: spamCheck.matchedTopic,
        },
      },
    });

    // Process delivery through each channel
    await this.deliverNotification(notification);

    // Record the notification was sent for spam tracking
    await notificationSpamDetector.recordNotificationSent(
      userId,
      input.title,
      input.message,
      notification.id,
      input.sourceType
    );

    return {
      notification,
      spamCheck,
      blocked: false,
    };
  }

  /**
   * Send notification without spam check (for backward compatibility)
   * @deprecated Use sendNotification with skipSpamCheck: true instead
   */
  async sendNotificationUnchecked(userId: string, input: Omit<CreateNotificationInput, 'skipSpamCheck'>) {
    return this.sendNotification(userId, { ...input, skipSpamCheck: true });
  }

  /**
   * Schedule a notification for future delivery
   */
  async scheduleNotification(userId: string, input: CreateNotificationInput) {
    if (!input.scheduledFor) {
      throw new Error("scheduledFor is required for scheduled notifications");
    }

    // Automatically configure channels based on user settings
    const channels = await this.configureChannels(userId, input.channels);

    const notification = await prisma.notification.create({
      data: {
        userId,
        title: input.title,
        message: input.message,
        type: input.type ?? NotificationType.INFO,
        channels,
        scheduledFor: input.scheduledFor,
        sentAt: null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        metadata: input.metadata ?? {},
      },
    });

    return notification;
  }

  /**
   * Get a notification by ID
   */
  async getNotification(userId: string, notificationId: string) {
    return prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });
  }

  /**
   * List notifications with filters
   */
  async listNotifications(
    userId: string,
    filters: NotificationFilters = {},
    options: NotificationListOptions = {},
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const where: Prisma.NotificationWhereInput = {
      userId,
      sentAt: { not: null }, // Only show sent notifications
    };

    if (filters.type) {
      where.type = Array.isArray(filters.type)
        ? { in: filters.type }
        : filters.type;
    }

    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    if (filters.isDismissed !== undefined) {
      where.isDismissed = filters.isDismissed;
    }

    if (filters.sourceType) {
      where.sourceType = filters.sourceType;
    }

    if (filters.since) {
      where.createdAt = { gte: filters.since };
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
        isDismissed: false,
        sentAt: { not: null },
      },
    });
  }

  /**
   * Mark notification as read and record user interaction (resets spam cooldown)
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.getNotification(userId, notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    const result = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Record user interaction to reset cooldown for this topic
    await notificationSpamDetector.recordUserResponse(userId, notificationId);

    return result;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        sentAt: { not: null },
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * Dismiss a notification
   */
  async dismissNotification(userId: string, notificationId: string) {
    const notification = await this.getNotification(userId, notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isDismissed: true,
      },
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.getNotification(userId, notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true };
  }

  /**
   * Clear all dismissed notifications
   */
  async clearDismissed(userId: string) {
    await prisma.notification.deleteMany({
      where: {
        userId,
        isDismissed: true,
      },
    });

    return { success: true };
  }

  /**
   * Get pending scheduled notifications
   */
  async getPendingScheduled(userId?: string) {
    const now = new Date();

    return prisma.notification.findMany({
      where: {
        ...(userId ? { userId } : {}),
        scheduledFor: { lte: now },
        sentAt: null,
      },
      orderBy: { scheduledFor: "asc" },
    });
  }

  /**
   * Process and send scheduled notifications
   * Called by the scheduler service
   */
  async processScheduledNotifications() {
    const pending = await this.getPendingScheduled();

    const results = [];
    for (const notification of pending) {
      try {
        await this.deliverNotification(notification);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { sentAt: new Date() },
        });
        results.push({ id: notification.id, success: true });
      } catch (error: any) {
        results.push({
          id: notification.id,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(userId: string, notificationId: string) {
    const notification = await this.getNotification(userId, notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.sentAt) {
      throw new Error("Cannot cancel already sent notification");
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true };
  }

  // ==================== Private Methods ====================

  /**
   * Deliver notification through configured channels
   */
  private async deliverNotification(notification: any) {
    const channels = notification.channels as NotificationChannel[];

    for (const channel of channels) {
      try {
        switch (channel) {
          case NotificationChannel.IN_APP:
            // In-app notifications are stored in DB, no additional delivery needed
            break;

          case NotificationChannel.EMAIL:
            await this.sendEmailNotification(notification);
            break;

          case NotificationChannel.PUSH:
            await this.sendPushNotification(notification);
            break;

          case NotificationChannel.WEBHOOK:
            await this.sendWebhookNotification(notification);
            break;

          case NotificationChannel.PUSHOVER:
            await this.sendPushoverNotification(notification);
            break;
        }
      } catch (error) {
        console.error(`Failed to deliver notification via ${channel}:`, error);
      }
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: any) {
    // TODO: Implement email delivery
    // Could use nodemailer, sendgrid, etc.
    console.log(`[EMAIL] Would send: ${notification.title}`);
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: any) {
    // TODO: Implement push notification
    // Could use web-push, firebase, etc.
    console.log(`[PUSH] Would send: ${notification.title}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(notification: any) {
    // TODO: Implement webhook delivery
    // Would POST to configured webhook URL
    console.log(`[WEBHOOK] Would send: ${notification.title}`);
  }

  /**
   * Send Pushover notification
   */
  private async sendPushoverNotification(notification: any) {
    // Import notification service to leverage existing Pushover implementation
    const { notificationService } = await import("../notification.js");
    await notificationService.sendPushover(notification);
  }

  // ==================== Helper Notifications ====================

  /**
   * Send a success notification
   */
  async notifySuccess(userId: string, title: string, message: string) {
    return this.sendNotification(userId, {
      title,
      message,
      type: NotificationType.SUCCESS,
    });
  }

  /**
   * Send a warning notification
   */
  async notifyWarning(userId: string, title: string, message: string) {
    return this.sendNotification(userId, {
      title,
      message,
      type: NotificationType.WARNING,
    });
  }

  /**
   * Send an error notification
   */
  async notifyError(userId: string, title: string, message: string) {
    return this.sendNotification(userId, {
      title,
      message,
      type: NotificationType.ERROR,
    });
  }

  /**
   * Send a reminder notification
   */
  async notifyReminder(userId: string, title: string, message: string) {
    return this.sendNotification(userId, {
      title,
      message,
      type: NotificationType.REMINDER,
    });
  }

  /**
   * Send an achievement notification
   */
  async notifyAchievement(userId: string, title: string, message: string) {
    return this.sendNotification(userId, {
      title,
      message,
      type: NotificationType.ACHIEVEMENT,
    });
  }
}

export const notificationService = new NotificationService();
