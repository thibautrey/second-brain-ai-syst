// Secrets Controller
// API endpoints for managing user secrets (API keys, tokens, etc.)

import { Router, Response, NextFunction } from "express";
import { secretsService, SecretInput } from "../services/secrets.js";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Create a new secret
 * POST /api/secrets
 */
router.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { key, value, displayName, category, description, expiresAt } =
      req.body;

    if (!key || !value || !displayName) {
      return res.status(400).json({
        error: "Missing required fields: key, value, displayName",
      });
    }

    // Validate key format (alphanumeric + underscores)
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return res.status(400).json({
        error:
          "Invalid key format. Must start with lowercase letter and contain only lowercase letters, numbers, and underscores",
      });
    }

    const input: SecretInput = {
      key,
      value,
      displayName,
      category,
      description,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };

    const secret = await secretsService.createSecret(userId, input);

    res.status(201).json({
      success: true,
      secret,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "A secret with this key already exists",
      });
    }
    next(error);
  }
});

/**
 * List all secrets (metadata only, no values)
 * GET /api/secrets
 */
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const category = req.query.category as string | undefined;

    const secrets = await secretsService.listSecrets(userId, category);

    res.json({
      success: true,
      secrets,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a specific secret (metadata only)
 * GET /api/secrets/:key
 */
router.get("/:key", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { key } = req.params;

    const secret = await secretsService.getSecret(userId, key);

    if (!secret) {
      return res.status(404).json({
        error: "Secret not found",
      });
    }

    res.json({
      success: true,
      secret,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a secret
 * PUT /api/secrets/:key
 */
router.put("/:key", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { key } = req.params;
    const { value, displayName, category, description, expiresAt } = req.body;

    const updates: Partial<SecretInput> = {};
    if (value !== undefined) updates.value = value;
    if (displayName !== undefined) updates.displayName = displayName;
    if (category !== undefined) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (expiresAt !== undefined)
      updates.expiresAt = expiresAt ? new Date(expiresAt) : undefined;

    const secret = await secretsService.updateSecret(userId, key, updates);

    res.json({
      success: true,
      secret,
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({
        error: "Secret not found",
      });
    }
    next(error);
  }
});

/**
 * Delete a secret
 * DELETE /api/secrets/:key
 */
router.delete(
  "/:key",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { key } = req.params;

      const deleted = await secretsService.deleteSecret(userId, key);

      if (!deleted) {
        return res.status(404).json({
          error: "Secret not found",
        });
      }

      res.json({
        success: true,
        message: "Secret deleted",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Check if secrets exist
 * POST /api/secrets/check
 */
router.post(
  "/check",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { keys } = req.body;

      if (!Array.isArray(keys)) {
        return res.status(400).json({
          error: "keys must be an array",
        });
      }

      const result = await secretsService.checkSecretsExist(userId, keys);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
