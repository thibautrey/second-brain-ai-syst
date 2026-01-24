/**
 * Notification Service
 *
 * Built-in tool for user notifications.
 * Supports multiple channels: in-app, email, push, webhooks.
 */

import prisma from "../prisma.js";
import { NotificationType, NotificationChannel, Prisma } from "@prisma/client";

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
   * Create and send a notification immediately
   */
  async sendNotification(userId: string, input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title: input.title,
        message: input.message,
        type: input.type ?? NotificationType.INFO,
        channels: input.channels ?? [NotificationChannel.IN_APP],
        scheduledFor: null,
        sentAt: new Date(),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        metadata: input.metadata ?? {},
      },
    });

    // Process delivery through each channel
    await this.deliverNotification(notification);

    return notification;
  }

  /**
   * Schedule a notification for future delivery
   */
  async scheduleNotification(userId: string, input: CreateNotificationInput) {
    if (!input.scheduledFor) {
      throw new Error("scheduledFor is required for scheduled notifications");
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        title: input.title,
        message: input.message,
        type: input.type ?? NotificationType.INFO,
        channels: input.channels ?? [NotificationChannel.IN_APP],
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
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.getNotification(userId, notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
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
    // @ts-ignore - Access private method
    await notificationService["sendPushover"](notification);
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
