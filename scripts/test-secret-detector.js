#!/usr/bin/env node

/**
 * Quick validation script to test secret detector
 * Run: node scripts/test-secret-detector.js
 */

import {
  detectSecretsInCode,
  validateSecretsDeclaration,
  mergeAndCompleteSecrets,
  generateSecretsReport,
} from "../backend/services/secret-detector.js";

// Test cases
const testCases = [
  {
    name: "OpenAI Tool",
    code: `
import os
api_key = os.environ.get('OPENAI_API_KEY')
result = {"key": api_key}
`,
    declared: ["OPENAI_API_KEY"],
    shouldBeValid: true,
  },
  {
    name: "Multi-API Tool - Complete",
    code: `
stripe = os.environ.get('STRIPE_API_KEY')
openai = os.environ.get('OPENAI_API_KEY')
db = os.environ.get('DATABASE_URL')
`,
    declared: ["STRIPE_API_KEY", "OPENAI_API_KEY", "DATABASE_URL"],
    shouldBeValid: true,
  },
  {
    name: "Multi-API Tool - Incomplete (should auto-correct)",
    code: `
stripe = os.environ.get('STRIPE_API_KEY')
openai = os.environ.get('OPENAI_API_KEY')
db = os.environ.get('DATABASE_URL')
`,
    declared: ["STRIPE_API_KEY", "OPENAI_API_KEY"],
    shouldBeValid: false,
  },
  {
    name: "No Secrets",
    code: `
result = 42
print("Hello world")
`,
    declared: [],
    shouldBeValid: true,
  },
  {
    name: "Various patterns",
    code: `
key1 = os.environ.get('API_KEY')
key2 = os.getenv('ANOTHER_KEY')
key3 = os.environ['THIRD_KEY']
`,
    declared: ["API_KEY", "ANOTHER_KEY", "THIRD_KEY"],
    shouldBeValid: true,
  },
];

console.log("🧪 Secret Detector Validation Tests\n");
console.log("=".repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  console.log(`\n${index + 1}. ${test.name}`);
  console.log("-".repeat(60));

  // Detect
  const detected = detectSecretsInCode(test.code);
  console.log(`   Detected: ${detected.length > 0 ? detected.join(", ") : "none"}`);

  // Validate
  const validation = validateSecretsDeclaration(test.code, test.declared);
  console.log(`   Declared: ${test.declared.length > 0 ? test.declared.join(", ") : "none"}`);

  // Check
  const isValid = validation.valid;
  const expectedValid = test.shouldBeValid;
  const testPassed = isValid === expectedValid;

  console.log(
    `   Status:   ${isValid ? "✓ VALID" : "❌ INVALID"}${
      !expectedValid && !isValid ? " (expected)" : ""
    }`,
  );

  if (!isValid && validation.missingSecrets.length > 0) {
    console.log(`   Missing:  ${validation.missingSecrets.join(", ")}`);
  }

  if (validation.undeclaredSecrets.length > 0) {
    console.log(`   Unused:   ${validation.undeclaredSecrets.join(", ")}`);
  }

  // Merge
  const merged = mergeAndCompleteSecrets(test.code, test.declared);
  if (merged.length > 0 && merged.length !== test.declared.length) {
    console.log(`   Merged:   ${merged.join(", ")}`);
  }

  if (testPassed) {
    console.log("   ✅ Test PASSED");
    passed++;
  } else {
    console.log("   ❌ Test FAILED");
    failed++;
  }
});

console.log("\n" + "=".repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
console.log(
  failed === 0 ? "\n✅ All tests passed!" : `\n❌ ${failed} test(s) failed`,
);
console.log();
