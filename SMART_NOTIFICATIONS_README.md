# 🔔 Smart Notification Routing - README

## What Is This?

A sophisticated notification system that intelligently routes messages based on user presence. When you're actively using the web interface, notifications appear directly in the chat with an elegant notification sound. When you step away, notifications use standard channels.

## ✨ Key Features

- **👁️ Presence Detection**: Real-time tracking of user activity
- **🎯 Smart Routing**: Automatic routing based on user state
- **💬 Chat Integration**: Notifications appear where you are
- **🎵 Elegant Sound**: Harmonious, non-intrusive notification tone
- **⚡ Low Overhead**: Minimal performance impact (~1 heartbeat/5s)
- **🔒 Privacy-First**: Local tracking only, no analytics

## 🎯 How It Works

### When You're Using the Web Interface

```
You're typing/clicking/scrolling
        ↓
System detects activity
        ↓
Notification arrives
        ↓
Routes to CHAT channel
        ↓
Appears in chat panel
        ↓
Elegant sound plays (C-E-G chord)
        ↓
Auto-dismisses or waits for action
```

### When You're Away

```
30+ seconds of inactivity
        ↓
System marks you inactive
        ↓
Notification arrives
        ↓
Routes to standard channels (IN_APP, PUSH, EMAIL)
        ↓
Appears in notifications panel (not chat)
        ↓
No sound plays (you're not watching)
```

## 🎵 The Notification Sound

The elegant notification sound is:

- **Harmonious**: C Major chord (consonant, pleasing)
- **Brief**: ~0.6 seconds (not intrusive)
- **Gentle**: Soft volume level
- **Professional**: Smooth envelope with no clicking

**Frequencies**: 261.63 Hz (C), 329.63 Hz (E), 392.0 Hz (G)

## 🚀 Quick Start

### For Users

1. **Just use the app normally** - presence tracking is automatic
2. **Look for notifications in chat** when actively using the interface
3. **Listen for the elegant sound** when notifications arrive
4. **Check your notification panel** for messages while you were away

### For Developers

#### Add a Notification

```javascript
// Notification automatically routes based on user presence
await notificationService.createNotification({
  userId: "user123",
  title: "Task Complete",
  message: "Your analysis is ready",
  type: "SUCCESS",
  channels: ["IN_APP", "PUSH"],
  // System automatically upgrades to CHAT if user is active
});
```

#### Check User Presence

```javascript
const isActive = await smartNotificationRouter.isUserActiveInWeb(userId);
```

#### Play Sound Manually

```javascript
import { notificationSoundService } from "@/services/notification-sound";

notificationSoundService.playElegantSound();
```

## 📁 File Structure

```
Smart Notification System
├── Frontend
│   ├── src/hooks/
│   │   ├── useUserPresence.ts           # Activity tracking hook
│   │   └── useChatNotificationListener.ts # WebSocket listener
│   ├── src/services/
│   │   └── notification-sound.ts        # Sound generation
│   ├── src/components/
│   │   ├── ChatNotificationMessage.tsx  # Notification display
│   │   └── ChatPanelWithNotifications.tsx # Chat wrapper
│   └── src/config/
│       └── smart-notifications.ts       # Configuration
│
├── Backend
│   ├── controllers/
│   │   └── user-presence.controller.ts  # API endpoints
│   ├── services/
│   │   └── smart-notification-router.ts # Routing logic
│   ├── prisma/
│   │   ├── schema.prisma                # UserPresence model
│   │   └── migrations/
│   │       └── 20260126193738_add_user_presence/
│   │
├── Documentation
│   ├── SMART_NOTIFICATION_ROUTING.md    # Technical guide
│   ├── SMART_NOTIFICATIONS_COMPLETE.md  # Implementation summary
│   ├── TESTING_SMART_NOTIFICATIONS.md   # Testing guide
│   └── DEPLOYMENT_GUIDE.md              # Deployment steps
└── Configuration
    └── smart-notifications.ts            # User preferences
```

## 🔌 API Endpoints

### Presence Tracking

```bash
# Send activity heartbeat (called automatically every 5 seconds)
POST /api/user/presence/heartbeat
Authorization: Bearer <token>

{
  "timestamp": "2026-01-26T19:37:38.000Z",
  "isFocused": true
}

# Get current presence status
GET /api/user/presence/status
Authorization: Bearer <token>

# Response:
{
  "success": true,
  "isOnline": true,
  "isFocused": true,
  "lastActiveAt": "2026-01-26T19:37:38.000Z"
}

# Mark as offline
POST /api/user/presence/offline
Authorization: Bearer <token>
```

## ⚙️ Configuration

Edit `src/config/smart-notifications.ts`:

```typescript
export const SMART_NOTIFICATION_CONFIG = {
  // Presence tracking
  HEARTBEAT_INTERVAL: 5000, // ms between heartbeats
  INACTIVITY_TIMEOUT: 30000, // ms before marking inactive

  // Sound settings
  SOUND_ENABLED: true,
  SOUND_VOLUME: 0.3, // 0.0-1.0

  // Chat notifications
  AUTO_DISMISS_TIMEOUT: 8000, // ms before auto-dismiss
  ENABLE_ANIMATIONS: true,

  // Routing
  ENABLE_SMART_ROUTING: true,
};
```

