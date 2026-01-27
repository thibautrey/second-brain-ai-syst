# LLM Error Handling & Graceful Degradation

**Date**: 27 January 2026  
**Status**: Implemented  
**Scope**: Backend LLM routing, error classification, and graceful failure handling

## Problem Statement

The system was experiencing cascading failures when LLM providers became unavailable:

```
Primary: 403 upstream request timeout (GpuStack)
Fallback: 404 model incompatible with /chat/completions (OpenAI)
Result: Memory cleanup agent crashes, stops processing
```

This caused the entire background agent system to fail when providers had temporary issues or incompatibilities.

## Solution Overview

Implemented **intelligent error classification and graceful degradation** across three layers:

### 1. LLM Router - Error Classification (`llm-router.ts`)

Added `LLMErrorInfo` interface and `classifyLLMError()` function to categorize failures:

```typescript
export interface LLMErrorInfo {
  type: "timeout" | "model-incompatible" | "auth" | "rate-limit" | "network" | "unknown";
  status?: number;
  message: string;
  isRetryable: boolean;      // Whether to retry this request
  isTransient: boolean;      // Whether the error is temporary
}
```

**Error Classification Logic**:

| Error Type | Detection | Retry | Transient |
|-----------|-----------|-------|-----------|
| **timeout** | Message contains "timeout", "ECONNRESET", "ETIMEDOUT" | ✅ Yes | ✅ Yes |
| **model-incompatible** | 404 + "model" in message | ❌ No | ❌ No |
| **auth** | 401 or 403 + "permission" | ❌ No | ❌ No |
| **rate-limit** | 429 or "rate" in message | ✅ Yes | ✅ Yes |
| **network** | 503, 502, or "upstream" | ✅ Yes | ✅ Yes |
| **unknown** | All others | ❌ No | ❌ No |

**Improved callLLM Method**:

- Classifies primary provider failures
- Provides detailed logging with error type and retry info
- Passes classification info to fallback handler
- Attaches error classification to thrown errors for consumer handling

```typescript
// Example error handling
try {
  return await llmRouterService.executeTask(...);
} catch (llmError) {
  const errorInfo = llmError?.errorInfo || llmError?.primaryErrorInfo;
  const errorType = errorInfo?.type; // "timeout", "model-incompatible", etc.
  const isTransient = errorInfo?.isTransient; // true for temporary issues
  
  // Decide whether to skip, retry, or fail
}
```

### 2. Memory Cleaner - Graceful Degradation (`memory-cleaner.ts`)

**Key Changes**:

1. **Added `skipped` and `skipReason` fields** to `CleanupResult` interface
   - Distinguishes between "successful cleanup" and "skipped due to unavailability"

2. **Wrapped LLM calls in error handling**:
   ```typescript
   try {
     response = await llmRouterService.executeTask(...);
   } catch (llmError) {
     // Log the specific error type
     const errorType = llmError?.errorInfo?.type || "unknown";
     console.warn(`LLM call failed with ${errorType}. Skipping cleanup.`);
     
     // Return graceful skip instead of crash
     return {
       success: true,  // Still success - didn't crash
       skipped: true,
       skipReason: `LLM provider unavailable (${errorType}). Will retry next cycle.`,
       memoriesAnalyzed: shortTermMemories.length,
     };
   }
   ```

3. **Graceful parsing fallback**:
   - If JSON parsing fails, skip cleanup instead of crashing
   - Preserves system stability over perfect memory optimization

4. **Wrapped unexpected errors**:
   - Catches and logs any unexpected errors
   - Returns gracefully skipped result instead of failing

### 3. Background Agents & Scheduler - Resilient Scheduling

#### Background Agents (`background-agents.ts`)

```typescript
async runMemoryCleaner(userId: string): Promise<AgentResult> {
  // Checks for skipped results
  if (result.skipped) {
    return {
      success: true,  // Skipped = success (no crash)
      output: `Memory cleanup skipped: ${result.skipReason}`,
      metadata: { skipped: true, skipReason: result.skipReason }
    };
  }
  
  // On unexpected error, returns success with recovered flag
  return {
    success: true,  // Always true to prevent cascading failures
    metadata: { error: message, recovered: true }
  };
}
```

#### Scheduler (`scheduler.ts`)

```typescript
private async runMemoryCleaner(): Promise<void> {
  for (const user of users) {
    try {
      const result = await agentService.runMemoryCleaner(user.id);
      
      // Handle skipped results
      if (result.metadata.skipped) {
        console.info(`Memory cleaner skipped: ${result.metadata.skipReason}`);
        continue;  // Move to next user
      }
      
      // Normal processing for completed cleanups
    }
  }
}
```

## Behavior Changes

### Before (Crash on Provider Failure)
```
Memory cleanup cycle starts
  → LLM provider timeout
  → Fallback tries with incompatible model
  → Both fail
  → Memory cleaner crashes
  → Scheduler stops
  → System unresponsive
```

