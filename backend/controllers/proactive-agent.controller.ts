/**
 * Proactive Agent Controller
 *
 * API endpoints for managing and interacting with the proactive agent
 */

import { Request, Response, NextFunction } from "express";
import { proactiveAgentService } from "../services/proactive-agent.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";

/**
 * Run proactive analysis for current user
 * POST /api/proactive/analyze
 */
export async function runProactiveAnalysis(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { timeframeDays = 7 } = req.body;

    const result = await proactiveAgentService.runProactiveAnalysis(
      userId,
      timeframeDays,
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.metadata?.reason || "Analysis failed",
      });
    }

    res.json({
      success: true,
      suggestionsGenerated: result.suggestionsGenerated,
      suggestions: result.suggestions,
      overallAssessment: result.output,
      metadata: result.metadata,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Run health check for current user
 * POST /api/proactive/health-check
 */
export async function runHealthCheck(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await proactiveAgentService.runHealthCheck(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.metadata?.reason || "Health check failed",
      });
    }

    res.json({
      success: true,
      suggestionsGenerated: result.suggestionsGenerated,
      suggestions: result.suggestions,
      metadata: result.metadata,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get proactive agent status
 * GET /api/proactive/status
 */
export async function getProactiveStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get recent proactive agent results from memories
    const prisma = (await import("../services/prisma.js")).default;
    const recentSuggestions = await prisma.memory.findMany({
      where: {
        userId,
        sourceType: {
          in: ["agent:proactive", "agent:health-check"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    res.json({
      success: true,
      recentSuggestionsCount: recentSuggestions.length,
      lastRun:
        recentSuggestions.length > 0
          ? recentSuggestions[0].createdAt
          : null,
      recentSuggestions: recentSuggestions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        sourceType: s.sourceType,
        suggestionsCount: s.metadata?.suggestionsCount || 0,
        tags: s.tags,
      })),
    });
  } catch (error) {
    next(error);
  }
}
