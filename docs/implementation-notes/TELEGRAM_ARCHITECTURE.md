# Telegram Primary Channel - Complete Architecture

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NOTIFICATION REQUEST                     │
│  (from AI, System, or User Action)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Create Notification       │
        │  Input:                    │
        │  • userId                  │
        │  • title, message          │
        │  • type, channels          │
        │  • sourceType, metadata    │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Spam Detection Check      │
        │  (unless skipSpamCheck)    │
        └────────────┬───────────────┘
                     │
                ┌────┴────┐
                │          │
           Blocked      Allowed
                │          │
                │          ▼
                │  ┌──────────────────────────┐
                │  │  Get Optimal Channels    │
                │  │                          │
                │  │  Priority Order:         │
                │  │  1. TELEGRAM (if config) │
                │  │  2. CHAT (if active)     │
                │  │  3. IN_APP/PUSH (default)│
                │  └────────┬─────────────────┘
                │           │
                │      ┌────┴────┬────────┐
                │      │         │        │
                │      ▼         ▼        ▼
                │    [TELEGRAM] [CHAT] [IN_APP/PUSH]
                │      │         │        │
                │      └────┬────┴────┬───┘
                │           │        │
                │           ▼        ▼
                └────────▶ Create DB Record
                           + Metadata
                           │
                           ▼
                      Send Notification
                      Via Selected Channel(s)
                           │
                      ┌────┴────┬───────────────┐
                      ▼         ▼               ▼
                  [TELEGRAM]  [CHAT]        [IN_APP/PUSH]
                  (Bot API)   (WebSocket)   (Browser/Push)
```

## 🔄 Channel Selection Flow

### Option 1: Telegram Configured ✅

```
User Settings:
  • telegramBotToken: "123456789:ABC..."
  • telegramChatId: "987654321" (set after /start)
  • telegramEnabled: true

isTelegramConfigured(userId)
  ✓ Check: telegramBotToken exists? YES
  ✓ Check: telegramChatId exists? YES
  ✓ Check: telegramEnabled === true? YES
  └─> RETURN: true

getOptimalChannels()
  ├─ isTelegramConfigured() returns true
  └─> RETURN: ["TELEGRAM"]

Result: ✅ Notification goes to TELEGRAM BOT
        📍 Sent via Telegram.sendNotification()
        📍 User sees notification in @bot chat
```

### Option 2: Telegram Not Ready ⏳

```
User Settings:
  • telegramBotToken: "123456789:ABC..."
  • telegramChatId: null (waiting for /start)
  • telegramEnabled: true

isTelegramConfigured(userId)
  ✓ Check: telegramBotToken exists? YES
  ✗ Check: telegramChatId exists? NO ← Missing!
  └─> RETURN: false

getOptimalChannels()
  ├─ isTelegramConfigured() returns false
  ├─ isUserActiveInWeb() returns false (assuming)
  └─> RETURN: ["IN_APP", "PUSH"] (default)

Result: ⏳ Notification uses default channels
        📍 System waits for user to send /start
        📍 Once /start received, next notification goes to Telegram
```

### Option 3: User Active in Web 🌐

```
User Settings:
  • telegramBotToken: null
  • telegramChatId: null
  • telegramEnabled: false

User Presence:
  • isOnline: true
  • lastActiveAt: < 2 minutes ago

isTelegramConfigured(userId)
  └─> RETURN: false (no Telegram)

isUserActiveInWeb(userId)
  ✓ Check: User online? YES
  ✓ Check: Recent activity? YES (< 2 min)
  └─> RETURN: true

getOptimalChannels()
  ├─ isTelegramConfigured() returns false
  ├─ isUserActiveInWeb() returns true
  └─> RETURN: ["CHAT"]

Result: 🌐 Notification sent to chat interface
        📍 Appears in web interface real-time
        📍 Via WebSocket broadcast
```

### Option 4: Default/Offline 📱

```
User Settings:
  • telegramBotToken: null
  • telegramChatId: null
  • telegramEnabled: false

User Presence:
  • isOnline: false OR lastActiveAt: > 2 minutes

isTelegramConfigured(userId)
  └─> RETURN: false

isUserActiveInWeb(userId)
  └─> RETURN: false

getOptimalChannels()
  ├─ isTelegramConfigured() returns false
  ├─ isUserActiveInWeb() returns false
  └─> RETURN: ["IN_APP", "PUSH"] (defaults)

Result: 📱 Notification uses default channels
        📍 IN_APP: Stored in DB, shown when user logs in
        📍 PUSH: Browser push notification (if enabled)
```

## 🔐 Configuration States

```
State Matrix:
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Config State                    │
├────────────────┬──────────┬──────────┬───────────────────────┤
│ Token   │ChatID│ Enabled  │Status         │ Routing           │
├────────────────┼──────────┼──────────┼───────────────────────┤
│ ✗       │ ✗    │ ✗        │ Not Setup     │ Default Channels  │
│ ✓       │ ✗    │ ✓        │ Waiting /start│ Default Channels  │
│ ✓       │ ✓    │ ✓        │ ACTIVE        │ ✅ TELEGRAM       │
│ ✓       │ ✓    │ ✗        │ Disabled      │ Default Channels  │
│ ✗       │ ✗    │ ✗        │ Removed       │ Default Channels  │
└────────────────┴──────────┴──────────┴───────────────────────┘

Transition Flow:
Not Setup
    ↓ (user adds token)
Waiting /start
    ↓ (user sends /start)
ACTIVE (PRIMARY CHANNEL!) ←──┐
    ↓ (user sends /stop)     │
