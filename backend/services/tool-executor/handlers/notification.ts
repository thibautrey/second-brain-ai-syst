import { NotificationType } from "@prisma/client";
import { notificationService } from "../../tools/index.js";

export async function executeNotificationAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "send":
      if (!params.title) {
        throw new Error("Missing required parameter 'title' for send action");
      }
      if (!params.message) {
        throw new Error(
          "Missing required parameter 'message' for send action",
        );
      }
      return notificationService.sendNotification(userId, {
        title: params.title,
        message: params.message,
        type: params.type as NotificationType,
        channels: params.channels,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        actionUrl: params.actionUrl,
        actionLabel: params.actionLabel,
        metadata: params.metadata || {},
      });

    case "schedule":
      if (!params.title) {
        throw new Error(
          "Missing required parameter 'title' for schedule action",
        );
      }
      if (!params.message) {
        throw new Error(
          "Missing required parameter 'message' for schedule action",
        );
      }
      if (!params.scheduledFor) {
        throw new Error(
          "Missing required parameter 'scheduledFor' (ISO date string) for schedule action",
        );
      }
      return notificationService.scheduleNotification(userId, {
        title: params.title,
        message: params.message,
        type: params.type as NotificationType,
        channels: params.channels,
        scheduledFor: new Date(params.scheduledFor),
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        actionUrl: params.actionUrl,
        actionLabel: params.actionLabel,
        metadata: params.metadata || {},
      });

    case "get":
      if (!params.notificationId) {
        throw new Error(
          "Missing required parameter 'notificationId' for get action",
        );
      }
      const notification = await notificationService.getNotification(
        userId,
        params.notificationId,
      );
      if (!notification) {
        return { found: false, error: "Notification not found" };
      }
      return { found: true, notification };

    case "list":
      return notificationService.listNotifications(
        userId,
        {
          type: params.type,
          isRead: params.isRead,
          isDismissed: params.isDismissed,
          sourceType: params.sourceType,
          since: params.since ? new Date(params.since) : undefined,
        },
        {
          page: params.page || 1,
          limit: params.limit || 50,
          sortBy: params.sortBy || "createdAt",
          sortOrder: params.sortOrder || "desc",
        },
      );

    case "unread_count":
      const count = await notificationService.getUnreadCount(userId);
      return { unreadCount: count };

    case "mark_read":
      if (params.all === true) {
        return notificationService.markAllAsRead(userId);
      }
      if (!params.notificationId) {
        throw new Error(
          "Missing required parameter 'notificationId' for mark_read action (or set 'all: true' to mark all as read)",
        );
      }
      return notificationService.markAsRead(userId, params.notificationId);

    case "dismiss":
      if (!params.notificationId) {
        throw new Error(
          "Missing required parameter 'notificationId' for dismiss action",
        );
      }
      return notificationService.dismissNotification(
        userId,
        params.notificationId,
      );

    case "delete":
      if (!params.notificationId) {
        throw new Error(
          "Missing required parameter 'notificationId' for delete action",
        );
      }
        return notificationService.deleteNotification(
          userId,
          params.notificationId,
        );

    case "cancel_scheduled":
      if (!params.notificationId) {
        throw new Error(
          "Missing required parameter 'notificationId' for cancel_scheduled action",
        );
      }
      return notificationService.cancelScheduledNotification(
        userId,
        params.notificationId,
      );

    default:
      throw new Error(
        `Unknown notification action: ${action}. Valid actions are: send, schedule, get, list, unread_count, mark_read, dismiss, delete, cancel_scheduled`,
      );
  }
}

export const NOTIFICATION_TOOL_SCHEMA = {
  name: "notification",
  description:
    "Send and manage notifications to the user - immediate, scheduled, or manage existing ones. The system automatically selects the best delivery channel (Pushover for mobile if configured, otherwise browser). Use 'send' for immediate, 'schedule' for future delivery.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "send",
          "schedule",
          "get",
          "list",
          "unread_count",
          "mark_read",
          "dismiss",
          "delete",
          "cancel_scheduled",
        ],
        description:
          "'send': send immediately (requires title, message). 'schedule': send later (requires title, message, scheduledFor). 'list': show notifications. 'get': get specific notification. 'unread_count': count unread. 'mark_read': mark as read (use notificationId or all:true). 'dismiss': hide notification. 'delete': permanently remove. 'cancel_scheduled': cancel a pending scheduled notification.",
      },
      notificationId: {
        type: "string",
        description:
          "ID of the notification - REQUIRED for get, mark_read (unless all:true), dismiss, delete, cancel_scheduled. Use 'list' to find IDs.",
      },
      title: {
        type: "string",
        description:
          "Title of the notification - REQUIRED for send and schedule actions",
      },
      message: {
        type: "string",
        description:
          "Message content - REQUIRED for send and schedule actions",
      },
      type: {
        type: "string",
        enum: [
          "INFO",
          "SUCCESS",
          "WARNING",
          "ERROR",
          "REMINDER",
          "ACHIEVEMENT",
        ],
        description:
          "Type of notification (default: INFO). Affects visual styling and priority.",
      },
      scheduledFor: {
        type: "string",
        description:
          "When to send the notification - REQUIRED for 'schedule' action. Use ISO 8601 format (e.g., '2024-12-31T09:00:00Z')",
      },
      all: {
        type: "boolean",
        description:
          "For 'mark_read' action: set to true to mark ALL notifications as read instead of a specific one",
      },
      isRead: {
        type: "boolean",
        description:
          "For 'list' action: filter by read status (true=read only, false=unread only, omit for all)",
      },
      since: {
        type: "string",
        description:
          "For 'list' action: only show notifications created after this ISO date",
      },
    },
    required: ["action"],
  },
};
