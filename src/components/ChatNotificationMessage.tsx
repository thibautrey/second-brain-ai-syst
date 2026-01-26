/**
 * ChatNotificationHandler Component
 *
 * Handles notifications in the chat interface when user is actively viewing
 * Integrates notifications seamlessly into the chat experience
 */

import React, { useEffect, useRef } from "react";
import {
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Zap,
  Trophy,
} from "lucide-react";
import { notificationSoundService } from "../services/notification-sound";
import { cn } from "../lib/utils";

export interface ChatNotification {
  id: string;
  title: string;
  message: string;
  notificationType:
    | "INFO"
    | "SUCCESS"
    | "WARNING"
    | "ERROR"
    | "REMINDER"
    | "ACHIEVEMENT";
  sourceType?: string;
  sourceId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

interface ChatNotificationHandlerProps {
  notification: ChatNotification;
  onDismiss?: (id: string) => void;
  playSound?: boolean;
}

export function ChatNotificationMessage({
  notification,
  onDismiss,
  playSound = true,
}: ChatNotificationHandlerProps) {
  const dismissTimeoutRef = useRef<number | null>(null);
  const hasPlayedSoundRef = useRef(false);

  useEffect(() => {
    // Play elegant sound on first render
    if (playSound && !hasPlayedSoundRef.current) {
      hasPlayedSoundRef.current = true;
      notificationSoundService.playElegantSound();
    }

    // Auto-dismiss after 8 seconds for non-critical notifications
    if (
      notification.notificationType !== "ERROR" &&
      notification.notificationType !== "REMINDER"
    ) {
      dismissTimeoutRef.current = window.setTimeout(() => {
        onDismiss?.(notification.id);
      }, 8000);
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [notification.id, notification.notificationType, playSound, onDismiss]);

  const getIcon = () => {
    switch (notification.notificationType) {
      case "SUCCESS":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "WARNING":
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case "ERROR":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "REMINDER":
        return <Zap className="w-5 h-5 text-blue-600" />;
      case "ACHIEVEMENT":
        return <Trophy className="w-5 h-5 text-purple-600" />;
      default:
        return <Info className="w-5 h-5 text-slate-600" />;
    }
  };

  const getColorClasses = () => {
    switch (notification.notificationType) {
      case "SUCCESS":
        return "bg-green-50 border-green-200 text-green-900";
      case "WARNING":
        return "bg-amber-50 border-amber-200 text-amber-900";
      case "ERROR":
        return "bg-red-50 border-red-200 text-red-900";
      case "REMINDER":
        return "bg-blue-50 border-blue-200 text-blue-900";
      case "ACHIEVEMENT":
        return "bg-purple-50 border-purple-200 text-purple-900";
      default:
        return "bg-slate-50 border-slate-200 text-slate-900";
    }
  };

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-lg border animate-in fade-in slide-in-from-top-2 duration-300",
        getColorClasses(),
      )}
      role="alert"
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm mb-1">{notification.title}</h3>
        <p className="text-sm opacity-90">{notification.message}</p>

        {/* Action button if provided */}
        {notification.actionUrl && notification.actionLabel && (
          <button
            onClick={() => {
              window.location.href = notification.actionUrl!;
              onDismiss?.(notification.id);
            }}
            className={cn(
              "mt-2 text-xs font-semibold underline hover:opacity-75 transition-opacity",
              notification.notificationType === "SUCCESS" && "text-green-700",
              notification.notificationType === "WARNING" && "text-amber-700",
              notification.notificationType === "ERROR" && "text-red-700",
              notification.notificationType === "REMINDER" && "text-blue-700",
              notification.notificationType === "ACHIEVEMENT" &&
                "text-purple-700",
            )}
          >
            {notification.actionLabel}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss?.(notification.id)}
        className="flex-shrink-0 text-lg leading-none opacity-50 hover:opacity-75 transition-opacity"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

// Hook to manage chat notifications state
export function useChatNotifications() {
  const [notifications, setNotifications] = React.useState<ChatNotification[]>(
    [],
  );

  const addNotification = React.useCallback(
    (notification: ChatNotification) => {
      setNotifications((prev) => [notification, ...prev]);
    },
    [],
  );

  const removeNotification = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
  };
}
