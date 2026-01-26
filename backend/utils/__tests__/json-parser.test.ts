/**
 * Tests for JSON Parser Utility
 * Run with: npx tsx backend/utils/__tests__/json-parser.test.ts
 */

import {
  stripMarkdownCodeBlocks,
  parseJSONFromLLMResponse,
  extractJSONFromText,
  repairIncompleteJSON,
} from "../json-parser.js";

console.log("🧪 Testing JSON Parser Utility\n");

// Test 1: Strip markdown code blocks with json identifier
console.log("Test 1: Strip markdown code blocks with json identifier");
const input1 = '```json\n{"key": "value"}\n```';
const expected1 = '{"key": "value"}';
const result1 = stripMarkdownCodeBlocks(input1);
console.log("Input:", input1);
console.log("Expected:", expected1);
console.log("Result:", result1);
console.log("✓ Pass:", result1 === expected1);
console.log();

// Test 2: Strip markdown code blocks without language identifier
console.log("Test 2: Strip markdown code blocks without language identifier");
const input2 = '```\n{"key": "value"}\n```';
const expected2 = '{"key": "value"}';
const result2 = stripMarkdownCodeBlocks(input2);
console.log("Input:", input2);
console.log("Expected:", expected2);
console.log("Result:", result2);
console.log("✓ Pass:", result2 === expected2);
console.log();

// Test 3: Handle multiline JSON
console.log("Test 3: Handle multiline JSON");
const input3 = '```json\n{\n  "key": "value",\n  "array": [1, 2, 3]\n}\n```';
const expected3 = '{\n  "key": "value",\n  "array": [1, 2, 3]\n}';
const result3 = stripMarkdownCodeBlocks(input3);
console.log("Input:", input3);
console.log("Expected:", expected3);
console.log("Result:", result3);
console.log("✓ Pass:", result3 === expected3);
console.log();

// Test 4: Handle JSON without code blocks
console.log("Test 4: Handle JSON without code blocks");
const input4 = '{"key": "value"}';
const result4 = stripMarkdownCodeBlocks(input4);
console.log("Input:", input4);
console.log("Result:", result4);
console.log("✓ Pass:", result4 === input4);
console.log();

// Test 5: Handle null/undefined gracefully
console.log("Test 5: Handle null/undefined gracefully");
const result5a = stripMarkdownCodeBlocks(null as any);
const result5b = stripMarkdownCodeBlocks(undefined as any);
console.log("Null result:", result5a, "=== '':", result5a === "");
console.log("Undefined result:", result5b, "=== '':", result5b === "");
console.log("✓ Pass:", result5a === "" && result5b === "");
console.log();

// Test 6: Handle code blocks not at start/end
console.log("Test 6: Handle code blocks not at start/end");
const input6 =
  'Some text before\n```json\n{"key": "value"}\n```\nSome text after';
const result6 = stripMarkdownCodeBlocks(input6);
console.log("Input:", input6);
console.log("Result:", result6);
console.log("✓ Pass:", result6.includes('{"key": "value"}'));
console.log();

// Test 7: Parse JSON from markdown code blocks
console.log("Test 7: Parse JSON from markdown code blocks");
const input7a = '```json\n{"title": "Test", "value": 42}\n```';
const result7a = parseJSONFromLLMResponse(input7a);
console.log("Input:", input7a);
console.log("Result:", JSON.stringify(result7a));
console.log("✓ Pass:", result7a.title === "Test" && result7a.value === 42);
console.log();

// Test 8: Parse plain JSON
console.log("Test 8: Parse plain JSON");
const input8 = '{"title": "Test", "value": 42}';
const result8 = parseJSONFromLLMResponse(input8);
console.log("Input:", input8);
console.log("Result:", JSON.stringify(result8));
console.log("✓ Pass:", result8.title === "Test" && result8.value === 42);
console.log();

