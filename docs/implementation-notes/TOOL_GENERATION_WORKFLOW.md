# Tool Generation Workflow & Self-Healing System

## Overview

This document describes the improved tool generation system with a structured developer workflow and self-healing capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Tool Generation System                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  User Request   │───▶│   Workflow      │───▶│  Generated      │ │
│  │  "Create tool   │    │   Service       │    │  Tool           │ │
│  │   for..."       │    │                 │    │                 │ │
│  └─────────────────┘    └────────┬────────┘    └────────┬────────┘ │
│                                  │                      │          │
│                                  ▼                      ▼          │
│                         ┌─────────────────┐    ┌─────────────────┐ │
│                         │  Generation     │    │  Execution      │ │
│                         │  Session        │    │  Logs           │ │
│                         │  (Full Trace)   │    │  (Monitoring)   │ │
│                         └─────────────────┘    └────────┬────────┘ │
│                                                         │          │
│                                  ┌──────────────────────┘          │
│                                  ▼                                 │
│                         ┌─────────────────┐                        │
│                         │  Tool Healer    │                        │
│                         │  Service        │                        │
│                         │  (Auto-Repair)  │                        │
│                         └─────────────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Tool Generation Workflow Service

**File:** `backend/services/tool-generation-workflow.ts`

The new workflow service implements a structured developer process:

#### Phases

| Phase             | Description                   | Duration  | Artifacts            |
| ----------------- | ----------------------------- | --------- | -------------------- |
| 1. Specification  | Create detailed spec document | ~30s      | `specDocument`       |
| 2. Planning       | Generate implementation plan  | ~30s      | `implementationPlan` |
| 3. Implementation | Write the Python code         | ~60s      | `generatedCode`      |
| 4. Testing        | Validate syntax + execute     | ~120s     | Test results         |
| 5. Fixing         | Iterative bug fixes (max 5)   | ~60s each | Fixed code           |
| 6. Validation     | Final check + schema gen      | ~30s      | `schemaJson`         |

#### Specification Document Structure

```typescript
interface SpecDocument {
  title: string;
  objective: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  inputParameters: ParameterSpec[];
  expectedOutputFormat: OutputSpec;
  errorHandling: string[];
  dependencies: string[];
  requiredSecrets: string[];
  testCases: TestCaseSpec[];
}
```

#### Implementation Plan Structure

```typescript
interface ImplementationPlan {
  overview: string;
  steps: ImplementationStep[];
  estimatedComplexity: "low" | "medium" | "high";
  riskAssessment: string[];
  fallbackStrategies: string[];
}
```

### 2. Tool Healer Service

**File:** `backend/services/tool-healer.ts`

Proactive monitoring and self-healing for generated tools.

#### Features

- **Health Monitoring**: Analyzes execution logs for error patterns
- **Root Cause Analysis**: LLM-powered error analysis
- **Auto-Healing**: Automatic code repair for fixable issues
- **Rollback**: Ability to revert to previous code version
- **Notifications**: Alerts for issues requiring manual intervention

#### Error Pattern Detection

The healer recognizes these error types:

| Error Type | Severity | Auto-Healable | Example               |
| ---------- | -------- | ------------- | --------------------- |
| timeout    | medium   | ✅            | Connection timed out  |
| network    | high     | ✅            | ECONNREFUSED          |
| auth       | critical | ❌            | 401 Unauthorized      |
| permission | critical | ❌            | 403 Forbidden         |
| endpoint   | high     | ✅            | 404 Not Found         |
| rate_limit | medium   | ✅            | 429 Too Many Requests |
| parsing    | high     | ✅            | JSON decode error     |
| code_error | high     | ✅            | KeyError, TypeError   |
| dependency | critical | ✅            | Module not found      |

#### Health Score Calculation

```
Health Score = 100 - (error_penalty) - (issue_penalties)

Where:
- error_penalty = (1 - success_rate) * 50
- issue_penalties:
  - critical: -30
  - high: -20
  - medium: -10
  - low: -5
```

#### Health Status

| Status             | Health Score | Description               |
| ------------------ | ------------ | ------------------------- |
| HEALTHY            | 80-100       | Tool working normally     |
| DEGRADED           | 60-79        | Some issues detected      |
| FAILING            | 0-59         | Tool frequently failing   |
| HEALING            | -            | Auto-repair in progress   |
| HEALED             | -            | Successfully repaired     |
| REQUIRES_ATTENTION | -            | Needs manual intervention |

### 3. Database Schema

#### ToolGenerationSession

Stores complete workflow state:

```prisma
model ToolGenerationSession {
  id                 String @id
  userId             String
  toolId             String?  // Link to generated tool

  // Request
  objective          String
  context            String?
  suggestedSecrets   String[]

  // Status
  status             GenerationSessionStatus
  currentPhase       String?
  progress           Int      // 0-100

  // Artifacts
  specDocument       String?  // JSON
  implementationPlan String?  // JSON
  generatedCode      String?
  testCode           String?
  testResults        Json?
  schemaJson         Json?

  // Iteration tracking
  currentIteration   Int
  maxIterations      Int

  // Timing
  startedAt          DateTime?
  completedAt        DateTime?
  totalDurationMs    Int?

  // Logs
  logs               ToolGenerationLog[]
}
```

#### ToolGenerationLog

Detailed logging for each phase:

```prisma
model ToolGenerationLog {
  id              String @id
  sessionId       String

  phase           String   // 'specification', 'planning', etc.
  step            String?  // Specific step within phase
  level           String   // 'debug', 'info', 'warn', 'error'
  message         String

  // LLM interaction
  promptSent      String?
  responseReceived String?
  modelUsed       String?
  tokensUsed      Int?

  // Code execution
  codeExecuted    String?
  executionResult Json?
  executionTimeMs Int?

  createdAt       DateTime
}
```

