/**
 * Smart Notification Configuration
 *
 * Centralized configuration for smart notification routing behavior
 * Can be customized per user via settings in the future
 */

export const SMART_NOTIFICATION_CONFIG = {
  // ==================== Presence Tracking ====================

  /** Interval between presence heartbeats (milliseconds) */
  HEARTBEAT_INTERVAL: 5000,

  /** Time before user is considered inactive (milliseconds) */
  INACTIVITY_TIMEOUT: 30000,

  /** Time window to consider user "actively online" (milliseconds) */
  ACTIVE_WINDOW: 2 * 60 * 1000, // 2 minutes

  // ==================== Notification Sound ====================

  /** Enable/disable notification sounds */
  SOUND_ENABLED: true,

  /** Master volume for notification sounds (0.0 - 1.0) */
  SOUND_VOLUME: 0.3,

  /** Duration of elegant notification sound (seconds) */
  ELEGANT_SOUND_DURATION: 0.6,

  /** Frequencies for the C Major chord (Hz) */
  SOUND_FREQUENCIES: {
    C: 261.63,
    E: 329.63,
    G: 392.0,
  },

  /** Envelope configuration for smooth attack/release */
  SOUND_ENVELOPE: {
    ATTACK_TIME: 0.05, // 50ms
    RELEASE_TIME: 0.55, // 550ms
  },

  // ==================== Chat Notifications ====================

  /** Auto-dismiss timeout for non-critical notifications (milliseconds) */
  AUTO_DISMISS_TIMEOUT: 8000,

  /** Notification types that auto-dismiss */
  AUTO_DISMISS_TYPES: ["INFO", "SUCCESS", "WARNING", "ACHIEVEMENT"],

  /** Notification types that persist */
  PERSIST_TYPES: ["ERROR", "REMINDER"],

  /** Enable smooth animations for notifications */
  ENABLE_ANIMATIONS: true,

  /** Animation duration (milliseconds) */
  ANIMATION_DURATION: 300,

  // ==================== Routing Logic ====================

  /** Enable smart routing (if false, always use standard channels) */
  ENABLE_SMART_ROUTING: true,

  /** Only route to chat if user is focused on window */
  REQUIRE_FOCUS_FOR_CHAT: false,

  /** Default channels when user is inactive */
  DEFAULT_INACTIVE_CHANNELS: ["IN_APP", "PUSH"],

  /** Always include these channels regardless of presence */
  ALWAYS_INCLUDE_CHANNELS: [],

  // ==================== Fallback Behavior ====================

  /** Fallback to standard channels if WebSocket fails */
  FALLBACK_ON_WEBSOCKET_FAIL: true,

  /** Maximum retry attempts for WebSocket delivery */
  MAX_WEBSOCKET_RETRIES: 3,

  // ==================== Privacy & Performance ====================

  /** Track user activity locally (no server-side analytics) */
  LOCAL_TRACKING_ONLY: true,

  /** Maximum notifications to display in chat at once */
  MAX_CHAT_NOTIFICATIONS: 5,

  /** Clean up dismissed notifications after (milliseconds) */
  NOTIFICATION_CLEANUP_DELAY: 1000,
};

/**
 * Get notification config with optional overrides
 * Can be extended to pull from user preferences
 */
export function getNotificationConfig(
  overrides?: Partial<typeof SMART_NOTIFICATION_CONFIG>,
) {
  return {
    ...SMART_NOTIFICATION_CONFIG,
    ...overrides,
  };
}

/**
 * Sound presets for different notification types
 * Can be extended with user preferences
 */
export const SOUND_PRESETS = {
  elegant: {
    name: "Elegant Chord",
    frequencies: [261.63, 329.63, 392.0], // C, E, G
    duration: 0.6,
    volume: 0.3,
  },
  chime: {
    name: "Single Chime",
    frequencies: [523.25], // C5
    duration: 0.3,
    volume: 0.25,
  },
  bell: {
    name: "Bell",
    frequencies: [659.25, 587.33], // E5, D5
    duration: 0.5,
    volume: 0.25,
  },
  soft_ping: {
    name: "Soft Ping",
    frequencies: [440.0], // A4
    duration: 0.2,
    volume: 0.2,
  },
};

/**
 * Notification type configuration
 * Defines behavior for each notification type
 */
export const NOTIFICATION_TYPE_CONFIG = {
  INFO: {
    icon: "info-circle",
    color: "blue",
    autoDismiss: true,
    soundEnabled: true,
    soundPreset: "elegant",
  },
  SUCCESS: {
    icon: "check-circle",
    color: "green",
    autoDismiss: true,
    soundEnabled: true,
    soundPreset: "elegant",
  },
  WARNING: {
    icon: "alert-triangle",
    color: "amber",
    autoDismiss: true,
    soundEnabled: true,
    soundPreset: "chime",
  },
  ERROR: {
    icon: "alert-circle",
    color: "red",
    autoDismiss: false,
    soundEnabled: true,
    soundPreset: "bell",
  },
  REMINDER: {
    icon: "zap",
    color: "blue",
    autoDismiss: false,
    soundEnabled: true,
    soundPreset: "soft_ping",
  },
  ACHIEVEMENT: {
    icon: "trophy",
    color: "purple",
    autoDismiss: true,
    soundEnabled: true,
    soundPreset: "elegant",
  },
};
