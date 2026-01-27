# WebSocket Connection Error - Diagnosis & Fix Guide

## 🎯 Summary

**Frontend URL**: `wss://brain-api.thibautrey.fr/ws/notifications`  
**Error**: Code 1006 - Abnormal Closure (connection immediately fails)  
**Root Cause**: **CORS middleware not configured for WebSocket upgrades in production**

---

## 📊 Detailed Investigation Results

### 1. ✅ Endpoint IMPLEMENTATION IS CORRECT

**Location**: [backend/services/api-server.ts](backend/services/api-server.ts#L3210-L3525)

The endpoint exists and is properly implemented:
- ✅ WebSocket server created at `/ws/notifications`
- ✅ JWT authentication from query parameter
- ✅ Connection handler with proper error responses
- ✅ Broadcast service integration
- ✅ Ping/pong keepalive

```typescript
// Line 3210-3220: Server initialization
const notificationWss = new WebSocketServer({
  server: httpServer,
  path: "/ws/notifications",
});
setupNotificationWebSocketServer(notificationWss);
```

### 2. ✅ FRONTEND CLIENT IS CORRECT

**Location**: [src/services/notification-client.ts](src/services/notification-client.ts#L1-L70)

The client properly:
- ✅ Converts API URL to WebSocket URL
- ✅ Passes JWT token as query parameter
- ✅ Handles reconnection with exponential backoff
- ✅ Sends ping/pong for keepalive

```typescript
function getNotificationWebSocketUrl(): string {
  const apiUrl = new URL(API_BASE_URL);  // https://brain-api.thibautrey.fr
  const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${apiUrl.host}/ws/notifications`;
  // Result: wss://brain-api.thibautrey.fr/ws/notifications
}
```

### 3. ❌ **CORS MIDDLEWARE IS THE PROBLEM**

**Location**: [backend/services/api-server.ts](backend/services/api-server.ts#L166)

```typescript
// Line 166 - DEFAULT CORS CONFIGURATION (BROKEN FOR WEBSOCKET)
app.use(cors());  // Uses default options without credentials
```

**The Issue**:
- Default CORS doesn't set `credentials: true`
- WebSocket upgrade requires CORS headers to be set in the upgrade response
- Browser rejects upgrade without proper `Access-Control-Allow-Credentials: true`
- Connection fails immediately with code 1006

---

## 🔍 Detailed Error Flow

```
1. Browser attempts WebSocket upgrade to wss://brain-api.thibautrey.fr/ws/notifications
2. Request includes: 
   - Upgrade: websocket
   - Connection: upgrade
   - Authorization headers (implicitly with credentials)
3. Reverse proxy (nginx) at brain-api.thibautrey.fr receives request
4. Proxy forwards to backend at localhost:3000
5. CORS middleware (app.use(cors())) processes request
   ❌ Doesn't set: Access-Control-Allow-Credentials: true
   ❌ Doesn't set: Access-Control-Allow-Origin to frontend domain
6. Browser rejects upgrade response due to missing CORS headers
7. Connection closes abnormally → Code 1006 error
```

---

## 🛠️ THE FIX

### Change 1: Update CORS Configuration

**File**: [backend/services/api-server.ts](backend/services/api-server.ts#L166)

Replace:
```typescript
app.use(cors());
```

With:
```typescript
// Configure CORS for WebSocket support
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Add explicit WebSocket upgrade header handling
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestOrigin = req.get("origin");
  
  // Allow WebSocket upgrades from trusted origins
  if (
    req.headers.upgrade?.toLowerCase() === "websocket" &&
    requestOrigin &&
    (requestOrigin === process.env.FRONTEND_URL ||
      requestOrigin === "http://localhost:5173")
  ) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  
  next();
});
```

### Change 2: Add Environment Variable

Add to `.env` and `.env.example`:
```bash
# Frontend URL for CORS and WebSocket configuration
# In production, use the actual frontend domain
# In development, use localhost:5173
FRONTEND_URL=https://brain-api.thibautrey.fr
```

Or if frontend is hosted separately:
```bash
# If frontend is on different domain
FRONTEND_URL=https://app.thibautrey.fr
```

### Change 3: Verify Reverse Proxy Configuration (Optional)

If you have nginx in front of the backend, ensure these headers are in the proxy configuration:

```nginx
location /ws/notifications {
    proxy_pass http://backend:3000;
    
    # Essential for WebSocket upgrade
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Required headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Allow long-lived connections
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

---

## 📋 Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| [backend/services/api-server.ts](backend/services/api-server.ts) | Update CORS middleware (line 166) | 🔴 CRITICAL |
| `.env` | Add `FRONTEND_URL` variable | 🟠 HIGH |
| `.env.example` | Add `FRONTEND_URL` variable | 🟠 HIGH |
| nginx config (if exists) | Add WebSocket proxy headers | 🟡 MEDIUM |

---

## ✅ Verification Checklist

After making changes:

- [ ] CORS middleware includes `credentials: true`
- [ ] `FRONTEND_URL` environment variable is set correctly
- [ ] Backend server restarted with new configuration
- [ ] Network tab shows upgrade request with proper CORS headers
- [ ] WebSocket connection succeeds (code 101 upgrade)
- [ ] `[NotificationClient] Connected` appears in console
- [ ] Notifications are received through WebSocket

---

## 🔗 Related Components

**Backend Services**:
- [websocket-broadcast.ts](backend/services/websocket-broadcast.ts) - Handles notification broadcasting
- [notification.ts](backend/services/notification.ts) - Creates and sends notifications

**Frontend Hooks**:
- [useNotificationListener.ts](src/hooks/useNotificationListener.ts) - Manages notification connection lifecycle
- [useChatNotificationListener.ts](src/hooks/useChatNotificationListener.ts) - Displays chat notifications

---

## 📝 Technical Details

### Why Code 1006 (Abnormal Closure)?

**Code 1006** is used when:
- WebSocket close frame is missing (unexpected connection drop)
- Proxy/firewall intercepts the connection
- CORS validation fails at HTTP upgrade stage
- TLS/SSL certificate issues (less likely here)

In this case, the browser rejects the upgrade response due to CORS, so the connection drops without a proper close frame.

### WebSocket Upgrade Process

```
Client                          Server
  |                              |
  |-- GET /ws/notifications ----->|
  |    Upgrade: websocket         |
  |    Connection: upgrade        |
  |    Origin: https://...        |
  |                              |
  |<-- 101 Switching Protocols ---|
  |    Upgrade: websocket         |
  |    Connection: upgrade        |
  |    Access-Control-Allow-*     | ← MISSING in default CORS!
  |                              |
  |<==================WebSocket====================|
```

---

**Investigation Date**: January 27, 2026  
**Status**: Root cause identified, fix provided  
**Next Step**: Apply CORS configuration changes to [backend/services/api-server.ts](backend/services/api-server.ts)
