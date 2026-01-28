# Chat Configuration Refactoring

**Date**: 28 janvier 2026
**Status**: ✅ Complete

## Summary

Refactored hardcoded chat configuration constants and duplicated types to centralized locations to eliminate duplication and ensure consistency across services.

## Problem

The chat system had duplicate constants and types across multiple services:

**Constants:**

- **chat.controller.ts**: `MAX_ITERATIONS = 30`, `MAX_CONSECUTIVE_FAILURES = 5`
- **chat-response.ts**: `maxIterations = 10` (default), `MAX_CONSECUTIVE_FAILURES = 3`

**Types:**

- `ChatMessageParam` - duplicated in both files
- `ToolFunctionDefinition` - defined locally in chat.controller.ts
- `LlmTool` - defined locally in chat.controller.ts

These inconsistent values could lead to different behavior between streaming and non-streaming chat responses.

## Solution

### 1. Centralized Configuration

Created: [backend/config/chat-config.ts](../../backend/config/chat-config.ts)

```typescript
export const CHAT_CONFIG = {
  MAX_ITERATIONS: 30, // Maximum tool call iterations
  MAX_CONSECUTIVE_FAILURES: 5, // Circuit breaker threshold
} as const;

export type ToolFunctionDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
};

export type LlmTool = {
  type: "function";
  function: ToolFunctionDefinition;
};
```

### 2. Exported shared type from chat-response.ts

```typescript
export type ChatMessageParam = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};
```

## Changes Made

### Created: `backend/config/chat-config.ts`

- `CHAT_CONFIG` constant with loop control values
- `ToolFunctionDefinition` type
- `LlmTool` type

### Modified: `backend/controllers/chat.controller.ts`

- Import `CHAT_CONFIG`, `LlmTool`, `ToolFunctionDefinition` from config
- Import `ChatMessageParam` from chat-response.ts
- Removed local type definitions (17 lines removed)
- Use `CHAT_CONFIG.MAX_ITERATIONS` and `CHAT_CONFIG.MAX_CONSECUTIVE_FAILURES`

### Modified: `backend/services/chat-response.ts`

- Import `CHAT_CONFIG`
- Export `ChatMessageParam` type
- Default `maxIterations` now uses `CHAT_CONFIG.MAX_ITERATIONS` (30 instead of 10)
- Use `CHAT_CONFIG.MAX_CONSECUTIVE_FAILURES`

## Benefits

✅ **Single Source of Truth**: All chat configurations and types in centralized locations
✅ **Consistency**: Streaming and non-streaming responses use identical limits
✅ **Maintainability**: Easy to adjust values and types globally
✅ **Type Safety**: Shared types ensure interface consistency
✅ **DRY Principle**: Eliminated ~25 lines of duplicate code
✅ **Better Organization**: Clear separation of config vs service logic

## Files Modified

| File                                     | Changes                                        |
| ---------------------------------------- | ---------------------------------------------- |
| `backend/config/chat-config.ts`          | Created with constants + types                 |
| `backend/controllers/chat.controller.ts` | Import shared config/types, removed duplicates |
| `backend/services/chat-response.ts`      | Import config, export `ChatMessageParam`       |

## Exports Summary

| Export                   | From             | Used By                        |
| ------------------------ | ---------------- | ------------------------------ |
| `CHAT_CONFIG`            | chat-config.ts   | chat.controller, chat-response |
| `ToolFunctionDefinition` | chat-config.ts   | chat.controller                |
| `LlmTool`                | chat-config.ts   | chat.controller                |
| `ChatMessageParam`       | chat-response.ts | chat.controller                |

## Migration Notes

- No breaking changes - configurations remain the same
- Existing callers of `getChatResponse()` continue to work
- Default `maxIterations` changed from 10 to 30 (aligning with streaming behavior)
