# Telegram as Primary Notification Channel Implementation

## Summary

When a user successfully configures Telegram, it becomes the primary (and default) notification channel, automatically replacing other notification methods.

## Changes Made

### 1. **Smart Notification Router Enhancement** (`backend/services/smart-notification-router.ts`)

Added `isTelegramConfigured()` method that checks:

- Bot token is set
- Chat ID is set (user has sent `/start` command)
- Telegram notifications are enabled

Updated `getOptimalChannels()` with priority routing:

1. **Telegram configured** → Use TELEGRAM channel (primary)
2. **User active in web** → Use CHAT channel
3. **Default** → Use preferred channels (IN_APP, PUSH)

### 2. **Routing Logic Flow**

```
User sends notification
    ↓
[getOptimalChannels] checks:
    ├─ Is Telegram configured? → Use TELEGRAM
    └─ Is user active in web? → Use CHAT
    └─ Default → Use IN_APP/PUSH
    ↓
[sendNotification] routes to selected channel
    ↓
Message reaches user
```

## How Telegram Configuration Works

### Setup Process

1. User adds bot token in settings
2. User sends `/start` to the bot
3. Telegram service records chat ID in `userSettings.telegramChatId`
4. `telegramEnabled` is set to `true`

### Telegram State

- **Not Configured**: No token or no chat ID
- **Configured**: Token + Chat ID + Enabled = true
- **Disabled**: Token present but `telegramEnabled` = false

### Automatic Behavior

- When Telegram is configured, **all notifications automatically go to Telegram**
- User no longer receives web notifications (browser/push)
- If user sends `/stop` command, `telegramEnabled` becomes false and routing reverts to default channels

## Code Examples

### Check if Telegram is Primary Channel

```typescript
const hasTelegram = await smartNotificationRouter.isTelegramConfigured(userId);
// Returns true only if fully configured and enabled
```

### Send Notification (Automatic Routing)

```typescript
await notificationService.createNotification({
  userId: "user123",
  title: "New Memory",
  message: "Your memory has been saved",
  // Don't need to specify channels - router will auto-select TELEGRAM if configured
});
```

## User Perspective

### Before Telegram Setup

- Gets notifications via browser (IN_APP)
- Can configure Pushover for mobile

### After Telegram Setup

- All notifications go to Telegram bot
- Can manage notifications via bot commands:
  - `/start` - Enable notifications
  - `/stop` - Disable notifications
  - `/status` - Check connection status

## Advantages

✅ **Unified Channel**: Single source for all notifications  
✅ **Always On**: Works even if web interface is closed  
✅ **No Browser Dependency**: Independent of browser permissions  
✅ **Bidirectional**: Can also receive commands via Telegram  
✅ **User Control**: Easy enable/disable via `/stop` and `/start`

## Testing

To verify Telegram is being used as primary:

1. Configure Telegram in settings
2. Send test notification via: `POST /api/settings/telegram/test`
3. Check logs for: `"Using Telegram as primary channel for user [userId]"`
4. Verify notification appears in Telegram bot

## Related Files

- `/backend/services/smart-notification-router.ts` - Primary routing logic
- `/backend/services/notification.ts` - Notification creation and dispatch
- `/backend/services/telegram.service.ts` - Telegram integration
- `/backend/services/api-server.ts` - API endpoints for Telegram setup

## Database Schema

Relevant fields in `userSettings`:

- `telegramBotToken` - Bot token from @BotFather
- `telegramChatId` - Chat ID (set after /start)
- `telegramEnabled` - Enable/disable flag

## Notes

- Telegram must be **fully configured** (token + chat ID + enabled) to become primary
- If user sends `/stop`, notifications revert to default channels
- To reconfigure, user needs to send `/start` again to the bot
- The routing happens automatically - no manual channel selection needed
