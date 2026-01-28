// Example: Using the Model Compatibility Hint System

// Note: This file demonstrates usage patterns for the model compatibility hint system.
// In actual implementation, these imports would work from the services directory.
// For documentation purposes, these are the functions available:
//
// import {
//   recordModelError,
//   recordModelSuccess,
//   isModelBlacklisted,
//   getCompatibilityHint,
//   blacklistModel,
//   setPreferredEndpoint,
//   getProviderHints,
// } from '../services/model-compatibility-hint';

// Type definitions for documentation
interface CompatibilityHint {
  providerId: string;
  modelId: string;
  supportedEndpoints: string[];
  unsupportedEndpoints: string[];
  preferredEndpoint?: string;
  errorCount: number;
  successCount: number;
  isBlacklisted: boolean;
  blacklistReason?: string;
  lastErrorType?: string;
  lastErrorMessage?: string;
  lastErrorTime?: Date;
  lastSuccessTime?: Date;
}

interface LLMErrorInfo {
  type: 'timeout' | 'model-incompatible' | 'auth' | 'rate-limit' | 'network' | 'unknown';
  status?: number;
  message: string;
  isRetryable: boolean;
  isTransient: boolean;
}

// Mock functions for documentation/type checking
async function recordModelError(providerId: string, modelId: string, errorInfo: LLMErrorInfo): Promise<void> {}
async function recordModelSuccess(providerId: string, modelId: string): Promise<void> {}
async function isModelBlacklisted(providerId: string, modelId: string): Promise<boolean> { return false; }
async function getCompatibilityHint(providerId: string, modelId: string): Promise<CompatibilityHint | null> { return null; }
async function blacklistModel(providerId: string, modelId: string, reason: string): Promise<void> {}
async function setPreferredEndpoint(providerId: string, modelId: string, endpoint: string): Promise<void> {}
async function getProviderHints(providerId: string): Promise<CompatibilityHint[]> { return []; }

/**
 * Example 1: Recording an error
 * This happens automatically in LLMRouter, but here's what's happening:
 */
async function exampleRecordingError() {
  // When a call fails:
  const errorInfo = {
    type: 'model-incompatible' as const,
    status: 404,
    message: '404 This model is only supported in v1/responses and not in v1/chat/completions.',
    isRetryable: false,
    isTransient: false,
  };

  // Record the error
  await recordModelError('provider-openai', 'codex-mini-latest', errorInfo);
  // System now knows:
  // - openai/codex-mini-latest has 1 error
  // - /v1/chat/completions is unsupported
  // - This is a permanent issue (not retryable)
}

/**
 * Example 2: Recording success
 * Also automatic, but shows the flow:
 */
async function exampleRecordingSuccess() {
  // When a call succeeds:
  await recordModelSuccess('provider-openai', 'gpt-4o-mini');
  // System now knows:
  // - openai/gpt-4o-mini works (success count = 1)
  // - More confident in this provider/model combo
}

/**
 * Example 3: Checking if a model is blacklisted
 * This happens automatically before each attempt:
 */
async function exampleCheckingBlacklist() {
  const isBlacklisted = await isModelBlacklisted(
    'provider-gpustack',
    'qwen3-coder-30b-a3b-instruct-fp8'
  );

  if (isBlacklisted) {
    console.log('This model is broken, skip it and try fallback');
    // In LLMRouter.callLLM(), this prevents wasting time
  } else {
    console.log('Safe to try this model');
  }
}

/**
 * Example 4: Getting detailed hint information
 * Use this for monitoring and troubleshooting:
 */
async function exampleGettingHints() {
  const hint = await getCompatibilityHint('provider-openai', 'codex-mini-latest');

  if (hint) {
    console.log({
      provider: 'openai',
      model: 'codex-mini-latest',
      
      // Error tracking
      errorCount: hint.errorCount,          // e.g., 3
      lastErrorType: hint.lastErrorType,    // e.g., "model-incompatible"
      
      // Success tracking
      successCount: hint.successCount,      // e.g., 0
      lastSuccessTime: hint.lastSuccessTime, // null (never succeeded)
      
      // Learned endpoints
      unsupportedEndpoints: hint.unsupportedEndpoints, // ["/v1/chat/completions"]
      supportedEndpoints: hint.supportedEndpoints,    // []
      preferredEndpoint: hint.preferredEndpoint,      // null
      
      // Status
      isBlacklisted: hint.isBlacklisted,    // true (after 3+ errors)
      blacklistReason: hint.blacklistReason, // "Too many errors (3) with no successes"
    });
  } else {
    console.log('No information yet about this provider/model combo');
  }
}

/**
 * Example 5: Manually blacklisting a provider
 * Do this if a provider is deprecated or known to be broken:
 */
async function exampleManualBlacklist() {
  await blacklistModel(
    'provider-old-service',
    'legacy-model',
    'Provider shut down, no longer available'
  );
  // System will now skip this combo immediately
}

/**
 * Example 6: Recording a successful endpoint
 * Use this after you've figured out the right endpoint:
 */
async function exampleSettingPreferredEndpoint() {
  // If you discover that openai's model works with /v1/responses:
  await setPreferredEndpoint(
    'provider-openai',
    'codex-mini-latest',
    'v1/responses'
  );
  // Future attempts will know to use v1/responses for this model
}

/**
 * Example 7: Getting all hints for a provider
 * Use this for debugging and optimization:
 */
