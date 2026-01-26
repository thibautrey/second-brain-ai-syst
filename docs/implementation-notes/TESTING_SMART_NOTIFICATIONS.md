# Testing Smart Notification Routing

## Quick Start Testing

### 1. Setup & Migration

```bash
# Apply database migration
cd /Users/thibaut/gitRepo/second-brain-ai-syst/backend
npx prisma migrate deploy

# Verify the migration
npx prisma studio  # Look for user_presence table
```

### 2. Start the Application

```bash
# From project root
docker compose down
docker compose build
docker compose up
```

### 3. Access the Application

```
Frontend: http://localhost:5173
Backend: http://localhost:3000
```

## Manual Testing Steps

### Test 1: Verify Presence Tracking

1. **Open browser DevTools** (F12)
2. **Go to Network tab**
3. **Navigate to dashboard** and watch for heartbeat requests:
   ```
   POST /api/user/presence/heartbeat
   ```
4. **Expected**: Request every ~5 seconds with:
   ```json
   {
     "timestamp": "2026-01-26T...",
     "isFocused": true
   }
   ```

### Test 2: Check User Presence Status

1. **Open browser console**
2. **Run**:
   ```javascript
   fetch("http://localhost:3000/api/user/presence/status", {
     headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
   })
     .then((r) => r.json())
     .then(console.log);
   ```
3. **Expected output**:
   ```json
   {
     "success": true,
     "isOnline": true,
     "isFocused": true,
     "lastActiveAt": "2026-01-26T..."
   }
   ```

### Test 3: Verify Smart Notification Routing

1. **Keep DevTools open** (Network tab)
2. **Send a notification via API**:
   ```bash
   curl -X POST http://localhost:3000/api/notifications \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Notification",
       "message": "This should appear in chat!",
       "type": "SUCCESS",
       "channels": ["IN_APP", "PUSH"]
     }'
   ```
3. **Check Network tab** for WebSocket message with `type: 'chat.notification'`
4. **Expected**: Notification appears in chat with elegant sound

### Test 4: Test Sound Generation

1. **Open browser console**
2. **Run**:
   ```javascript
   import { notificationSoundService } from "/src/services/notification-sound.ts";
   notificationSoundService.playElegantSound();
   ```
3. **Expected**: Hear a harmonious, brief chord
4. **Test chime**:
   ```javascript
   notificationSoundService.playChime();
   ```
5. **Expected**: Hear a single note

### Test 5: Test Inactive Routing

1. **Stop clicking/typing** in the browser for 35 seconds
2. **Send a notification**:
   ```bash
   curl -X POST http://localhost:3000/api/notifications \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Inactive Test",
       "message": "User should be marked inactive",
       "type": "INFO",
       "channels": ["IN_APP", "PUSH"]
     }'
   ```
3. **Expected**: Notification does NOT appear in chat (user marked inactive)
4. **Check database**:
   ```sql
   SELECT * FROM user_presence WHERE "userId" = 'your_user_id';
   -- isOnline should be false after timeout
   ```

### Test 6: Test Focus/Blur Awareness

1. **Open DevTools console** to monitor heartbeats
2. **Click away to another tab** (blur event)
3. **Check presence status**:
   ```javascript
   fetch("http://localhost:3000/api/user/presence/status", {
     headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
   })
     .then((r) => r.json())
     .then(console.log);
   ```
4. **Expected**: `isFocused` should be `false`
5. **Click back to application** (focus event)
6. **Expected**: `isFocused` should be `true` again

### Test 7: Test Different Notification Types

```bash
# Create different notification types
TYPES=("INFO" "SUCCESS" "WARNING" "ERROR" "REMINDER" "ACHIEVEMENT")

for TYPE in "${TYPES[@]}"; do
  curl -X POST http://localhost:3000/api/notifications \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"Test $TYPE\",
      \"message\": \"This is a $TYPE notification\",
      \"type\": \"$TYPE\",
      \"channels\": [\"IN_APP\", \"PUSH\"]
    }"
  sleep 1
done
```

**Expected**:

- INFO/SUCCESS/WARNING/ACHIEVEMENT: Auto-dismiss after 8s
- ERROR/REMINDER: Stay until manually dismissed
- Different colors and icons for each type

### Test 8: Test Offline Marking

1. **Run presence check**:
   ```javascript
   fetch("http://localhost:3000/api/user/presence/offline", {
     method: "POST",
     headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
   })
     .then((r) => r.json())
     .then(console.log);
   ```
