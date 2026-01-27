# Tool Generation Timeout Fix

## Problem

When the agent attempts to create tools via the `/api/generated-tools/generate` endpoint, the process fails when the external API (like GoldAPI) is slow or the network connection is unstable.

**Root Cause**:

- The client timeout was set to 60 seconds, but code execution timeout was only 30 seconds
- No retry logic for network failures
- APIs can occasionally be slow to respond

## Solution Implemented

### 1. **Increased Client Timeout**

- **Before**: 60 seconds
- **After**: 120 seconds
- **Location**: `code-executor-wrapper.ts` line 72

This gives enough time for slow API calls to complete.

### 2. **Added Intelligent Retry Logic**

Modified `executeWithNetwork()` in `code-executor-wrapper.ts` to:

- **Attempt up to 3 retries** on network failures
- **Exponential backoff**: 1s, 2s, 4s delays between retries
- **Only retries on network errors**: ECONNRESET, ETIMEDOUT, ENOTFOUND, etc.
- **Fails immediately** on code/logic errors (doesn't waste time retrying)

### 3. **Increased Execution Timeout for Tool Generation**

- **Before**: 30 seconds
- **After**: 60 seconds
- **Location**: `dynamic-tool-generator.ts` line 252

This allows slow APIs more time to respond.

### 4. **Applied to All Network Code Execution**

Updated all callers of `executeWithNetwork()`:

- `dynamic-tool-generator.ts` - Main tool generation (lines 252, 663)
- `dynamic-tool-registry.ts` - Tool execution (line 189)

## Files Modified

1. **backend/services/code-executor-wrapper.ts**
   - Increased axios timeout from 60s to 120s
   - Added `maxRetries` parameter to `executeWithNetwork()` method
   - Implemented exponential backoff retry logic
   - Added network error detection

2. **backend/services/dynamic-tool-generator.ts**
   - Changed timeout from 30s to 60s
   - Added 3 retry parameter to `executeWithNetwork()` calls
   - Affects tool generation at lines 252 and 663

3. **backend/services/dynamic-tool-registry.ts**
   - Added 3 retry parameter to `executeWithNetwork()` call
   - Affects existing tool execution at line 189

## How It Works

```typescript
// Old behavior - single attempt
const result = await codeExecutorService.executeWithNetwork(
  code,
  secretValues,
  30, // Only 30 seconds
);

// New behavior - up to 3 attempts with exponential backoff
const result = await codeExecutorService.executeWithNetwork(
  code,
  secretValues,
  60, // 60 seconds per attempt
  3, // Retry up to 3 times on network failures
);
```

**Retry Logic**:

1. **First attempt**: 0ms delay
2. **Second attempt** (if network error): 1000ms delay
3. **Third attempt** (if network error): 2000ms delay
4. **Fourth attempt** (if network error): 4000ms delay
5. **Fails**: After 3 failed attempts or on non-network errors

## Expected Behavior

When creating a tool like GoldAPI:

1. Agent generates Python code
2. System attempts to execute code (up to 60 seconds)
3. **If network fails**: Automatically retries with backoff
4. **If API is slow but responds**: Completes successfully
5. **If code is invalid**: Fails immediately and agent fixes code

## Testing

To verify the fix works:

1. Create a tool with an API that has slow response times
2. Monitor logs for "Network error on attempt X/3"
3. Tool should eventually succeed (not timeout immediately)

## Future Improvements

- [ ] Make retry count configurable per tool
- [ ] Add circuit breaker pattern for consistently failing APIs
- [ ] Log detailed timing information for performance analysis
- [ ] Add metrics for retry success rates
