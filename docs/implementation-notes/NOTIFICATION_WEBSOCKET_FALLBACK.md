# Notification WebSocket Fallback Implementation

## Problem
The notification WebSocket was failing with connection errors, particularly in production environments with proxy/Cloudflare interference:
```
WebSocket error: Event {isTrusted: true, type: 'error', ...}
readyState: 3 (CLOSED)
```

The system had no fallback mechanism, leaving users without real-time notifications when WebSocket failed.

## Solution
Implemented a transparent fallback system similar to the audio-connection-manager pattern:

1. **Primary Protocol**: WebSocket (real-time, lowest latency)
2. **Fallback Protocol**: HTTP Polling (when WebSocket fails)

The system automatically detects WebSocket failures and switches to polling without user intervention or error notifications.

## Changes Made

### 1. Frontend Client Updates (`src/services/notification-client.ts`)

#### Added Protocol Support
- `ConnectionProtocol` type: `"websocket" | "polling"`
- `ConnectionState` type: `"disconnected" | "connecting" | "connected" | "reconnecting" | "fallback"`
- Tracks current protocol and connection state

#### Enhanced Connection Handling
- **WebSocket timeout detection**: 10-second timeout for initial connection attempts
- **Proxy error detection**: Handles abnormal closures (code 1006, 1015) as proxy errors
- **Binary type setting**: Sets `binaryType = "arraybuffer"` for proper frame handling

#### Fallback Mechanism
- **Automatic protocol switching**: After max reconnection attempts, switches to polling
- **Polling implementation**: 3-second polling interval (less aggressive than audio)
- **Session validation**: Pre-validates session before opening connections
- **Transparent fallback**: No error notifications shown to user; connection callbacks indicate "fallback-connected"

#### Key Methods
```typescript
// Switch to polling fallback
private async startPolling(): Promise<void>

// Automatic fallback trigger
private tryFallback(): void

// Clean handling of both protocols
private cleanup(): void
```

#### Features
- **Exponential backoff with jitter**: Prevents thundering herd on server
- **Max reconnection attempts**: 15 attempts (increased from 10) before fallback
- **Consecutive failure tracking**: Polling stops after 5 consecutive failures
- **Session validation**: Detects and handles invalid sessions during polling
- **Resource cleanup**: Properly closes WebSocket and stops polling intervals

### 2. Backend API Updates

#### New Polling Endpoint (`backend/controllers/notification.controller.ts`)
```typescript
async poll(req: AuthRequest, res: Response)
// GET /api/notifications/poll?since=<timestamp>
```

**Features:**
- Returns notifications created after `since` timestamp
- Filters results dynamically (no need to store timestamps server-side)
- Returns up to 100 notifications per poll
- Properly handles authentication

#### API Registration (`backend/services/api-server.ts`)
Added route registration:
```typescript
app.get("/api/notifications/poll", authMiddleware, ...)
```

## Behavior

### WebSocket Success Path
1. Client initiates WebSocket connection
2. If successful → connected state, real-time notifications
3. If WebSocket closes unexpectedly → attempts reconnection with exponential backoff

### WebSocket Failure Path
1. WebSocket error detected during connection
2. Attempts reconnection (up to 15 times with exponential backoff)
3. After max attempts → automatically switches to polling
4. User remains connected with polling (3-second updates)

### Proxy/Cloudflare Error Path
1. Detects abnormal closure codes (1006, 1015)
2. Immediately triggers fallback to polling (skips reconnection attempts)
3. Provides faster recovery for known proxy issues

### Polling Failure Path
1. If polling encounters 5 consecutive failures
2. Attempts to reconnect with WebSocket again
3. Creates a retry cycle: WebSocket → Polling → WebSocket

## Testing

### Test Fallback Mechanism
```bash
# Monitor browser console
# Look for: "[NotificationClient] Starting polling fallback"
# Look for: "[NotificationClient] WebSocket error during connect, will fallback to SSE"

# In DevTools Network tab:
# 1. Should see WebSocket connection attempt
# 2. When it fails, should see POST requests to /api/notifications/poll
```

### Test Polling Endpoint
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/notifications/poll?since=0"
```

### Manual Testing
1. Open DevTools Network tab
2. Go to Notifications section in app
3. Force WebSocket failure (DevTools → Network → disable/throttle)
4. Create a notification
5. Should see polling requests instead of WebSocket messages

## Performance Impact

### Memory
- Minimal: Only one polling interval active (vs WebSocket binary handling)
- Polling cleaned up if WebSocket reconnects

### Network
- WebSocket: Single connection, real-time
- Polling: HTTP GET every 3 seconds (~20 requests/minute)
- ~5-10x increase in requests when on polling fallback
- Still acceptable for notification use case

### Latency
- WebSocket: <100ms typical
- Polling: 0-3s delay (depends on poll timing)
- Acceptable for non-critical notifications

## Configuration

Users can control fallback behavior by setting environment variables:

```env
# Force specific protocol for testing
VITE_NOTIFICATION_PROTOCOL=polling  # or 'websocket'

# Customize polling interval (not exposed yet, but easy to add)
```

## Edge Cases Handled

1. **Session becomes invalid during polling**: Detected and triggers full reconnection
2. **Rapid WebSocket failures**: Exponential backoff prevents server hammering
3. **User navigates away**: Proper cleanup of polling intervals
4. **Network transitions**: Polling continues across WiFi/cellular changes
5. **Multiple notifications**: Polling can batch-deliver multiple notifications

## Future Improvements

1. **SSE Fallback**: Could add Server-Sent Events as intermediate fallback
2. **Persistent Storage**: Queue notifications while offline
3. **Smart Polling**: Adaptive interval based on network conditions
4. **Metrics**: Track which protocol is used and failure rates
5. **User Control**: Allow users to manually select protocol preference

## References
- Similar pattern used in `src/services/audio-connection-manager.ts`
- Cloudflare WebSocket limitations: https://developers.cloudflare.com/workers/platform/limitations/
- HTTP Polling best practices: MDN Web Docs
