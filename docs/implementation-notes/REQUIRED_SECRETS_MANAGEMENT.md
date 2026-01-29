# Required Secrets Management for Tools

## Overview

When agents create, use, or update tools in the Second Brain AI System, **all required API keys and secrets MUST be declared** in the tool's `requiredSecrets` field. Without proper declaration, the system will fail at runtime because the tool executor won't have access to the necessary credentials.

## Critical Rule

```
⚠️  GOLDEN RULE: Every API key, token, or secret used in tool code MUST be declared
    in the tool's requiredSecrets array. Otherwise, the tool will fail at execution time.
```

---

## How It Works

### 1. Tool Creation Workflow

When an agent generates a new tool:

```
[Tool Generation Request]
        ↓
[Specification Phase] → Identifies required secrets
        ↓
[Planning Phase] → Documents which secrets are needed
        ↓
[Code Generation Phase] → Generates code that uses os.environ.get('SECRET_KEY')
        ↓
[Schema Generation Phase] → Declares requiredSecrets: ["SECRET_KEY"]
        ↓
[Database Saved] → Tool stored with requiredSecrets array
```

### 2. Tool Execution Flow

When a tool is executed:

```
[Tool Execution Request]
        ↓
[Check Required Secrets] → Verify all required secrets are available
        ↓
[Retrieve Secret Values] → Get actual values from secrets store
        ↓
[Inject into Environment] → Pass as os.environ variables to sandbox
        ↓
[Execute Code] → Code accesses via os.environ.get('KEY_NAME')
        ↓
[Return Result] → Success or "Missing secrets" error
```

---

## Required Secrets Format

### In Tool Code (Python)

Tools must use environment variables to access secrets:

```python
import os
import requests

# Correct way to access secrets
api_key = os.environ.get('OPENAI_API_KEY')
if not api_key:
    result = {"error": "OPENAI_API_KEY environment variable not set"}
else:
    headers = {"Authorization": f"Bearer {api_key}"}
    response = requests.get("https://api.openai.com/...", headers=headers)
    result = response.json()
```

### In Tool Definition (TypeScript)

When saving a tool to the database, the `requiredSecrets` array must list all needed secrets:

```typescript
interface GeneratedToolInput {
  name: string;
  displayName: string;
  description: string;
  code: string;                    // Python code
  inputSchema: object;
  outputSchema?: object;
  requiredSecrets?: string[];      // ← THIS MUST BE COMPLETE AND ACCURATE
  category?: string;
  tags?: string[];
}
```

Example:

```typescript
{
  name: "openai_text_generator",
  displayName: "OpenAI Text Generator",
  description: "Generate text using OpenAI API",
  code: "import os\nimport requests\n...",
  inputSchema: { ... },
  outputSchema: { ... },
  requiredSecrets: ["OPENAI_API_KEY"],  // ✓ Required secret declared
  category: "ai",
  tags: ["text-generation", "openai"]
}
```

---

## Detection & Validation

### 1. Automatic Detection During Generation

The tool generation workflow automatically:

1. **Analyzes code** for common patterns:
   - `os.environ.get('API_KEY')`
   - `os.getenv('TOKEN')`
   - References to known API services

2. **Identifies API usage**:
   - OpenAI → `OPENAI_API_KEY`
   - Google Maps → `GOOGLE_MAPS_API_KEY`
   - Stripe → `STRIPE_API_KEY`
   - etc.

3. **Cross-checks available secrets**:
   - Gets list of secrets user has configured
   - Warns if required secret is not available
   - Allows proceeding but tool will fail at runtime

### 2. Schema Generation Phase

During schema generation, the LLM explicitly identifies required secrets:

```python
const TOOL_SCHEMA_PROMPT = `...
Return a JSON object with:
{
  "name": "...",
  "displayName": "...",
  "requiredSecrets": ["API_KEY_NAME"],  // ← Explicitly identified here
  ...
}
...`
```

### 3. Runtime Validation

Before executing a tool, the system validates:

```typescript
// From dynamic-tool-registry.ts
const missingSecrets = tool.requiredSecrets.filter(
  (s) => !secretValues[s]
);

if (missingSecrets.length > 0) {
  return {
    success: false,
    error: `Missing required secrets: ${missingSecrets.join(", ")}. 
            Please configure them in Settings > Secrets.`,
    executionTime: Date.now() - startTime,
    toolUsed: tool.name,
  };
}
```

---

## Common Mistakes & How to Avoid Them

### ❌ Mistake 1: Hardcoding Secrets

**DON'T:**
```python
api_key = "sk-1234567890"  # NEVER hardcode secrets!
response = requests.get("https://api.openai.com/...", 
                       headers={"Authorization": f"Bearer {api_key}"})
```

**DO:**
```python
import os
api_key = os.environ.get('OPENAI_API_KEY')
if not api_key:
    result = {"error": "OPENAI_API_KEY not configured"}
else:
    response = requests.get("https://api.openai.com/...",
                           headers={"Authorization": f"Bearer {api_key}"})
```

### ❌ Mistake 2: Not Declaring All Required Secrets

