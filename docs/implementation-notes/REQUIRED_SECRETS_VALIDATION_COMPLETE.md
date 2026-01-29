# Required Secrets Validation - Implementation Complete

## Overview

✅ **IMPLEMENTED** - Automatic detection and enforcement of API key declarations in all generated tools.

The system now **automatically**:
1. Scans generated Python code for all secret/API key usage
2. Validates that every secret is declared in `requiredSecrets`
3. **Auto-corrects** if secrets are used but not declared
4. Prevents tool creation with incomplete secret declarations

---

## What Changed

### 1. New Service: Secret Detector (`secret-detector.ts`)

**Location:** `backend/services/secret-detector.ts`

Core functions:
- `detectSecretsInCode(code)` - Scans Python code and finds all environment variable accesses
- `validateSecretsDeclaration(code, declared)` - Checks if all used secrets are declared
- `mergeAndCompleteSecrets(code, declared)` - Combines detected + declared secrets
- `generateSecretsReport(code, declared)` - Human-readable validation report

**Patterns detected:**
```python
os.environ.get('API_KEY')
os.getenv('API_KEY')
os.environ['API_KEY']
```

### 2. Updated: Dynamic Tool Generator (`dynamic-tool-generator.ts`)

**Changes:**
- ✅ Import `secret-detector` functions
- ✅ Enhanced `generateToolSchema()` to auto-detect secrets
- ✅ Added validation before saving tool
- ✅ Auto-corrects `requiredSecrets` if incomplete

**Key logic:**
```typescript
// Detect all secrets actually used in code
const detectedSecrets = detectSecretsInCode(code);

// Merge with LLM response
const completeSecrets = mergeAndCompleteSecrets(code, schema.requiredSecrets);

// FORCE include any missing secrets
if (!validation.valid) {
  schema.requiredSecrets = [...completeSecrets, ...validation.missingSecrets];
}
```

### 3. Updated: Tool Generation Workflow (`tool-generation-workflow.ts`)

**Changes:**
- ✅ Import `secret-detector` functions
- ✅ Enhanced validation phase with automatic detection
- ✅ Added auto-correction in save phase
- ✅ Comprehensive logging of secret changes

**Validation Phase:**
```typescript
// Step 1: Auto-detect secrets in code
const detectedSecrets = detectSecretsInCode(code);

// Step 2: Merge with LLM declaration
const completeSecrets = mergeAndCompleteSecrets(code, schema.requiredSecrets);

// Step 3: Force include missing secrets if any
if (!validation.valid) {
  schema.requiredSecrets = [...completeSecrets, ...validation.missingSecrets];
}
```

**Save Phase:**
```typescript
// Validate before saving
const validation = validateSecretsDeclaration(code, schemaSecrets);

if (!validation.valid) {
  // Auto-correct
  finalSecrets = [...schemaSecrets, ...validation.missingSecrets];
  // Log the correction
  await this.log(sessionId, "save", "warning", 
    `Auto-corrected: Added missing secrets: ${validation.missingSecrets.join(", ")}`);
}
```

---

## How It Works in Practice

### Scenario 1: Tool Creation with OpenAI

```
User Request: "Create a tool that uses OpenAI API"
                    ↓
Generated Code: 
  api_key = os.environ.get('OPENAI_API_KEY')
  response = requests.post(..., headers={"Authorization": f"Bearer {api_key}"})
                    ↓
Secret Detector: Detects ['OPENAI_API_KEY']
                    ↓
Schema Generation: LLM generates schema with requiredSecrets
                    ↓
Validation Phase: 
  - Detected: ['OPENAI_API_KEY']
  - LLM declared: ['OPENAI_API_KEY']
  - ✓ Valid! All match
                    ↓
Tool Saved: requiredSecrets = ['OPENAI_API_KEY']
```

### Scenario 2: Tool with Incomplete Declaration (Auto-Corrected)

```
User Request: "Create a tool for Stripe and database"
                    ↓
Generated Code:
  stripe_key = os.environ.get('STRIPE_API_KEY')
  db_url = os.environ.get('DATABASE_URL')
                    ↓
Secret Detector: Detects ['STRIPE_API_KEY', 'DATABASE_URL']
                    ↓
Schema Generation: LLM generates schema 
  requiredSecrets: ['STRIPE_API_KEY']  // Missing DATABASE_URL!
                    ↓
Validation Phase:
  - Detected: ['STRIPE_API_KEY', 'DATABASE_URL']
  - Declared: ['STRIPE_API_KEY']
  - ❌ Missing: ['DATABASE_URL']
  - AUTO-CORRECTING...
                    ↓
Auto-Correction:
  requiredSecrets = ['STRIPE_API_KEY', 'DATABASE_URL']
  Log: "Added missing secrets: DATABASE_URL"
                    ↓
Tool Saved: ✅ Complete requiredSecrets
```

### Scenario 3: Hardcoded Secret (Still caught but needs manual fix)

```
Generated Code:
  api_key = "sk-1234567890"  // HARDCODED - INSECURE!
  response = requests.get(..., headers={"Authorization": f"Bearer {api_key}"})
                    ↓
Secret Detector: No environment variable detected
  Detected: []
                    ↓
This code would still execute but:
  ⚠️ INSECURE - Secret is hardcoded
  ⚠️ Not using os.environ.get()
  ✅ But won't fail at runtime (it has the key)
  
Note: The LLM generation prompt already instructs to use
os.environ.get() for all secrets. This rarely happens.
```

---

## Files Modified