### After (Graceful Skip)
```
Memory cleanup cycle starts
  → LLM provider timeout (detected as transient)
  → Fallback tries with incompatible model (detected as permanent)
  → Error classified, logged with type
  → Memory cleaner gracefully skips
  → Scheduler continues to next user
  → Next cycle will retry
  → System remains responsive
```

## Logging Improvements

New, more informative logs:

```
[LLMRouter] Primary provider "GpuStack" (gpt-4-turbo) failed with timeout error
[LLMRouter] Attempting fallback provider "openai" (gpt-3.5-turbo)
[LLMRouter] Both primary and fallback providers failed.
  primary: { type: "timeout", status: 403, message: "upstream request timeout" }
  fallback: { type: "model-incompatible", status: 404, message: "This model is only supported in v1/responses..." }

[MemoryCleaner] LLM call failed with model-incompatible error. Skipping cleanup.
  userId: "user123"
  errorType: "model-incompatible"
  message: "404 This model is only supported in v1/responses..."

[BackgroundAgent] Memory cleaner skipped for user user123: LLM provider unavailable (model-incompatible). Cleanup skipped. Will retry next cycle.

ℹ Memory cleaner skipped for user123: LLM provider unavailable (model-incompatible)
```

## Error Handling Flow

```
┌─────────────────────────┐
│  executeTask() called   │
└────────────┬────────────┘
             │
             ▼
    ┌────────────────┐
    │ Try Primary    │
    └────────┬───────┘
             │
        ┌────┴────┐
        │ Success? │
        └─┬──┬──┬──┘
      No │  │  │
        ▼  │  └────────────────┐
    ┌──────────────┐            │
    │ Classify     │            │
    │ Error        │         (Yes)
    └──┬───────────┘            │
       │                        │
       ▼                        │
    ┌──────────────────────┐    │
    │ Has Fallback Config? │    │
    └──┬───────────────────┘    │
       │                        │
   ┌───┴────┐                   │
   │ Yes    │ No                │
   │        └──────────────┐    │
   ▼                       ▼    │
┌──────────────┐     ┌────────────────┐
│ Try Fallback │     │ Throw Error    │
└──┬───────────┘     │ (with errInfo) │
   │                 └────────────────┘
   ▼
┌──────────────┐
│ Success?     │
└──┬────┬──┬───┘
   │    │  No
Yes│    │  │
   │    ▼  ▼
   │  ┌────────────────────┐
   │  │ Throw Combined     │
   │  │ Error (with both)  │
   │  └────────────────────┘
   │
   ▼
┌──────────────┐
│ Return       │
│ Response     │
└──────────────┘
```

## Testing Recommendations

### Unit Tests
- [ ] Test `classifyLLMError()` with various error types
- [ ] Test memory cleaner with LLM timeout (should skip)
- [ ] Test memory cleaner with model incompatibility (should skip)
- [ ] Test memory cleaner with parsing failure (should skip)

### Integration Tests
- [ ] Run scheduler with unreachable primary provider (should skip and continue)
- [ ] Run scheduler with incompatible fallback model (should skip gracefully)
- [ ] Verify no cascading failures when providers are unavailable

### Manual Testing
- [ ] Kill primary LLM provider → observe graceful skip
- [ ] Configure incompatible model → observe skip with proper logging
- [ ] Verify scheduler continues running despite failures

## Performance Impact

- **Minimal**: Error classification adds ~1-2ms per error
- **Positive**: Prevents system crashes and resource exhaustion
- **Positive**: Allows retry on next cycle for transient errors

## Future Enhancements

1. **Smart Retry Strategy**
   - Exponential backoff for transient errors
   - Skip indefinitely for permanent errors until configuration changes
   
2. **Provider Health Tracking**
   - Track failure rates per provider
   - Auto-disable providers with persistent issues
   
3. **Metrics & Monitoring**
   - Track skip rates by error type
   - Alert on persistent provider failures
   - Dashboard showing provider reliability
   
4. **Dynamic Fallback Selection**
   - Try multiple fallback providers in sequence
   - Select based on failure type and provider capabilities

## Files Modified

1. **`backend/services/llm-router.ts`**
   - Added `LLMErrorInfo` interface
   - Added `classifyLLMError()` function
   - Enhanced `callLLM()` method with classification

2. **`backend/services/memory-cleaner.ts`**
   - Updated `CleanupResult` interface
   - Enhanced `runMemoryCleanup()` with graceful error handling
   - Improved documentation

3. **`backend/services/background-agents.ts`**
   - Updated `runMemoryCleaner()` to handle skipped results
   - Better error logging and recovery

4. **`backend/services/scheduler.ts`**
   - Updated `runMemoryCleaner()` scheduling
   - Better handling of skipped cleanup results
   - Improved logging for operational visibility

---

**Related Issues**: LLM provider failures causing system crashes  
**Related Documentation**: See `docs/architecture.md` for system design overview
