# Tips Feature - Setup & Testing Guide

## Quick Start

### 1. Apply Database Migration

The migration file has been created at `backend/prisma/migrations/20260126095431_add_tip_model/migration.sql`.

**Option A: Using Prisma CLI** (recommended if Node.js/npm versions are compatible)
```bash
cd backend
npx prisma migrate deploy
```

**Option B: Manual SQL execution** (if Prisma CLI has version issues)
```bash
# Connect to your PostgreSQL database and run the migration manually:
psql $DATABASE_URL < backend/prisma/migrations/20260126095431_add_tip_model/migration.sql
```

### 2. Seed Default Tips

After migration is applied, populate default tips:

```bash
cd backend
npx ts-node prisma/seed-tips.ts
```

This creates 8 default tips for each existing user covering getting-started, feature highlights, and productivity tips.

### 3. Restart Backend

```bash
cd backend
npm run dev
# or
node main.ts
```

The backend will log: `💡 Tips routes enabled at /api/tips`

### 4. Test in Frontend

1. Open the desktop dashboard (not mobile)
2. Look at the **bottom of the left sidebar** (below navigation items, above logout)
3. You should see the Tips Carousel with:
   - A colorful card with an emoji icon, title, and description
   - Navigation arrows (◀ ▶) and dot indicators
   - A dismiss button (×) in the top-right corner
   - A category badge
   - A counter showing position (e.g., "1 / 8")

## Testing Scenarios

### Scenario 1: View Tips
- Tips automatically rotate every 8 seconds
- Click navigation arrows to manually rotate
- Click dots to jump to a specific tip
- Verify counter updates correctly

### Scenario 2: Track Views
Open browser DevTools (Network tab):
1. View a tip (by letting it auto-rotate)
2. Verify `PATCH /api/tips/:id/view` is called
3. Verify response shows incremented `viewCount`

### Scenario 3: Dismiss Tips
1. Click the × button on any tip
2. Tip should disappear from carousel
3. If this was the last tip, carousel should disappear entirely
4. Refresh page - dismissed tip should not reappear
5. Verify `PATCH /api/tips/:id/dismiss` was called in Network tab

### Scenario 4: Multiple Users
1. Create two test users
2. Log in as User A, dismiss some tips
3. Log in as User B, verify they see different tips
4. Switch back to User A, dismissed tips still gone

## API Endpoints

### Get Active Tips
```http
GET /api/tips?limit=5&offset=0&targetFeature=memories
Authorization: Bearer {token}
```

Response:
```json
{
  "success": true,
  "tips": [
    {
      "id": "tip123",
      "userId": "user456",
      "title": "Welcome to Second Brain",
      "description": "Your personal AI system...",
      "category": "getting-started",
      "targetFeature": "dashboard",
      "isDismissed": false,
      "dismissedAt": null,
      "viewCount": 2,
      "lastViewedAt": "2026-01-26T10:00:00Z",
      "priority": 100,
      "icon": "lightbulb",
      "createdAt": "2026-01-26T09:00:00Z",
      "updatedAt": "2026-01-26T09:00:00Z"
    }
  ],
  "total": 8,
  "limit": 5,
  "offset": 0
}
```

### Track Tip View
```http
PATCH /api/tips/tip123/view
Authorization: Bearer {token}
Content-Length: 0
```

Response:
```json
{
  "success": true,
  "tip": {
    "id": "tip123",
    "viewCount": 3,
    "lastViewedAt": "2026-01-26T10:15:00Z",
    ...
  }
}
```

### Dismiss Tip
```http
PATCH /api/tips/tip123/dismiss
Authorization: Bearer {token}
Content-Length: 0
```

Response:
```json
{
  "success": true,
  "tip": {
    "id": "tip123",
    "isDismissed": true,
    "dismissedAt": "2026-01-26T10:20:00Z",
    ...
  }
}
```

## Troubleshooting

### Tips carousel not appearing
1. Check browser console for errors
2. Verify backend is running and `/api/tips` endpoint is accessible
3. Check Network tab - should see GET request to `/api/tips`
4. Verify user is authenticated (check auth token in headers)

### Tips not dismissing
1. Check Network tab for PATCH request to `/api/tips/:id/dismiss`
2. Verify response is successful (status 200)
3. Check browser console for error messages

### "Tips loading" stuck
1. Check backend logs for errors
2. Verify database connection
3. Verify user has tips created (check database)

### Different tips for different users
This is **expected behavior**. Tips are per-user, so each user:
- Sees only their own tips
- Has their own dismiss state
- Their tips won't affect other users

## Database Queries for Debugging

### Check tips for a user
```sql
SELECT * FROM tips 
WHERE "userId" = 'user123'
ORDER BY "isDismissed" ASC, priority DESC;
```

### Check dismissed tips
```sql
SELECT * FROM tips 
WHERE "isDismissed" = true
ORDER BY "dismissedAt" DESC;
```

### Check view counts
```sql
SELECT title, "viewCount", "lastViewedAt" FROM tips
WHERE "viewCount" > 0
ORDER BY "viewCount" DESC;
```

### Reset tips for a user
```sql
DELETE FROM tips WHERE "userId" = 'user123';
```

## Customizing Tips

### Add a new tip via TypeScript
```typescript
import { tipsService } from "./services/tips.js";

await tipsService.createTip({
  userId: "user123",
  title: "New Feature Available",
  description: "Learn about our latest feature",
  category: "feature-highlight",
  targetFeature: "dashboard",
  priority: 90,
  icon: "star",
  metadata: {
    videoUrl: "https://example.com/video",
    learnMoreUrl: "https://example.com/docs"
  }
});
```

### Edit default tips
Edit `backend/prisma/seed-tips.ts` and re-run:
```bash
cd backend
# First delete old tips (optional)
npx prisma db execute "DELETE FROM tips;"
# Then reseed
npx ts-node prisma/seed-tips.ts
```

### Change carousel auto-rotation interval
In `src/components/TipsCarousel.tsx`, change this line:
```typescript
}, 8000); // Change 8000 to desired milliseconds
```

### Change tip display position
In `src/pages/DashboardPage.tsx`, move the `<TipsCarousel />` component to a different location, or add conditions to only show on certain pages.

## Performance Considerations

- Tips are fetched once on dashboard mount
- Dismissed tips removed from frontend state (don't require server round-trip on next load)
- View tracking is async (non-blocking)
- Carousel updates are local state only
- Database indexes on userId, isDismissed, priority for fast queries

## Future Enhancements

Potential improvements for future iterations:
- [ ] Animated transitions between tips
- [ ] Rich content support (markdown, images)
- [ ] Analytics: which tips are most viewed
- [ ] A/B testing different tip variations
- [ ] Schedule tips to show only at specific times
- [ ] Tip dependencies (show tip B only after tip A is viewed)
- [ ] Contextual tips (show only when viewing specific features)
- [ ] Tip ratings/feedback from users
- [ ] Admin panel to manage tips globally

