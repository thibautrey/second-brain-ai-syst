/**
 * ChatPanelWithNotifications Component
 *
 * Wrapper around ChatPanel that displays notifications elegantly
 * Notifications appear in the chat interface when user is active
 */

import React from "react";
import { ChatPanel } from "./ChatPanel";
import {
  ChatNotificationMessage,
  useChatNotifications,
} from "./ChatNotificationMessage";

export function ChatPanelWithNotifications() {
  const { notifications, removeNotification } = useChatNotifications();

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] gap-3">
      {/* Notification stack at the top */}
      {notifications.length > 0 && (
        <div className="px-4 pt-2 space-y-2 max-h-32 overflow-y-auto">
          {notifications.map((notification) => (
            <ChatNotificationMessage
              key={notification.id}
              notification={notification}
              onDismiss={removeNotification}
              playSound={true}
            />
          ))}
        </div>
      )}

      {/* Chat panel */}
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
    </div>
  );
}
