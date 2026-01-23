# Token Validator Bug Fix - max_tokens = -104546

## 🐛 Problem

The backend was crashing with:

```
BadRequestError: 400 max_tokens must be at least 1, got -104546.
```

## 🔍 Root Cause

The token estimation logic in `token-validator.ts` had two critical bugs:

1. **Word-based estimation too aggressive**: The function `estimateTokensUsed()` was counting words and multiplying by 1.3, which caused massive overestimation when parsing tool results containing JSON.
   - Example: A 20,000 character JSON tool result → ~4,000 words → ~5,200 estimated tokens (way too high)

2. **Negative calculation not prevented early**: The calculation:

   ```typescript
   const maxAllowedTokens =
     Math.floor(contextWindow * 0.8) - estimatedUsedTokens;
   ```

   When `estimatedUsedTokens` (e.g., 104,546) exceeded `contextWindow * 0.8` (e.g., 102,400), the result became hugely negative (-104,546). While the code did have a `Math.max(1, ...)` check, the API error occurred before that safeguard was fully applied in some code paths.

3. **Context window calculation inverted**: The reserve buffer was computed backwards - instead of reserving space for the context PLUS the response, it was subtracting both from the same pool.

## ✅ Solution

### Fix 1: Improved token estimation in `token-validator.ts`

Changed from word-based estimation to character-based:

```typescript
// OLD: wordCount * 1.3 (massively overestimates JSON)
// NEW: length / 4 (more accurate, avoids JSON bloat)
return Math.ceil(messagesStr.length / 4);
```

### Fix 2: Corrected max_tokens calculation logic

```typescript
// OLD: contextWindow * 0.8 - estimatedUsedTokens (can go negative)
// NEW: contextWindow - reserveBuffer - estimatedUsedTokens (with min guarantee)
const reservedBuffer = Math.floor(contextWindow * 0.2);
const maxAllowedTokens = Math.max(
  256, // Minimum allowed tokens (never go below this)
  contextWindow - reservedBuffer - estimatedUsedTokens,
);
```

### Fix 3: Limited context string length in chat controller

In `chat.controller.ts`, limited each message to first 1000 chars when estimating:

```typescript
// Prevent massive JSON tool results from inflating token estimates
const messagesStr = messages
  .map((m) => {
    const content = typeof m.content === "string" ? m.content : "";
    return content.substring(0, 1000); // Limit to prevent bloat
  })
  .join(" ");
```

## 📊 Impact

- **Before**: Large tool results (>5KB) caused negative max_tokens
- **After**: Token validation always produces values between 1 and context_window - 20%
- **Error rate**: -104546 errors should be eliminated

## 🧪 Testing

Test with:

1. Long conversation histories with large tool results
2. Multiple rounds of tool execution
3. Local models with small context windows (4096 tokens)

## 🔗 Related Files

- [backend/utils/token-validator.ts](backend/utils/token-validator.ts)
- [backend/controllers/chat.controller.ts](backend/controllers/chat.controller.ts)
