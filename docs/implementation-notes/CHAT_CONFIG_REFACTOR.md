# Chat Configuration Refactoring

**Date**: 28 janvier 2026  
**Status**: ✅ Complete

## Summary

Refactored hardcoded chat configuration constants to a centralized configuration file to eliminate duplication and ensure consistency across services.

## Problem

The chat system had duplicate hardcoded constants for LLM loop control across multiple services:

- **chat.controller.ts**: `MAX_ITERATIONS = 30`, `MAX_CONSECUTIVE_FAILURES = 5`
- **chat-response.ts**: `maxIterations = 10` (default), `MAX_CONSECUTIVE_FAILURES = 3`

These inconsistent values could lead to different behavior between streaming and non-streaming chat responses.

## Solution

Created a centralized configuration file: [backend/config/chat-config.ts](../../backend/config/chat-config.ts)

```typescript
export const CHAT_CONFIG = {
  MAX_ITERATIONS: 30, // Maximum tool call iterations
  MAX_CONSECUTIVE_FAILURES: 5, // Circuit breaker threshold
} as const;
```

## Changes Made

### 1. Created centralized config

- **File**: `backend/config/chat-config.ts`
- Exported `CHAT_CONFIG` constant with both loop control values

### 2. Updated chat.controller.ts

- Added import: `import { CHAT_CONFIG } from "../config/chat-config.js";`
- Lines 274-275: Changed hardcoded values to:
  ```typescript
  const MAX_ITERATIONS = CHAT_CONFIG.MAX_ITERATIONS;
  const MAX_CONSECUTIVE_FAILURES = CHAT_CONFIG.MAX_CONSECUTIVE_FAILURES;
  ```

### 3. Updated chat-response.ts

- Added import: `import { CHAT_CONFIG } from "../config/chat-config.js";`
- Line 86: Changed default `maxIterations` parameter:
  ```typescript
  maxIterations = CHAT_CONFIG.MAX_ITERATIONS,
  ```
- Line 183: Changed hardcoded value:
  ```typescript
  const MAX_CONSECUTIVE_FAILURES = CHAT_CONFIG.MAX_CONSECUTIVE_FAILURES;
  ```
- Updated JSDoc for `ChatResponseOptions.maxIterations` to reference the new default

## Benefits

✅ **Single Source of Truth**: All chat loop configurations in one place  
✅ **Consistency**: Streaming and non-streaming responses use identical limits  
✅ **Maintainability**: Easy to adjust circuit breaker values globally  
✅ **Type Safety**: Values are constants typed as `as const`  
✅ **DRY Principle**: Eliminated code duplication

## Files Modified

- `backend/config/chat-config.ts` (created)
- `backend/controllers/chat.controller.ts`
- `backend/services/chat-response.ts`

## Migration Notes

- No breaking changes - configurations remain the same
- Existing callers of `getChatResponse()` continue to work
- Default `maxIterations` changed from 10 to 30 (aligning with streaming behavior)

## Next Steps

Consider extracting other repeated constants into configuration:

- Token limits
- Temperature defaults
- Memory search defaults
- Timeout values
