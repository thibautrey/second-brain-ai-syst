# Tips Feature - Architecture & Implementation Details

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  DashboardPage.tsx                                           │
│  ├─ Fetches tips on mount: fetchActiveTips()               │
│  ├─ Manages state: tips[], tipsLoading                      │
│  ├─ Handlers: handleTipDismiss(), handleTipView()          │
│  └─ Renders: <TipsCarousel />                              │
│                                                              │
│  TipsCarousel.tsx (Dumb Component)                          │
│  ├─ Input: tips[], onDismiss(), onView()                   │
│  ├─ State: currentIndex, autoRotate                        │
│  ├─ Features: auto-rotation, navigation, dismiss           │
│  └─ UI: emoji icons, animations, indicators               │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Express)                       │
├─────────────────────────────────────────────────────────────┤
│  api-server.ts (Routes)                                     │
│  ├─ POST   /api/tips          → create()                    │
│  ├─ GET    /api/tips          → list()                      │
│  ├─ PATCH  /api/tips/:id/view → view()                      │
│  ├─ PATCH  /api/tips/:id/dismiss → dismiss()               │
│  └─ DELETE /api/tips/:id      → delete()                    │
│                                                              │
│  tips.controller.ts (Handlers)                              │
│  ├─ Auth validation (authMiddleware)                        │
│  ├─ Input validation & parsing                             │
│  ├─ Error handling                                         │
│  └─ Response formatting                                    │
│                                                              │
│  tips.service.ts (Business Logic)                           │
│  ├─ createTip()      → INSERT INTO tips                     │
│  ├─ getActiveTips()  → SELECT WHERE isDismissed=false      │
│  ├─ dismissTip()     → UPDATE isDismissed=true             │
│  ├─ viewTip()        → UPDATE viewCount++                   │
│  ├─ getAllTips()     → SELECT all                           │
│  └─ deleteTip()      → DELETE                               │
└─────────────────────────────────────────────────────────────┘
                            ↕ SQL
┌─────────────────────────────────────────────────────────────┐
│                  Database (PostgreSQL)                       │
├─────────────────────────────────────────────────────────────┤
│  tips table                                                  │
│  ├─ Columns: id, userId, title, description, category...   │
│  ├─ Indexes: userId, isDismissed, targetFeature, priority   │
│  └─ Foreign Key: userId → users.id (CASCADE DELETE)        │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### Get Active Tips (on page load)
```
DashboardPage.tsx (useEffect)
    └─> fetchActiveTips({ limit: 5 })
        └─> api.ts: apiGet("/tips", params)
            └─> Authorization: Bearer {token}
                └─> Backend: GET /api/tips
                    └─> tips.controller.ts: list()
                        └─> tips.service.ts: getActiveTips()
                            └─> prisma.tip.findMany({
                                  where: { userId, isDismissed: false },
                                  orderBy: [{ priority: desc }, ...]
                                })
                                └─> Database Query
                                    └─> Return [ Tip[] ]
                            └─> Return { tips, total, limit, offset }
                        └─> res.json({ success: true, ...result })
            └─> Return TipsCarouselProps
        └─> setTips(response.tips)
            └─> <TipsCarousel tips={tips} />
```

### Track Tip View (when carousel advances)
```
TipsCarousel.tsx (useEffect on currentIndex change)
    └─> onView(tip.id)
        └─> handleTipView() in DashboardPage
            └─> viewTip(tipId)
                └─> api.ts: apiPatch(`/tips/${tipId}/view`)
                    └─> Authorization: Bearer {token}
                        └─> Backend: PATCH /api/tips/:id/view
                            └─> tips.controller.ts: view()
                                └─> tips.service.ts: viewTip(tipId, userId)
                                    └─> prisma.tip.update({
                                          where: { id: tipId },
                                          data: { 
                                            viewCount: { increment: 1 },
                                            lastViewedAt: new Date()
                                          }
                                        })
                                        └─> Database Update
                                └─> res.json({ success: true, tip })
                    └─> Async (non-blocking, result not used in UI)
```

### Dismiss Tip (when user clicks X button)
```
TipsCarousel.tsx (onClick={handleDismiss})
    └─> onDismiss(tip.id)
        └─> handleTipDismiss() in DashboardPage
            └─> dismissTip(tipId)
                └─> api.ts: apiPatch(`/tips/${tipId}/dismiss`)
                    └─> Authorization: Bearer {token}
                        └─> Backend: PATCH /api/tips/:id/dismiss
                            └─> tips.controller.ts: dismiss()
                                └─> tips.service.ts: dismissTip(tipId, userId)
                                    └─> prisma.tip.update({
                                          where: { id: tipId },
                                          data: { 
                                            isDismissed: true,
                                            dismissedAt: new Date()
                                          }
                                        })
                                        └─> Database Update
                                └─> res.json({ success: true, tip })
                    └─> setTips(prevTips => prevTips.filter(t => t.id !== tipId))
                        └─> <TipsCarousel tips={tips} />
                            └─> currentTip now points to next tip OR carousel disappears
```

## Database Schema

