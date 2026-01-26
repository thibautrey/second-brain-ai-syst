# Quick Troubleshooting: JSON Parsing Errors

## Still Seeing JSON Parse Errors?

### 1. Check if System is Up-to-Date

Ensure you're using the latest code:

```bash
git pull
npm install --legacy-peer-deps
```

### 2. Rebuild Backend

The JSON parser improvements require recompilation:

```bash
cd backend
npm run build
# OR if using Docker
docker-compose up --build backend-1
```

### 3. Check Logs for New Error Format

After the fix, errors will show:

```
[JSONParser] Failed to parse JSON from response:
Original response: "assistant\n{"claims"..."
After markdown stripping: "{\"claims\"..."
After extraction: "{\"claims\"..."
After repair: "{\"claims\"..."
```

This tells you which strategy failed and why.

### 4. Test the Parser Directly

```bash
npx tsx backend/utils/__tests__/json-parser.test.ts
```

All 14 tests should pass ✓

### 5. Common Issues & Solutions

#### Issue: "Still getting 'Unexpected end of JSON input'"

- **Cause**: Incomplete JSON that repair can't fix
- **Solution**: Check if LLM response is being truncated (max_tokens too low)
- **Fix**: Increase `max_tokens` in the LLM request

#### Issue: "Still getting 'Unexpected token' errors"

- **Cause**: JSON is severely malformed, not just incomplete
- **Solution**: Check the LLM prompt - may need to be more explicit about JSON format
- **Fix**: Add example JSON format to the prompt

#### Issue: "Parser logs show 'None of the strategies worked'"

- **Cause**: Response is not JSON at all
- **Solution**: Likely an LLM API error (wrong model, API down, etc.)
- **Fix**: Check LLM provider status and credentials

### 6. Enable Debug Logging

To see detailed parsing info, modify the parser call:

```typescript
// In any service using parseJSONFromLLMResponse
try {
  const result = parseJSONFromLLMResponse(response);
} catch (error) {
  // Full error logging now automatically included
  console.error("[Service] Full error:", error);
}
```

### 7. If Issue Persists

**Collect diagnostic info**:

```bash
# Get full backend logs
docker-compose logs backend-1 | grep -i "json\|parse\|fact"

# Run test suite
npm run test

# Check LLM response directly
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [...], "response_format": {"type": "json_object"}}'
```

Then create an issue with:

- Full error message including preview content
- Which service had the error (FactChecker, IntentRouter, etc.)
- The original LLM response (if available)
- System version: `git describe --tags`

## Success Indicators

✅ FactChecker completes without errors  
✅ IntentRouter analyzes exchanges successfully  
✅ No "Unexpected token" or "Unexpected end" errors  
✅ JSON parser tests all pass  
✅ Logs show clean analysis without parse errors

## Performance Impact

None - the multi-strategy approach is:

- Only invoked on parse failure (rare with good LLM responses)
- Extremely fast (simple string operations)
- Negligible compared to LLM request latency

## Prevention

To minimize JSON parse errors going forward:

1. **LLM Provider**: Use models known for reliable JSON output (GPT-4, Claude)
2. **Prompts**: Always include `response_format: { type: "json_object" }`
3. **Max Tokens**: Set conservatively to avoid truncation
4. **Validation**: Check response before parsing when possible

```typescript
// Example: Validate before parsing
if (!response.includes("{") || !response.includes("}")) {
  console.warn("Response might not be valid JSON");
  // Handle gracefully
}
```
