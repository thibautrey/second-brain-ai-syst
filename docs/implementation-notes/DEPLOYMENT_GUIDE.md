# Smart Notifications - Next Steps & Deployment

## 🚀 Pre-Deployment Checklist

### Code Review

- [ ] Review all new files for code quality
- [ ] Check for console.log statements (debug code)
- [ ] Verify error handling is comprehensive
- [ ] Ensure no credentials/secrets in code
- [ ] Check TypeScript types are correct

### Testing

- [ ] Run unit tests (if applicable)
- [ ] Manual testing on desktop browser
- [ ] Manual testing on mobile browser
- [ ] Test with different notification types
- [ ] Test presence detection with network throttling
- [ ] Test with WebSocket connection drops

### Database

- [ ] Backup production database
- [ ] Test migration on staging environment
- [ ] Verify migration on production
- [ ] Check for migration errors in logs

### Performance

- [ ] Monitor CPU usage during heartbeats
- [ ] Monitor network bandwidth (heartbeat traffic)
- [ ] Check memory usage with many notifications
- [ ] Monitor database query performance

## 📋 Deployment Steps

### Step 1: Database Migration

```bash
cd /Users/thibaut/gitRepo/second-brain-ai-syst/backend

# Run migration
npx prisma migrate deploy

# Verify migration
npx prisma db execute --stdin < verify_migration.sql
```

**Verify Migration Script** (`verify_migration.sql`):

```sql
-- Check user_presence table exists
\dt user_presence

-- Check user has presence records
SELECT COUNT(*) as presence_records FROM user_presence;

-- Check indexes
\di user_presence*

-- Expected output:
-- Table 'user_presence' with 1 row
-- Index on userId (unique)
```

### Step 2: Backend Deployment

```bash
# From project root
cd /Users/thibaut/gitRepo/second-brain-ai-syst

# Rebuild backend
docker compose build backend

# Restart backend
docker compose restart backend

# Check logs
docker compose logs backend

# Verify no errors with 'ERROR' in logs
docker compose logs backend | grep ERROR
```

### Step 3: Frontend Deployment

```bash
# Rebuild frontend
npm run build

# Verify build output
ls -la dist/

# If using docker:
docker compose build frontend
docker compose restart frontend
```

### Step 4: Smoke Testing

```bash
# Test backend is running
curl http://localhost:3000/api/user/presence/status \
  -H "Authorization: Bearer <test_token>"

# Should return 401 (no auth) or 200 (valid token)
# But not connection errors

# Test presence endpoint
curl -X POST http://localhost:3000/api/user/presence/heartbeat \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": "2026-01-26T...", "isFocused": true}'

# Should return 200 with success: true
```

### Step 5: Monitor After Deployment

```bash
# Watch backend logs for errors
docker compose logs -f backend | grep -E "(ERROR|error|Failed)"

# Monitor database connections
# In psql:
SELECT usename, count(*) FROM pg_stat_activity GROUP BY usename;

# Check user_presence records being created
SELECT COUNT(*) FROM user_presence WHERE "updatedAt" > NOW() - INTERVAL '5 minutes';

# Should see increasing count every 5 seconds
```

## 🔄 Rollback Plan

If issues occur, rollback is straightforward:

### Option 1: Disable Smart Routing (Quick Fix)

```bash
# Edit src/config/smart-notifications.ts
# Set: ENABLE_SMART_ROUTING: false

# This makes all notifications use standard channels
# Presence tracking continues but doesn't affect routing
```

### Option 2: Full Rollback (if migration failed)

```bash
# Rollback database migration
cd backend
npx prisma migrate resolve --rolled-back 20260126193738_add_user_presence

# Revert code changes
git revert <commit_hash>

# Restart services
docker compose restart backend frontend
```

## 📊 Monitoring & Metrics

### Key Metrics to Monitor

```sql
-- Presence heartbeat volume
SELECT
  DATE_TRUNC('minute', "updatedAt") as minute,
  COUNT(*) as heartbeats
FROM user_presence
WHERE "updatedAt" > NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute DESC;

-- Active users
SELECT COUNT(*) as active_users
FROM user_presence
WHERE "lastActiveAt" > NOW() - INTERVAL '5 minutes'
AND "isOnline" = true;

-- Notification routing to chat
SELECT
  channels,
  COUNT(*) as count
FROM notification
WHERE "createdAt" > NOW() - INTERVAL '1 day'
GROUP BY channels;
```

