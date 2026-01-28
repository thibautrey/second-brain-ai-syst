# LLM Provider Resilience & Error Learning System

## Overview

The LLM Provider Resilience system enables the Second Brain AI System to learn from errors and improve provider/model selection over time. Instead of repeatedly hitting the same incompatible endpoints, the system remembers what worked and what didn't.

## Problem Statement

Before this system, when a model failed with an incompatible endpoint error (e.g., "This model is only supported in v1/responses and not in v1/chat/completions"), the system would:

1. ❌ Try the same failing endpoint again the next time
2. ❌ Exhaust both primary and fallback providers unnecessarily
3. ❌ Waste resources and time on known incompatibilities
4. ❌ Provide poor user experience with repeated failures

## Solution: ModelCompatibilityHint System

### Key Features

#### 1. **Error Recording & Learning**
- Every LLM call failure is recorded with classification
- Error type, timestamp, and message are stored
- Error count incremented for tracking failure patterns

#### 2. **Success Tracking**
- Successful calls increment success counter
- Preferred endpoints learned from successful calls
- Confidence in provider/model combinations builds over time

#### 3. **Automatic Blacklisting**
- Models with 5+ errors and 0 successes are auto-blacklisted
- Prevents wasting resources on completely broken configurations
- Can be manually reviewed and overridden

#### 4. **Intelligent Fallback**
- Checks if primary/fallback are blacklisted before attempting
- Skips known-bad configurations
- Falls back faster to working providers

### Data Structure

```sql
model_compatibility_hints {
  providerId              -- Reference to AIProvider
  modelId                 -- Model identifier (e.g., 'gpt-4o', 'qwen3-coder')
  
  -- What we learned works
  supportedEndpoints[]    -- Endpoints confirmed to work (e.g., ['/v1/responses'])
  unsupportedEndpoints[]  -- Endpoints that fail (e.g., ['/v1/chat/completions'])
  preferredEndpoint       -- Best endpoint for this model
  
  -- Error tracking
  errorCount              -- How many times this combo failed
  lastErrorType           -- Latest error classification
  lastErrorMessage        -- Latest error message
  lastErrorTime           -- When the last error occurred
  
  -- Success tracking
  successCount            -- How many times it worked
  lastSuccessTime         -- When it last succeeded
  
  -- Administrative
  isBlacklisted           -- Should we use this model?
  blacklistReason         -- Why it's blacklisted
}
```

## Usage Examples

### Example 1: Learning from Model Incompatibility

```
1. First attempt with OpenAI fallback provider (codex-mini-latest):
   ERROR: "404 This model is only supported in v1/responses and not in v1/chat/completions."

2. System records:
   - Provider: openai
   - Model: codex-mini-latest
   - Error type: model-incompatible
   - Unsupported endpoint: /v1/chat/completions
   - Error count: 1

3. Next time same model is tried:
   - System checks compatibility hint
   - Sees /v1/chat/completions failed before
   - Could try /v1/responses instead
   - Or skip to fallback faster
```

### Example 2: Auto-Blacklisting

```
Model has failed 5 times with no successes:
- Provider: GpuStack
- Model: qwen3-coder-30b-a3b-instruct-fp8
- Error count: 5
- Success count: 0

System automatically:
1. Blacklists the combination
2. Sets blacklistReason: "Too many errors (5) with no successes"
3. Next attempt skips this provider immediately
4. Goes straight to fallback
```

### Example 3: Success Builds Confidence

```
Attempt 1: Model fails (error recorded)
Attempt 2: Model fails (error recorded, count = 2)
Attempt 3: Model succeeds ✓ (success recorded, count = 1)
Attempt 4: Model succeeds ✓ (success recorded, count = 2)

Result:
- Success count = 2
- Error count = 2
- Last success = now
- isBlacklisted = false (not triggered since successes > 0)
```

## Code Implementation

### Key Files

1. **`services/model-compatibility-hint.ts`** - Core compatibility management
   - `recordModelError()` - Learn from failures
   - `recordModelSuccess()` - Learn from successes
   - `getCompatibilityHint()` - Check what we know
   - `isModelBlacklisted()` - Check if we should skip it
   - `getRecommendedEndpoint()` - Find the best endpoint to use
   - `blacklistModel()` - Manually blacklist if needed

2. **`services/llm-router.ts`** - Enhanced with learning
   - Import compatibility hint service
   - Check blacklist status before attempting
   - Record errors/successes after each call
   - Extract endpoint hints from error messages
   - Skip failed combinations intelligently

3. **Database Migration** - `20260128_add_model_compatibility_hints`
   - Creates `model_compatibility_hints` table
   - Indexes for efficient queries

### Integration Points

#### In LLMRouter.callLLM()

```typescript
// Before trying primary provider
const primaryBlacklisted = await isModelBlacklisted(provider.id, provider.modelId);
if (primaryBlacklisted) {
  console.warn("Primary is blacklisted, skipping to fallback");
  // Jump to fallback logic
}

// After successful call
await recordModelSuccess(provider.id, provider.modelId);

// After failed call
await recordModelError(provider.id, provider.modelId, errorInfo);
```

#### In LLMRouter.attemptLLMCall()

```typescript
// Detect model-incompatible errors
if (errorMsg.includes("only supported in v1/responses")) {
  const alternativeEndpoint = "v1/responses";
  (llmError as any).suggestedEndpoint = alternativeEndpoint;
  // Will be recorded in error recording
}
```

## Resilience Behavior

### Scenario 1: Provider Timeout (Transient Error)

```
Primary times out (transient error, isRetryable=true)
→ Record error
→ Try fallback
→ If fallback succeeds, use it
→ Both recorded appropriately
```

**Result**: System learns provider has latency issues but doesn't blacklist (transient)

