/**
 * Marketplace Controller
 *
 * REST API endpoints for the public marketplace.
 * Handles browsing, publishing, installing, and voting on skills/tools.
 */

import { Router, Response } from "express";
import { AuthRequest } from "../../backend/middlewares/auth.middleware.js";
import { marketplaceService } from "./marketplace.service.js";
import {
  BrowseOptions,
  PublishSkillRequest,
  PublishToolRequest,
  ItemType,
  ReportReason,
} from "../types/marketplace.types.js";

const router = Router();

// ==================== Status ====================

/**
 * Get marketplace configuration status
 * GET /api/marketplace/status
 */
router.get("/status", async (_req: AuthRequest, res: Response) => {
  try {
    const status = marketplaceService.getConfigStatus();
    return res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Skills ====================

/**
 * Browse public skills
 * GET /api/marketplace/skills
 * Query params: category, search, tags, sort_by, page, limit
 */
router.get("/skills", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const options: BrowseOptions = {
      category: req.query.category as string,
      search: req.query.search as string,
      tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
      sort_by: req.query.sort_by as any,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await marketplaceService.browseSkills(options);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[Marketplace] Error browsing skills:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get a single skill
 * GET /api/marketplace/skills/:idOrSlug
 */
router.get("/skills/:idOrSlug", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const skill = await marketplaceService.getSkill(req.params.idOrSlug);

    if (!skill) {
      return res.status(404).json({
        success: false,
        error: "Skill not found",
      });
    }

    // Check if this instance has voted/installed
    const [hasVoted, hasInstalled] = await Promise.all([
      marketplaceService.hasVoted("skill", skill.id),
      marketplaceService.hasInstalled("skill", skill.id),
    ]);

    return res.json({
      success: true,
      skill,
      user_status: {
        has_voted: hasVoted,
        has_installed: hasInstalled,
      },
    });
  } catch (error: any) {
    console.error("[Marketplace] Error fetching skill:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Publish a skill to the marketplace
 * POST /api/marketplace/skills/publish
 */
router.post("/skills/publish", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const request: PublishSkillRequest = req.body;

    // Validate required fields
    if (!request.name || !request.description || !request.instructions) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, description, instructions",
      });
    }

    const result = await marketplaceService.publishSkill(request);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        security: result.security,
      });
    }

    return res.status(201).json({
      success: true,
      skill: result.skill,
      security: result.security,
    });
  } catch (error: any) {
    console.error("[Marketplace] Error publishing skill:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Tools ====================

/**
 * Browse public tools
 * GET /api/marketplace/tools
 */
router.get("/tools", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const options: BrowseOptions = {
      category: req.query.category as string,
      search: req.query.search as string,
      tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
      sort_by: req.query.sort_by as any,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await marketplaceService.browseTools(options);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[Marketplace] Error browsing tools:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get a single tool
 * GET /api/marketplace/tools/:idOrSlug
 */
router.get("/tools/:idOrSlug", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const tool = await marketplaceService.getTool(req.params.idOrSlug);

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: "Tool not found",
      });
    }

    const [hasVoted, hasInstalled] = await Promise.all([
      marketplaceService.hasVoted("tool", tool.id),
      marketplaceService.hasInstalled("tool", tool.id),
    ]);

    return res.json({
      success: true,
      tool,
      user_status: {
        has_voted: hasVoted,
        has_installed: hasInstalled,
      },
    });
  } catch (error: any) {
    console.error("[Marketplace] Error fetching tool:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Publish a tool to the marketplace
 * POST /api/marketplace/tools/publish
 */
router.post("/tools/publish", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const request: PublishToolRequest = req.body;

    // Validate required fields
    if (
      !request.name ||
      !request.display_name ||
      !request.description ||
      !request.code ||
      !request.input_schema
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: name, display_name, description, code, input_schema",
      });
    }

    const result = await marketplaceService.publishTool(request);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        security: result.security,
      });
    }

    return res.status(201).json({
      success: true,
      tool: result.tool,
      security: result.security,
    });
  } catch (error: any) {
    console.error("[Marketplace] Error publishing tool:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Install Tracking ====================

/**
 * Track an installation
 * POST /api/marketplace/install
 * Body: { item_type: 'skill' | 'tool', item_id: string }
 */
router.post("/install", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const { item_type, item_id } = req.body;

    if (!item_type || !item_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: item_type, item_id",
      });
    }

    if (!["skill", "tool"].includes(item_type)) {
      return res.status(400).json({
        success: false,
        error: "item_type must be 'skill' or 'tool'",
      });
    }

    const result = await marketplaceService.trackInstall({
      item_type: item_type as ItemType,
      item_id,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("[Marketplace] Error tracking install:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Track an uninstall
 * DELETE /api/marketplace/install
 * Body: { item_type: 'skill' | 'tool', item_id: string }
 */
router.delete("/install", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const { item_type, item_id } = req.body;

    if (!item_type || !item_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: item_type, item_id",
      });
    }

    const result = await marketplaceService.trackUninstall({
      item_type: item_type as ItemType,
      item_id,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("[Marketplace] Error tracking uninstall:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Voting ====================

/**
 * Add an upvote
 * POST /api/marketplace/vote
 * Body: { item_type: 'skill' | 'tool', item_id: string }
 */
router.post("/vote", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const { item_type, item_id } = req.body;

    if (!item_type || !item_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: item_type, item_id",
      });
    }

    // Check if installed (must install to vote)
    const hasInstalled = await marketplaceService.hasInstalled(
      item_type as ItemType,
      item_id,
    );
    if (!hasInstalled) {
      return res.status(400).json({
        success: false,
        error: "You must install this item before voting",
      });
    }

    const result = await marketplaceService.addVote({
      item_type: item_type as ItemType,
      item_id,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("[Marketplace] Error adding vote:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Remove an upvote
 * DELETE /api/marketplace/vote
 * Body: { item_type: 'skill' | 'tool', item_id: string }
 */
router.delete("/vote", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const { item_type, item_id } = req.body;

    if (!item_type || !item_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: item_type, item_id",
      });
    }

    const result = await marketplaceService.removeVote({
      item_type: item_type as ItemType,
      item_id,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("[Marketplace] Error removing vote:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Reporting ====================

/**
 * Report an item
 * POST /api/marketplace/report
 * Body: { item_type, item_id, reason, details? }
 */
router.post("/report", async (req: AuthRequest, res: Response) => {
  try {
    if (!marketplaceService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Marketplace not configured",
      });
    }

    const { item_type, item_id, reason, details } = req.body;

    if (!item_type || !item_id || !reason) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: item_type, item_id, reason",
      });
    }

    const validReasons: ReportReason[] = [
      "security",
      "inappropriate",
      "spam",
      "other",
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: `reason must be one of: ${validReasons.join(", ")}`,
      });
    }

    const result = await marketplaceService.reportItem({
      item_type: item_type as ItemType,
      item_id,
      reason: reason as ReportReason,
      details,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("[Marketplace] Error reporting item:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Security Check (for preview) ====================

/**
 * Preview security check without publishing
 * POST /api/marketplace/security-check
 * Body: { content: string, type: 'skill' | 'tool' }
 */
router.post("/security-check", async (req: AuthRequest, res: Response) => {
  try {
    const { content, type } = req.body;

    if (!content || !type) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: content, type",
      });
    }

    if (!["skill", "tool"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "type must be 'skill' or 'tool'",
      });
    }

    const result = await marketplaceService.performSecurityCheck(content, type);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[Marketplace] Error in security check:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