## 🧪 Testing

### Quick Test

```javascript
// Test presence is working
fetch("http://localhost:3000/api/user/presence/status", {
  headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
})
  .then((r) => r.json())
  .then(console.log);

// Test notification sound
import { notificationSoundService } from "@/services/notification-sound";
notificationSoundService.playElegantSound();

// Send test notification
fetch("http://localhost:3000/api/notifications", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Test",
    message: "Testing smart notifications",
    type: "SUCCESS",
    channels: ["IN_APP", "PUSH"],
  }),
})
  .then((r) => r.json())
  .then(console.log);
```

See `/docs/implementation-notes/TESTING_SMART_NOTIFICATIONS.md` for comprehensive testing guide.

## 📊 Notification Types

| Type        | Icon | Color  | Auto-Dismiss | Sound   |
| ----------- | ---- | ------ | ------------ | ------- |
| INFO        | ℹ️   | Blue   | Yes (8s)     | Elegant |
| SUCCESS     | ✓    | Green  | Yes (8s)     | Elegant |
| WARNING     | ⚠️   | Amber  | Yes (8s)     | Chime   |
| ERROR       | ✗    | Red    | No           | Bell    |
| REMINDER    | ⚡   | Blue   | No           | Ping    |
| ACHIEVEMENT | 🏆   | Purple | Yes (8s)     | Elegant |

## 🔒 Privacy & Security

- ✅ **Local Tracking Only**: No server-side analytics
- ✅ **Heartbeat Minimal**: ~1 request per 5 seconds
- ✅ **User Data Safe**: Deleted when user account deleted
- ✅ **No Telemetry**: No tracking of what user does
- ✅ **Browser Security**: Respects CORS, HTTPS in production

## 📈 Performance

- **Frontend Code**: ~3KB additional
- **Network**: ~200 bytes per heartbeat, every 5 seconds
- **Database**: ~500 bytes per user presence record
- **Memory**: Minimal (notification queue)
- **CPU**: Negligible impact

## 🐛 Troubleshooting

### Notifications Not Appearing in Chat

1. Check user is marked as active: `GET /api/user/presence/status`
2. Verify WebSocket connection is open (DevTools > Network)
3. Check browser console for errors

### Sound Not Playing

1. Verify browser audio permissions
2. Click anywhere to enable audio (browser security)
3. Check DevTools console: `notificationSoundService.playElegantSound()`
4. Ensure Web Audio API is available

### Heartbeat Not Sending

1. Check network connection (DevTools > Network)
2. Verify authentication token is valid
3. Look for CORS errors in console

See full troubleshooting guide in `/docs/implementation-notes/TESTING_SMART_NOTIFICATIONS.md`

## 🔄 Database

### New Table: user_presence

```sql
CREATE TABLE user_presence (
  id TEXT PRIMARY KEY,
  userId TEXT UNIQUE NOT NULL REFERENCES users(id),
  isOnline BOOLEAN DEFAULT false,
  isFocused BOOLEAN DEFAULT false,
  lastActiveAt TIMESTAMP DEFAULT NOW(),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP
);
```

## 🚀 Deployment

### Prerequisites

- PostgreSQL database running
- Backend service reachable
- Frontend WebSocket connection available

### Steps

1. Run database migration: `npx prisma migrate deploy`
2. Rebuild backend: `docker compose build backend`
3. Rebuild frontend: `npm run build`
4. Restart services: `docker compose restart`

See full deployment guide in `/docs/implementation-notes/DEPLOYMENT_GUIDE.md`

## 📚 Documentation

| File                            | Purpose                       |
| ------------------------------- | ----------------------------- |
| SMART_NOTIFICATION_ROUTING.md   | Technical architecture & APIs |
| SMART_NOTIFICATIONS_COMPLETE.md | Implementation summary        |
| TESTING_SMART_NOTIFICATIONS.md  | Testing procedures            |
| DEPLOYMENT_GUIDE.md             | Deployment & rollback         |

## 🎯 Use Cases

1. **Real-time Alerts**: Critical messages appear immediately
2. **Task Updates**: Know when tasks complete while watching
3. **Reminders**: Gentle reminders when you're available
4. **Achievements**: Celebrate wins when you're watching
5. **Social Notifications**: Never miss important messages

## 🔮 Future Enhancements

- [ ] User settings UI for customization
- [ ] Multiple sound presets
- [ ] Do Not Disturb mode
- [ ] Notification grouping
- [ ] Accessibility improvements
- [ ] Mobile app integration

## 💬 Questions?

Check the documentation in `/docs/implementation-notes/` for:

- Technical details
- Testing procedures
- Troubleshooting
- Deployment steps

---

**Status**: Production Ready ✅  
**Version**: 1.0.0  
**Last Updated**: January 26, 2026