```sql
CREATE TABLE tips (
    id TEXT PRIMARY KEY,              -- Unique identifier (CUID)
    userId TEXT NOT NULL,             -- Foreign key to users
    
    -- Content
    title TEXT NOT NULL,              -- Short title (< 50 chars)
    description TEXT NOT NULL,        -- Full description
    category TEXT DEFAULT 'general',  -- getting-started, feature-highlight, productivity
    targetFeature TEXT,               -- Optional: associated feature (memories, tools)
    
    -- Tracking
    isDismissed BOOLEAN DEFAULT false, -- User dismissed this tip
    dismissedAt TIMESTAMP,            -- When dismissed
    viewCount INTEGER DEFAULT 0,      -- Number of times viewed
    lastViewedAt TIMESTAMP,           -- When last viewed
    
    -- Display
    priority INTEGER DEFAULT 0,       -- Sort order (higher = shown first)
    icon TEXT,                        -- Emoji identifier (lightbulb, star, rocket, zap)
    metadata JSONB DEFAULT '{}',      -- Extensible field for future data
    
    -- Timestamps
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP,
    
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for fast queries
CREATE INDEX tips_userId_idx ON tips(userId);
CREATE INDEX tips_isDismissed_idx ON tips(isDismissed);
CREATE INDEX tips_targetFeature_idx ON tips(targetFeature);
CREATE INDEX tips_priority_idx ON tips(priority);
```

## Component Hierarchy

```
App
└─ Router
    └─ DashboardPage
        ├─ Sidebar
        │  ├─ Logo
        │  ├─ Navigation (NavItem components)
        │  └─ TipsCarousel ← NEW COMPONENT
        │      ├─ TipCard
        │      ├─ NavigationControls
        │      │  ├─ PrevButton
        │      │  ├─ IndicatorDots
        │      │  └─ NextButton
        │      └─ Counter
        ├─ TopBar
        │  ├─ MenuButton
        │  ├─ UserInfo
        │  └─ Avatar
        └─ MainContent
            └─ [Page Content based on activeTab]
```

## State Management

### DashboardPage State
```typescript
const [sidebarOpen, setSidebarOpen] = useState(boolean);
const [tips, setTips] = useState<Tip[]>([]);           // NEW
const [tipsLoading, setTipsLoading] = useState(boolean); // NEW
```

### TipsCarousel State
```typescript
const [currentIndex, setCurrentIndex] = useState(0);
const [autoRotate, setAutoRotate] = useState(true);
```

## Authentication & Authorization

All tip endpoints require:
1. **Authentication**: Valid JWT token in Authorization header
2. **Authorization**: Can only see/modify own tips (userId validation in service)

```typescript
// Protected by authMiddleware
app.get("/api/tips", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId; // From auth middleware
  // Only fetch tips for this user
  const tips = await tipsService.getActiveTips(userId, ...);
});
```

## Error Handling

### Frontend
```typescript
try {
  const data = await fetchActiveTips({ limit: 5 });
  setTips(data.tips);
} catch (error) {
  console.error("Failed to load tips:", error);
  setTips([]); // Show empty carousel
} finally {
  setTipsLoading(false);
}
```

### Backend
```typescript
// Controller
try {
  const tip = await tipsService.dismissTip(id, userId);
  res.json({ success: true, tip });
} catch (error: any) {
  console.error("[TipsController] Dismiss error:", error);
  res.status(500).json({ error: error.message });
}

// Service
async dismissTip(tipId: string, userId: string) {
  const tip = await prisma.tip.findUnique({ where: { id: tipId } });
  
  // Authorization check
  if (!tip || tip.userId !== userId) {
    throw new Error("Tip not found or unauthorized");
  }
  
  return prisma.tip.update({...});
}
```

## Performance Optimizations

### Frontend
- **Single fetch**: Tips fetched once on mount, not on every render
- **Dismissed state**: Dismissed tips removed from state, no server roundtrip needed
- **View tracking**: Async operation that doesn't block carousel interaction
- **Local state**: Navigation/rotation purely local, no server calls

### Backend
- **Indexes**: Queries on userId, isDismissed, priority are fast
- **Filtering**: Only SELECT non-dismissed tips (isDismissed=false in WHERE clause)
- **Sorting**: Database-level sorting (priority, createdAt) is efficient
- **Pagination**: limit/offset support for large tip sets

### Database
- **Composite indexes**: Multiple single-column indexes for flexibility
- **Foreign key cascade**: Efficient cleanup when user deleted
- **JSON metadata**: Allows extensibility without schema migration

## Security Considerations

1. **User isolation**: Each user only sees their own tips (userId check)
2. **Dismissal scope**: Can only dismiss own tips (userId validation)
3. **No XSS**: Tip content is text fields, no HTML/markdown execution
4. **No SQL injection**: Using Prisma parameterized queries
5. **Auth required**: All endpoints require valid JWT token
6. **Rate limiting**: (optional) Can be added to POST/PATCH endpoints

## Testing Strategy

### Unit Tests
```typescript
// tips.service.test.ts
describe("TipsService", () => {
  test("getActiveTips returns only non-dismissed tips", () => {});
  test("dismissTip updates isDismissed and dismissedAt", () => {});
  test("viewTip increments viewCount", () => {});
});
```

### Integration Tests
```typescript
// tips.controller.test.ts
describe("Tips API", () => {
  test("GET /api/tips returns user's active tips", () => {});
  test("PATCH /api/tips/:id/dismiss marks tip as dismissed", () => {});
  test("Unauthorized request returns 401", () => {});
});
```

### E2E Tests
```typescript
// tips.e2e.test.ts
describe("Tips Feature", () => {
  test("User can see and dismiss tips in carousel", () => {});
  test("Dismissed tips don't reappear on refresh", () => {});
  test("Different users see different tips", () => {});
});
```

## Deployment Checklist

- [ ] Database migration applied (`npx prisma migrate deploy`)
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Seed script run (`npx ts-node prisma/seed-tips.ts`)
- [ ] Backend routes registered (check console logs)
- [ ] Frontend component deployed
- [ ] API endpoints accessible and returning data
- [ ] Tips display in sidebar on desktop
- [ ] Dismiss functionality working
- [ ] View tracking being recorded
- [ ] Mobile view respects `useIsMobile` hook (carousel hidden)