**DON'T:**
```typescript
{
  name: "multi_api_tool",
  displayName: "Multi-API Tool",
  code: "api_key = os.environ.get('OPENAI_API_KEY')\n..." +
        "stripe_key = os.environ.get('STRIPE_API_KEY')\n...",
  requiredSecrets: ["OPENAI_API_KEY"]  // ❌ Missing STRIPE_API_KEY!
}
```

**DO:**
```typescript
{
  name: "multi_api_tool",
  displayName: "Multi-API Tool",
  code: "...",
  requiredSecrets: ["OPENAI_API_KEY", "STRIPE_API_KEY"]  // ✓ All declared
}
```

### ❌ Mistake 3: Inconsistent Secret Names

Ensure secret names match exactly:

**In Code:**
```python
stripe_api = os.environ.get('STRIPE_API_KEY')
```

**In Declaration:**
```typescript
requiredSecrets: ["STRIPE_API_KEY"]  // ✓ Must match exactly
```

NOT:
```typescript
requiredSecrets: ["STRIPE_KEY"]  // ❌ Mismatch!
```

---

## Workflow for Agents

### When Creating a Tool

1. **Analyze objective** - Identify what APIs/services are needed
2. **List required secrets** - Document all API keys needed
3. **Generate code** - Use `os.environ.get('SECRET_NAME')`
4. **Generate schema** - Use LLM to identify `requiredSecrets`
5. **Validate** - Ensure every secret used in code is declared
6. **Save to DB** - Tool saved with complete `requiredSecrets` array

### When Using a Tool

1. **Check `requiredSecrets`** - Before execution
2. **Verify availability** - Confirm user has configured all required secrets
3. **Provide guidance** - If missing: "Please configure X in Settings > Secrets"
4. **Execute** - Tool receives secrets via environment

### When Updating a Tool

1. **Review changes** - Identify new API usage
2. **Update code** - Add new `os.environ.get('NEW_SECRET')`
3. **Update schema** - Add to `requiredSecrets` array
4. **Re-validate** - Ensure completeness
5. **Save with version increment** - Update existing tool in DB

---

## System Components Handling Secrets

### Secret Manager Service (`secretsService`)

**Location:** `backend/services/secrets.ts`

Handles:
- Creating/storing secrets
- Retrieving secret values
- Listing secret metadata
- Encryption/decryption

**Key Method:**
```typescript
async getSecretsValues(userId: string, secretKeys: string[])
  : Promise<Record<string, string>>
```

### Tool Registry (`dynamicToolRegistry`)

**Location:** `backend/services/dynamic-tool-registry.ts`

**Execution Logic:**
```typescript
// Get required secrets for tool
const secretValues = await secretsService.getSecretsValues(
  userId,
  tool.requiredSecrets  // ← Passed here
);

// Check if all available
const missingSecrets = tool.requiredSecrets.filter(
  (s) => !secretValues[s]  // ← Validates completeness
);

if (missingSecrets.length > 0) {
  return { success: false, error: `Missing: ${missingSecrets.join(", ")}` };
}

// Inject into environment
const fullCode = `
import os
import json

# Injected parameters and secrets
params = ${paramsJson}
os.environ.update(${JSON.stringify(secretValues)})

# Tool code
${tool.code}
`;
```

### Tool Executor Service

**Location:** `backend/services/tool-executor.ts`

Coordinates:
1. Tool selection
2. Secret validation
3. Execution delegation
4. Result handling

---

## Examples

### Example 1: Simple API Tool

**Objective:** "Create a weather lookup tool using OpenWeatherMap"

**Generated Code:**
```python
import os
import requests

def get_weather(city: str, country_code: str = None):
    api_key = os.environ.get('OPENWEATHER_API_KEY')
    if not api_key:
        return {"error": "OpenWeather API key not configured"}
    
    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {
            "q": f"{city},{country_code}" if country_code else city,
            "appid": api_key,
            "units": "metric"
        }
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        result = response.json()
        return {
            "city": result.get("name"),
            "temperature": result["main"]["temp"],
            "description": result["weather"][0]["description"]
        }
    except requests.RequestException as e:
        return {"error": f"API request failed: {str(e)}"}

# Main execution
result = get_weather(params.get("city"), params.get("country_code"))
```

**Tool Definition:**
```typescript
{
  name: "openweather_lookup",
  displayName: "Weather Lookup",
  description: "Get current weather for any city",
  code: "[python code above]",
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name" },
      country_code: { type: "string", description: "Optional country code" }
    },
    required: ["city"]
  },
  outputSchema: {
    type: "object",
    properties: {
      city: { type: "string" },
      temperature: { type: "number" },
      description: { type: "string" }
    }
  },
  requiredSecrets: ["OPENWEATHER_API_KEY"],  // ✓ Declared
  category: "weather",
  tags: ["weather", "openweathermap"]
}
```

### Example 2: Multi-Service Tool

**Objective:** "Create a content generator that uses OpenAI and saves to Supabase"