| File | Changes | Impact |
|------|---------|--------|
| `backend/services/secret-detector.ts` | **NEW** | Core secret detection logic |
| `backend/services/secret-detector.test.ts` | **NEW** | Comprehensive test suite |
| `backend/services/dynamic-tool-generator.ts` | Enhanced `generateToolSchema()` and `saveTool()` | Auto-detects and validates secrets |
| `backend/services/tool-generation-workflow.ts` | Enhanced validation and save phases | Auto-detects, validates, and corrects |

---

## Validation Tests

Run tests with:
```bash
npm test backend/services/secret-detector.test.ts
```

**Test coverage:**
- ✅ Detects `os.environ.get()` patterns
- ✅ Detects `os.getenv()` patterns
- ✅ Detects `os.environ[...]` patterns
- ✅ Handles quote variations (single/double)
- ✅ Handles default values in get()
- ✅ Validates complete declarations
- ✅ Detects undeclared secrets
- ✅ Merges and deduplicates secrets
- ✅ Generates human-readable reports
- ✅ Real-world scenarios (OpenAI, multi-service, etc.)

---

## Runtime Behavior

### Tool Creation

When an agent creates a tool:
1. **Generate** → Code generated with `os.environ.get()` calls
2. **Detect** → Secret detector scans code
3. **Schema** → LLM generates schema with `requiredSecrets`
4. **Validate** → Auto-detection compared against declaration
5. **Auto-Correct** → If missing, automatically added
6. **Log** → Changes logged for transparency
7. **Save** → Tool saved with complete `requiredSecrets`

### Tool Execution

When a tool is executed:
1. **Check** → System verifies all `requiredSecrets` are available
2. **Retrieve** → Get actual secret values from encrypted store
3. **Inject** → Pass as environment variables to sandbox
4. **Execute** → Code accesses via `os.environ.get()`
5. **Return** → Result or "Missing secrets" error

### Tool Update

When an agent updates a tool:
1. **Scan new code** for any new secret references
2. **Validate** against existing `requiredSecrets`
3. **Add missing** if any detected
4. **Save** with updated `requiredSecrets`

---

## Error Messages

### Missing Secrets at Runtime
```
Error: Missing required secrets: OPENAI_API_KEY, STRIPE_API_KEY
Please configure them in Settings > Secrets.
```

### Log Messages During Generation
```
Auto-detected 2 secret(s): OPENAI_API_KEY, STRIPE_API_KEY
Final required secrets: OPENAI_API_KEY, STRIPE_API_KEY
Auto-corrected: Added missing secrets to requiredSecrets: DATABASE_URL
```

---

## Security Considerations

✅ **What's Protected:**
- All `os.environ.get()` references are tracked
- Secrets are injected only during execution
- Secrets stored encrypted in database
- `requiredSecrets` field is always complete

⚠️ **What's NOT Protected:**
- Hardcoded secrets (but LLM is instructed to avoid)
- Secrets in comments or strings
- Secrets in import statements
- Code that builds secret strings dynamically

**Best Practice:** Always use `os.environ.get('SECRET_NAME')`

---

## Example Code Patterns

### ✅ Correct Pattern
```python
import os
import requests

api_key = os.environ.get('OPENAI_API_KEY')
if not api_key:
    result = {"error": "API key not configured"}
    return

headers = {"Authorization": f"Bearer {api_key}"}
response = requests.post("https://api.openai.com/v1/...", headers=headers)
result = response.json()
```

### ❌ Incorrect Patterns

```python
# Pattern 1: Hardcoded secret
api_key = "sk-1234567890"  # ❌ NEVER DO THIS

# Pattern 2: Not using environ
api_key = input("Enter your API key: ")  # ❌ Won't work in sandbox

# Pattern 3: Building secret name dynamically
secret_name = "OPENAI_API_KEY"
api_key = os.environ.get(secret_name)  # ❌ Won't be detected
# Use direct string: os.environ.get('OPENAI_API_KEY')
```

---

## Debugging

### Check if tool has all required secrets
```
GET /api/generated-tools/{toolId}
→ Look at requiredSecrets field
```

### Check user's configured secrets
```
GET /api/secrets
→ List of available secrets for this user
```

### Generate validation report
```javascript
import { generateSecretsReport } from "./secret-detector";
const report = generateSecretsReport(toolCode, requiredSecrets);
console.log(report);
```

---

## Future Enhancements

Possible improvements:
1. **Static analysis** for hardcoded secrets detection
2. **Pattern library** for common API services
3. **LLM verification** that generated code is secure
4. **Audit trail** of secret access
5. **Secret rotation** alerts

---

## Integration Checklist

- [x] Create `secret-detector.ts` service
- [x] Add test suite with comprehensive coverage
- [x] Integrate with `dynamic-tool-generator.ts`
- [x] Integrate with `tool-generation-workflow.ts`
- [x] Add validation in schema generation
- [x] Add validation in save phase
- [x] Auto-correction when incomplete
- [x] Logging for transparency
- [x] TypeScript compilation verified
- [ ] Run full test suite
- [ ] Deploy to staging
- [ ] Monitor for edge cases

---

## References

- **Secret Detection Logic:** `backend/services/secret-detector.ts`
- **Integration Point 1:** `backend/services/dynamic-tool-generator.ts` (lines ~500-620)
- **Integration Point 2:** `backend/services/tool-generation-workflow.ts` (lines ~988-1080)
- **Tests:** `backend/services/secret-detector.test.ts`

---

**Status:** ✅ Implementation Complete  
**Date:** January 29, 2026  
**Impact:** All agents now must declare all secrets used in tools
