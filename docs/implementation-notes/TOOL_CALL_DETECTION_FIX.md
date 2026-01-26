# Tool Call Detection Fix - Implementation Notes

**Date**: 26 janvier 2026  
**Issue**: LLM returning tool call JSON instead of executing and providing natural response  
**Status**: ✅ Fixed

## Problem Statement

When the user asked in French: "Je me suis fixé l'objectif de faire du sport 2 fois par semaine pendant environ 15-20 minutes. Aide moi atteindre cet objectif"

The system received:

```
Je me suis fixé l'objectif de faire du sport 2 fois par semaine pendant environ 15-20 minutes. Aide moi atteindre cet objectif

user_profile{"action": "update", "currentGoals": ["Faire du sport 2 fois par semaine pendant environ 15-20 minutes"]}scheduled_task{"action": "create", "name": "Rappel séance de sport", ...}
```

Instead of:

1. ✅ Executing both the `user_profile` tool call
2. ✅ Executing the `scheduled_task` tool call
3. ✅ Giving a natural language response

It was just **returning the JSON to the user**.

## Root Cause Analysis

### Issue 1: Regex too restrictive

**Location**: [chat.controller.ts](chat.controller.ts#L576-L586)

The original detection regex used `^...$` anchors:

```typescript
const toolNameMatch = content.match(
  /^(curl|todo|notification|scheduled_task|user_context)\s*(\{[\s\S]*\})\s*$/i,
);
```

This pattern means:

- The tool call MUST be at the start AND end of the string (`^` and `$`)
- For text like `user_profile{...}scheduled_task{...}`:
  - `user_profile{...}` doesn't match because it's not followed by `$` (end)
  - `scheduled_task{...}` doesn't match because there's text before it

**Result**: Only the FIRST tool call was detected, and second one was ignored

### Issue 2: Only detecting ONE tool call per response

The code was structured to detect and execute one tool call, then loop back. But when multiple tool calls existed in the same text, it would process the first one, find no more at the top level, and fall through to the "no tool calls" case.

### Issue 3: Inconsistent tool_call_id mapping

When adding messages to history, the code was using `Date.now()` twice in the same iteration:

```typescript
const toolCallId_1 = `text_tool_${Date.now()}`; // ID for assistant message
const toolCallId_2 = `text_tool_${Date.now()}`; // Different ID! Timing difference
```

This created mismatched IDs between the assistant message tool_calls and the tool results.

## Solution Implemented

### 1. New Helper Function: `extractAllTextToolCalls()`

**Location**: [chat.controller.ts](chat.controller.ts#L243-L278)

```typescript
function extractAllTextToolCalls(content: string): Array<{
  toolId: string;
  params: Record<string, any>;
  start: number;
  end: number;
}> {
  const results: Array<{...}> = [];

  // Find ALL occurrences of toolName{ anywhere in text
  const toolPattern = /(user_profile|scheduled_task|todo|notification|curl|user_context)\s*(\{)/gi;

  let match;
  while ((match = toolPattern.exec(content)) !== null) {
    // Find matching closing brace and parse JSON
    // Add to results array
  }

  return results;
}
```

**Key improvements**:

- Uses global flag `g` to find ALL matches, not just first
- Uses `while` loop to process each match sequentially
- No `^...$` anchors - finds tool calls anywhere in text
- Returns array of ALL detected tool calls with their positions

### 2. Batch Tool Execution with Consistent ID Mapping

**Location**: [chat.controller.ts](chat.controller.ts#L668-L792)

```typescript
if (textToolCalls.length > 0) {
  // Generate SINGLE batch ID for consistency
  const batchToolCallId = `text_tool_batch_${Date.now()}_${Math.random()...}`;
  const toolCallResults = [];

  // Execute ALL tools
  for (let i = 0; i < textToolCalls.length; i++) {
    const toolCallId = `${batchToolCallId}_${i}`;
    // Execute tool, track result with this ID
    toolCallResults.push({ toolCallId, toolId, success, data, error });
  }

  // Add messages with matching IDs
  messages.push({
    role: "assistant",
    tool_calls: textToolCalls.map((tc, idx) => ({
      id: `${batchToolCallId}_${idx}`,  // Consistent ID
      type: "function",
      function: { name: tc.toolId, arguments: JSON.stringify(tc.params) },
    })),
  });

  // Add tool results with MATCHING IDs
  toolCallResults.forEach((result) => {
    messages.push({
      role: "tool",
      tool_call_id: result.toolCallId,  // Same as above
      name: result.toolId,
      content: JSON.stringify({...}),
    });
  });

  continue;  // Let LLM process results
}
```

**Key improvements**:

- Single batch ID ensures all IDs are consistent
- All tools executed before adding messages
- Results tracked in order matching tool_calls
- Tool result IDs exactly match tool_calls IDs

### 3. Messages Added After Execution

The key change in flow:

1. Detect ALL text tool calls
2. Execute each tool sequentially
3. Collect results in array with proper IDs
4. **Then** add assistant message and all tool results to history with matching IDs
5. Continue loop so LLM can process results and generate natural response

## Testing Scenario

### Before Fix

User: "Fais du sport 2x/semaine et rappelle-moi"  
System response: `user_profile{...}scheduled_task{...}` ❌

### After Fix

User: "Fais du sport 2x/semaine et rappelle-moi"  
System:

1. ✅ Executes `user_profile` action=update with currentGoals
2. ✅ Executes `scheduled_task` action=create for reminder
3. ✅ LLM processes results
4. ✅ Returns natural response like: "Parfait! J'ai enregistré votre objectif et créé un rappel pour vous"

## Files Modified

- [backend/controllers/chat.controller.ts](chat.controller.ts)
  - Added `extractAllTextToolCalls()` helper
  - Updated text tool call detection logic
  - Fixed ID mapping for multiple tool calls
  - Fixed assistant message content preservation

## Benefits

1. **Multiple tool calls support**: LLM can now generate and execute multiple tool calls in one response
2. **Correct ID mapping**: Tool results properly associated with tool calls
3. **Natural responses**: LLM gets results and can generate meaningful text response
4. **Fallback mechanism**: If LLM generates text tool calls (some models don't support function_calling properly), they're still executed
5. **Improved flow**: Tool execution happens before response generation, giving LLM all context

## Edge Cases Handled

- ✅ No tool calls detected (normal response)
- ✅ Single tool call detected
- ✅ Multiple tool calls detected
- ✅ Tool execution errors (caught and tracked)
- ✅ JSON parsing errors (skipped safely)
- ✅ Mismatched braces (validation in helper)

## Future Improvements

1. Could parallelize tool execution for multiple calls (currently sequential)
2. Could add timeout handling per tool
3. Could implement retry logic for failed tool calls
4. Could track tool call chains/dependencies
