# Tool Executor - Tool Development Guide

This directory contains handlers for various tools that can be executed by the tool executor system. This guide explains how to create new tools for future reference.

## 📁 Directory Structure

```
tool-executor/
├── handlers/              # Tool implementation files
│   ├── weather.ts        # Example weather tool
│   ├── browser.ts        # Browser automation tool
│   ├── code-executor.ts  # Code execution tool
│   └── ...
└── README.md             # This file
```

## 🎯 What is a Tool?

A **tool** is a stateless function that performs a specific action and returns structured results. Tools are:

- **Atomic**: Perform a single, well-defined task
- **Idempotent**: Multiple executions with same params produce same result
- **Stateless**: No memory between executions
- **Schema-defined**: Include clear parameter specifications

## 📝 Tool Creation Template

### 1. Basic Structure

Every tool file should follow this structure:

```typescript
// Types and interfaces
interface ToolParams {
  // Input parameters
}

interface ToolResult {
  // Output structure
}

// Helper functions (optional)
function helperFunction() {
  // Reusable logic
}

// Main handler function
export async function handleYourToolName(params: ToolParams): Promise<{
  success: boolean;
  data?: ToolResult;
  error?: string;
}> {
  try {
    // Validate inputs
    if (!params.requiredField) {
      return {
        success: false,
        error: "requiredField is required",
      };
    }

    // Execute tool logic
    const result = await someAsyncOperation(params);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Tool schema for registration
export const yourToolSchema = {
  name: "your_tool_name",
  description: "Clear description of what the tool does",
  parameters: {
    type: "object" as const,
    properties: {
      param1: {
        type: "string",
        description: "What this parameter does",
      },
      param2: {
        type: "number",
        description: "Another parameter",
      },
    },
    required: ["param1"],
  },
  handler: handleYourToolName,
};
```

### 2. Key Requirements

✅ **Always Include**:

- `handleYourToolName()` - Main handler function
- `try/catch` block - Error handling
- `success` boolean - Status indicator
- `yourToolSchema` - Tool registration schema
- JSDoc comments - Parameter and return documentation
- Input validation - Check required parameters
- Proper TypeScript types - Full type safety

### 3. Response Format

All tools must return this format:

```typescript
{
  success: boolean;        // true if successful
  data?: any;             // Tool result (optional)
  error?: string;         // Error message if failed (optional)
}
```

## 📋 Step-by-Step: Creating Your First Tool

### Step 1: Create the file

Create a new file in `handlers/` directory:

```bash
touch backend/services/tool-executor/handlers/your-tool.ts
```

### Step 2: Define types

```typescript
interface YourToolParams {
  requiredParam: string;
  optionalParam?: number;
}

interface YourToolResult {
  status: string;
  value: any;
}
```

### Step 3: Implement the handler

```typescript
export async function handleYourTool(
  params: YourToolParams,
): Promise<{ success: boolean; data?: YourToolResult; error?: string }> {
  try {
    // Validate
    if (!params.requiredParam) {
      return { success: false, error: "requiredParam is required" };
    }

    // Execute
    const result = await performAction(params.requiredParam);

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

### Step 4: Create the schema

```typescript
export const yourToolSchema = {
  name: "your_tool",
  description: "Description of your tool",
  parameters: {
    type: "object" as const,
    properties: {
      requiredParam: {
        type: "string",
        description: "Description",
      },
    },
    required: ["requiredParam"],
  },
  handler: handleYourTool,
};
```

### Step 5: Register the tool

Add to `handlers/index.ts`:

```typescript
export { handleYourTool, yourToolSchema } from "./your-tool";
```

## 🔍 Example Tools

### Weather Tool (No API Key Required)

[weather.ts](./handlers/weather.ts) - Fetches weather using free Open-Meteo API

**Key features**:

- No authentication needed
- Geocoding for any city
- Formatted and raw output modes
- Error handling for invalid cities

### Stock Price Tool (No API Key Required)

[stock-price.ts](./handlers/stock-price.ts) - Fetches current stock prices using public Yahoo Finance endpoints

**Key features**:

- No authentication needed
- Real-time stock pricing for any ticker symbol
- Single stock lookup or multi-stock comparison
- Returns price, change, high/low, and volume data
- Formatted and raw output modes
- Error handling for invalid symbols

### Browser Tool

[browser.ts](./handlers/browser.ts) - Web automation tool

**Key features**:

- Navigate URLs
- Click elements
- Extract content
- Form filling

## 🧪 Testing Your Tool

### In TypeScript:

```typescript
import { handleYourTool, yourToolSchema } from "./handlers/your-tool";

// Test
const result = await handleYourTool({
  requiredParam: "test",
  optionalParam: 42,
});

