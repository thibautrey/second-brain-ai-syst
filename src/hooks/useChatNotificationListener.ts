/**
 * useChatNotificationListener Hook
 *
 * Listens for chat notifications from the WebSocket and manages them
 * Integrates with useChatNotifications to display notifications in chat
 */

import { useEffect, useCallback } from "react";
import { useChatNotifications } from "../components/ChatNotificationMessage";

interface WebSocketNotificationEvent {
  type: "chat.notification";
  data: {
    id: string;
    title: string;
    message: string;
    notificationType: string;
    sourceType?: string;
    sourceId?: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Record<string, any>;
  };
}

export function useChatNotificationListener() {
  const { addNotification } = useChatNotifications();

  const handleNotificationMessage = useCallback(
    (event: WebSocketNotificationEvent) => {
      if (event.type === "chat.notification" && event.data) {
        addNotification({
          id: event.data.id,
          title: event.data.title,
          message: event.data.message,
          notificationType: event.data.notificationType as any,
          sourceType: event.data.sourceType,
          sourceId: event.data.sourceId,
          actionUrl: event.data.actionUrl,
          actionLabel: event.data.actionLabel,
          metadata: event.data.metadata,
        });
      }
    },
    [addNotification],
  );

  return { handleNotificationMessage };
}
