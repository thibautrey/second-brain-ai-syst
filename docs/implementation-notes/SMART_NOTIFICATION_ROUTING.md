# Smart Notification Routing - Web Interface Detection

## Overview

This feature implements intelligent notification routing that detects when a user is actively viewing the web interface and sends notifications directly to the chat interface instead of using external notification channels. This creates a seamless, elegant user experience with an optimized notification sound.

## How It Works

### 1. **User Presence Tracking**

The frontend continuously tracks user activity in the web interface:

- **Heartbeat System**: Sends activity heartbeats every 5 seconds
- **Activity Detection**: Tracks mouse, keyboard, touch, and scroll events
- **Focus Detection**: Monitors window/tab focus state
- **Inactivity Timeout**: Considers user inactive after 30 seconds of no activity

### 2. **Smart Channel Routing**

When a notification is created:

1. The system checks if the user is actively viewing the web interface
2. If active → Route notification to **CHAT** channel
3. If inactive → Route to standard channels (IN_APP, PUSH, EMAIL, etc.)

### 3. **Chat Integration**

Notifications routed to CHAT appear as:

- Beautiful, styled messages in the chat panel
- With appropriate icons and colors based on notification type
- Smooth animation on appearance
- Elegant, harmonious notification sound

### 4. **Elegant Notification Sound**

When notifications arrive in chat:

- Plays a smooth, harmonious chord (C-E-G major) using Web Audio API
- Soft volume (0.3) for gentle notification
- ~0.6 second duration with smooth attack and release
- Optional gentle reverb effect

## Architecture

### Frontend Components

#### `useUserPresence` Hook

- Tracks user activity with activity event listeners
- Sends heartbeats to backend API
- Monitors focus/blur events
- Implements inactivity timeout logic

```typescript
const { isActive } = useUserPresence({
  enabled: true,
  onPresenceChange: (isActive) => {...}
});
```

#### `notificationSoundService`

- Web Audio API-based sound generation
- `playElegantSound()`: Plays full harmonious chord
- `playChime()`: Plays single note chime

```typescript
import { notificationSoundService } from "@/services/notification-sound";

notificationSoundService.playElegantSound();
```

#### `ChatNotificationMessage` Component

- Displays notifications in chat interface
- Automatically plays elegant sound
- Auto-dismisses after 8 seconds (non-critical)
- Supports action buttons and different notification types

#### `useChatNotifications` Hook

- Manages notification queue for chat display
- Handles add/remove/clear operations

### Backend Services

#### `SmartNotificationRouterService`

- Checks user presence in web interface
- Routes notifications to appropriate channels
- Determines optimal channels based on user state

```typescript
// Check if user is active
const isActive = await smartNotificationRouter.isUserActiveInWeb(userId);

// Get optimal channels
const channels = await smartNotificationRouter.getOptimalChannels(userId);

// Send to chat
await smartNotificationRouter.sendToChat(notification);
```

#### `UserPresenceController`

REST API endpoints for presence management:

- `POST /api/user/presence/heartbeat` - Record activity
- `GET /api/user/presence/status` - Get presence status
- `POST /api/user/presence/offline` - Mark as offline

#### Database Model: `UserPresence`

Tracks user presence state:

- `isOnline`: Whether user is online
- `isFocused`: Whether window/tab is focused
- `lastActiveAt`: Last activity timestamp

## Notification Type Support

Notifications display appropriately based on type:

| Type        | Icon | Color  | Auto-dismiss |
| ----------- | ---- | ------ | ------------ |
| INFO        | ℹ️   | Blue   | Yes (8s)     |
| SUCCESS     | ✓    | Green  | Yes (8s)     |
| WARNING     | ⚠️   | Amber  | Yes (8s)     |
| ERROR       | ✗    | Red    | No           |
| REMINDER    | ⚡   | Blue   | No           |
| ACHIEVEMENT | 🏆   | Purple | Yes (8s)     |

## API Endpoints

### Presence Tracking

#### Send Heartbeat

```bash
POST /api/user/presence/heartbeat
Authorization: Bearer <token>

{
  "timestamp": "2026-01-26T19:37:38.000Z",
  "isFocused": true
}
```

#### Get Presence Status

```bash
GET /api/user/presence/status
Authorization: Bearer <token>

Response:
{
  "success": true,
  "isOnline": true,
  "isFocused": true,
  "lastActiveAt": "2026-01-26T19:37:38.000Z"
}
```

#### Mark Offline

```bash
POST /api/user/presence/offline
Authorization: Bearer <token>
```

## Usage Example

### Frontend

```tsx
import { useChatNotifications } from "@/components/ChatNotificationMessage";
import { ChatNotificationMessage } from "@/components/ChatNotificationMessage";

export function ChatWithNotifications() {
  const { notifications, addNotification, removeNotification } =
    useChatNotifications();

  // Listen for notification events from WebSocket
  useEffect(() => {
    const handleChatNotification = (event) => {
      if (event.type === "chat.notification") {
        addNotification(event.data);
      }
    };

    websocket.on("message", handleChatNotification);
    return () => websocket.off("message", handleChatNotification);
  }, []);

  return (
    <div>
      {/* Notification messages */}
      {notifications.map((notif) => (
        <ChatNotificationMessage
          key={notif.id}
          notification={notif}
          onDismiss={removeNotification}
          playSound={true}
        />
      ))}

      {/* Chat content */}
      <ChatPanel />
    </div>
  );
}
```

### Backend - Sending Notifications

```typescript
import { notificationService } from "@/services/notification";

// Notification is automatically routed based on user presence
await notificationService.createNotification({
  userId: "user123",
  title: "Task Completed",
  message: "Your analysis is ready",
  type: "SUCCESS",
  channels: ["IN_APP", "PUSH"], // Original channels
  // System will check presence and route to CHAT if user is active
});
```

## Configuration

### Presence Tracking

Edit `useUserPresence` options:

```typescript
const HEARTBEAT_INTERVAL = 5000; // ms between heartbeats
const INACTIVITY_TIMEOUT = 30000; // ms before marking inactive
```

### Notification Sound

Edit `notificationSoundService`:

```typescript
masterGain.gain.value = 0.3; // Sound volume (0.0-1.0)
// Frequencies: 261.63 Hz (C), 329.63 Hz (E), 392.0 Hz (G)
```

### Auto-dismiss Duration

Edit `ChatNotificationMessage`:

```typescript
dismissTimeoutRef.current = window.setTimeout(() => {
  onDismiss?.(notification.id);
}, 8000); // 8 seconds
```

## Benefits

1. **Seamless Experience**: No context switch - notifications appear where user is
2. **Elegant Sound**: Harmonious, non-intrusive notification tone
3. **Privacy-Aware**: Only tracks local presence, no server-side tracking
4. **Performance**: Minimal battery impact with 5-second heartbeat
5. **Graceful Fallback**: Routes to standard channels when user is away
6. **Type-Aware**: Different handling for different notification types

## Future Enhancements

- [ ] Configurable notification sound via user preferences
- [ ] Custom notification animations
- [ ] Sound effects for different notification types
- [ ] Batch notifications to reduce spam
- [ ] Do Not Disturb mode integration
- [ ] Notification grouping by source
- [ ] Accessibility improvements (haptic feedback)