**Generated Code:**
```python
import os
import requests

def generate_and_save_content(topic: str):
    # Check required secrets
    openai_key = os.environ.get('OPENAI_API_KEY')
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_API_KEY')
    
    if not all([openai_key, supabase_url, supabase_key]):
        return {"error": "Missing required secrets"}
    
    try:
        # Generate content with OpenAI
        content = generate_with_openai(topic, openai_key)
        
        # Save to Supabase
        save_to_supabase(content, supabase_url, supabase_key)
        
        result = {"success": True, "content": content}
    except Exception as e:
        result = {"error": str(e)}
    
    return result

def generate_with_openai(topic: str, api_key: str):
    # ... OpenAI API call ...
    pass

def save_to_supabase(content: str, url: str, key: str):
    # ... Supabase API call ...
    pass

result = generate_and_save_content(params.get("topic"))
```

**Tool Definition:**
```typescript
{
  name: "content_generator_saver",
  displayName: "Content Generator & Saver",
  description: "Generate content with OpenAI and save to Supabase",
  code: "[python code above]",
  inputSchema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "Topic to generate content about" }
    },
    required: ["topic"]
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      content: { type: "string" },
      error: { type: "string" }
    }
  },
  requiredSecrets: [
    "OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_API_KEY"
  ],  // ✓ All declared
  category: "content",
  tags: ["ai", "generation", "database", "openai", "supabase"]
}
```

---

## Debugging Missing Secrets

### Symptoms

1. **Tool exists but execution fails**
   ```
   Error: Missing required secrets: OPENAI_API_KEY
   ```

2. **Tool runs but returns undefined**
   ```
   api_key = os.environ.get('OPENAI_API_KEY')  # Returns None
   ```

3. **Tool definition incomplete**
   ```
   Tool code uses STRIPE_API_KEY but requiredSecrets: [] is empty
   ```

### Resolution Steps

1. **Check tool definition:**
   ```
   GET /api/generated-tools/{toolId}
   → Look at requiredSecrets field
   ```

2. **Verify user has secret configured:**
   ```
   GET /api/secrets
   → Check if required secret exists
   ```

3. **Update tool if needed:**
   ```
   PUT /api/generated-tools/{toolId}
   → Update requiredSecrets array
   ```

4. **User configures secret:**
   ```
   POST /api/secrets
   → Create missing secret
   ```

---

## Database Schema

### generatedTool Table

```prisma
model GeneratedTool {
  id                 String    @id @default(cuid())
  userId             String
  name               String    @unique
  displayName        String
  description        String
  code               String
  inputSchema        Json
  outputSchema       Json?
  requiredSecrets    String[]  // ← THIS FIELD
  category           String    @default("custom")
  tags               String[]
  enabled            Boolean   @default(true)
  version            Int       @default(1)
  // ... other fields
}
```

### secret Table

```prisma
model Secret {
  id          String   @id @default(cuid())
  userId      String
  key         String   // e.g., "OPENAI_API_KEY"
  value       String   // Encrypted
  displayName String
  category    String?
  // ... other fields
}
```

---

## API Endpoints

### List Available Secrets

```
GET /api/secrets

Response:
{
  "success": true,
  "secrets": [
    { "key": "OPENAI_API_KEY", "displayName": "OpenAI API Key", ... },
    { "key": "STRIPE_API_KEY", "displayName": "Stripe API Key", ... }
  ]
}
```

### Get Tool Details (with requiredSecrets)

```
GET /api/generated-tools/{toolId}

Response:
{
  "success": true,
  "tool": {
    "id": "...",
    "name": "openai_text_generator",
    "displayName": "OpenAI Text Generator",
    "code": "...",
    "requiredSecrets": ["OPENAI_API_KEY"],
    ...
  }
}
```

### Execute Tool (validates secrets)

```
POST /api/tools/execute

{
  "toolId": "...",
  "action": "execute",
  "params": { ... }
}

Response:
{
  "success": false,
  "error": "Missing required secrets: OPENAI_API_KEY. Please configure them in Settings > Secrets."
}
```

---

## Agent Checklist

When agents work with tools, they should verify:

- [ ] **Code Review**: Does the code use `os.environ.get('API_KEY')`?
- [ ] **Secret Declaration**: Are all API keys listed in `requiredSecrets`?
- [ ] **Name Matching**: Do secret names in code match declarations exactly?
- [ ] **Validation**: Is there error handling for missing secrets?
- [ ] **Documentation**: Is the tool's purpose clear and secrets documented?
- [ ] **Testing**: Can the tool be tested with user's configured secrets?
- [ ] **Updates**: If modifying code, are new secrets added to `requiredSecrets`?

---

## Related Files

- [Tool Execution Service](../../backend/services/tool-executor.ts)
- [Dynamic Tool Registry](../../backend/services/dynamic-tool-registry.ts)
- [Secrets Service](../../backend/services/secrets.ts)
- [Dynamic Tool Generator](../../backend/services/dynamic-tool-generator.ts)
- [Tool Generation Workflow](../../backend/services/tool-generation-workflow.ts)

---

**Last Updated:** January 29, 2026
**Status:** Reference Documentation
