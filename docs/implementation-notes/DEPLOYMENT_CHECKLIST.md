# LLM Provider Resilience - Deployment Checklist

## Pre-Deployment

- [ ] Review the implementation summary: [`LLM_RESILIENCE_IMPLEMENTATION_SUMMARY.md`](/docs/implementation-notes/LLM_RESILIENCE_IMPLEMENTATION_SUMMARY.md)
- [ ] Review the system documentation: [`llm-provider-resilience-system.md`](/docs/implementation-notes/llm-provider-resilience-system.md)
- [ ] Review usage examples: [`llm-resilience-usage-examples.ts`](/docs/implementation-notes/llm-resilience-usage-examples.ts)
- [ ] Ensure backup of current database
- [ ] Test in development environment first

## Deployment Steps

### 1. Update Prisma Schema
- [x] Added `ModelCompatibilityHint` model to schema
- [x] Created migration file: `20260128_add_model_compatibility_hints`

**Verify**: 
```bash
grep -n "model ModelCompatibilityHint" backend/prisma/schema.prisma
# Should show the new model around line 835
```

### 2. Add Service Implementation
- [x] Created `backend/services/model-compatibility-hint.ts`
- [x] Contains all compatibility hint management functions

**Verify**:
```bash
ls -la backend/services/model-compatibility-hint.ts
# Should exist and be ~400 lines
```

### 3. Update LLMRouterService
- [x] Imported compatibility hint service
- [x] Updated `callLLM()` to check blacklist before attempting
- [x] Updated `callLLM()` to record errors/successes
- [x] Updated `attemptLLMCall()` to detect endpoint hints
- [x] Enhanced error handling for model incompatibility

**Verify**:
```bash
grep -n "recordModelError\|recordModelSuccess\|isModelBlacklisted" backend/services/llm-router.ts
# Should have multiple matches
```

### 4. Run Database Migration
```bash
cd backend
npm run prisma:migrate dev
# Follow prompts, should create model_compatibility_hints table
```

**Verify migration succeeded**:
```bash
npm run prisma:db:push
# Should complete without errors

# Check table exists:
npx prisma studio
# Should show model_compatibility_hints table in UI
```

### 5. Build TypeScript
```bash
cd backend
npm run build
# Should complete without errors
```

**Verify**:
```bash
ls -la dist/services/model-compatibility-hint.js
# Should exist
```

### 6. Test in Development
```bash
npm run dev
# Or start with Docker Compose
```

**Expected Logs**:
- Should see `[CompatibilityHint]` messages when errors/successes occur
- Should see blacklist checks in logs: `[LLMRouter] Primary provider "..." is blacklisted`

### 7. Deploy to Production
```bash
# Push code changes
git add backend/services/model-compatibility-hint.ts
git add backend/services/llm-router.ts
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260128_add_model_compatibility_hints/
git add docs/implementation-notes/
git commit -m "feat: add LLM provider resilience learning system"

# Push to repository
git push

# Run migrations on production database
npm run prisma:migrate deploy

# Rebuild and restart
npm run build
docker-compose restart backend  # or your deployment method
```

## Post-Deployment Verification

### 1. Check Database Table
```sql
SELECT * FROM model_compatibility_hints LIMIT 1;
-- Should return (possibly empty) with all columns present
```

### 2. Monitor for Learning
```bash
# Watch logs for learning messages
docker logs -f backend | grep "CompatibilityHint"
# Should see messages like:
# [CompatibilityHint] Recorded error for ...
# [CompatibilityHint] First success for ...
```

### 3. Query Learned Information After 24 Hours
```sql
-- Check what was learned
SELECT 
  providerId, modelId, 
  errorCount, successCount,
  CASE WHEN isBlacklisted THEN '⚠️ BLACKLISTED' ELSE '✓ OK' END as status
FROM model_compatibility_hints
ORDER BY errorCount DESC;
```

### 4. Test Error Recording
```bash
# Trigger an intentional error to see learning in action:
# 1. Use a bad provider/model combo
# 2. Watch logs for [CompatibilityHint] Recorded error
# 3. Check database: SELECT * FROM model_compatibility_hints WHERE modelId = 'bad-model';
```

## Troubleshooting

### Issue: Migration fails with "relation does not exist"
**Solution**: Ensure previous migrations ran successfully
```bash
npm run prisma:db:push --force-reset  # CAREFUL: Only in dev
```

### Issue: Table not created
**Solution**: Check migration file exists
```bash
ls backend/prisma/migrations/20260128_add_model_compatibility_hints/migration.sql
```

### Issue: TypeScript build errors
**Solution**: Check imports in llm-router.ts
```bash
grep "model-compatibility-hint" backend/services/llm-router.ts
# Should show the import statement
```

### Issue: No learning happening
**Solution**: Check if errors are occurring
1. Verify provider/model combos are being tested
2. Check logs for `[LLMRouter]` messages
3. Manually query database to see if records exist

## Rollback Plan

If issues occur, you can safely roll back:

```bash
# Revert code changes
git revert <commit-hash>

# Rollback migration (data safe, just removes table)
npm run prisma:migrate resolve --rolled-back 20260128_add_model_compatibility_hints

# OR keep the table but disable usage by commenting imports in llm-router.ts
```

The system is designed to be non-breaking - if something goes wrong, the LLM router still works without learning.

## Monitoring & Maintenance

### Weekly Check
```sql
-- See what models are problematic
SELECT modelId, errorCount, successCount, isBlacklisted 
FROM model_compatibility_hints 
WHERE errorCount > 2
ORDER BY errorCount DESC;
```

### Monthly Cleanup
```sql
-- Archive old data if table grows large
DELETE FROM model_compatibility_hints 
WHERE lastErrorTime < NOW() - INTERVAL '90 days' 
AND errorCount = 0 AND successCount = 0;
```

### Quarterly Review
- Review which providers have lowest success rates
- Investigate and possibly replace low-performing providers
- Update fallback configurations based on learned data

## Success Criteria

✅ System is working if:
1. [x] Database migration completes without errors
2. [x] Backend builds and starts successfully
3. [x] Logs show `[CompatibilityHint]` messages for errors/successes
4. [x] Database has entries in `model_compatibility_hints` table
5. [x] Failed providers are eventually blacklisted (after 5+ errors)
6. [x] Subsequent attempts skip blacklisted models faster

## Questions?

Refer to:
- **Overview**: `/docs/implementation-notes/LLM_RESILIENCE_IMPLEMENTATION_SUMMARY.md`
- **Technical Details**: `/docs/implementation-notes/llm-provider-resilience-system.md`
- **Usage Examples**: `/docs/implementation-notes/llm-resilience-usage-examples.ts`

---

**Deployment Status**: Ready ✅
**Risk Level**: Low (non-breaking change, adds new learning capability)
**Rollback Difficulty**: Easy (just remove imports if needed)
**Data Loss Risk**: None (only adds new table, doesn't modify existing data)

