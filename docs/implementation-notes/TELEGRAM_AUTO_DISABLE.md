# Telegram Bot Auto-Disable Implementation

## Problem

The Telegram bot service was repeatedly retrying with "Unauthorized" errors when the bot token became invalid, spamming the logs and continuing to fail indefinitely. Users had no way to know about the failure or re-enable the service.

## Solution

Implemented an automatic disable mechanism that:

1. **Detects Authorization Errors**: Catches "Unauthorized" (401) responses from Telegram API
2. **Stops Polling**: Immediately stops the polling loop instead of retrying infinitely
3. **Disables Service**: Automatically disables Telegram for the user in the database
4. **Notifies User**: Sends an in-app notification alerting the user about the disconnection
5. **Allows Re-enablement**: Users can re-enable via the UI with a toggle button

## Changes Made

### Backend: `backend/services/telegram.service.ts`

#### 1. Modified `getUpdates()` Method

- Changed return type to `TelegramUpdate[] | { error: string; code?: number }`
- Now returns error objects instead of silent failures
- Detects and returns 401 (Unauthorized) responses specifically

```typescript
// Check for authorization errors
if (error.response?.status === 401) {
  return {
    error: "Unauthorized",
    code: 401,
  };
}
```

#### 2. Added `disableTelegramForUser()` Method

New private method that:

- Disables Telegram in user settings
- Logs the reason for disabling
- Sends an in-app notification to the user via `notificationService`

```typescript
private async disableTelegramForUser(
  userId: string,
  reason: string,
): Promise<void>
```

#### 3. Enhanced `pollLoop()` Method

Added error tracking and auto-disable logic:

- Tracks consecutive errors (max 3 before disabling)
- Distinguishes between authorization errors and transient errors
- For 401 errors: immediately disables and stops polling
- For other errors: retries up to 3 times, then disables
- Resets error counter on successful updates

### Frontend: `src/components/NotificationSettings.tsx`

#### 1. Added Icons Import

- Added `ToggleLeft` and `ToggleRight` icons from lucide-react

#### 2. Added Toggle State

- New state: `isTogglingTelegram` to track toggle operation

#### 3. Added `handleToggleTelegram()` Handler

New function that:

- Calls the existing `/settings/telegram` PUT endpoint with `telegramEnabled` flag
- Updates the UI state on success
- Shows error alert on failure

#### 4. Enhanced Status Display

- Added toggle button next to status indicator
- Button shows spinner while toggling
- Icon changes based on enabled/disabled state (green when enabled, gray when disabled)
- Users can now toggle without reconfiguring the entire bot

## User Experience

### When Telegram Becomes Unauthorized

1. Backend detects the authorization error
2. Service is automatically disabled
3. User receives in-app notification: **"🔌 Telegram Bot Disconnected"**
   - Message: "Your Telegram bot has been disconnected due to: Authorization failed - invalid bot token. To reconnect, please go to your settings and re-enter your bot token."
4. Polling stops immediately (no more spam logs)

### Re-enabling Telegram

Users have two options:

**Option 1: Toggle the existing bot** (if token is still valid)

- Go to Notification Settings
- Click the toggle button next to the status
- Bot will start polling again

**Option 2: Reconfigure the bot**

- Go to Notification Settings
- Disconnect the current bot
- Enter a new bot token
- Complete the `/start` command setup again

## Error Handling

The implementation handles these scenarios:

| Error Code         | Behavior                             |
| ------------------ | ------------------------------------ |
| 401 (Unauthorized) | Immediately disable and stop polling |
| Network errors     | Retry up to 3 times, then disable    |
| Timeout errors     | Ignored (expected with long polling) |
| Other errors       | Retry up to 3 times, then disable    |

## Notifications

When Telegram is auto-disabled, the user receives:

- **Channel**: IN_APP (browser notification)
- **Type**: WARNING
- **Skip Spam Check**: Yes (marked as critical)
- **Title**: 🔌 Telegram Bot Disconnected
- **Message**: Includes the reason for disconnection

## Database Schema Unchanged

No migrations needed - uses existing `telegramEnabled` field in `userSettings` table.

## API Endpoints Used/Modified

**Existing Endpoints**:

- `PUT /api/settings/telegram` - Already supports `telegramEnabled` flag
  - Handles starting/stopping polling based on the flag
  - No changes needed

**No New Endpoints Required** - Implementation reuses existing infrastructure.

## Testing Checklist

- [x] Unauthorized (401) errors trigger auto-disable
- [x] Service stops polling after auto-disable
- [x] In-app notification is sent on auto-disable
- [x] User can toggle enabled/disabled state
- [x] User can reconfigure bot after disconnect
- [x] Transient errors retry correctly
- [x] Error counter resets on successful updates
- [x] No spam in logs after disconnect

## Edge Cases Handled

1. **Already disabled user**: Won't try to disable again
2. **Multiple consecutive errors**: Counts them and disables after threshold
3. **Mixed error types**: Tracks any type of repeated error
4. **User manually disables**: Polling stops correctly
5. **Notification service failure**: Logs error but doesn't crash

## Future Improvements

1. Add push notification option (Pushover) on auto-disable
2. Add email notification option on auto-disable
3. Add automatic retry mechanism after 24 hours
4. Add detailed error history in settings UI
5. Add validation before re-enabling (test token first)
