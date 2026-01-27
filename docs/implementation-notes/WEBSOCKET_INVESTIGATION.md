# WebSocket Endpoint Investigation - `/ws/notifications` Connection Error

## 🔍 Issue Summary

**Problem**: Frontend receiving WebSocket connection error (code 1006 - abnormal closure) when connecting to `wss://brain-api.thibautrey.fr/ws/notifications`

**Root Cause Identified**: ⚠️ **CORS Middleware blocking WebSocket upgrades in production**

---

## 📍 Endpoint Implementation Found

### ✅ Backend Endpoint Location
**File**: [backend/services/api-server.ts](backend/services/api-server.ts#L3210-L3220)

```typescript
// Line 3210-3220
const notificationWss = new WebSocketServer({
  server: httpServer,
  path: "/ws/notifications",
});

setupNotificationWebSocketServer(notificationWss);
console.log("✓ WebSocket notification server initialized at /ws/notifications");
```

### ✅ WebSocket Handler Implementation
**File**: [backend/services/api-server.ts](backend/services/api-server.ts#L3455-L3525)

```typescript
function setupNotificationWebSocketServer(wss: WebSocketServer): void {
  const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
  
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    console.log("Notification WebSocket connection attempt...");
    
    // Extract token from query string
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    
    if (!token) {
      console.log("Notification WebSocket connection rejected: no token");
      ws.close(4001, "Authentication required");
      return;
    }
    
    // Verify JWT token
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch (error) {
      console.log("Notification WebSocket connection rejected: invalid token");
      ws.close(4002, "Invalid token");
      return;
    }
    
    // ... rest of handler
  });
}
```

---

## 🚨 **CRITICAL ISSUE: CORS Middleware Blocking WebSocket Upgrades**

### The Problem

**File**: [backend/services/api-server.ts](backend/services/api-server.ts#L166)

```typescript
// Line 166
app.use(cors());  // ⚠️ DEFAULT CORS - No credentials allowed!
```

**Why this breaks WebSocket in production:**

1. **Default CORS middleware** is configured WITHOUT `credentials: true` option
2. **WebSocket upgrade requests** from HTTPS frontend (`wss://`) need proper CORS headers:
   - `Access-Control-Allow-Origin: https://frontend.domain.com`
   - `Access-Control-Allow-Credentials: true`
3. **Production reverse proxy** (nginx at `brain-api.thibautrey.fr`) likely intercepts the upgrade request
4. **Improper CORS response** → Browser rejects the WebSocket upgrade
5. **Connection closes abnormally** → Error code 1006 (abnormal closure)

### How to Confirm This is the Issue

The error pattern matches exactly:
- ✅ **Endpoint exists** and is defined correctly
- ✅ **Backend WebSocket server** is initialized
- ✅ **Token authentication** is configured
- ❌ **CORS headers** not allowing WebSocket upgrade from production origin
- ❌ **Browser rejects upgrade** → Code 1006

---

## 🔧 Files That Need Changes

### 1. **[backend/services/api-server.ts](backend/services/api-server.ts)** - CORS Configuration

**Current (Line 166)**:
```typescript
app.use(cors());
```

**Should be**:
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

// Also need to handle WebSocket upgrade headers manually
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.headers.upgrade === "websocket") {
    res.setHeader(
      "Access-Control-Allow-Origin",
      corsOptions.origin as string,
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      corsOptions.methods.join(", "),
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      corsOptions.allowedHeaders.join(", "),
    );
  }
  next();
});
```

### 2. **Environment Variables** - Add frontend URL

Add to `.env`:
```bash
FRONTEND_URL=https://frontend.domain.com  # In production
# or
FRONTEND_URL=http://localhost:5173  # In development
```

### 3. **Reverse Proxy Configuration** (if using nginx)

If you have a reverse proxy in front of the backend, ensure it's configured for WebSocket:

```nginx
# nginx configuration needed
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# Allow WebSocket upgrade
proxy_read_timeout 86400;
```

---

## 📊 Current Architecture Verified

### Frontend WebSocket Client
**File**: [src/services/notification-client.ts](src/services/notification-client.ts#L11-L18)

✅ **Correctly constructs URL**:
```typescript
function getNotificationWebSocketUrl(): string {
  const apiUrl = new URL(API_BASE_URL);
  const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${apiUrl.host}/ws/notifications`;
}
```

✅ **Authentication method**:
```typescript
const wsUrl = `${baseWsUrl}?token=${encodeURIComponent(this.authToken)}`;
```

### Backend Handler Chain
1. ✅ WebSocket server created at `/ws/notifications`
2. ✅ Connection handler extracts JWT from query param
3. ✅ Token validation with `jwt.verify()`
4. ✅ User connection registered in broadcast service
5. ✅ Ping/pong keepalive implemented
6. ✅ Error handling on disconnect

---

## 🔗 Related Code References

### WebSocket Broadcast Service
**File**: [backend/services/websocket-broadcast.ts](backend/services/websocket-broadcast.ts)

- `registerConnection(userId, ws)` - Register user connection
- `sendNotification(userId, notification)` - Send notification to user
- `removeConnection(userId)` - Cleanup on disconnect

### Notification Service Integration
**File**: [backend/services/notification.ts](backend/services/notification.ts#L200-L210)

- Uses WebSocket broadcast to send in-app notifications
- Falls back to WebSocket for push notifications

---

## 📝 Summary

| Component | Status | Issue |
|-----------|--------|-------|
| **Endpoint Definition** | ✅ Exists | None |
| **WebSocket Handler** | ✅ Implemented | None |
| **JWT Authentication** | ✅ Configured | None |
| **Frontend Client** | ✅ Correct | None |
| **CORS Middleware** | ❌ BROKEN | Blocks WebSocket upgrade in production |
| **Reverse Proxy Headers** | ❓ Unknown | May need WebSocket configuration |

## 🎯 Action Items

1. **Update CORS configuration** in `api-server.ts` with `credentials: true` and frontend URL
2. **Add environment variable** for `FRONTEND_URL` to support both dev and production
3. **Verify reverse proxy** (nginx) has proper WebSocket upgrade headers configured
4. **Test** the WebSocket connection after changes

---

**Last Updated**: January 27, 2026
**Investigation Type**: Production Error - Code 1006 Abnormal Closure
**Priority**: HIGH - Blocking notifications in production