2. **Expected**: User marked offline in database
3. **Send notification** while offline:
   ```bash
   curl -X POST http://localhost:3000/api/notifications ...
   ```
4. **Expected**: Routes to standard channels, NOT chat

## Database Verification

### Check user_presence Table

```sql
-- Connect to database
psql -U postgres -d second_brain_dev

-- View presence records
SELECT
  up.id,
  up."userId",
  up."isOnline",
  up."isFocused",
  up."lastActiveAt",
  u.email
FROM user_presence up
JOIN users u ON u.id = up."userId"
ORDER BY up."lastActiveAt" DESC;

-- Check recent activity
SELECT
  *,
  NOW() - "lastActiveAt" as time_since_active
FROM user_presence
WHERE "userId" = 'specific_user_id'
ORDER BY "updatedAt" DESC;
```

## Performance Monitoring

### Check Heartbeat Volume

```javascript
// In console, count heartbeat requests in last minute
let count = 0;
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes("/presence/heartbeat")) {
      count++;
      console.log(`Heartbeats: ${count}`);
    }
  }
});
observer.observe({ entryTypes: ["resource"] });
```

### Monitor WebSocket Messages

```javascript
// Monitor WebSocket for notification messages
const originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = function (data) {
  console.log("[WS Send]", data);
  return originalSend.call(this, data);
};

const originalOnMessage = WebSocket.prototype.onmessage;
Object.defineProperty(WebSocket.prototype, "onmessage", {
  set(fn) {
    this._onmessage = (event) => {
      console.log("[WS Receive]", event.data);
      fn(event);
    };
  },
  get() {
    return this._onmessage;
  },
});
```

## Troubleshooting

### Notifications Not Appearing in Chat

1. **Check user is marked active**:

   ```javascript
   fetch("http://localhost:3000/api/user/presence/status", {
     headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
   })
     .then((r) => r.json())
     .then(console.log);
   ```

2. **Check WebSocket connection**:
   - Look for `websocket_connected` or similar message in console
   - Check Network tab for WebSocket connection to `ws://localhost:3000`

3. **Check notification channels**:

   ```bash
   curl http://localhost:3000/api/notifications \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

   - Verify channels include "CHAT" if user is active

### No Sound Playing

1. **Check browser audio permissions**:
   - Allow audio playback in browser settings

2. **Check browser console for errors**:

   ```javascript
   notificationSoundService.playElegantSound();
   // Check for any Web Audio API errors
   ```

3. **Verify Web Audio API is available**:
   ```javascript
   console.log(
     typeof AudioContext !== "undefined" ||
       typeof webkitAudioContext !== "undefined",
   );
   // Should print: true
   ```

### Heartbeat Not Sending

1. **Check network connection**:
   - Look in DevTools Network tab for requests

2. **Verify user is authenticated**:

   ```javascript
   console.log(localStorage.getItem("authToken"));
   ```

3. **Check browser console for errors**:
   - May indicate CORS issues or auth problems

## API Testing with cURL

### Create Test Notification

```bash
#!/bin/bash

TOKEN="your_auth_token_here"
BASE_URL="http://localhost:3000"

# Helper function
send_notification() {
  local TITLE=$1
  local MESSAGE=$2
  local TYPE=${3:-"INFO"}

  curl -X POST "$BASE_URL/api/notifications" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"$TITLE\",
      \"message\": \"$MESSAGE\",
      \"type\": \"$TYPE\",
      \"channels\": [\"IN_APP\", \"PUSH\"],
      \"metadata\": {
        \"test\": true
      }
    }"
  echo ""
}

# Test different types
send_notification "Test Success" "This is a success message" "SUCCESS"
send_notification "Test Error" "This is an error message" "ERROR"
send_notification "Test Reminder" "This is a reminder" "REMINDER"
```

## Success Criteria

✅ Presence heartbeats send every 5 seconds  
✅ User status correctly reflects online/offline  
✅ Notifications route to CHAT when user active  
✅ Notifications route to IN_APP when user inactive  
✅ Elegant sound plays when notifications appear in chat  
✅ Different notification types display correctly  
✅ Auto-dismiss works for non-critical types  
✅ No sound issues or Web Audio errors  
✅ WebSocket messages contain correct chat notification format  
✅ Database records presence changes

## Next Steps After Testing

1. ✅ Verify all tests pass
2. ✅ Check console for warnings/errors
3. ✅ Monitor database for data consistency
4. ✅ Test on different browsers (Chrome, Firefox, Safari)
5. ✅ Test on mobile devices if applicable
6. ✅ Performance testing under load
7. ✅ Accessibility testing (screen readers)
