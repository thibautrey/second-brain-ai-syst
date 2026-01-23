import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  notificationClient,
  NotificationClient,
} from "../services/notification-client";
import type { Notification } from "../types/tools";

export interface UseNotificationListenerReturn {
  isConnected: boolean;
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  isSupported: boolean;
}

export function useNotificationListener(
  onNotification?: (notification: Notification) => void,
): UseNotificationListenerReturn {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    NotificationClient.getPermission(),
  );

  // Register service worker on mount
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("[App] Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.error("[App] Service Worker registration failed:", error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "NOTIFICATION_READ") {
          // Handle notification read event
          console.log("[App] Notification read:", event.data.id);
        } else if (event.data.type === "NAVIGATE") {
          // Handle navigation event
          window.location.href = event.data.url;
        }
      });
    }
  }, []);

  // Connect to WebSocket when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      notificationClient.connect(token);

      // Subscribe to connection status
      const unsubscribeConnection = notificationClient.onConnectionChange(
        (connected) => {
          setIsConnected(connected);
        },
      );

      // Subscribe to notifications
      let unsubscribeNotifications: (() => void) | undefined;
      if (onNotification) {
        unsubscribeNotifications =
          notificationClient.onNotification(onNotification);
      }

      return () => {
        unsubscribeConnection();
        if (unsubscribeNotifications) {
          unsubscribeNotifications();
        }
        notificationClient.disconnect();
      };
    }
  }, [isAuthenticated, token, onNotification]);

  const requestPermission = async (): Promise<NotificationPermission> => {
    const newPermission = await NotificationClient.requestPermission();
    setPermission(newPermission);
    return newPermission;
  };

  return {
    isConnected,
    permission,
    requestPermission,
    isSupported: NotificationClient.isSupported(),
  };
}