### Alert Thresholds

- ⚠️ If heartbeat requests drop below 1 per 5 seconds per active user
- ⚠️ If WebSocket message queue size > 1000
- ⚠️ If presence check latency > 500ms
- ⚠️ If database query performance degrades > 20%

## 🧪 User Acceptance Testing

### Test Scenarios

**Scenario 1: Active User**

1. Open browser → see heartbeats in Network tab
2. Send notification → appears in chat
3. Hear elegant sound
4. Message auto-dismisses or shows action

**Scenario 2: Inactive User**

1. Stop clicking for 30+ seconds
2. Send notification → doesn't appear in chat
3. Notification appears in standard location (IN_APP)
4. No sound plays

**Scenario 3: Tab Switching**

1. Send notification in active tab → appears in chat
2. Switch to another tab (blur) → isFocused becomes false
3. Send notification → may not appear in chat
4. Switch back to original tab → tracking resumes

**Scenario 4: Network Issues**

1. Network throttled to slow 3G
2. Notifications still appear but with delay
3. Fallback to standard channels if WebSocket fails
4. No errors in console

**Scenario 5: Different Notification Types**

1. Success → green, auto-dismiss
2. Error → red, persistent
3. Reminder → blue, persistent
4. Achievement → purple, auto-dismiss
5. Each plays sound appropriately

## 📝 Configuration for Production

### Environment Variables

```bash
# .env file
ENABLE_SMART_ROUTING=true
NOTIFICATION_HEARTBEAT_INTERVAL=5000
NOTIFICATION_INACTIVITY_TIMEOUT=30000
NOTIFICATION_SOUND_VOLUME=0.3
NOTIFICATION_AUTO_DISMISS_TIMEOUT=8000
```

### Optional: User Settings Integration

In the future, add to UserSettings model:

```prisma
model UserSettings {
  // ... existing fields

  // Smart notification preferences
  smartNotificationsEnabled Boolean @default(true)
  notificationSoundEnabled Boolean @default(true)
  notificationSoundVolume Float @default(0.3) // 0.0-1.0
  notificationAutoDismissDelay Int @default(8000) // ms
}
```

## 🔍 Post-Deployment Verification

### Day 1: Stability Check

- [ ] No database errors in logs
- [ ] Presence heartbeats sending consistently
- [ ] Notifications appearing in chat for active users
- [ ] Sound playing without errors
- [ ] No memory leaks or connection issues

### Day 3: Performance Check

- [ ] Database query performance stable
- [ ] WebSocket connection stable
- [ ] No spikes in CPU/memory usage
- [ ] Heartbeat requests consistent volume
- [ ] User reported no issues

### Week 1: Usage Analytics

- [ ] Measure percentage of notifications routed to CHAT
- [ ] Measure average presence detection accuracy
- [ ] Collect user feedback on sound/timing
- [ ] Monitor for edge cases/bugs

## 📞 Support Contacts

If issues occur:

1. Check `/docs/implementation-notes/TESTING_SMART_NOTIFICATIONS.md`
2. Review logs: `docker compose logs backend | grep -A5 "presence\|notification"`
3. Check database: `psql -U postgres -d second_brain_dev`
4. Verify WebSocket: Check DevTools Network tab for WebSocket connection

## 🎯 Success Criteria

✅ Notifications route to chat when user is active  
✅ Notifications use standard channels when user is away  
✅ Elegant sound plays smoothly without issues  
✅ No performance degradation  
✅ Zero breaking changes to existing features  
✅ Database migration completes successfully  
✅ All tests pass  
✅ User feedback positive

## 🚀 Go/No-Go Decision

**Go to Production if:**

- All tests pass
- No critical issues found
- Performance metrics acceptable
- Database migration successful
- No breaking changes to existing APIs

**Hold/Rollback if:**

- Critical bugs discovered
- Performance issues > 20% degradation
- Database migration fails
- Breaking changes to existing features

---

**Prepared**: January 26, 2026  
**Target Deployment**: January 27, 2026  
**Estimated Downtime**: 5-10 minutes  
**Risk Level**: Low (non-breaking changes, graceful fallback)