#### ToolHealthReport

Health status and healing history:

```prisma
model ToolHealthReport {
  id               String @id
  toolId           String

  status           HealthReportStatus
  healthScore      Int    // 0-100
  issuesDetected   Json   // Array of issues

  // Analysis
  errorPatterns    Json?
  suggestedFixes   Json?
  rootCauseAnalysis String?

  // Healing
  healingAttempted Boolean
  healingSuccess   Boolean?
  healedCode       String?
  healingLog       Json?

  // Metrics
  recentSuccessRate Float?
  recentErrorCount  Int
  recentUsageCount  Int
}
```

#### ToolExecutionLog

Execution history for pattern analysis:

```prisma
model ToolExecutionLog {
  id              String @id
  toolId          String
  userId          String

  inputParams     Json?
  success         Boolean
  result          Json?
  error           String?
  errorType       String?  // 'runtime', 'timeout', etc.

  executionTimeMs Int?
  triggeredBy     String?  // 'user_chat', 'scheduled', etc.

  createdAt       DateTime
}
```

## Scheduler Integration

The Tool Healer runs automatically every 4 hours:

```typescript
// In scheduler.ts
this.registerTask({
  id: "tool-health-check",
  name: "Tool Health Check & Auto-Healing",
  cronExpression: "0 */4 * * *", // Every 4 hours
  handler: async () => {
    const healer = await getToolHealerService();
    await healer.runProactiveHealing();
  },
});
```

## Usage

### Generating a Tool

```typescript
import { dynamicToolGeneratorService } from "./dynamic-tool-generator.js";

// New workflow-based generation (default)
const result = await dynamicToolGeneratorService.generateTool(userId, {
  objective: "Fetch weather data from OpenWeatherMap API",
  context: "User wants current temperature and conditions",
  suggestedSecrets: ["OPENWEATHERMAP_API_KEY"],
});

// Legacy generation (for backward compatibility)
const legacyResult = await dynamicToolGeneratorService.generateTool(userId, {
  objective: "...",
  useWorkflow: false,
});
```

### Checking Tool Health

```typescript
import { toolHealerService } from "./tool-healer.js";

// Check all tools for a user
const results = await toolHealerService.runHealthCheck(userId);

// Get health summary
const summary = await toolHealerService.getHealthSummary(userId);
```

### Manual Healing

```typescript
// Attempt to heal a specific tool
const result = await toolHealerService.healTool(userId, toolId);

// Rollback to previous version
const success = await toolHealerService.rollbackTool(userId, toolId);
```

### Accessing Session Logs

```typescript
import { toolGenerationWorkflowService } from "./tool-generation-workflow.js";

// Get session with logs
const session = await toolGenerationWorkflowService.getSession(sessionId);

// Get user's recent sessions
const sessions = await toolGenerationWorkflowService.getUserSessions(
  userId,
  20,
);
```

## WebSocket Events

The system emits real-time events:

### Generation Progress

```json
{
  "type": "tool:generation:workflow:step",
  "sessionId": "...",
  "data": {
    "phase": "implementation",
    "message": "💻 Phase 3/6: Génération du code...",
    "progress": 35
  }
}
```

### Healing Events

```json
{
  "type": "tool:healing:started",
  "data": { "toolId": "...", "toolName": "Weather API" }
}

{
  "type": "tool:healing:completed",
  "data": { "toolId": "...", "success": true }
}
```

## Best Practices

1. **Always provide context**: The more context you give, the better the spec document
2. **Specify secrets upfront**: Helps the system generate appropriate code
3. **Monitor health reports**: Check the health dashboard regularly
4. **Review healed code**: Auto-healed code should be reviewed when possible
5. **Use rollback carefully**: Only if the healed version introduces new issues

## Troubleshooting

### Tool keeps failing after healing

1. Check if the error type is auto-healable
2. Review the root cause analysis
3. Check if API credentials are valid
4. Consider manual code review

### Generation session stuck

1. Check the session status and logs
2. Cancel if needed: `workflowService.cancelSession(sessionId)`
3. Retry with more specific objective

### Health check not running

1. Verify scheduler is started
2. Check cron expression: `0 */4 * * *`
3. Review scheduler logs for errors

## Related Files

- `backend/services/tool-generation-workflow.ts` - Workflow orchestration
- `backend/services/tool-healer.ts` - Health monitoring and healing
- `backend/services/tool-workflow-persistence.ts` - Database operations with graceful fallback
- `backend/services/dynamic-tool-generator.ts` - Integration layer
- `backend/services/scheduler.ts` - Background task scheduling
- `backend/prisma/schema.prisma` - Database models

## Setup Instructions

### 1. Run Prisma Migration

Before the workflow can persist data to the database, run:

```bash
cd backend
npx prisma migrate dev --name add-tool-generation-workflow
```

This creates the following tables:

- `tool_generation_sessions`
- `tool_generation_logs`
- `tool_health_reports`
- `tool_execution_logs`

### 2. Regenerate Prisma Client

```bash
npx prisma generate
```

### 3. Verify

```bash
# Check that the tables exist
npx prisma studio
```

### Pre-Migration Behavior

Before the migration runs, the system uses **in-memory fallback storage**:

- Sessions and logs are stored in memory
- Data is lost on service restart
- This allows testing the workflow without database changes

After migration, all data is persisted to PostgreSQL.

---

**Last Updated**: January 28, 2026
**Status**: Implemented - Pending Migration