Disabled                     │
    ├─ (user sends /start) ──┘
    │
    └─ (user removes token)
       Not Setup
```

## 📝 Database Storage

### notification table

```typescript
{
  id: string,
  userId: string,
  title: string,
  message: string,
  type: NotificationType,

  // ✨ KEY FIELD: Channels selected for this notification
  channels: ["TELEGRAM"] | ["CHAT"] | ["IN_APP", "PUSH"] | ...,

  metadata: {
    originalChannels: ["IN_APP", "PUSH"],    // What was requested
    routedChannels: ["TELEGRAM"],             // What router selected
    spamCheckTopic: "memory.saved",           // If topic-matched
    ...
  },

  sentAt: Date,
  createdAt: Date,
  // ... other fields
}
```

### userSettings table

```typescript
{
  userId: string,

  // Telegram fields:
  telegramBotToken: string | null,    // From @BotFather
  telegramChatId: string | null,      // Set after /start command
  telegramEnabled: boolean,            // Enable/disable flag

  // Pushover fields:
  pushoverUserKey: string | null,
  pushoverApiToken: string | null,

  // Browser fields:
  notifyOnMemoryStored: boolean,
  notifyOnCommandDetected: boolean,

  // ... other fields
}
```

## 🔌 API Endpoints

### Check Telegram Status

```
GET /api/settings/telegram
Response:
{
  hasBotToken: boolean,
  telegramChatId: string | null,
  telegramEnabled: boolean
}
```

### Save Telegram Configuration

```
PUT /api/settings/telegram
Body:
{
  telegramBotToken: "123456789:ABC...",
  telegramEnabled: true
}

Triggers:
1. Validate bot token
2. Save settings
3. Start polling for messages
4. Log: "Telegram enabled... will become primary once /start is sent"
```

### Test Telegram

```
POST /api/settings/telegram/test
Response:
{
  success: boolean,
  message: string // "Waiting for /start" or "Sent successfully"
}
```

### Remove Telegram

```
DELETE /api/settings/telegram
Triggers:
1. Clear token & chat ID
2. Stop polling
3. Log: "Telegram removed"
4. Routing reverts to defaults
```

## 🤖 Telegram Bot Commands

### User Commands

```
/start
├─ Action: Register chat ID
├─ Sets: telegramChatId, telegramEnabled = true
├─ Effect: TELEGRAM becomes primary channel immediately
└─ Response: Welcome message + Chat ID

/stop
├─ Action: Disable notifications
├─ Sets: telegramEnabled = false
├─ Effect: Routing reverts to default channels
└─ Response: Confirmation message

/status
├─ Action: Show connection status
├─ Response: Enabled/Disabled + Chat ID
└─ Effect: No state change
```

## 📊 Example Notification Flow

### Scenario: New Memory Created + Telegram Configured

```
1. Memory Creation Event
   └─ Triggers: ai.createNotification()

2. NotificationService.createNotification()
   ├─ Input: title="Memory Saved", message="Your note about...",
   │         channels=["IN_APP", "PUSH"]
   ├─ Spam Check: ✅ Allowed
   ├─ Call: smartNotificationRouter.getOptimalChannels(userId)
   │         └─ Returns: ["TELEGRAM"]
   ├─ Create DB Record:
   │  {
   │    channels: ["TELEGRAM"],
   │    metadata: {
   │      originalChannels: ["IN_APP", "PUSH"],
   │      routedChannels: ["TELEGRAM"]
   │    }
   │  }
   └─ Log: "Notification will be sent via Telegram (primary channel)"

3. NotificationService.sendNotification()
   └─ For each channel in ["TELEGRAM"]:
      ├─ Call: sendTelegram(notification)
      │   ├─ Get: userSettings.telegramBotToken
      │   ├─ Get: userSettings.telegramChatId
      │   ├─ Call: telegramService.sendNotification()
      │   │   └─ POST to Telegram API
      │   └─ Log: "Telegram notification sent: Memory Saved"
      └─ Update: notification.sentAt = now

4. User Experience
   └─ 📱 Notification arrives in Telegram bot chat
      Topic: "Memory Saved"
      Message: "Your note about..."
```

## 🧪 Testing Checklist

- [ ] Telegram not configured → Uses default channels
- [ ] Telegram token added, no /start → Uses default channels
- [ ] Telegram /start sent → Uses TELEGRAM channel
- [ ] User sends /stop → Reverts to default channels
- [ ] User sends /start again → Uses TELEGRAM channel again
- [ ] User removes token → Uses default channels
- [ ] Notification metadata tracks original vs routed channels
- [ ] Spam detection blocks before channel selection
- [ ] User active in web + Telegram configured → Uses TELEGRAM
- [ ] Logs show correct channel selection reason
- [ ] Test endpoint works: POST /api/settings/telegram/test

## 🚀 Key Takeaways

✅ **Telegram is PRIMARY** - Always first choice if configured  
✅ **Automatic Routing** - No manual channel selection per notification  
✅ **Smart Fallback** - Reverts to defaults if disabled/removed  
✅ **Metadata Tracking** - Stores what was routed and why  
✅ **User Control** - Easy enable/disable via bot commands  
✅ **Transparent** - Works without AI/system knowing the routing

## 📚 Related Documentation

- [agents.md](../../agents.md) - System overview
- [TELEGRAM_PRIMARY_FEATURE.md](./TELEGRAM_PRIMARY_FEATURE.md) - Feature summary
- [TELEGRAM_TEST_CASES.md](./TELEGRAM_TEST_CASES.md) - Test scenarios
- [notifications.md](../notifications.md) - General notification system
