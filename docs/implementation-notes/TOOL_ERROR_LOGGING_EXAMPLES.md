/\*\*

- Tool Error Logging Integration Example
-
- This example demonstrates how the tool error logging system works
- in different scenarios
  \*/

// ============================================================================
// SCENARIO 1: Console Output (Immediate Visibility)
// ============================================================================

/\*\*

- When a tool fails, you'll see detailed console output:
-
- ════════════════════════════════════════════════════════════════════════════
- ⚠️ TOOL EXECUTION ERROR - 2026-01-29T15:30:45.123Z
- ════════════════════════════════════════════════════════════════════════════
-
- 📋 TOOL INFORMATION:
- Tool ID: get_weather
- User ID: user_123
- Action: execute
- Flow ID: flow_abc123
-
- ❌ ERROR DETAILS:
- Type: api_error
- Severity: high [🟠]
- Category: execution
- Recoverable: ✓ YES
- Message: HTTP error 429: Too many requests
- Error Code: 429
-
- 📥 REQUEST CONTEXT:
- Parameters: {
-                     "city": "Paris",
-                     "units": "metric"
-                   }
- Size: 45 KB
-
- ⏱️ TIMING:
- Started: 2026-01-29T15:30:45.100Z
- Ended: 2026-01-29T15:30:45.850Z
- Duration: 750ms
-
- 📍 STACK TRACE:
- Error: HTTP error 429: Too many requests
-     at executeApiCall (tool-executor.ts:450)
-     at ToolExecutorService.executeTool (tool-executor.ts:580)
-     at Object.<anonymous> (chat-tools.ts:295)
-
- 💡 SUGGESTED RECOVERY:
- Check API endpoint and credentials, verify network connectivity,
- review API rate limits
-
- 🔧 METADATA:
- {
-     "retries": 0,
-     "endpoint": "https://api.weather.com/current",
-     "lastSuccess": "2026-01-29T15:20:00Z"
- }
-
- ════════════════════════════════════════════════════════════════════════════
  \*/

// ============================================================================
// SCENARIO 2: Querying Errors Programmatically
// ============================================================================

import { toolErrorLogger } from "./tool-error-logger";

// Get all high-severity execution errors from the last 24 hours
async function analyzeRecentErrors() {
const logs = await toolErrorLogger.queryErrorLogs({
category: "execution",
severity: "high",
since: new Date(Date.now() - 24 _ 60 _ 60 \* 1000),
limit: 100,
});

console.log(`Found ${logs.length} high-severity errors in last 24h`);

for (const log of logs) {
console.log(`       Tool: ${(log as any).toolId}
      Error: ${(log as any).errorMessage}
      Duration: ${(log as any).executionTimeMs}ms
      Recoverable: ${(log as any).isRecoverable ? "Yes" : "No"}
      Suggested Fix: ${(log as any).suggestedRecovery}
    `);
}
}

// ============================================================================
// SCENARIO 3: Monitoring Tool Health
// ============================================================================

async function monitorToolHealth(toolId: string) {
const stats = await toolErrorLogger.getErrorStatistics(toolId);

console.log(`📊 Health Report for ${toolId}:`);
console.log(`   Total Errors: ${stats.totalErrors}`);
console.log(`   Recovery Rate: ${(stats.recoveryRate * 100).toFixed(1)}%`);
console.log(`   Errors by Category:`, stats.byCategory);
console.log(`   Errors by Severity:`, stats.bySeverity);

// Alert if recovery rate is too low
if (stats.recoveryRate < 0.8) {
console.warn(`⚠️  Tool ${toolId} has low recovery rate!`);
}

// Alert if too many critical errors
const criticalErrors = stats.bySeverity["critical"] || 0;
if (criticalErrors > 5) {
console.warn(`🔴 Tool ${toolId} has ${criticalErrors} critical errors!`);
}
}

// ============================================================================
// SCENARIO 4: API Usage Examples
// ============================================================================

/\*\*

- Example API Calls:
  \*/

// Get recent errors for a specific tool
fetch("http://localhost:3000/debug/tool-errors/get_weather?limit=20").then(
(res) => res.json(),
);

// Filter by category
fetch(
"http://localhost:3000/debug/tool-errors?category=timeout&severity=high"
).then((res) => res.json());

// Get all errors from last hour
const oneHourAgo = new Date(Date.now() - 60 _ 60 _ 1000).toISOString();
fetch(
`http://localhost:3000/debug/tool-errors?since=${oneHourAgo}&limit=50`
).then((res) => res.json());

// Get error summary for dashboard
fetch("http://localhost:3000/debug/tool-errors/summary").then((res) =>
res.json(),
);

// ============================================================================
// SCENARIO 5: Error Categorization Examples
// ============================================================================

/\*\*

- Different error types are automatically categorized:
  \*/

