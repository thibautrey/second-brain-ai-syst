/**
 * Skills Controller
 *
 * REST API endpoints for managing skills (Moltbot-style skill system).
 * Handles skill hub browsing, installation, configuration, and content access.
 */

import { Router, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import skillManager, { SkillCategory } from "../services/skill-manager.js";

const router = Router();

// ==================== Skill Hub (Registry) Routes ====================

/**
 * Get skill hub catalog
 * GET /api/skills/hub
 * Query params:
 *   - category: Filter by category
 *   - search: Search in name, description, tags
 */
router.get("/hub", async (req: AuthRequest, res: Response) => {
  try {
    const category = req.query.category as SkillCategory | undefined;
    const search = req.query.search as string | undefined;

    const catalog = await skillManager.getHubCatalog(category, search);

    return res.json({
      success: true,
      catalog,
      total: catalog.length,
    });
  } catch (error: any) {
    console.error("[Skills] Error fetching hub catalog:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get a specific skill from the hub
 * GET /api/skills/hub/:slug
 */
router.get("/hub/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const skill = await skillManager.getHubSkill(req.params.slug);

    if (!skill) {
      return res.status(404).json({
        success: false,
        error: "Skill not found",
      });
    }

    return res.json({
      success: true,
      skill,
    });
  } catch (error: any) {
    console.error("[Skills] Error fetching hub skill:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get skill categories
 * GET /api/skills/categories
 */
router.get("/categories", async (_req: AuthRequest, res: Response) => {
  try {
    const categories = Object.values(SkillCategory).map((cat: string) => ({
      id: cat,
      name: cat.charAt(0) + cat.slice(1).toLowerCase(),
      icon: getCategoryIcon(cat as SkillCategory),
    }));

    return res.json({
      success: true,
      categories,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Installed Skills Routes ====================

/**
 * Get user's installed skills
 * GET /api/skills/installed
 * Query params:
 *   - enabledOnly: Only return enabled skills
 */
router.get("/installed", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const enabledOnly = req.query.enabledOnly === "true";

    const skills = await skillManager.getInstalledSkills(userId, enabledOnly);

    return res.json({
      success: true,
      skills,
      total: skills.length,
    });
  } catch (error: any) {
    console.error("[Skills] Error fetching installed skills:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get a specific installed skill
 * GET /api/skills/installed/:slug
 */
router.get("/installed/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const skill = await skillManager.getInstalledSkill(userId, req.params.slug);

    if (!skill) {
      return res.status(404).json({
        success: false,
        error: "Skill not installed",
      });
    }

    return res.json({
      success: true,
      skill,
    });
  } catch (error: any) {
    console.error("[Skills] Error fetching installed skill:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Install a skill from the hub
 * POST /api/skills/install/:slug
 * Body: { config?: Record<string, any> }
 */
router.post("/install/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { config } = req.body;

    // Check if already installed
    const existing = await skillManager.getInstalledSkill(
      userId,
      req.params.slug,
    );
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Skill already installed",
      });
    }

    const installed = await skillManager.installSkill(
      userId,
      req.params.slug,
      config,
    );

    return res.status(201).json({
      success: true,
      skill: installed,
    });
  } catch (error: any) {
    console.error("[Skills] Error installing skill:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Uninstall a skill
 * DELETE /api/skills/installed/:slug
 */
router.delete("/installed/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await skillManager.uninstallSkill(userId, req.params.slug);

    return res.json({
      success: true,
    });
  } catch (error: any) {
    console.error("[Skills] Error uninstalling skill:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update skill configuration
 * PATCH /api/skills/installed/:slug
 * Body: { enabled?: boolean, config?: object, env?: object, apiKey?: string }
 */
router.patch("/installed/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { enabled, config, env, apiKey } = req.body;

    const updated = await skillManager.updateSkillConfig(
      userId,
      req.params.slug,
      { enabled, config, env, apiKey },
    );

    return res.json({
      success: true,
      skill: updated,
    });
  } catch (error: any) {
    console.error("[Skills] Error updating skill:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Toggle skill enabled status
 * POST /api/skills/installed/:slug/toggle
 * Body: { enabled: boolean }
 */
router.post(
  "/installed/:slug/toggle",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { enabled } = req.body;

      if (typeof enabled !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "enabled must be a boolean",
        });
      }

      const updated = await skillManager.toggleSkill(
        userId,
        req.params.slug,
        enabled,
      );

      return res.json({
        success: true,
        skill: updated,
      });
    } catch (error: any) {
      console.error("[Skills] Error toggling skill:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// ==================== Skill Content Routes ====================

/**
 * Get skill content (for LLM read_skill tool)
 * GET /api/skills/content/:slug
 */
router.get("/content/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const content = await skillManager.getSkillContent(userId, req.params.slug);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: "Skill content not found",
      });
    }

    return res.json({
      success: true,
      content,
    });
  } catch (error: any) {
    console.error("[Skills] Error fetching skill content:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get skill body only (instructions without frontmatter)
 * GET /api/skills/body/:slug
 */
router.get("/body/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const body = await skillManager.getSkillBody(userId, req.params.slug);

    if (!body) {
      return res.status(404).json({
        success: false,
        error: "Skill not found",
      });
    }

    return res.json({
      success: true,
      body,
    });
  } catch (error: any) {
    console.error("[Skills] Error fetching skill body:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Admin Routes ====================

/**
 * Seed the skill hub with builtin skills
 * POST /api/skills/admin/seed
 * Note: In production, this should be protected
 */
router.post("/admin/seed", async (_req: AuthRequest, res: Response) => {
  try {
    await skillManager.seedHub();

    return res.json({
      success: true,
      message: "Skill hub seeded successfully",
    });
  } catch (error: any) {
    console.error("[Skills] Error seeding hub:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Install builtin skills for a user
 * POST /api/skills/admin/install-builtins
 */
router.post(
  "/admin/install-builtins",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      await skillManager.installBuiltinSkills(userId);

      return res.json({
        success: true,
        message: "Builtin skills installed",
      });
    } catch (error: any) {
      console.error("[Skills] Error installing builtins:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// ==================== Helper Functions ====================

function getCategoryIcon(category: SkillCategory): string {
  const icons: Record<SkillCategory, string> = {
    PRODUCTIVITY: "📋",
    DEVELOPMENT: "💻",
    WRITING: "✍️",
    RESEARCH: "🔬",
    AUTOMATION: "🤖",
    ANALYSIS: "📊",
    COMMUNICATION: "💬",
    CREATIVITY: "🎨",
    HEALTH: "🏃",
    FINANCE: "💰",
    LEARNING: "📚",
    OTHER: "📦",
  };
  return icons[category] || "📦";
}

export default router;
