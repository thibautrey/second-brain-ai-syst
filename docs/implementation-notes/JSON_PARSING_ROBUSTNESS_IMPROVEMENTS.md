# JSON Parsing Robustness Improvements

## Problem Statement

The system was experiencing JSON parsing errors when LLM responses were incomplete or contained non-JSON prefixes:

```
[FactChecker] Claim extraction failed: SyntaxError: Unexpected end of JSON input
Unified exchange analysis failed: SyntaxError: Unexpected token 'a', "assistant\n"... is not valid JSON
```

## Root Causes

1. **Incomplete JSON responses**: LLMs sometimes return truncated JSON (especially when max_tokens is reached)
2. **Non-JSON prefixes**: Some LLM responses contain text like "assistant\n" before the JSON
3. **Brittle parsing**: The original `parseJSONFromLLMResponse()` only stripped markdown and called `JSON.parse()` directly

## Solution

Enhanced the JSON parser with **multi-strategy fallback** approach in [`backend/utils/json-parser.ts`](../../backend/utils/json-parser.ts):

### New Strategies (in order):

1. **Direct parsing** - Try to parse the cleaned JSON directly
2. **Text extraction** - Find the first `{` and last `}` to extract JSON from text with surrounding context
3. **Incomplete JSON repair** - Add missing closing braces `}` to fix truncated responses
4. **Detailed error logging** - Show which strategy failed and sample content for debugging

### New Helper Functions

```typescript
// Extract JSON from text that may have non-JSON prefixes/suffixes
extractJSONFromText(text: string): string

// Repair incomplete JSON by adding missing closing braces
repairIncompleteJSON(text: string): string
```

## Changes Made

### 1. Enhanced `json-parser.ts`

- Added `extractJSONFromText()` - handles "assistant\n{...}" prefixes
- Added `repairIncompleteJSON()` - adds missing closing braces
- Updated `parseJSONFromLLMResponse()` with multi-strategy fallback
- Improved error messages with content preview for debugging

### 2. Improved Error Handling in Services

- **`fact-checker.ts`**: Added fallback parsing for claim extraction with manual regex extraction
- **`intent-router.ts`**: Enhanced logging for JSON parse errors (both main and fallback attempts)
- **`memory-cleaner.ts`**: Added detailed error logging before fallback
- **`notification-spam-detector.ts`**: Added JSON parse error logging

### 3. Comprehensive Test Coverage

Added new tests in [`backend/utils/__tests__/json-parser.test.ts`](../../backend/utils/__tests__/json-parser.test.ts):

- Test 11: JSON with non-JSON prefix (e.g., "assistant\n{...}")
- Test 12: Extract JSON from text with surrounding context
- Test 13: Repair incomplete JSON (missing closing braces)
- Test 14: End-to-end robustness with incomplete JSON and prefix

## Benefits

✅ **Resilience**: System continues working even if LLM response is incomplete  
✅ **Debugging**: Detailed logging shows exactly why parsing failed  
✅ **Fallback chains**: Multiple strategies mean most responses can still be parsed  
✅ **Backward compatible**: All existing valid responses still parse correctly  
✅ **Tested**: Comprehensive test coverage for edge cases

## Testing

Run the JSON parser tests:

```bash
npx tsx backend/utils/__tests__/json-parser.test.ts
```

## Examples

### Before (would fail):

```
Response: "assistant\n{"claims": ["claim1", "claim2"]"
Error: "Unexpected token 'a'"
```

### After (succeeds):

```
Response: "assistant\n{"claims": ["claim1", "claim2"]"
Strategy 1 (direct): Failed
Strategy 2 (extraction): Success! → {"claims": ["claim1", "claim2"]"}
Result: claims = ["claim1", "claim2"]
```

## Impact on Error Logs

When errors occur, logs now include:

- Original response (first 200 chars)
- Result after markdown stripping (first 200 chars)
- Result after JSON extraction (first 200 chars)
- Result after repair attempt (first 200 chars)

This makes debugging much easier without exposing full potentially large responses.

## Future Improvements

- Add telemetry to track which strategy is most often needed
- Consider stricter LLM prompts to ensure valid JSON
- Add response format validation before parsing attempts
