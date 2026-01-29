/\*\*

- API Server Integration Guide
-
- This file shows where and how to integrate the Tool Error Logs Controller
- in your Express app (typically in backend/main.ts or backend/services/api-server.ts)
  \*/

// ============================================================================
// INTEGRATION EXAMPLE 1: In main.ts
// ============================================================================

import express, { Express } from "express";
import toolErrorLogsController from "./controllers/tool-error-logs.controller.js";

const app: Express = express();

// ... other middleware ...

// Register tool error logs endpoints
app.use("/api", toolErrorLogsController);

// ... rest of your routes ...

// ============================================================================
// INTEGRATION EXAMPLE 2: In api-server.ts with namespace
// ============================================================================

const apiRouter = express.Router();

// Mount debug routes
apiRouter.use("/debug", toolErrorLogsController);

app.use("/api", apiRouter);

// ============================================================================
// TESTING THE INTEGRATION
// ============================================================================

/\*\*

- After adding the controller, test these endpoints:
  \*/

// 1. Get all errors
curl("http://localhost:3000/api/debug/tool-errors");

// 2. Get errors for specific tool
curl("http://localhost:3000/api/debug/tool-errors/get_weather");

// 3. Filter by category
curl(
"http://localhost:3000/api/debug/tool-errors?category=execution&severity=high"
);

// 4. Get dashboard summary
curl("http://localhost:3000/api/debug/tool-errors/summary");

// 5. Get statistics
curl("http://localhost:3000/api/debug/tool-errors/stats");

// ============================================================================
// COMPLETE SETUP CHECKLIST
// ============================================================================

/\*\*

- Before the errors are logged:
-
- [✓] 1. Create Prisma migration:
-        npx prisma migrate dev --name add_tool_error_logs
-
- [✓] 2. Import toolErrorLogger in tool-executor.ts:
-        import { toolErrorLogger } from "./tool-error-logger.js";
-
- [✓] 3. Import toolErrorLogger in dynamic-tool-generator.ts:
-        import { toolErrorLogger } from "./tool-error-logger.js";
-
- [ ] 4.  Register controller in main.ts/api-server.ts:
-        import toolErrorLogsController from "./controllers/tool-error-logs.controller.js";
-        app.use("/api", toolErrorLogsController);
-
- [ ] 5.  Start backend and test:
-        npm run dev
-
- [ ] 6.  Trigger an error and check:
-        - Console output
-        - Database: SELECT * FROM tool_error_logs
-        - API: GET /api/debug/tool-errors
  \*/

// ============================================================================
// ENVIRONMENT VARIABLES (Optional)
// ============================================================================

/\*\*

- You can add these to .env for configuration:
  \*/

// Enable/disable error logging
TOOL_ERROR_LOGGING_ENABLED=true;

// Log level for error details (FULL, SUMMARY, NONE)
TOOL_ERROR_LOG_LEVEL=FULL;

// Maximum errors to keep in database (auto-cleanup after this)
TOOL_ERROR_LOG_MAX_RETENTION=10000;

// Days to keep error logs (by severity)
TOOL_ERROR_LOG_RETENTION_CRITICAL=90;
TOOL_ERROR_LOG_RETENTION_HIGH=30;
TOOL_ERROR_LOG_RETENTION_MEDIUM=14;
TOOL_ERROR_LOG_RETENTION_LOW=7;

// ============================================================================
// MONITORING & ALERTING (Future Enhancements)
// ============================================================================

/\*\*

- The error logs can be integrated with:
- - Sentry for error tracking
- - DataDog for monitoring
- - PagerDuty for alerting
- - Slack for notifications
    \*/

// Example: Alert on critical errors
async function monitorCriticalErrors() {
const logs = await toolErrorLogger.queryErrorLogs({
severity: "critical",
limit: 10,
});

if (logs.length > 0) {
// Send to Slack, email, PagerDuty, etc.
await sendAlert(`${logs.length} critical tool errors detected!`, logs);
}
}

// Run periodically
setInterval(monitorCriticalErrors, 5 _ 60 _ 1000); // Every 5 minutes

// ============================================================================
// EXAMPLE CURL REQUESTS
// ============================================================================

// 1. Get recent errors
/\*_
curl -X GET "http://localhost:3000/api/debug/tool-errors?limit=20" \
 -H "Content-Type: application/json"
_/

// 2. Filter by tool and category
/\*_
curl -X GET "http://localhost:3000/api/debug/tool-errors?toolId=get_weather&category=timeout" \
 -H "Content-Type: application/json"
_/

// 3. Get errors since specific date
/\*_
curl -X GET "http://localhost:3000/api/debug/tool-errors?since=2026-01-28T00:00:00Z" \
 -H "Content-Type: application/json"
_/

// 4. Get tool error history with stats
/\*_
curl -X GET "http://localhost:3000/api/debug/tool-errors/get_weather" \
 -H "Content-Type: application/json"
_/

// 5. Get all errors in a category
/\*_
curl -X GET "http://localhost:3000/api/debug/tool-errors/category/execution" \
 -H "Content-Type: application/json"
_/

// 6. Get dashboard summary
/\*_
curl -X GET "http://localhost:3000/api/debug/tool-errors/summary" \
 -H "Content-Type: application/json"
_/

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

/\*\*

- If errors are not being logged:
-
- 1.  Check that toolErrorLogger is imported in tool-executor.ts
- 2.  Verify prisma migration ran: npx prisma migrate status
- 3.  Check database exists: psql -l | grep second_brain
- 4.  Check table exists: psql -c "SELECT \* FROM tool_error_logs LIMIT 1"
- 5.  Check console for logging errors: "[ToolErrorLogger] Failed to..."
- 6.  Verify toolErrorLogger.logError() is being called in catch blocks
-
- If API endpoints return 404:
-
- 1.  Verify controller is imported in main.ts
- 2.  Check route registration: app.use("/api", toolErrorLogsController)
- 3.  Restart the backend service
- 4.  Check console for import errors
      \*/

// ============================================================================
// PERFORMANCE CONSIDERATIONS
// ============================================================================

/\*\*

- Database performance:
- - Table has indices on: toolId, userId, category, severity, createdAt
- - Max 10k errors recommended in production
- - Consider archiving old errors periodically
-
- Logging performance:
- - Console output is instant
- - Database write is async (doesn't block tool execution)
- - Logging errors are caught and logged separately
-
- API performance:
- - Limited to 500 results per query
- - Pagination supported via offset/limit
- - Consider caching /summary endpoint
    \*/

export {};
