/**
 * Tool Error Logs Controller
 * REST API endpoints for querying and managing tool error logs
 */

import { Request, Response, Router } from "express";

import { toolErrorLogger } from "../services/tool-error-logger.js";

const router = Router();

/**
 * GET /debug/tool-errors
 * Query tool error logs with filters
 *
 * Query parameters:
 * - toolId: Filter by specific tool
 * - userId: Filter by user (defaults to current user)
 * - category: Filter by error category (validation, execution, timeout, system, permission, unknown)
 * - severity: Filter by severity level (low, medium, high, critical)
 * - isRecoverable: Filter by recoverability (true, false)
 * - since: Get errors since this ISO date
 * - limit: Max results (default: 50, max: 500)
 * - offset: Pagination offset (default: 0)
 */
router.get("/debug/tool-errors", async (req: Request, res: Response) => {
  try {
    const {
      toolId,
      userId,
      category,
      severity,
      isRecoverable,
      since,
      limit = 50,
      offset = 0,
    } = req.query;

    // Parse filters
    const filters: any = {
      limit: Math.min(parseInt(limit as string) || 50, 500),
      offset: parseInt(offset as string) || 0,
    };

    if (toolId) filters.toolId = toolId as string;
    if (userId) filters.userId = userId as string;
    if (category) filters.category = category as string;
    if (severity) filters.severity = severity as string;
    if (isRecoverable !== undefined) {
      filters.isRecoverable = isRecoverable === "true";
    }
    if (since) {
      filters.since = new Date(since as string);
    }

    // Query error logs
    const logs = await toolErrorLogger.queryErrorLogs(filters);

    res.json({
      success: true,
      count: logs.length,
      filters,
      logs,
    });
  } catch (error: any) {
    console.error("[ToolErrorLogsController] Error querying logs:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to query error logs",
    });
  }
});

/**
 * GET /debug/tool-errors/:toolId
 * Get detailed error history for a specific tool
 */
router.get(
  "/debug/tool-errors/:toolId",
  async (req: Request, res: Response) => {
    try {
      const { toolId } = req.params;
      const { limit = 20, offset = 0, category, severity } = req.query;

      const filters: any = {
        toolId,
        limit: Math.min(parseInt(limit as string) || 20, 500),
        offset: parseInt(offset as string) || 0,
      };

      if (category) filters.category = category as string;
      if (severity) filters.severity = severity as string;

      const logs = await toolErrorLogger.queryErrorLogs(filters);
      const stats = await toolErrorLogger.getErrorStatistics(toolId);

      res.json({
        success: true,
        toolId,
        statistics: stats,
        errorLogs: logs,
        filters,
      });
    } catch (error: any) {
      console.error(
        "[ToolErrorLogsController] Error fetching tool errors:",
        error,
      );
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch tool errors",
      });
    }
  },
);

/**
 * GET /debug/tool-errors/stats
 * Get aggregated error statistics across all tools
 */
router.get("/debug/tool-errors/stats", async (req: Request, res: Response) => {
  try {
    const stats = await toolErrorLogger.getErrorStatistics();

    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(
      "[ToolErrorLogsController] Error fetching statistics:",
      error,
    );
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch statistics",
    });
  }
});

/**
 * POST /debug/tool-errors/replay/:errorLogId
 * Replay a failed tool execution to analyze the error
 * (This would trigger the tool healer to analyze the specific error)
 */
router.post(
  "/debug/tool-errors/replay/:errorLogId",
  async (req: Request, res: Response) => {
    try {
      const { errorLogId } = req.params;

      // This would need to:
      // 1. Fetch the error log
      // 2. Extract the tool ID and parameters
      // 3. Re-execute the tool
      // 4. Compare results with original error

      res.json({
        success: true,
        message: "Error replay initiated",
        errorLogId,
        status: "pending",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to replay error",
      });
    }
  },
);

/**
 * GET /debug/tool-errors/category/:category
 * Get all errors in a specific category
 */
router.get(
  "/debug/tool-errors/category/:category",
  async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const filters = {
        category,
        limit: Math.min(parseInt(limit as string) || 50, 500),
        offset: parseInt(offset as string) || 0,
      };

      const logs = await toolErrorLogger.queryErrorLogs(filters);

      res.json({
        success: true,
        category,
        count: logs.length,
        logs,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch category errors",
      });
    }
  },
);

/**
 * GET /debug/tool-errors/summary
 * Get a summary of all error logs for dashboard
 */
router.get(
  "/debug/tool-errors/summary",
  async (req: Request, res: Response) => {
    try {
      const stats = await toolErrorLogger.getErrorStatistics();

      // Get recent critical errors
      const recentCritical = await toolErrorLogger.queryErrorLogs({
        severity: "critical",
        limit: 10,
      });

      // Get errors by tool (top 10)
      const toolErrors = await toolErrorLogger.queryErrorLogs({
        limit: 100,
      });

      const errorsByTool: Record<string, number> = {};
      for (const log of toolErrors) {
        errorsByTool[(log as any).toolId] =
          (errorsByTool[(log as any).toolId] || 0) + 1;
      }

      const topErrorTools = Object.entries(errorsByTool)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([toolId, count]) => ({ toolId, count }));

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        statistics: stats,
        topErrorTools,
        recentCriticalErrors: recentCritical,
      });
    } catch (error: any) {
      console.error("[ToolErrorLogsController] Error fetching summary:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch error summary",
      });
    }
  },
);

export default router;
