// Test file for sanitization service
// Run with: npx ts-node backend/services/__tests__/sanitize.test.ts

import {
  sanitizeToolResult,
  generateToolExecutionSummary,
  createToolMetadata,
} from "../sanitize-tool-results.js";

console.log("🧪 Testing Sanitization Service\n");

// Test 1: API Key Redaction
console.log("Test 1: API Key Redaction");
const apiKeyData = {
  response: "Success",
  api_key: "sk_test_1234567890abcdef",
  user_email: "user@example.com",
  details: {
    authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  },
};

const result1 = sanitizeToolResult(apiKeyData);
console.log("Input:", JSON.stringify(apiKeyData, null, 2));
console.log("Output:", JSON.stringify(result1.cleaned, null, 2));
console.log(
  "Sanitized:",
  result1.hasSensitiveData,
  "Count:",
  result1.redactedCount,
);
console.log("Redaction Summary:", result1.redactionSummary);
console.log();

// Test 2: Password Redaction
console.log("Test 2: Password Redaction");
const passwordData = {
  status: "authenticated",
  credentials: {
    username: "john_doe",
    password: "MySecurePassword123!",
    db_password: "DatabasePass456",
  },
};

const result2 = sanitizeToolResult(passwordData);
console.log("Input:", JSON.stringify(passwordData, null, 2));
console.log("Output:", JSON.stringify(result2.cleaned, null, 2));
console.log("Redacted Count:", result2.redactedCount);
console.log("Redaction Summary:", result2.redactionSummary);
console.log();

// Test 3: Email and Phone Redaction
console.log("Test 3: Email and Phone Redaction");
const contactData = {
  user: "John Doe",
  contact: {
    email: "john.doe@company.com",
    phone: "+33 6 12 34 56 78",
    backup_email: "john@personal.com",
  },
};

const result3 = sanitizeToolResult(contactData);
console.log("Input:", JSON.stringify(contactData, null, 2));
console.log("Output:", JSON.stringify(result3.cleaned, null, 2));
console.log("Redacted Count:", result3.redactedCount);
console.log("Redaction Summary:", result3.redactionSummary);
console.log();

// Test 4: AWS Credentials
console.log("Test 4: AWS Credentials");
const awsData = {
  credentials: {
    aws_access_key: "AKIAIOSFODNN7EXAMPLE",
    aws_secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  },
  region: "eu-west-1",
};

const result4 = sanitizeToolResult(awsData);
console.log("Input:", JSON.stringify(awsData, null, 2));
console.log("Output:", JSON.stringify(result4.cleaned, null, 2));
console.log("Redacted Count:", result4.redactedCount);
console.log("Redaction Summary:", result4.redactionSummary);
console.log();

// Test 5: Tool Execution Summary
console.log("Test 5: Tool Execution Summary");
const toolResults = [
  {
    toolUsed: "curl",
    success: true,
    error: undefined,
    executionTime: 245,
  },
  {
    toolUsed: "notification",
    success: true,
    error: undefined,
    executionTime: 120,
  },
  {
    toolUsed: "user_context",
    success: false,
    error: "Timeout",
    executionTime: 5000,
  },
];

const summary = generateToolExecutionSummary(toolResults);
console.log("Summary:\n", summary);
console.log();

const metadata = createToolMetadata(toolResults, summary);
console.log("Metadata:", JSON.stringify(metadata, null, 2));
console.log();

// Test 6: Clean data (no sensitive info)
console.log("Test 6: Clean Data (No Sensitive Info)");
const cleanData = {
  weather: "sunny",
  temperature: 22,
  humidity: 65,
  forecast: ["sunny", "cloudy", "rainy"],
};

const result6 = sanitizeToolResult(cleanData);
console.log("Input:", JSON.stringify(cleanData, null, 2));
console.log("Has Sensitive Data:", result6.hasSensitiveData);
console.log("Redacted Count:", result6.redactedCount);
console.log();

console.log("✅ All tests completed!");
