/**
 * useUserPresence Hook
 *
 * Tracks whether user is actively viewing the web interface
 * Sends heartbeats to the backend to indicate active session
 */

import { useEffect, useRef, useCallback } from "react";
import { apiPost } from "../services/api";

const HEARTBEAT_INTERVAL = 5000; // 5 seconds
const INACTIVITY_TIMEOUT = 30000; // 30 seconds - user considered inactive after this

interface UseUserPresenceOptions {
  enabled?: boolean;
  onPresenceChange?: (isActive: boolean) => void;
}

export function useUserPresence(options: UseUserPresenceOptions = {}) {
  const { enabled = true, onPresenceChange } = options;
  const heartbeatIntervalRef = useRef<number | null>(null);
  const inactivityTimeoutRef = useRef<number | null>(null);
  const isActiveRef = useRef(true);

  const sendHeartbeat = useCallback(async () => {
    if (!enabled) return;

    try {
      await apiPost("/user/presence/heartbeat", {
        timestamp: new Date().toISOString(),
        isFocused: document.hasFocus(),
      });
    } catch (error) {
      console.error("[useUserPresence] Failed to send heartbeat:", error);
    }
  }, [enabled]);

  const handleActivity = useCallback(() => {
    // Clear existing inactivity timeout
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    // User is active
    if (!isActiveRef.current) {
      isActiveRef.current = true;
      onPresenceChange?.(true);
    }

    // Set new inactivity timeout
    inactivityTimeoutRef.current = window.setTimeout(() => {
      if (isActiveRef.current) {
        isActiveRef.current = false;
        onPresenceChange?.(false);
      }
    }, INACTIVITY_TIMEOUT);
  }, [onPresenceChange]);

  useEffect(() => {
    if (!enabled) return;

    // Send initial heartbeat
    sendHeartbeat();

    // Set up heartbeat interval
    heartbeatIntervalRef.current = window.setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL,
    );

    // Track user activity
    const activityEvents = [
      "mousedown",
      "keydown",
      "touchstart",
      "click",
      "scroll",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, true);
    });

    // Track focus/blur
    window.addEventListener("focus", () => {
      isActiveRef.current = true;
      onPresenceChange?.(true);
      sendHeartbeat();
    });

    window.addEventListener("blur", () => {
      isActiveRef.current = false;
      onPresenceChange?.(false);
    });

    // Initial activity detection
    handleActivity();

    return () => {
      // Clean up
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }

      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity, true);
      });
    };
  }, [enabled, sendHeartbeat, handleActivity]);

  return {
    isActive: isActiveRef.current,
    sendHeartbeat,
  };
}