console.log(result);
// Output: { success: true, data: { ... } }
```

### In the System:

Tools are executed by the tool executor system:

```typescript
// The tool executor will call:
const result = await handleYourTool(userParams);
```

## ⚙️ Best Practices

### ✅ Do's

- **Validate inputs** - Check types and required fields
- **Handle errors gracefully** - Return error message, not throw
- **Use descriptive names** - `handleWeatherTool`, not `h`
- **Add JSDoc comments** - Document parameters and returns
- **Keep it focused** - One tool = one job
- **Use proper types** - Full TypeScript typing
- **Test edge cases** - Empty strings, null, undefined, etc.

### ❌ Don'ts

- **Don't modify global state** - Tools should be stateless
- **Don't hard-code secrets** - Use environment variables
- **Don't forget error handling** - Always use try/catch
- **Don't return raw errors** - Format them in response object
- **Don't use console.log** - Use proper logging
- **Don't create side effects** - Tools should be pure functions

## 🔐 Security Considerations

1. **Input Validation** - Always validate user input
2. **API Keys** - Never commit API keys; use environment variables
3. **Rate Limiting** - Consider rate limits for external APIs
4. **Timeout Handling** - Set timeouts for network requests
5. **Output Sanitization** - Clean output if returning user data

## 📚 Common Patterns

### API Calls

```typescript
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`API error: ${response.statusText}`);
}
const data = await response.json();
```

### Async Operations

```typescript
export async function handleAsyncTool(params: Params) {
  try {
    const result = await someAsyncOperation();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

### Parameter Variants

```typescript
const format = params.format || "default";
const limit = Math.min(params.limit || 10, 100); // Cap at 100
```

## 🚀 Adding a New Tool to the System

### Step-by-Step Integration

Once you've created your tool handler file, you need to register it with the tool executor system. Here's the exact process:

#### 1. Create tool handler file

Create `your-tool.ts` in `handlers/` directory with the proper structure (see template above).

#### 2. Export from handlers/index.ts

Add your handler function export to [handlers/index.ts](./handlers/index.ts):

```typescript
export { executeWeatherAction } from "./weather.js";
```

**IMPORTANT**: Use the `.js` extension in imports (ES modules).

#### 3. Import schema in handlers/schemas.ts

Add import in [handlers/schemas.ts](./handlers/schemas.ts):

```typescript
import { WEATHER_TOOL_SCHEMA } from "./weather.js";
```

#### 4. Add schema to BUILTIN_TOOL_SCHEMAS

Add your schema to the array in [handlers/schemas.ts](./handlers/schemas.ts):

```typescript
export const BUILTIN_TOOL_SCHEMAS = [
  // ... other schemas
  WEATHER_TOOL_SCHEMA,
];
```

#### 5. Import handler in tool-executor.ts

Add import in [../tool-executor.ts](../tool-executor.ts):

```typescript
import {
  // ... other imports
  executeWeatherAction,
} from "./tool-executor/handlers/index.js";
```

#### 6. Register in tool executor switch statement

Add case handler in the `executeBuiltinTool` switch statement in [../tool-executor.ts](../tool-executor.ts):

```typescript
case "weather":
  return executeWeatherAction(action, params);
```

### Complete Integration Example: Weather Tool

**File**: `handlers/weather.ts`

```typescript
export async function executeWeatherAction(
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "get":
      // Implementation here
      break;
  }
}

export const WEATHER_TOOL_SCHEMA = {
  name: "weather",
  description: "Fetch current weather...",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["get"] },
      city: { type: "string", description: "City name" },
    },
    required: ["action", "city"],
  },
};
```

**File**: `handlers/index.ts` (add)

```typescript
export { executeWeatherAction } from "./weather.js";
```

**File**: `handlers/schemas.ts` (add import)

```typescript
import { WEATHER_TOOL_SCHEMA } from "./weather.js";
```

**File**: `handlers/schemas.ts` (add to array)

```typescript
export const BUILTIN_TOOL_SCHEMAS = [
  // ... other schemas
  WEATHER_TOOL_SCHEMA,
];
```

**File**: `../tool-executor.ts` (add import)

```typescript
import { executeWeatherAction } from "./tool-executor/handlers/index.js";
```

**File**: `../tool-executor.ts` (add to switch)

```typescript
case "weather":
  return executeWeatherAction(action, params);
```

### How Tool Execution Works

Once integrated, the tool executor will:

1. **Parse user request** → extracts tool name and action
2. **Validate schema** → checks parameters against WEATHER_TOOL_SCHEMA
3. **Route to handler** → executes `executeWeatherAction(action, params)`
4. **Return result** → `{ success, data, error }`

### Verification Checklist

- [ ] Handler file created in `handlers/`
- [ ] Function exported from `handlers/index.ts`
- [ ] Schema imported in `handlers/schemas.ts`
- [ ] Schema added to `BUILTIN_TOOL_SCHEMAS` array
- [ ] Handler imported in `tool-executor.ts`
- [ ] Case statement added to switch in `tool-executor.ts`
- [ ] Tool tested with sample parameters
- [ ] Documentation updated if needed

## 📞 Tool Integration with Tool Executor

The tool executor system will:

1. Load your schema from `yourToolSchema`
2. Validate user params against schema
3. Call `handleYourTool(params)`
4. Return structured result to user

Example flow:

```
User Request
    ↓
Tool Executor receives request
    ↓
Matches tool name → finds handler
    ↓
Validates params against schema
    ↓
Calls handleYourTool(validatedParams)
    ↓
Returns { success, data, error }
    ↓
Response to user
```

---

**Last Updated**: January 29, 2026
**Version**: 1.0
**Status**: Complete
