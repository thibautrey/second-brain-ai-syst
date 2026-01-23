// Generated Tools Controller
// API endpoints for managing AI-generated tools

import { Router, Response, NextFunction } from "express";
import { dynamicToolGeneratorService } from "../services/dynamic-tool-generator.js";
import { dynamicToolRegistry } from "../services/dynamic-tool-registry.js";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Generate a new tool
 * POST /api/generated-tools/generate
 */
router.post(
  "/generate",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { objective, context, suggestedSecrets } = req.body;

      if (!objective) {
        return res.status(400).json({
          error: "Missing required field: objective",
        });
      }

      const result = await dynamicToolGeneratorService.generateTool(userId, {
        objective,
        context,
        suggestedSecrets,
      });

      if (result.success && result.tool) {
        // Add to registry cache
        await dynamicToolRegistry.addToCache(result.tool);

        res.status(201).json({
          success: true,
          tool: {
            id: result.tool.id,
            name: result.tool.name,
            displayName: result.tool.displayName,
            description: result.tool.description,
            category: result.tool.category,
            tags: result.tool.tags,
            requiredSecrets: result.tool.requiredSecrets,
            inputSchema: result.tool.inputSchema,
            code: result.tool.code,
            version: result.tool.version,
          },
          executionResult: result.executionResult,
          iterations: result.iterations,
          logs: result.logs,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          logs: result.logs,
          iterations: result.iterations,
        });
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * List all generated tools
 * GET /api/generated-tools
 */
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const category = req.query.category as string | undefined;
    const enabledOnly = req.query.enabled_only !== "false";

    const tools = await dynamicToolGeneratorService.listTools(
      userId,
      category,
      enabledOnly,
    );

    res.json({
      success: true,
      tools: tools.map((t) => ({
        id: t.id,
        name: t.name,
        displayName: t.displayName,
        description: t.description,
        category: t.category,
        tags: t.tags,
        requiredSecrets: t.requiredSecrets,
        usageCount: t.usageCount,
        lastUsedAt: t.lastUsedAt,
        enabled: t.enabled,
        isVerified: t.isVerified,
        version: t.version,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      count: tools.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get tool statistics
 * GET /api/generated-tools/stats
 */
router.get("/stats", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const stats = await dynamicToolRegistry.getToolStats(userId);
    const mostUsed = await dynamicToolRegistry.getMostUsedTools(userId, 5);

    res.json({
      success: true,
      stats,
      mostUsed: mostUsed.map((t) => ({
        id: t.id,
        name: t.name,
        displayName: t.displayName,
        usageCount: t.usageCount,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a specific tool
 * GET /api/generated-tools/:id
 */
router.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const tool = await dynamicToolGeneratorService.getTool(userId, id);

    if (!tool) {
      return res.status(404).json({
        error: "Tool not found",
      });
    }

    res.json({
      success: true,
      tool: {
        id: tool.id,
        name: tool.name,
        displayName: tool.displayName,
        description: tool.description,
        category: tool.category,
        tags: tool.tags,
        requiredSecrets: tool.requiredSecrets,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        code: tool.code,
        previousCode: tool.previousCode,
        usageCount: tool.usageCount,
        lastUsedAt: tool.lastUsedAt,
        lastErrorAt: tool.lastErrorAt,
        lastError: tool.lastError,
        enabled: tool.enabled,
        isVerified: tool.isVerified,
        version: tool.version,
        timeout: tool.timeout,
        createdAt: tool.createdAt,
        updatedAt: tool.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Execute a tool
 * POST /api/generated-tools/:id/execute
 */
router.post(
  "/:id/execute",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const params = req.body.params || {};

      const result = await dynamicToolGeneratorService.executeTool(
        userId,
        id,
        params,
      );

      res.json({
        success: result.success,
        result: result.result,
        error: result.error,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Toggle tool enabled status
 * PATCH /api/generated-tools/:id/toggle
 */
router.patch(
  "/:id/toggle",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== "boolean") {
        return res.status(400).json({
          error: "Missing or invalid 'enabled' field (must be boolean)",
        });
      }

      const tool = await dynamicToolGeneratorService.toggleTool(userId, id, enabled);

      if (!tool) {
        return res.status(404).json({
          error: "Tool not found",
        });
      }

      // Update cache
      dynamicToolRegistry.invalidateCache(userId);

      res.json({
        success: true,
        tool: {
          id: tool.id,
          name: tool.name,
          enabled: tool.enabled,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Delete a tool
 * DELETE /api/generated-tools/:id
 */
router.delete(
  "/:id",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const deleted = await dynamicToolGeneratorService.deleteTool(userId, id);

      if (!deleted) {
        return res.status(404).json({
          error: "Tool not found",
        });
      }

      // Remove from cache
      dynamicToolRegistry.removeFromCache(userId, id);

      res.json({
        success: true,
        message: "Tool deleted",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Search tools
 * GET /api/generated-tools/search?q=query
 */
router.get(
  "/search",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const query = req.query.q as string;

      if (!query) {
        return res.status(400).json({
          error: "Missing query parameter 'q'",
        });
      }

      const tools = await dynamicToolRegistry.searchTools(userId, query);

      res.json({
        success: true,
        query,
        tools: tools.map((t) => ({
          id: t.id,
          name: t.name,
          displayName: t.displayName,
          description: t.description,
          category: t.category,
          tags: t.tags,
        })),
        count: tools.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
