/**
 * Tests for JSON Parser Utility
 * Run with: npx tsx backend/utils/__tests__/json-parser.test.ts
 */

import { stripMarkdownCodeBlocks, parseJSONFromLLMResponse } from '../json-parser.js';

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

// Test 5: Parse JSON from markdown code blocks
console.log("Test 5: Parse JSON from markdown code blocks");
const input5 = '```json\n{"title": "Test", "value": 42}\n```';
const result5 = parseJSONFromLLMResponse(input5);
console.log("Input:", input5);
console.log("Result:", JSON.stringify(result5));
console.log("✓ Pass:", result5.title === "Test" && result5.value === 42);
console.log();

// Test 6: Parse plain JSON
console.log("Test 6: Parse plain JSON");
const input6 = '{"title": "Test", "value": 42}';
const result6 = parseJSONFromLLMResponse(input6);
console.log("Input:", input6);
console.log("Result:", JSON.stringify(result6));
console.log("✓ Pass:", result6.title === "Test" && result6.value === 42);
console.log();

// Test 7: Handle complex nested objects (summarization format)
console.log("Test 7: Handle complex nested objects (summarization format)");
const input7 = `\`\`\`json
{
  "title": "Summary",
  "content": "Test content",
  "keyInsights": ["insight1", "insight2"],
  "topics": ["topic1"],
  "sentiment": "positive",
  "actionItems": []
}
\`\`\``;
const result7 = parseJSONFromLLMResponse(input7);
console.log("Input:", input7);
console.log("Result:", JSON.stringify(result7, null, 2));
console.log("✓ Pass:", 
  result7.title === "Summary" && 
  result7.keyInsights.length === 2 &&
  result7.sentiment === "positive"
);
console.log();

// Test 8: Throw error on invalid JSON
console.log("Test 8: Throw error on invalid JSON");
const input8 = '```json\n{invalid json}\n```';
try {
  parseJSONFromLLMResponse(input8);
  console.log("✗ Fail: Should have thrown SyntaxError");
} catch (error) {
  console.log("✓ Pass: Correctly threw error:", error instanceof SyntaxError);
}
console.log();

// Test 9: Handle exact format from problem statement
console.log("Test 9: Handle exact format from problem statement");
const input9 = '```json\n{\n  "title": "Weekly Summary"\n}\n```';
const result9 = parseJSONFromLLMResponse(input9);
console.log("Input:", input9);
console.log("Result:", JSON.stringify(result9));
console.log("✓ Pass:", result9.title === "Weekly Summary");
console.log();

console.log("✅ All tests completed!");

