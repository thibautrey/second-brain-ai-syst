# Quick Reference: Error Classification & Graceful Degradation

## What Changed?

The system now **automatically classifies LLM errors** and **gracefully skips operations** instead of crashing when providers fail.

## Error Classification

When an LLM call fails, the system classifies it as one of:

```typescript
type ErrorType = 
  | "timeout"              // 403, "upstream request timeout" → Retry next cycle
  | "model-incompatible"   // 404, "model" in error → Skip permanently 
  | "auth"                 // 401, 403 permission → Admin action needed
  | "rate-limit"           // 429, "rate" → Retry with backoff
  | "network"              // 503, 502 → Retry next cycle
  | "unknown"              // Other errors → Skip safely
```

## For Developers

### Handling LLM Errors Gracefully

```typescript
import { llmRouterService, classifyLLMError } from "./llm-router.js";

try {
  const response = await llmRouterService.executeTask(
    userId,
    "analysis",
    userMessage,
    systemPrompt
  );
} catch (error) {
  // Error now includes classification info
  const errorInfo = error?.errorInfo || error?.primaryErrorInfo;
  
  if (errorInfo?.isTransient) {
    // Temporary issue - will be retried next cycle
    console.info(`Skipping: ${errorInfo.message}`);
    return gracefulSkip();
  }
  
  if (errorInfo?.isRetryable) {
    // Can retry immediately with backoff
    return retryWithBackoff();
  }
  
  // Permanent error - needs investigation
  throw error;
}
```

### Memory Cleaner Behavior

**When LLM providers are unavailable**, memory cleanup now:

1. **Skips gracefully** instead of crashing
2. **Logs the reason** with error type for debugging
3. **Continues to next cycle** to retry

```typescript
const result = await memoryCleanerService.runMemoryCleanup(userId);

if (result.skipped) {
  console.info(`Cleanup skipped: ${result.skipReason}`);
  // System continues running - no crash
} else {
  console.log(`Cleaned up ${result.memoriesDeleted} memories`);
}
```

## New Log Messages

Look for these patterns in logs:

### Provider Timeout (Transient)
```
[LLMRouter] Primary provider failed with timeout error
  → Will retry in next cycle
```

### Model Incompatibility (Permanent)
```
[LLMRouter] Primary provider failed with model-incompatible error
[LLMRouter] Attempting fallback provider...
[MemoryCleaner] LLM call failed with model-incompatible error. Skipping cleanup.
  → Will retry in next cycle (providers might be reconfigured)
```

### Network Issue (Transient)
```
[LLMRouter] Primary provider failed with network error
  → Will retry in next cycle
```

### Info Messages
```
ℹ Memory cleaner skipped for user123: LLM provider unavailable
✓ Memory cleaner: archived 3, deleted 2 for user456
```

## System Behavior

### Before
- LLM provider fails → Memory cleaner crashes → Scheduler stops → System unresponsive ❌

### After
- LLM provider fails → Memory cleaner skips → Scheduler continues → System responsive ✅

## For Operations

### When You See "Memory cleaner skipped"

This is **normal and expected**. It means:
- LLM providers were temporarily unavailable
- System gracefully skipped optimization
- Will retry in next cycle (usually 5 minutes)

**Action**: None required - the system auto-recovers

### When You See Error Type in Logs

- **timeout/network**: Usually temporary → Monitor but no action needed
- **model-incompatible**: Check if model configuration changed → May need reconfiguration
- **auth**: Check API keys → Likely misconfiguration
- **rate-limit**: Check rate limits → May need to adjust request frequency

## Monitoring Dashboard (Future)

Metrics to track:
- Cleanup skip rate
- Error types per provider
- Provider availability %
- Automatic recovery success rate

See `/docs/implementation-notes/LLM_ERROR_HANDLING_IMPROVEMENTS.md` for complete details.