const exampleErrors = [
{
message: "validation failed: required parameter 'city' missing",
category: "validation",
severity: "medium",
recoverable: false,
fix: "Check parameter types and required fields",
},
{
message: "Cannot read property 'results' of undefined",
category: "execution",
severity: "high",
recoverable: true,
fix: "Check if variable is initialized before use",
},
{
message: "Request timeout after 30 seconds",
category: "timeout",
severity: "high",
recoverable: true,
fix: "Increase timeout threshold or optimize tool performance",
},
{
message: "Authentication failed: invalid API key",
category: "permission",
severity: "high",
recoverable: false,
fix: "Check API key and re-authenticate",
},
{
message: "HTTP error 429: Too many requests",
category: "execution",
severity: "medium",
recoverable: true,
fix: "Check API rate limits and implement backoff",
},
{
message: "OutOfMemory: JavaScript heap out of memory",
category: "system",
severity: "critical",
recoverable: false,
fix: "Optimize memory usage or increase heap size",
},
];

// ============================================================================
// SCENARIO 6: Dashboard Widget Data
// ============================================================================

/\*\*

- Example response from /debug/tool-errors/summary:
  \*/
  const dashboardData = {
  success: true,
  timestamp: "2026-01-29T15:35:00.000Z",
  statistics: {
  totalErrors: 127,
  byCategory: {
  execution: 65,
  validation: 32,
  timeout: 18,
  system: 8,
  permission: 3,
  unknown: 1,
  },
  bySeverity: {
  critical: 2,
  high: 35,
  medium: 68,
  low: 22,
  },
  recoveryRate: 0.82,
  },
  topErrorTools: [
  { toolId: "get_weather", count: 25 },
  { toolId: "api_call", count: 18 },
  { toolId: "search_web", count: 14 },
  { toolId: "process_data", count: 10 },
  { toolId: "send_email", count: 8 },
  ],
  recentCriticalErrors: [
  {
  id: "error_001",
  toolId: "process_data",
  errorMessage: "OutOfMemory: JavaScript heap out of memory",
  severity: "critical",
  createdAt: "2026-01-29T15:33:00.000Z",
  },
  {
  id: "error_002",
  toolId: "get_weather",
  errorMessage: "Cannot connect to database",
  severity: "critical",
  createdAt: "2026-01-29T15:22:00.000Z",
  },
  ],
  };

// ============================================================================
// SCENARIO 7: Troubleshooting a Failing Tool
// ============================================================================

/\*\*

- Step-by-step troubleshooting process using the error logs:
  \*/

async function troubleshootTool(toolId: string) {
console.log(`🔍 Troubleshooting ${toolId}...\n`);

// Step 1: Get health stats
const stats = await toolErrorLogger.getErrorStatistics(toolId);
console.log("1️⃣ Health Statistics:");
console.log(`   Success Rate: ${((1 - stats.recoveryRate) * 100).toFixed(1)}%`);
console.log(`   Total Errors: ${stats.totalErrors}`);

// Step 2: Check most common error categories
const categories = Object.entries(stats.byCategory)
.sort(([, a], [, b]) => (b as number) - (a as number))
.slice(0, 3);

console.log("\n2️⃣ Most Common Error Categories:");
for (const [category, count] of categories) {
console.log(`   ${category}: ${count} errors`);
}

// Step 3: Analyze recent errors
const recentLogs = await toolErrorLogger.queryErrorLogs({
toolId,
limit: 5,
});

console.log("\n3️⃣ Recent Errors:");
for (const log of recentLogs) {
console.log(`   - ${(log as any).errorType}: ${(log as any).errorMessage}`);
console.log(`     Suggested: ${(log as any).suggestedRecovery}`);
}

// Step 4: Recommendations
console.log("\n4️⃣ Recommendations:");
if (stats.recoveryRate < 0.7) {
console.log(" ⚠️ Low recovery rate - consider reviewing tool implementation");
}
if ((stats.bySeverity["critical"] || 0) > 0) {
console.log(" 🔴 Critical errors detected - immediate action required");
}
if ((stats.bySeverity["timeout"] || 0) > stats.totalErrors \* 0.2) {
console.log(" ⏱️ Many timeout errors - consider increasing timeout or optimizing");
}
}

// ============================================================================
// SCENARIO 8: Integration with Tool Healer
// ============================================================================

/\*\*

- The error logs are used by the Tool Healer Service to:
- 1.  Identify patterns in failures
- 2.  Suggest fixes automatically
- 3.  Test and validate corrections
- 4.  Track healing success rate
      \*/

// When an error is logged, the tool healer can:
async function autoHealOnError(toolId: string) {
// Get recent errors
const errors = await toolErrorLogger.queryErrorLogs({
toolId,
limit: 10,
isRecoverable: true,
});

console.log(`Found ${errors.length} recoverable errors for ${toolId}`);

// Analyze error patterns
for (const error of errors) {
const errorData = error as any;
if (
errorData.errorType === "undefined_reference" ||
errorData.errorType === "runtime_error"
) {
console.log(`Attempting to heal ${errorData.errorType}...`);
// Tool healer would attempt to fix the issue
}
}
}

export {
analyzeRecentErrors,
monitorToolHealth,
troubleshootTool,
autoHealOnError,
};