// Test 9: Handle complex nested objects (summarization format)
console.log("Test 9: Handle complex nested objects (summarization format)");
const input9 = `\`\`\`json
{
  "title": "Summary",
  "content": "Test content",
  "keyInsights": ["insight1", "insight2"],
  "topics": ["topic1"],
  "sentiment": "positive",
  "actionItems": []
}
\`\`\``;
const result9 = parseJSONFromLLMResponse(input9);
console.log("Input:", input9);
console.log("Result:", JSON.stringify(result9, null, 2));
console.log(
  "✓ Pass:",
  result9.title === "Summary" &&
    result9.keyInsights.length === 2 &&
    result9.sentiment === "positive",
);
console.log();

// Test 10: Throw error on invalid JSON
console.log("Test 10: Throw error on invalid JSON");
const input10 = "```json\n{invalid json}\n```";
try {
  parseJSONFromLLMResponse(input10);
  console.log("✗ Fail: Should have thrown SyntaxError");
} catch (error) {
  console.log("✓ Pass: Correctly threw error:", error instanceof SyntaxError);
}
console.log();

// Test 11: Handle JSON with non-JSON prefix (assistant response)
console.log("Test 11: Handle JSON with non-JSON prefix (assistant response)");
const input11 = 'assistant\n{"title": "Test", "value": 42}';
try {
  const result11 = parseJSONFromLLMResponse(input11);
  console.log("Input:", input11);
  console.log("Result:", JSON.stringify(result11));
  console.log("✓ Pass:", result11.title === "Test" && result11.value === 42);
} catch (e) {
  console.log("✗ Fail:", e);
}
console.log();

// Test 12: Extract JSON from text with surrounding context
console.log("Test 12: Extract JSON from text with surrounding context");
const input12 =
  'Here is the analysis: {"claims": ["claim1", "claim2"], "reasoning": "test"}. End of analysis.';
const extracted12 = extractJSONFromText(input12);
console.log("Input:", input12);
console.log("Extracted:", extracted12);
try {
  const parsed12 = JSON.parse(extracted12);
  console.log(
    "✓ Pass:",
    Array.isArray(parsed12.claims) && parsed12.claims.length === 2,
  );
} catch (e) {
  console.log("✗ Fail:", e);
}
console.log();

// Test 13: Repair incomplete JSON (missing closing braces)
console.log("Test 13: Repair incomplete JSON (missing closing braces)");
const input13 =
  '{"title": "Test", "items": [{"name": "item1"}, {"name": "item2"';
const repaired13 = repairIncompleteJSON(input13);
console.log("Input:", input13);
console.log("Repaired:", repaired13);
try {
  const parsed13 = JSON.parse(repaired13);
  console.log(
    "✓ Pass:",
    parsed13.title === "Test" && parsed13.items.length === 2,
  );
} catch (e) {
  console.log("✗ Fail:", e);
}
console.log();

// Test 14: End-to-end robustness - incomplete JSON with prefix
console.log("Test 14: End-to-end robustness - incomplete JSON with prefix");
const input14 = 'assistant\n{"claims": ["claim1", "claim2"';
try {
  const result14 = parseJSONFromLLMResponse(input14);
  console.log("Input:", input14);
  console.log("Result:", JSON.stringify(result14));
  console.log(
    "✓ Pass:",
    Array.isArray(result14.claims) && result14.claims.length === 2,
  );
} catch (e) {
  console.log("✗ Fail:", e);
}
console.log();

// Test 11: Handle exact format from problem statement
console.log("Test 11: Handle exact format from problem statement");
const input11 = '```json\n{\n  "title": "Weekly Summary"\n}\n```';
const result11 = parseJSONFromLLMResponse(input11);
console.log("Input:", input11);
console.log("Result:", JSON.stringify(result11));
console.log("✓ Pass:", result11.title === "Weekly Summary");
console.log();

console.log("✅ All tests completed!");