async function exampleGetAllHints() {
  const hints = await getProviderHints('provider-openai');

  console.table(hints.map((hint: any) => ({
    model: hint.modelId,
    errors: hint.errorCount,
    successes: hint.successCount,
    success_rate: hint.successCount + hint.errorCount > 0 
      ? `${(hint.successCount / (hint.successCount + hint.errorCount) * 100).toFixed(1)}%`
      : 'N/A',
    blacklisted: hint.isBlacklisted ? '⚠️' : '✓',
    endpoint: hint.preferredEndpoint || '?',
  })));

  // Output example:
  // ┌──────────────────┬────────┬──────────┬──────────────┬────────────┬──────────┐
  // │ model            │ errors │ successes│ success_rate │ blacklisted│ endpoint │
  // ├──────────────────┼────────┼──────────┼──────────────┼────────────┼──────────┤
  // │ gpt-4o-mini      │ 0      │ 42       │ 100.0%       │ ✓          │ chat/... │
  // │ codex-mini-latest│ 5      │ 0        │ 0.0%         │ ⚠️          │ ?        │
  // │ gpt-4-turbo      │ 2      │ 38       │ 95.0%        │ ✓          │ chat/... │
  // └──────────────────┴────────┴──────────┴──────────────┴────────────┴──────────┘
}

/**
 * Example 8: Real-world scenario - Handling the actual error from your logs
 */
async function exampleRealWorldScenario() {
  // From your error:
  // "Both primary provider "GpuStack" (qwen3-coder-30b-a3b-instruct-fp8) and fallback 
  //  provider "openai" (codex-mini-latest) failed. Primary: timeout (403 upstream request 
  //  timeout). Fallback: model-incompatible (404 This model is only supported in v1/responses...)"

  // What the system does:

  // 1. Primary fails with timeout
  const primaryError = {
    type: 'timeout' as const,
    status: 403,
    message: '403 upstream request timeout',
    isRetryable: true,  // Transient, might come back
    isTransient: true,
  };
  await recordModelError('provider-gpustack', 'qwen3-coder-30b-a3b-instruct-fp8', primaryError);
  console.log('✓ Recorded: GpuStack timeout (will retry on next attempt)');

  // 2. Fallback fails with model incompatibility
  const fallbackError = {
    type: 'model-incompatible' as const,
    status: 404,
    message: '404 This model is only supported in v1/responses and not in v1/chat/completions.',
    isRetryable: false,  // Permanent issue
    isTransient: false,
  };
  await recordModelError('provider-openai', 'codex-mini-latest', fallbackError);
  console.log('✓ Recorded: OpenAI model incompatible with /v1/chat/completions');

  // 3. Check what we now know
  const gpuStackHint = await getCompatibilityHint('provider-gpustack', 'qwen3-coder-30b-a3b-instruct-fp8');
  const openaiHint = await getCompatibilityHint('provider-openai', 'codex-mini-latest');

  console.log('\nLearned information:');
  console.log(`GpuStack: ${gpuStackHint?.errorCount} timeouts, blacklisted: ${gpuStackHint?.isBlacklisted}`);
  console.log(`OpenAI: ${openaiHint?.errorCount} incompatibilities, unsupported: ${openaiHint?.unsupportedEndpoints.join(', ')}`);

  // 4. Next time these are tried:
  // - GpuStack will be skipped if blacklisted (after 5+ errors)
  // - OpenAI will skip /v1/chat/completions if we learn the alternative
  // - Overall: Faster failures, less wasted API calls
}

/**
 * Example 9: Monitoring dashboard query
 * Useful for your monitoring/admin dashboard:
 */
async function exampleMonitoringQuery() {
  const allHints = await getProviderHints('provider-openai');

  // Calculate overall provider health
  const totalErrors = allHints.reduce((sum: number, h: any) => sum + h.errorCount, 0);
  const totalSuccesses = allHints.reduce((sum: number, h: any) => sum + h.successCount, 0);
  const successRate = totalSuccesses + totalErrors > 0
    ? (totalSuccesses / (totalSuccesses + totalErrors) * 100).toFixed(1)
    : 'N/A';

  const blacklistedCount = allHints.filter((h: any) => h.isBlacklisted).length;

  console.log(`
📊 OpenAI Provider Health
├─ Total Success Rate: ${successRate}%
├─ Total Calls: ${totalSuccesses + totalErrors}
├─ Successful: ${totalSuccesses}
├─ Failed: ${totalErrors}
├─ Blacklisted Models: ${blacklistedCount}/${allHints.length}
└─ Status: ${successRate === '100' ? '🟢 Excellent' : successRate === 'N/A' ? '⚪ Unknown' : '🟡 Investigate'}
  `);

  // List problematic models
  const problematic = allHints.filter((h: any) => h.errorCount > 2);
  if (problematic.length > 0) {
    console.log('\n⚠️  Models with issues:');
    problematic.forEach((h: any) => {
      console.log(`   - ${h.modelId}: ${h.errorCount} errors (${h.lastErrorType})`);
    });
  }
}

/**
 * Export for testing/examples
 */
export {
  exampleRecordingError,
  exampleRecordingSuccess,
  exampleCheckingBlacklist,
  exampleGettingHints,
  exampleManualBlacklist,
  exampleSettingPreferredEndpoint,
  exampleGetAllHints,
  exampleRealWorldScenario,
  exampleMonitoringQuery,
};