### Scenario 2: Model Incompatible (Permanent Error)

```
Fallback returns "404 model only in v1/responses"
→ Record error with type "model-incompatible" (not retryable)
→ Extract endpoint hint
→ On next use, know to use v1/responses or skip
```

**Result**: System avoids hitting wrong endpoint repeatedly

### Scenario 3: Repeated Failures

```
Model fails 5+ times with 0 successes
→ Auto-blacklist (set isBlacklisted=true, set reason)
→ Next attempt skips immediately
→ No wasted resources
```

**Result**: Broken configurations are quarantined

## Error Classification

The system classifies errors for intelligent handling:

```typescript
type LLMErrorInfo = {
  type: "timeout" | "model-incompatible" | "auth" | "rate-limit" | "network" | "unknown"
  status?: number
  message: string
  isRetryable: boolean      // Should we retry this?
  isTransient: boolean      // Is this temporary or permanent?
}
```

Examples:

| Error | Type | Retryable | Transient | Action |
|-------|------|-----------|-----------|--------|
| `timeout` | timeout | ✓ | ✓ | Retry, don't blacklist |
| `404 model not in /chat/completions` | model-incompatible | ✗ | ✗ | Record, don't retry same endpoint |
| `401 Invalid API key` | auth | ✗ | ✗ | Don't retry, blacklist |
| `429 Rate limit` | rate-limit | ✓ | ✓ | Backoff, retry |
| `503 Service unavailable` | network | ✓ | ✓ | Retry, don't blacklist |

## Future Enhancements

### 1. **Alternative Endpoints**
- Try alternative endpoints before falling back
- Example: If `/v1/chat/completions` fails, try `/v1/responses`
- Stored in `preferredEndpoint` field

### 2. **Weighted Selection**
- Route based on success rate
- Higher success ratio = higher priority
- Example: Provider A (90% success) preferred over Provider B (70% success)

### 3. **Per-Task Learning**
- Track compatibility per task type
- Some models might work for chat but fail for summarization
- Link hints to `AITaskConfig`

### 4. **Auto-Recovery**
- Periodically retry blacklisted models
- Remove blacklist if recovery succeeds
- Prevent permanent false positives

### 5. **Compatibility Matrix**
- Dashboard showing all known compatibility info
- Visualize which providers/models work best
- Admin can tune configurations based on data

### 6. **Predictive Routing**
- Use compatibility hints to predict best provider
- Route to known-good combinations first
- Faster response times overall

## Monitoring & Operations

### Key Metrics to Track

```sql
-- Success rate by provider/model
SELECT 
  providerId, modelId,
  ROUND(successCount::float / (successCount + errorCount) * 100, 2) as success_rate,
  errorCount, successCount
FROM model_compatibility_hints
WHERE successCount + errorCount > 0
ORDER BY success_rate DESC;

-- Recently blacklisted models
SELECT providerId, modelId, blacklistReason, createdAt
FROM model_compatibility_hints
WHERE isBlacklisted = true
ORDER BY createdAt DESC;

-- Common error types
SELECT lastErrorType, COUNT(*) as count
FROM model_compatibility_hints
WHERE lastErrorType IS NOT NULL
GROUP BY lastErrorType
ORDER BY count DESC;
```

### Manual Intervention

```typescript
// Unblacklist a model (e.g., after fixing provider issue)
import { blacklistModel } from './services/model-compatibility-hint';

await blacklistModel(providerId, modelId, null); // Pass null to unblacklist

// Set preferred endpoint based on testing
import { setPreferredEndpoint } from './services/model-compatibility-hint';

await setPreferredEndpoint(providerId, modelId, 'v1/responses');

// Get all hints for a provider
import { getProviderHints } from './services/model-compatibility-hint';

const hints = await getProviderHints(providerId);
console.table(hints);
```

## Testing the System

### Test 1: Error Recording

```typescript
// First call fails
recordModelError(providerId, modelId, {
  type: 'model-incompatible',
  message: '404 model only in v1/responses',
  isRetryable: false,
  isTransient: false
});

// Check hint was created
const hint = await getCompatibilityHint(providerId, modelId);
console.log(hint.errorCount); // Should be 1
```

### Test 2: Auto-Blacklist

```typescript
// Record 5 errors, 0 successes
for(let i = 0; i < 5; i++) {
  await recordModelError(providerId, modelId, errorInfo);
}

// Check blacklist status
const isBlacklisted = await isModelBlacklisted(providerId, modelId);
console.log(isBlacklisted); // Should be true
```

### Test 3: Blacklist Skipping

```typescript
// In callLLM()
const isBlacklisted = await isModelBlacklisted(provider.id, provider.modelId);
console.log(isBlacklisted); // true, so skip primary
// Should go straight to fallback
```

## Production Deployment

1. **Run migration**: `npm run prisma:migrate`
2. **No code changes needed**: Uses new table transparently
3. **Verify learning**: Check logs for `[CompatibilityHint]` messages
4. **Monitor**: Set up dashboard to track success rates
5. **Iterate**: Use compatibility data to optimize configurations

## Questions & Troubleshooting

**Q: Why is my provider being blacklisted?**
A: Check with: `SELECT * FROM model_compatibility_hints WHERE providerId = 'xxx' AND isBlacklisted = true;`

**Q: How do I un-blacklist a provider?**
A: Manually set `isBlacklisted = false` or use `blacklistModel(providerId, modelId, null);`

**Q: Will this affect current behavior?**
A: No, it's entirely backward compatible. Existing calls work the same, just with added learning.

**Q: How long until it learns?**
A: Immediately - errors and successes are recorded in real-time.

---

**Last Updated**: January 28, 2026
**Version**: 1.0.0
