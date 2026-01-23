/**
 * Notification API Service
 *
 * Client-side service for managing notifications via REST API
 */

import { apiGet, apiPost, apiPatch } from "./api";
import type { Notification } from "../types/tools";

export interface CreateNotificationParams {
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "REMINDER";
  channels?: ("IN_APP" | "PUSH" | "EMAIL" | "WEBHOOK")[];
  scheduledFor?: string;
  sourceType?: string;
  sourceId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

export interface NotificationListResponse {
  success: boolean;
  notifications: Notification[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Create a new notification
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<{ success: boolean; notification: Notification }> {
  return apiPost<{ success: boolean; notification: Notification }>(
    "/api/notifications",
    params,
  );
}

/**
 * Get user notifications
 */
export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<NotificationListResponse> {
  return apiGet<NotificationListResponse>("/api/notifications", params);
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<{ success: boolean }> {
  return apiPatch<{ success: boolean }>(
    `/api/notifications/${notificationId}/read`,
  );
}
