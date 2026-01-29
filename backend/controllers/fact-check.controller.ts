/**
 * Fact-Check Controller
 * REST API for fact-checking features
 */

import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware.js";
import { factCheckerService } from "../services/fact-checker.js";

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/fact-check/results
 * Get fact-check results for current user
 */
router.get("/results", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 10;

    const results = await factCheckerService.getFactCheckResults(userId, limit);
    return res.json({ success: true, results });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/fact-check/corrections
 * Get pending corrections
 */
router.get("/corrections", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const corrections = await factCheckerService.getPendingCorrections(userId);
    return res.json({ success: true, corrections });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/fact-check/corrections/:id/read
 * Mark correction as read
 */
router.put("/corrections/:id/read", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const correctionId = req.params.id;

    await factCheckerService.markCorrectionRead(correctionId, userId);

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
