import {
  getOnboardingStatus,
  finishOnboarding,
  resetOnboarding,
  skipOnboarding,
  completeStep,
} from "../controllers/onboarding.controller.js";
import { AuthRequest, authMiddleware } from "../middlewares/auth.middleware.js";
import express, { Express, NextFunction, Request, Response } from "express";
import {
  getUserProfile,
  getUserBootstrapStatus,
  signin,
  signup,
} from "../controllers/auth.controller.js";
import {
  createMemory,
  getMemoryById,
  getMemories,
  updateMemory,
  deleteMemory,
  archiveMemory,
  unarchiveMemory,
  pinMemory,
  unpinMemory,
  bulkCreateMemories,
  getMemoryStats,
  createSummary,
  getSummaryById,
  getSummaries,
  updateSummary,
  deleteSummary,
  getLatestSummaries,
  type CreateMemoryInput,
  type UpdateMemoryInput,
  type MemoryQueryFilters,
  type CreateSummaryInput,
  type UpdateSummaryInput,
} from "../controllers/memory.controller.js";
import {
  getAISettings,
  getProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
  addModelToProvider,
  removeModelFromProvider,
  getTaskConfigs,
  updateTaskConfig,
  syncProviderModels,
  testProviderApiKey,
} from "../controllers/ai-settings.controller.js";
import {
  initiateOAuthFlow,
  handleOAuthCallback,
  getOAuthStatus,
  disconnectOAuth,
  setOAuthEnabled,
  checkUsage as checkChatGPTUsage,
  testConnection as testChatGPTConnection,
  initiateOAuthFlowWithLocalServer,
  checkOAuthFlowStatus,
  getOAuthConfig as getChatGPTOAuthConfig,
  initiatePiAiOAuthFlow,
  submitOAuthCodeManually,
} from "../controllers/chatgpt-oauth.controller.js";
import { audioUploadService } from "./audio-upload.js";
import { speakerRecognitionService } from "./speaker-recognition.js";
import { VoiceTrainingController } from "../controllers/input-ingestion.controller.js";
import {
  chatStream,
  chatStreamEnhanced,
  chatPollingStart,
  chatPollingStatus,
} from "../controllers/chat.controller.js";
import { TrainingProcessorService } from "./training-processor.js";
import { trainingSSEService } from "./training-sse.js";
import { memorySearchService } from "./memory-search.js";
import { continuousListeningManager } from "./continuous-listening.js";
import { schedulerService } from "./scheduler.js";
import { embeddingSchedulerService } from "./embedding-scheduler.js";
import { backgroundAgentService } from "./background-agents.js";
import { memoryCleanerService } from "./memory-cleaner.js";
import { scheduledTaskService } from "./tools/scheduled-task.service.js";
import { modelRecoveryService } from "./model-recovery.js";
import toolsController from "../controllers/tools.controller.js";
import longRunningTaskController from "../controllers/long-running-task.controller.js";
import { notificationController } from "../controllers/notification.controller.js";
import { tipsController } from "../controllers/tips.controller.js";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, Server as HttpServer, IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { wsBroadcastService } from "./websocket-broadcast.js";
import { adaptiveLearningController } from "../controllers/adaptive-learning.controller.js";

import cors from "cors";
import prisma from "./prisma.js";
import multer from "multer";
import debugController from "../controllers/debug.controller.js";
import secretsController from "../controllers/secrets.controller.js";
import generatedToolsController from "../controllers/generated-tools.controller.js";
import {
  runProactiveAnalysis,
  runHealthCheck,
  getProactiveStatus,
} from "../controllers/proactive-agent.controller.js";
import audioIngestionController from "../controllers/audio-ingestion.controller.js";
import { audioSessionManager } from "./audio-session-manager.js";
import factCheckController from "../controllers/fact-check.controller.js";
import analyticsController from "../controllers/analytics.controller.js";
import {
  cleanupDuplicateTodos,
  disableDataCoherenceAgent,
} from "../controllers/data-cleanup.controller.js";

// Environment validation
function validateEnvironment() {
  const required = ["JWT_SECRET", "ENCRYPTION_KEY", "DATABASE_URL"];
  const missing = required.filter(
    (key) => !process.env[key] || process.env[key].trim() === "",
  );

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => {
      console.error(`   • ${key}`);
    });
    console.error("\n💡 Run ./scripts/setup.sh to generate missing secrets");
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (
    process.env.JWT_SECRET === "your-secret-key-here" ||
    (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32)
  ) {
    console.error("❌ JWT_SECRET is too weak or using default value");
    console.error("💡 Run ./scripts/setup.sh to generate a secure secret");
    process.exit(1);
  }

  // Validate ENCRYPTION_KEY strength
  if (
    process.env.ENCRYPTION_KEY === "your-encryption-key-here" ||
    (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32)
  ) {
    console.error("❌ ENCRYPTION_KEY is too weak or using default value");
    console.error("💡 Run ./scripts/setup.sh to generate a secure key");
    process.exit(1);
  }

  console.log("✅ Environment validation passed");
}

// Constants
const PUSHOVER_USER_KEY_LENGTH = 30;
const PUSHOVER_USER_KEY_REGEX = /^[a-zA-Z0-9]{30}$/;

const app: Express = express();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/mp3",
      "audio/mpeg",
      "audio/ogg",
      "audio/webm",
      "audio/flac",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only audio files are allowed."));
    }
  },
});

// Middleware
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Chunk-Sequence",
    "X-Is-Final",
    "X-Audio-Format",
    "X-Sample-Rate",
  ],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from dist in production
if (process.env.NODE_ENV === "production") {
  const distPath = new URL("../../../dist", import.meta.url).pathname;
  app.use(
    express.static(distPath, {
      maxAge: "1y",
      etag: false,
    }),
  );
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// ==================== Auth Routes ====================

/**
 * POST /api/auth/signup
 * Create a new user account
 */
app.post(
  "/api/auth/signup",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const result = await signup(email, password, name);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/auth/signin
 * Authenticate user and return token
 */
app.post(
  "/api/auth/signin",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const result = await signin(email, password);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/auth/has-users
 * Check if any users exist (bootstrap)
 */
app.get(
  "/api/auth/has-users",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getUserBootstrapStatus();
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/auth/me
 * Get current user profile (protected)
 */
app.get(
  "/api/auth/me",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await getUserProfile(req.userId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

// ==================== Onboarding Routes ====================

/**
 * GET /api/onboarding/status
 * Get onboarding completion status for current user
 */
app.get("/api/onboarding/status", authMiddleware, getOnboardingStatus);

/**
 * POST /api/onboarding/finish
 * Mark onboarding as completed
 */
app.post("/api/onboarding/finish", authMiddleware, finishOnboarding);

/**
 * POST /api/onboarding/complete-step
 * Mark a specific onboarding step as completed
 */
app.post("/api/onboarding/complete-step", authMiddleware, completeStep);

/**
 * POST /api/onboarding/skip
 * Skip onboarding (mark as completed without steps)
 */
app.post("/api/onboarding/skip", authMiddleware, skipOnboarding);

/**
 * POST /api/onboarding/reset
 * Reset onboarding (for testing)
 */
app.post("/api/onboarding/reset", authMiddleware, resetOnboarding);

// ==================== Voice Training Routes ====================

const voiceTrainingController = new VoiceTrainingController();

/**
 * POST /api/training/samples
 * Upload a voice sample for training
 */
app.post(
  "/api/training/samples",
  authMiddleware,
  upload.single("audio"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.uploadVoiceSample(req, res, next);
  },
);

/**
 * GET /api/speaker-profiles
 * List all speaker profiles for current user
 */
app.get(
  "/api/speaker-profiles",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.listSpeakerProfiles(req, res, next);
  },
);

/**
 * POST /api/speaker-profiles
 * Create a new speaker profile for current user
 */
app.post(
  "/api/speaker-profiles",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.createSpeakerProfile(req, res, next);
  },
);

/**
 * GET /api/speaker-profiles/:profileId
 * Get a specific speaker profile with samples
 */
app.get(
  "/api/speaker-profiles/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.getSpeakerProfile(req, res, next);
  },
);

/**
 * DELETE /api/speaker-profiles/:profileId
 * Delete a speaker profile and all associated data
 */
app.delete(
  "/api/speaker-profiles/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.deleteSpeakerProfile(req, res, next);
  },
);

/**
 * GET /api/training/samples
 * List voice samples for a speaker profile
 */
app.get(
  "/api/training/samples",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.listVoiceSamples(req, res, next);
  },
);

/**
 * GET /api/training/samples/:sampleId
 * Get a specific voice sample
 */
app.get(
  "/api/training/samples/:sampleId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.getVoiceSample(req, res, next);
  },
);

/**
 * DELETE /api/training/samples/:sampleId
 * Delete a voice sample
 */
app.delete(
  "/api/training/samples/:sampleId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.deleteVoiceSample(req, res, next);
  },
);

/**
 * POST /api/training/start
 * Start a training session for a speaker profile
 */
app.post(
  "/api/training/start",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.startTrainingSession(req, res, next);
  },
);

/**
 * GET /api/training/status/:sessionId
 * Get the status of a training session
 */
app.get(
  "/api/training/status/:sessionId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.getTrainingStatus(req, res, next);
  },
);

/**
 * GET /api/training/active
 * Get active training sessions for current user
 */
app.get(
  "/api/training/active",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.getActiveTrainingSessions(req, res, next);
  },
);

/**
 * GET /api/training/active/stream
 * Server-Sent Events endpoint for real-time training session updates
 */
app.get(
  "/api/training/active/stream",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // Register client for SSE updates
    trainingSSEService.addClient(req.userId, res);

    // Send current active sessions immediately
    try {
      const sessions = await prisma.trainingSession.findMany({
        where: {
          speakerProfile: {
            userId: req.userId,
          },
          status: {
            in: ["pending", "in-progress"],
          },
        },
        include: { speakerProfile: true },
        orderBy: { createdAt: "desc" },
      });

      const sessionsData = sessions.map((s) => ({
        id: s.id,
        progress: s.progress,
        currentStep: s.currentStep,
        status: s.status,
      }));

      res.write(
        `data: ${JSON.stringify({ type: "sessions_update", sessions: sessionsData })}\n\n`,
      );
    } catch (error) {
      console.error("[SSE] Error fetching initial sessions:", error);
    }

    // Handle client disconnect
    req.on("close", () => {
      trainingSSEService.removeClient(req.userId!, res);
    });
  },
);

/**
 * POST /api/training/verify/:profileId
 * Verify voice against an enrolled speaker profile
 */
app.post(
  "/api/training/verify/:profileId",
  authMiddleware,
  upload.single("audio"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await voiceTrainingController.verifyVoice(req, res, next);
  },
);

// ==================== Adaptive Speaker Learning Routes ====================

/**
 * GET /api/adaptive-learning/status/:profileId
 * Get adaptive learning status for a profile
 */
app.get(
  "/api/adaptive-learning/status/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.getStatus(req, res, next);
  },
);

/**
 * POST /api/adaptive-learning/enable/:profileId
 * Enable adaptive learning for a profile
 */
app.post(
  "/api/adaptive-learning/enable/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.enable(req, res, next);
  },
);

/**
 * POST /api/adaptive-learning/disable/:profileId
 * Disable adaptive learning for a profile
 */
app.post(
  "/api/adaptive-learning/disable/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.disable(req, res, next);
  },
);

/**
 * POST /api/adaptive-learning/unfreeze/:profileId
 * Unfreeze a frozen profile
 */
app.post(
  "/api/adaptive-learning/unfreeze/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.unfreeze(req, res, next);
  },
);

/**
 * GET /api/adaptive-learning/health/:profileId
 * Get health metrics for a profile
 */
app.get(
  "/api/adaptive-learning/health/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.getHealth(req, res, next);
  },
);

/**
 * GET /api/adaptive-learning/health-history/:profileId
 * Get health check history for a profile
 */
app.get(
  "/api/adaptive-learning/health-history/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.getHealthHistory(req, res, next);
  },
);

/**
 * GET /api/adaptive-learning/samples/:profileId
 * Get adaptive samples for a profile
 */
app.get(
  "/api/adaptive-learning/samples/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.getSamples(req, res, next);
  },
);

/**
 * DELETE /api/adaptive-learning/samples/:profileId/:sampleId
 * Remove a specific adaptive sample
 */
app.delete(
  "/api/adaptive-learning/samples/:profileId/:sampleId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.removeSample(req, res, next);
  },
);

/**
 * GET /api/adaptive-learning/snapshots/:profileId
 * List available snapshots for rollback
 */
app.get(
  "/api/adaptive-learning/snapshots/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.getSnapshots(req, res, next);
  },
);

/**
 * POST /api/adaptive-learning/rollback/:profileId
 * Rollback to a previous snapshot
 */
app.post(
  "/api/adaptive-learning/rollback/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.rollback(req, res, next);
  },
);

/**
 * POST /api/adaptive-learning/snapshot/:profileId
 * Create a manual backup snapshot
 */
app.post(
  "/api/adaptive-learning/snapshot/:profileId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.createSnapshot(req, res, next);
  },
);

/**
 * GET /api/adaptive-learning/negatives
 * Get negative examples for current user
 */
app.get(
  "/api/adaptive-learning/negatives",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.getNegatives(req, res, next);
  },
);

/**
 * DELETE /api/adaptive-learning/negatives/:exampleId
 * Delete a specific negative example
 */
app.delete(
  "/api/adaptive-learning/negatives/:exampleId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.deleteNegative(req, res, next);
  },
);

/**
 * DELETE /api/adaptive-learning/negatives
 * Clear all negative examples for current user
 */
app.delete(
  "/api/adaptive-learning/negatives",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.clearNegatives(req, res, next);
  },
);

/**
 * GET /api/adaptive-learning/config
 * Get current adaptive learning configuration
 */
app.get(
  "/api/adaptive-learning/config",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.getConfig(req, res, next);
  },
);

/**
 * GET /api/adaptive-learning/recent-recordings
 * Get recent recordings with classification status for user review
 */
app.get(
  "/api/adaptive-learning/recent-recordings",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.getRecentRecordings(req, res, next);
  },
);

/**
 * POST /api/adaptive-learning/reclassify/:recordingId
 * Reclassify a recording (user says it's them or not them)
 */
app.post(
  "/api/adaptive-learning/reclassify/:recordingId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.reclassifyRecording(req, res, next);
  },
);

/**
 * DELETE /api/adaptive-learning/recent-recordings/clear-negatives
 * Clear all negative examples to reset voice detection
 */
app.delete(
  "/api/adaptive-learning/recent-recordings/clear-negatives",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await adaptiveLearningController.clearAllNegatives(req, res, next);
  },
);

// ==================== Scheduler Routes ====================

/**
 * GET /api/scheduler/tasks
 * Get status of all scheduled tasks
 */
app.get(
  "/api/scheduler/tasks",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tasks = schedulerService.getTasksStatus();
      res.json({ tasks });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/scheduler/tasks/:taskId/run
 * Run a specific task immediately
 */
app.post(
  "/api/scheduler/tasks/:taskId/run",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const result = await schedulerService.runTaskNow(taskId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/scheduler/tasks/:taskId
 * Enable or disable a task
 */
app.patch(
  "/api/scheduler/tasks/:taskId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }

      schedulerService.setTaskEnabled(taskId, enabled);
      res.json({ success: true, taskId, enabled });
    } catch (error) {
      next(error);
    }
  },
);

// ==================== Background Agents Routes ====================

/**
 * POST /api/agents/daily-reflection
 * Trigger daily reflection generation
 */
app.post(
  "/api/agents/daily-reflection",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await backgroundAgentService.runDailyReflection(
        req.userId,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/agents/weekly-insights
 * Trigger weekly insights generation
 */
app.post(
  "/api/agents/weekly-insights",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await backgroundAgentService.runWeeklyInsights(req.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/agents/goal-tracker
 * Trigger goal tracking analysis
 */
app.post(
  "/api/agents/goal-tracker",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await backgroundAgentService.runGoalTracker(req.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/agents/habit-analyzer
 * Trigger habit analysis
 */
app.post(
  "/api/agents/habit-analyzer",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await backgroundAgentService.runHabitAnalyzer(req.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/agents/run-all
 * Trigger all agents for current user
 */
app.post(
  "/api/agents/run-all",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const results = await backgroundAgentService.runAllAgents(req.userId);
      res.json({ results });
    } catch (error) {
      next(error);
    }
  },
);

// ==================== AI Settings Routes ====================

/**
 * GET /api/settings/ai
 * Get all AI settings (providers + task configs)
 */
app.get(
  "/api/settings/ai",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const settings = await getAISettings(req.userId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/settings/ai/providers
 * Get all AI providers
 */
app.get(
  "/api/settings/ai/providers",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const providers = await getProviders(req.userId);
      res.json(providers);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/settings/ai/providers/:providerId
 * Get a specific provider
 */
app.get(
  "/api/settings/ai/providers/:providerId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const provider = await getProviderById(req.userId, req.params.providerId);
      res.json(provider);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/settings/ai/providers
 * Create a new AI provider
 */
app.post(
  "/api/settings/ai/providers",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const provider = await createProvider(req.userId, req.body);
      res.status(201).json(provider);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/settings/ai/providers/:providerId
 * Update an AI provider
 */
app.put(
  "/api/settings/ai/providers/:providerId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const provider = await updateProvider(
        req.userId,
        req.params.providerId,
        req.body,
      );
      res.json(provider);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/settings/ai/providers/:providerId
 * Delete an AI provider
 */
app.delete(
  "/api/settings/ai/providers/:providerId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await deleteProvider(req.userId, req.params.providerId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/settings/ai/providers/:providerId/models
 * Add a custom model to a provider
 */
app.post(
  "/api/settings/ai/providers/:providerId/models",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const model = await addModelToProvider(
        req.userId,
        req.params.providerId,
        req.body,
      );
      res.status(201).json(model);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/settings/ai/providers/:providerId/models/:modelId
 * Remove a model from a provider
 */
app.delete(
  "/api/settings/ai/providers/:providerId/models/:modelId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await removeModelFromProvider(
        req.userId,
        req.params.providerId,
        req.params.modelId,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/settings/ai/tasks
 * Get all task configurations
 */
app.get(
  "/api/settings/ai/tasks",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const configs = await getTaskConfigs(req.userId);
      res.json(configs);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/settings/ai/tasks/:taskType
 * Update a task configuration
 */
app.put(
  "/api/settings/ai/tasks/:taskType",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const config = await updateTaskConfig(
        req.userId,
        req.params.taskType,
        req.body,
      );
      res.json(config);
    } catch (error) {
      next(error);
    }
  },
);

// ==================== ChatGPT OAuth Routes ====================

/**
 * GET /api/auth/chatgpt/status
 * Get ChatGPT OAuth connection status
 */
app.get(
  "/api/auth/chatgpt/status",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const status = await getOAuthStatus(req.userId);
      res.json(status);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/auth/chatgpt/initiate
 * Initiate ChatGPT OAuth flow - returns authorization URL
 */
app.post(
  "/api/auth/chatgpt/initiate",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await initiateOAuthFlow(req.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/auth/chatgpt/initiate-local
 * Initiate ChatGPT OAuth flow with local callback server
 * This starts a local server on port 1455 to capture the OAuth callback
 */
app.post(
  "/api/auth/chatgpt/initiate-local",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await initiateOAuthFlowWithLocalServer(req.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/auth/chatgpt/initiate-pi-ai
 * Initiate ChatGPT OAuth flow using pi-ai library (RECOMMENDED)
 * This uses the proven OAuth implementation from @mariozechner/pi-ai
 *
 * The flow:
 * 1. POST to this endpoint - returns authUrl immediately
 * 2. Frontend opens authUrl in new window
 * 3. User authenticates with OpenAI
 * 4. pi-ai's local server (port 1455) captures the callback
 * 5. Poll /api/auth/chatgpt/flow-status for completion
 */
app.post(
  "/api/auth/chatgpt/initiate-pi-ai",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Variable to store the auth URL when pi-ai provides it
      let authUrl: string | null = null;
      let flowCompleted = false;
      let flowError: string | null = null;

      // Start the OAuth flow with pi-ai
      // The callbacks will be handled by pi-ai's internal server
      const flowPromise = initiatePiAiOAuthFlow(req.userId, {
        onAuth: async (event) => {
          // Store the URL - this is sent to the client
          authUrl = event.url;
          console.log(`📱 Pi-ai OAuth URL for user ${req.userId}:`, authUrl);
        },
        onPrompt: async (prompt) => {
          // This is for manual code input if the callback server fails
          // In most cases this won't be called
          console.log(`❓ Pi-ai OAuth prompt: ${prompt.message}`);
          // Return empty string - the local server should handle the code
          return "";
        },
        onProgress: (message) => {
          console.log(`🔄 Pi-ai OAuth progress: ${message}`);
        },
      });

      // Wait a short time for the URL to be generated
      const waitForUrl = new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (authUrl) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 10000);
      });

      await waitForUrl;

      if (!authUrl) {
        return res.status(500).json({
          error: "Failed to generate OAuth URL",
          message: "pi-ai did not provide an authorization URL in time",
        });
      }

      // Handle flow completion in background
      flowPromise
        .then((result) => {
          flowCompleted = true;
          if (!result.success) {
            flowError = result.error || "OAuth flow failed";
          }
          console.log(
            `✅ Pi-ai OAuth flow completed for user ${req.userId}:`,
            result,
          );
        })
        .catch((err) => {
          flowCompleted = true;
          flowError = err.message || "OAuth flow failed";
          console.error(
            `❌ Pi-ai OAuth flow error for user ${req.userId}:`,
            err,
          );
        });

      // Return the auth URL immediately
      res.json({
        authUrl,
        method: "pi-ai",
        callbackPort: 1455,
        message:
          "Open the authUrl in a browser to authenticate. The flow will complete automatically via the local callback server.",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/auth/chatgpt/flow-status
 * Check the status of a pending OAuth flow
 */
app.get(
  "/api/auth/chatgpt/flow-status",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await checkOAuthFlowStatus(req.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/auth/chatgpt/config
 * Get OAuth configuration (for debugging)
 */
app.get(
  "/api/auth/chatgpt/config",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const config = await getChatGPTOAuthConfig();
      res.json(config);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/auth/chatgpt/callback
 * Handle OAuth callback from OpenAI
 * This endpoint is called by OpenAI after user authorizes
 */
app.get(
  "/api/auth/chatgpt/callback",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state, error: oauthError, error_description } = req.query;

      // Handle OAuth errors from OpenAI
      if (oauthError) {
        console.error(
          "OAuth error from OpenAI:",
          oauthError,
          error_description,
        );
        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return res.redirect(
          `${frontendUrl}/settings?chatgpt_oauth=error&message=${encodeURIComponent((error_description as string) || (oauthError as string))}`,
        );
      }

      if (!code || !state) {
        return res
          .status(400)
          .json({ error: "Missing code or state parameter" });
      }

      const result = await handleOAuthCallback(state as string, code as string);

      // Redirect to frontend with result
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      if (result.success) {
        res.redirect(`${frontendUrl}/settings?chatgpt_oauth=success`);
      } else {
        res.redirect(
          `${frontendUrl}/settings?chatgpt_oauth=error&message=${encodeURIComponent(result.error || "Unknown error")}`,
        );
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/auth/chatgpt/disconnect
 * Disconnect ChatGPT OAuth (delete credentials)
 */
app.post(
  "/api/auth/chatgpt/disconnect",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await disconnectOAuth(req.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/auth/chatgpt/submit-code
 * Submit OAuth authorization code manually (fallback when callback doesn't work)
 * User can paste the code or full redirect URL
 */
app.post(
  "/api/auth/chatgpt/submit-code",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "code is required" });
      }
      const result = await submitOAuthCodeManually(req.userId, code);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/auth/chatgpt/toggle
 * Toggle ChatGPT OAuth enabled/disabled
 */
app.post(
  "/api/auth/chatgpt/toggle",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      const result = await setOAuthEnabled(req.userId, enabled);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/auth/chatgpt/usage
 * Check ChatGPT usage limits
 */
app.get(
  "/api/auth/chatgpt/usage",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const usage = await checkChatGPTUsage(req.userId);
      res.json(usage);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/auth/chatgpt/test
 * Test ChatGPT OAuth connection
 */
app.get(
  "/api/auth/chatgpt/test",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await testChatGPTConnection(req.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// ==================== Health Check ====================

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// ==================== Debug Routes ====================

// Only enable debug routes in development
if (process.env.NODE_ENV !== "production") {
  app.use("/api/debug", debugController);
  console.log("🐛 Debug routes enabled at /api/debug/input-flow");
}

// ==================== Data Cleanup Routes ====================

app.post("/api/cleanup/duplicate-todos", authMiddleware, cleanupDuplicateTodos);
app.post(
  "/api/cleanup/disable-coherence-agent",
  authMiddleware,
  disableDataCoherenceAgent,
);
console.log("🧹 Data cleanup routes enabled at /api/cleanup");

// ==================== Built-in Tools Routes ====================

app.use("/api/tools", toolsController);
console.log("🔧 Built-in tools routes enabled at /api/tools");

// ==================== Skills System Routes ====================

import skillsController from "../controllers/skills.controller.js";
app.use("/api/skills", skillsController);
console.log("🎯 Skills routes enabled at /api/skills");

// ==================== User Secrets Routes ====================

app.use("/api/secrets", secretsController);
console.log("🔐 Secrets routes enabled at /api/secrets");

// ==================== Generated Tools Routes ====================

app.use("/api/generated-tools", generatedToolsController);
console.log("🤖 Generated tools routes enabled at /api/generated-tools");

// ==================== Fact-Check Routes ====================

app.use("/api/fact-check", factCheckController);
console.log("✅ Fact-check routes enabled at /api/fact-check");

// ==================== Analytics Routes ====================

app.use("/api/analytics", analyticsController);
console.log("📊 Analytics routes enabled at /api/analytics");

// ==================== Universal Audio Ingestion Routes ====================

// Note: Authentication handled by controller's requireAuth middleware
// This supports both Authorization header AND query parameter tokens (required for SSE)
app.use("/api/audio", audioIngestionController);
console.log("🎙️ Universal audio ingestion routes enabled at /api/audio");

// ==================== Goals Routes ====================

import { goalsController } from "../controllers/goals.controller.js";

app.get(
  "/api/goals",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await goalsController.listGoals(req, res);
  },
);

app.get(
  "/api/goals/stats",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await goalsController.getStats(req, res);
  },
);

app.get(
  "/api/goals/categories",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await goalsController.getCategories(req, res);
  },
);

app.get(
  "/api/goals/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await goalsController.getGoal(req, res);
  },
);

app.post(
  "/api/goals",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await goalsController.createGoal(req, res);
  },
);

app.patch(
  "/api/goals/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await goalsController.updateGoal(req, res);
  },
);

app.delete(
  "/api/goals/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await goalsController.deleteGoal(req, res);
  },
);

app.patch(
  "/api/goals/:id/progress",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await goalsController.updateProgress(req, res);
  },
);

app.post(
  "/api/goals/:id/milestones",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await goalsController.addMilestone(req, res);
  },
);

console.log("🎯 Goals routes enabled at /api/goals");

// ==================== Achievements Routes ====================

import { achievementsController } from "../controllers/achievements.controller.js";

app.get(
  "/api/achievements",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await achievementsController.listAchievements(req, res);
  },
);

app.get(
  "/api/achievements/stats",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await achievementsController.getStats(req, res);
  },
);

app.get(
  "/api/achievements/categories",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await achievementsController.getCategories(req, res);
  },
);

app.get(
  "/api/achievements/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await achievementsController.getAchievement(req, res);
  },
);

app.post(
  "/api/achievements",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await achievementsController.createAchievement(req, res);
  },
);

app.patch(
  "/api/achievements/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await achievementsController.updateAchievement(req, res);
  },
);

app.delete(
  "/api/achievements/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await achievementsController.deleteAchievement(req, res);
  },
);

app.post(
  "/api/achievements/:id/unlock",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await achievementsController.unlockAchievement(req, res);
  },
);

console.log("🏆 Achievements routes enabled at /api/achievements");

// ==================== Notification Routes ====================

// Create notification (for AI)
app.post(
  "/api/notifications",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await notificationController.create(req, res);
  },
);

// List user notifications
app.get(
  "/api/notifications",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await notificationController.list(req, res);
  },
);

// Mark notification as read
app.patch(
  "/api/notifications/:id/read",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await notificationController.markRead(req, res);
  },
);

// Poll for notifications (WebSocket fallback)
app.get(
  "/api/notifications/poll",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await notificationController.poll(req, res);
  },
);

// Record user interaction with notification (resets spam cooldown)
app.post(
  "/api/notifications/:id/interact",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await notificationController.recordInteraction(req, res);
  },
);

// Get notification topic trackers (spam detection state)
app.get(
  "/api/notifications/topics",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await notificationController.getTopicTrackers(req, res);
  },
);

// Revive a given-up topic
app.post(
  "/api/notifications/topics/:topic/revive",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await notificationController.reviveTopic(req, res);
  },
);

console.log("🔔 Notification routes enabled at /api/notifications");

// ==================== User Presence Routes ====================
// For smart notification routing (detecting if user is in web interface)

import { userPresenceController } from "../controllers/user-presence.controller.js";

// Send presence heartbeat (called regularly from frontend)
app.post(
  "/api/user/presence/heartbeat",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await userPresenceController.heartbeat(req, res);
  },
);

// Get current user presence status
app.get(
  "/api/user/presence/status",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await userPresenceController.getStatus(req, res);
  },
);

// Mark user as offline
app.post(
  "/api/user/presence/offline",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await userPresenceController.markOffline(req, res);
  },
);

console.log("👥 User presence routes enabled at /api/user/presence");

// ==================== Notification Settings Routes ====================

/**
 * GET /api/settings/notifications
 * Get notification settings including Pushover config
 */
app.get(
  "/api/settings/notifications",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.userId },
        select: {
          pushoverUserKey: true,
          pushoverApiToken: true,
          notifyOnMemoryStored: true,
          notifyOnCommandDetected: true,
        },
      });

      // Create default settings if they don't exist
      if (!settings) {
        const newSettings = await prisma.userSettings.create({
          data: {
            userId: req.userId!,
          },
          select: {
            pushoverUserKey: true,
            pushoverApiToken: true,
            notifyOnMemoryStored: true,
            notifyOnCommandDetected: true,
          },
        });
        return res.json(newSettings);
      }

      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching notification settings:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * PUT /api/settings/notifications
 * Update notification settings including Pushover config
 */
app.put(
  "/api/settings/notifications",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const {
        pushoverUserKey,
        pushoverApiToken,
        notifyOnMemoryStored,
        notifyOnCommandDetected,
      } = req.body;

      // Validate Pushover credentials if provided
      if (pushoverUserKey && !PUSHOVER_USER_KEY_REGEX.test(pushoverUserKey)) {
        return res.status(400).json({
          error: `Invalid Pushover user key format (should be ${PUSHOVER_USER_KEY_LENGTH} alphanumeric characters)`,
        });
      }

      // Upsert settings
      const settings = await prisma.userSettings.upsert({
        where: { userId: req.userId! },
        create: {
          userId: req.userId!,
          pushoverUserKey: pushoverUserKey || null,
          pushoverApiToken: pushoverApiToken || null,
          notifyOnMemoryStored: notifyOnMemoryStored ?? true,
          notifyOnCommandDetected: notifyOnCommandDetected ?? true,
        },
        update: {
          ...(pushoverUserKey !== undefined && {
            pushoverUserKey: pushoverUserKey || null,
          }),
          ...(pushoverApiToken !== undefined && {
            pushoverApiToken: pushoverApiToken || null,
          }),
          ...(notifyOnMemoryStored !== undefined && { notifyOnMemoryStored }),
          ...(notifyOnCommandDetected !== undefined && {
            notifyOnCommandDetected,
          }),
        },
        select: {
          pushoverUserKey: true,
          pushoverApiToken: true,
          notifyOnMemoryStored: true,
          notifyOnCommandDetected: true,
        },
      });

      res.json(settings);
    } catch (error: any) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * POST /api/settings/notifications/test-pushover
 * Test Pushover configuration by sending a test notification
 */
app.post(
  "/api/settings/notifications/test-pushover",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.userId },
      });

      if (!settings?.pushoverUserKey) {
        return res.status(400).json({
          error: "Pushover user key not configured",
        });
      }

      const apiToken =
        settings.pushoverApiToken || process.env.PUSHOVER_APP_TOKEN;
      if (!apiToken) {
        return res.status(400).json({
          error: "Pushover API token not configured",
        });
      }

      // Send test notification
      const axios = (await import("axios")).default;
      const payload = {
        token: apiToken,
        user: settings.pushoverUserKey,
        title: "Second Brain AI - Test Notification",
        message: "Your Pushover integration is working correctly! 🎉",
        priority: "0",
      };

      const response = await axios.post(
        "https://api.pushover.net/1/messages.json",
        new URLSearchParams(payload).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      if (response.data.status === 1) {
        res.json({
          success: true,
          message: "Test notification sent successfully",
        });
      } else {
        res.status(400).json({
          success: false,
          error:
            response.data.errors?.join(", ") || "Failed to send notification",
        });
      }
    } catch (error: any) {
      console.error("Error testing Pushover:", error);
      res.status(500).json({
        success: false,
        error: error.response?.data?.errors?.join(", ") || error.message,
      });
    }
  },
);

console.log(
  "⚙️  Notification settings routes enabled at /api/settings/notifications",
);

// ==================== Telegram Integration Routes ====================

import { telegramService } from "./telegram.service.js";

/**
 * GET /api/settings/telegram
 * Get Telegram settings for current user
 */
app.get(
  "/api/settings/telegram",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.userId },
        select: {
          telegramBotToken: true,
          telegramChatId: true,
          telegramEnabled: true,
        },
      });

      if (!settings) {
        return res.json({
          telegramBotToken: null,
          telegramChatId: null,
          telegramEnabled: false,
        });
      }

      // Don't expose full token, just indicate if configured
      res.json({
        hasBotToken: !!settings.telegramBotToken,
        telegramChatId: settings.telegramChatId,
        telegramEnabled: settings.telegramEnabled,
      });
    } catch (error: any) {
      console.error("Error fetching Telegram settings:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * PUT /api/settings/telegram
 * Update Telegram bot token
 * When successfully configured, Telegram becomes the primary notification channel
 */
app.put(
  "/api/settings/telegram",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { telegramBotToken, telegramEnabled } = req.body;
      const userId = req.userId!;

      // Validate bot token if provided
      if (telegramBotToken) {
        const validation =
          await telegramService.validateBotToken(telegramBotToken);
        if (!validation.valid) {
          return res.status(400).json({
            error: `Invalid bot token: ${validation.error}`,
          });
        }
      }

      // Upsert settings
      const settings = await prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          telegramBotToken: telegramBotToken || null,
          telegramEnabled: telegramEnabled ?? false,
        },
        update: {
          ...(telegramBotToken !== undefined && {
            telegramBotToken: telegramBotToken || null,
          }),
          ...(telegramEnabled !== undefined && { telegramEnabled }),
          // Clear chat ID if token is being removed
          ...(telegramBotToken === null && { telegramChatId: null }),
        },
        select: {
          telegramBotToken: true,
          telegramChatId: true,
          telegramEnabled: true,
        },
      });

      // Start or stop polling based on configuration
      if (settings.telegramBotToken && settings.telegramEnabled) {
        await telegramService.startPolling(userId);
        console.log(
          `[API] Telegram enabled for user ${userId} - will become primary notification channel once /start is sent`,
        );
      } else if (settings.telegramBotToken) {
        telegramService.stopPolling(settings.telegramBotToken);
        console.log(
          `[API] Telegram disabled for user ${userId} - reverting to default notification channels`,
        );
      } else {
        console.log(`[API] Telegram removed for user ${userId}`);
      }

      res.json({
        hasBotToken: !!settings.telegramBotToken,
        telegramChatId: settings.telegramChatId,
        telegramEnabled: settings.telegramEnabled,
      });
    } catch (error: any) {
      console.error("Error updating Telegram settings:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * POST /api/settings/telegram/test
 * Test Telegram configuration by sending a test notification
 */
app.post(
  "/api/settings/telegram/test",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await telegramService.sendTestNotification(req.userId!);

      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ success: false, error: result.message });
      }
    } catch (error: any) {
      console.error("Error testing Telegram:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * POST /api/settings/telegram/start-polling
 * Start polling for incoming messages (called when user enables Telegram)
 */
app.post(
  "/api/settings/telegram/start-polling",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await telegramService.startPolling(req.userId!);
      res.json({ success: true, message: "Polling started" });
    } catch (error: any) {
      console.error("Error starting Telegram polling:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

/**
 * DELETE /api/settings/telegram
 * Disconnect Telegram (clear all settings)
 */
app.delete(
  "/api/settings/telegram",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.userId },
        select: { telegramBotToken: true },
      });

      // Stop polling if active
      if (settings?.telegramBotToken) {
        telegramService.stopPolling(settings.telegramBotToken);
      }

      // Clear Telegram settings
      await prisma.userSettings.update({
        where: { userId: req.userId },
        data: {
          telegramBotToken: null,
          telegramChatId: null,
          telegramEnabled: false,
        },
      });

      res.json({ success: true, message: "Telegram disconnected" });
    } catch (error: any) {
      console.error("Error disconnecting Telegram:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

console.log("📱 Telegram routes enabled at /api/settings/telegram");

// ==================== Tips & Hints Routes ====================

/**
 * POST /api/tips
 * Create a new tip (for system/admin use)
 */
app.post(
  "/api/tips",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await tipsController.create(req, res);
  },
);

/**
 * GET /api/tips
 * Get active tips for user
 */
app.get(
  "/api/tips",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await tipsController.list(req, res);
  },
);

/**
 * PATCH /api/tips/:id/view
 * Track tip view
 */
app.patch(
  "/api/tips/:id/view",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await tipsController.view(req, res);
  },
);

/**
 * PATCH /api/tips/:id/dismiss
 * Dismiss a tip for user
 */
app.patch(
  "/api/tips/:id/dismiss",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await tipsController.dismiss(req, res);
  },
);

/**
 * DELETE /api/tips/:id
 * Delete a tip
 */
app.delete(
  "/api/tips/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await tipsController.delete(req, res);
  },
);

console.log("💡 Tips routes enabled at /api/tips");

// ==================== Proactive Agent Routes ====================

/**
 * POST /api/proactive/analyze
 * Run proactive analysis for current user
 */
app.post(
  "/api/proactive/analyze",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await runProactiveAnalysis(req, res, next);
  },
);

/**
 * POST /api/proactive/health-check
 * Run health check for current user
 */
app.post(
  "/api/proactive/health-check",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await runHealthCheck(req, res, next);
  },
);

/**
 * GET /api/proactive/status
 * Get proactive agent status
 */
app.get(
  "/api/proactive/status",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await getProactiveStatus(req, res, next);
  },
);

console.log("🤖 Proactive agent routes enabled at /api/proactive");

// ==================== Long Running Tasks Routes ====================

// List active tasks
app.get(
  "/api/tasks/long-running/active",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.getActiveTasks(req, res);
  },
);

// List all tasks
app.get(
  "/api/tasks/long-running",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.listTasks(req, res);
  },
);

// Create a new task
app.post(
  "/api/tasks/long-running",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.createTask(req, res);
  },
);

// Get a specific task
app.get(
  "/api/tasks/long-running/:taskId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.getTask(req, res);
  },
);

// Add steps to a task
app.post(
  "/api/tasks/long-running/:taskId/steps",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.addSteps(req, res);
  },
);

// Start a task
app.post(
  "/api/tasks/long-running/:taskId/start",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.startTask(req, res);
  },
);

// Pause a task
app.post(
  "/api/tasks/long-running/:taskId/pause",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.pauseTask(req, res);
  },
);

// Resume a task
app.post(
  "/api/tasks/long-running/:taskId/resume",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.resumeTask(req, res);
  },
);

// Cancel a task
app.post(
  "/api/tasks/long-running/:taskId/cancel",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.cancelTask(req, res);
  },
);

// Get task progress
app.get(
  "/api/tasks/long-running/:taskId/progress",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.getProgress(req, res);
  },
);

// Get task report
app.get(
  "/api/tasks/long-running/:taskId/report",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await longRunningTaskController.getReport(req, res);
  },
);

console.log("🚀 Long Running Tasks routes enabled at /api/tasks/long-running");

// ==================== Chat Routes ====================

/**
 * POST /api/chat
 * Stream chat response using SSE
 */
app.post(
  "/api/chat",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await chatStream(req, res, next);
  },
);

/**
 * POST /api/chat/enhanced
 * Enhanced streaming with detailed events (thinking, tool previews, etc.)
 */
app.post(
  "/api/chat/enhanced",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await chatStreamEnhanced(req, res, next);
  },
);

/**
 * POST /api/chat/polling/start
 * Start a polling-based chat flow
 */
app.post(
  "/api/chat/polling/start",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await chatPollingStart(req, res, next);
  },
);

/**
 * GET /api/chat/polling/:flowId
 * Poll for chat flow updates/results
 */
app.get(
  "/api/chat/polling/:flowId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await chatPollingStatus(req, res, next);
  },
);

// ==================== Chat Session Routes (pi-ai Context Serialization) ====================

import {
  listChatSessions,
  getChatSession,
  createChatSession,
  updateChatSession,
  updateChatSessionMetadata,
  archiveChatSession,
  deleteChatSession,
  exportChatSession,
  importChatSession,
  getChatSessionStats,
  appendMessageToSession,
} from "../controllers/chat-session.controller.js";

/**
 * GET /api/chat-sessions
 * List chat sessions for the current user
 */
app.get(
  "/api/chat-sessions",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await listChatSessions(req, res);
  },
);

/**
 * GET /api/chat-sessions/stats
 * Get chat session statistics
 */
app.get(
  "/api/chat-sessions/stats",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await getChatSessionStats(req, res);
  },
);

/**
 * GET /api/chat-sessions/:sessionId
 * Get a single chat session with full context
 */
app.get(
  "/api/chat-sessions/:sessionId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await getChatSession(req, res);
  },
);

/**
 * POST /api/chat-sessions
 * Create a new chat session
 */
app.post(
  "/api/chat-sessions",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await createChatSession(req, res);
  },
);

/**
 * POST /api/chat-sessions/import
 * Import a chat session from JSON
 */
app.post(
  "/api/chat-sessions/import",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await importChatSession(req, res);
  },
);

/**
 * PUT /api/chat-sessions/:sessionId
 * Update a chat session with new context
 */
app.put(
  "/api/chat-sessions/:sessionId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await updateChatSession(req, res);
  },
);

/**
 * PATCH /api/chat-sessions/:sessionId
 * Update session metadata (title, tags, etc.)
 */
app.patch(
  "/api/chat-sessions/:sessionId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await updateChatSessionMetadata(req, res);
  },
);

/**
 * POST /api/chat-sessions/:sessionId/archive
 * Archive a chat session
 */
app.post(
  "/api/chat-sessions/:sessionId/archive",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await archiveChatSession(req, res);
  },
);

/**
 * DELETE /api/chat-sessions/:sessionId
 * Delete a chat session (soft delete by default)
 */
app.delete(
  "/api/chat-sessions/:sessionId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await deleteChatSession(req, res);
  },
);

/**
 * GET /api/chat-sessions/:sessionId/export
 * Export a chat session to JSON
 */
app.get(
  "/api/chat-sessions/:sessionId/export",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await exportChatSession(req, res);
  },
);

/**
 * POST /api/chat-sessions/:sessionId/messages
 * Append a message to an existing session
 */
app.post(
  "/api/chat-sessions/:sessionId/messages",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    await appendMessageToSession(req, res);
  },
);

console.log("📝 Chat Session routes enabled at /api/chat-sessions");

// ==================== Telegram Conversation Routes ====================

import {
  getConversationHistory,
  cleanupTelegramConversation,
  expireTelegramMessages,
  getTelegramConversationSummary,
} from "../controllers/telegram-conversation.controller.js";

/**
 * GET /api/telegram/conversation
 * Get recent Telegram conversation context
 */
app.get(
  "/api/telegram/conversation",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await getConversationHistory(req, res);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/telegram/conversation/cleanup
 * Clean up old Telegram messages
 */
app.post(
  "/api/telegram/conversation/cleanup",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await cleanupTelegramConversation(req, res);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/telegram/conversation/expire
 * Expire old Telegram messages
 */
app.post(
  "/api/telegram/conversation/expire",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await expireTelegramMessages(req, res);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/telegram/conversation/summary
 * Get Telegram conversation summary
 */
app.get(
  "/api/telegram/conversation/summary",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await getTelegramConversationSummary(req, res);
    } catch (error) {
      next(error);
    }
  },
);

console.log("🚀 Telegram Conversation routes enabled");

// ==================== Memory Routes ====================

/**
 * POST /api/memories
 * Create a new memory
 */
app.post(
  "/api/memories",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const input: CreateMemoryInput = req.body;

      if (!input.content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const memory = await createMemory(req.userId, input);
      res.status(201).json(memory);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/memories
 * Get all memories for current user with filtering and pagination
 */
app.get(
  "/api/memories",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Parse query parameters
      const filters: MemoryQueryFilters = {
        type: req.query.type as any,
        timeScale: req.query.timeScale as any,
        tags: req.query.tags
          ? (req.query.tags as string).split(",")
          : undefined,
        minImportance: req.query.minImportance
          ? parseFloat(req.query.minImportance as string)
          : undefined,
        maxImportance: req.query.maxImportance
          ? parseFloat(req.query.maxImportance as string)
          : undefined,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        isArchived:
          req.query.isArchived === "true"
            ? true
            : req.query.isArchived === "false"
              ? false
              : undefined,
        isPinned:
          req.query.isPinned === "true"
            ? true
            : req.query.isPinned === "false"
              ? false
              : undefined,
        search: req.query.search as string,
      };

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        sortBy: (req.query.sortBy as any) || "createdAt",
        sortOrder: (req.query.sortOrder as any) || "desc",
      };

      const result = await getMemories(req.userId, filters, pagination);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/memories/stats
 * Get memory statistics for current user
 */
app.get(
  "/api/memories/stats",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const stats = await getMemoryStats(req.userId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics (memories, interactions, summaries)
 */
app.get(
  "/api/dashboard/stats",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get total memories
      const memoryStats = await getMemoryStats(req.userId);
      const totalMemories = memoryStats.total;

      // Get total interactions (processed inputs)
      const totalInteractions = await prisma.processedInput.count({
        where: {
          userId: req.userId,
          status: "completed",
        },
      });

      // Get today's summaries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dailySummaries = await prisma.summary.count({
        where: {
          userId: req.userId,
          timeScale: "DAILY",
          periodStart: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      res.json({
        totalMemories,
        totalInteractions,
        dailySummaries,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/memories/search/semantic
 * Semantic search in memories using Weaviate
 */
app.get(
  "/api/memories/search/semantic",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const query = req.query.query as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      if (!query) {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const results = await memorySearchService.semanticSearch(
        req.userId,
        query,
        limit,
      );
      res.json(results);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/memories/search/status
 * Check if semantic search is available
 */
app.get(
  "/api/memories/search/status",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      res.json({
        semanticSearchAvailable:
          memorySearchService.isSemanticSearchAvailable(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/memories/bulk
 * Bulk create memories
 */
app.post(
  "/api/memories/bulk",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { memories } = req.body;

      if (!Array.isArray(memories) || memories.length === 0) {
        return res.status(400).json({ error: "Memories array is required" });
      }

      const result = await bulkCreateMemories(req.userId, memories);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/memories/:memoryId
 * Get a specific memory
 */
app.get(
  "/api/memories/:memoryId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const memory = await getMemoryById(req.userId, req.params.memoryId);
      res.json(memory);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/memories/:memoryId
 * Update a memory
 */
app.patch(
  "/api/memories/:memoryId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const input: UpdateMemoryInput = req.body;
      const memory = await updateMemory(req.userId, req.params.memoryId, input);
      res.json(memory);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/memories/:memoryId
 * Delete a memory
 */
app.delete(
  "/api/memories/:memoryId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await deleteMemory(req.userId, req.params.memoryId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/memories/:memoryId/archive
 * Archive a memory
 */
app.post(
  "/api/memories/:memoryId/archive",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const memory = await archiveMemory(req.userId, req.params.memoryId);
      res.json(memory);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/memories/:memoryId/unarchive
 * Unarchive a memory
 */
app.post(
  "/api/memories/:memoryId/unarchive",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const memory = await unarchiveMemory(req.userId, req.params.memoryId);
      res.json(memory);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/memories/:memoryId/pin
 * Pin a memory
 */
app.post(
  "/api/memories/:memoryId/pin",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const memory = await pinMemory(req.userId, req.params.memoryId);
      res.json(memory);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/memories/:memoryId/unpin
 * Unpin a memory
 */
app.post(
  "/api/memories/:memoryId/unpin",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const memory = await unpinMemory(req.userId, req.params.memoryId);
      res.json(memory);
    } catch (error) {
      next(error);
    }
  },
);

// ==================== Memory Cleaner Routes ====================

/**
 * GET /api/memories/cleaner/stats
 * Get memory cleaner statistics (short-term, long-term, archived counts)
 */
app.get(
  "/api/memories/cleaner/stats",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const stats = await memoryCleanerService.getCleanupStats(req.userId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/memories/cleaner/run
 * Manually trigger memory cleanup for current user
 */
app.post(
  "/api/memories/cleaner/run",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await memoryCleanerService.runMemoryCleanup(req.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// ==================== Activities Routes ====================

/**
 * GET /api/activities/recent
 * Get recent activities (memories, interactions, todos) for dashboard
 */
app.get(
  "/api/activities/recent",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      // Fetch recent data from different sources
      const [recentMemories, recentTodos, recentInteractions] =
        await Promise.all([
          prisma.memory.findMany({
            where: {
              userId: req.userId,
              isArchived: false,
            },
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              content: true,
              type: true,
              createdAt: true,
              tags: true,
              importanceScore: true,
            },
          }),
          prisma.todo.findMany({
            where: { userId: req.userId },
            take: Math.ceil(limit / 2),
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              completedAt: true,
            },
          }),
          prisma.processedInput.findMany({
            where: { userId: req.userId },
            take: Math.ceil(limit / 2),
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              content: true,
              format: true,
              createdAt: true,
              status: true,
              speakerId: true,
            },
          }),
        ]);

      // Transform and combine into activity items
      const activityItems = [
        // Memory items
        ...recentMemories.map((memory) => ({
          id: memory.id,
          title: `${memory.content.substring(0, 50)}${memory.content.length > 50 ? "..." : ""}`,
          description: `Memory captured - ${memory.type.toLowerCase()}`,
          type: "memory" as const,
          timestamp: new Date(memory.createdAt),
          icon: "📝",
          metadata: {
            content: memory.content,
            tags: memory.tags,
            importance: memory.importanceScore,
          },
        })),
        // Todo items
        ...recentTodos.map((todo) => ({
          id: todo.id,
          title: todo.title,
          description:
            todo.status === "COMPLETED" ? "Task completed" : "Task created",
          type: "todo" as const,
          timestamp: new Date(
            todo.status === "COMPLETED"
              ? todo.completedAt || todo.createdAt
              : todo.createdAt,
          ),
          icon: todo.status === "COMPLETED" ? "✅" : "📋",
          metadata: {
            status: todo.status,
          },
        })),
        // Interaction items
        ...recentInteractions.map((interaction) => ({
          id: interaction.id,
          title: `${interaction.content.substring(0, 50)}${interaction.content.length > 50 ? "..." : ""}`,
          description: `${interaction.format} input - ${interaction.status}`,
          type: "interaction" as const,
          timestamp: new Date(interaction.createdAt),
          icon: interaction.format.includes("audio") ? "🎤" : "💬",
          metadata: {
            format: interaction.format,
            status: interaction.status,
          },
        })),
      ]
        // Sort by timestamp descending
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        // Take top N
        .slice(0, limit);

      res.json({ items: activityItems });
    } catch (error) {
      next(error);
    }
  },
);

// ==================== Summary Routes ====================

/**
 * POST /api/summaries
 * Create a new summary
 */
app.post(
  "/api/summaries",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const input: CreateSummaryInput = req.body;

      if (
        !input.content ||
        !input.timeScale ||
        !input.periodStart ||
        !input.periodEnd
      ) {
        return res.status(400).json({
          error: "content, timeScale, periodStart, and periodEnd are required",
        });
      }

      // Convert date strings to Date objects
      input.periodStart = new Date(input.periodStart);
      input.periodEnd = new Date(input.periodEnd);

      const summary = await createSummary(req.userId, input);
      res.status(201).json(summary);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/summaries
 * Get all summaries for current user
 */
app.get(
  "/api/summaries",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const filters = {
        timeScale: req.query.timeScale as any,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
      };

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        sortBy: (req.query.sortBy as any) || "periodEnd",
        sortOrder: (req.query.sortOrder as any) || "desc",
      };

      const result = await getSummaries(req.userId, filters, pagination);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/summaries/latest
 * Get the latest summary for each time scale
 */
app.get(
  "/api/summaries/latest",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const summaries = await getLatestSummaries(req.userId);
      res.json(summaries);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/summaries/:summaryId
 * Get a specific summary
 */
app.get(
  "/api/summaries/:summaryId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const summary = await getSummaryById(req.userId, req.params.summaryId);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/summaries/:summaryId
 * Update a summary
 */
app.patch(
  "/api/summaries/:summaryId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const input: UpdateSummaryInput = req.body;
      const summary = await updateSummary(
        req.userId,
        req.params.summaryId,
        input,
      );
      res.json(summary);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/summaries/:summaryId
 * Delete a summary
 */
app.delete(
  "/api/summaries/:summaryId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await deleteSummary(req.userId, req.params.summaryId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// ==================== AI Settings Routes ====================

/**
 * GET /api/ai-settings
 * Get all AI settings (providers + task configs)
 */
app.get(
  "/api/ai-settings",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const settings = await getAISettings(req.userId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/ai-settings/providers
 * Get all AI providers
 */
app.get(
  "/api/ai-settings/providers",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const providers = await getProviders(req.userId);
      res.json(providers);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/ai-settings/providers
 * Create a new AI provider
 */
app.post(
  "/api/ai-settings/providers",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const provider = await createProvider(req.userId, req.body);
      res.status(201).json(provider);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/ai-settings/providers/:providerId
 * Get a specific provider
 */
app.get(
  "/api/ai-settings/providers/:providerId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const provider = await getProviderById(req.userId, req.params.providerId);
      res.json(provider);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/ai-settings/providers/:providerId
 * Update a provider
 */
app.patch(
  "/api/ai-settings/providers/:providerId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const provider = await updateProvider(
        req.userId,
        req.params.providerId,
        req.body,
      );
      res.json(provider);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/ai-settings/providers/:providerId
 * Delete a provider
 */
app.delete(
  "/api/ai-settings/providers/:providerId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await deleteProvider(req.userId, req.params.providerId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/ai-settings/providers/:providerId/models
 * Add a custom model to a provider
 */
app.post(
  "/api/ai-settings/providers/:providerId/models",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const model = await addModelToProvider(
        req.userId,
        req.params.providerId,
        req.body,
      );
      res.status(201).json(model);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/ai-settings/providers/:providerId/models/:modelId
 * Remove a model from a provider
 */
app.delete(
  "/api/ai-settings/providers/:providerId/models/:modelId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await removeModelFromProvider(
        req.userId,
        req.params.providerId,
        req.params.modelId,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/ai-settings/providers/:providerId/sync-models
 * Sync models from provider API (discover available models)
 */
app.post(
  "/api/ai-settings/providers/:providerId/sync-models",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await syncProviderModels(
        req.userId,
        req.params.providerId,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/ai-settings/test-api-key
 * Test if an API key is valid
 */
app.post(
  "/api/ai-settings/test-api-key",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { apiKey, baseUrl } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: "API key is required" });
      }

      const result = await testProviderApiKey(apiKey, baseUrl);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/ai-settings/max-tokens
 * Get the default max tokens setting for the user
 */
app.get(
  "/api/ai-settings/max-tokens",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { getDefaultMaxTokens } =
        await import("../controllers/ai-settings.controller.js");
      const maxTokens = await getDefaultMaxTokens(req.userId);
      res.json({ maxTokens });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/ai-settings/max-tokens
 * Update the default max tokens setting for the user
 */
app.patch(
  "/api/ai-settings/max-tokens",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { maxTokens } = req.body;

      if (typeof maxTokens !== "number" || maxTokens < 1) {
        return res.status(400).json({
          error: "maxTokens must be a number and at least 1",
        });
      }

      if (maxTokens > 100000) {
        return res.status(400).json({
          error: "maxTokens cannot exceed 100000",
        });
      }

      const { updateDefaultMaxTokens } =
        await import("../controllers/ai-settings.controller.js");
      const updated = await updateDefaultMaxTokens(req.userId, maxTokens);
      res.json({ maxTokens: updated });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/ai-settings/task-configs
 * Get all task configurations
 */
app.get(
  "/api/ai-settings/task-configs",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const configs = await getTaskConfigs(req.userId);
      res.json(configs);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/ai-settings/task-configs/:taskType
 * Update a task configuration
 */
app.patch(
  "/api/ai-settings/task-configs/:taskType",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const config = await updateTaskConfig(
        req.userId,
        req.params.taskType,
        req.body,
      );
      res.json(config);
    } catch (error) {
      next(error);
    }
  },
);

// ==================== User Settings Routes ====================

/**
 * GET /api/user-settings
 * Get user settings (creates default if none exist)
 */
app.get(
  "/api/user-settings",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let settings = await prisma.userSettings.findUnique({
        where: { userId: req.userId },
      });

      // Create default settings if none exist
      if (!settings) {
        settings = await prisma.userSettings.create({
          data: { userId: req.userId },
        });
      }

      res.json(settings);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/user-settings
 * Update user settings
 */
app.patch(
  "/api/user-settings",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        continuousListeningEnabled,
        wakeWord,
        wakeWordSensitivity,
        minImportanceThreshold,
        silenceDetectionMs,
        vadSensitivity,
        speakerConfidenceThreshold,
        autoDeleteAudioAfterProcess,
        notifyOnMemoryStored,
        notifyOnCommandDetected,
        themePreference,
      } = req.body;

      const allowedThemePreferences = ["system", "light", "dark"] as const;
      type ThemePreference = (typeof allowedThemePreferences)[number];
      const normalizedThemePreference =
        typeof themePreference === "string" &&
        allowedThemePreferences.includes(themePreference as ThemePreference)
          ? (themePreference as ThemePreference)
          : undefined;

      if (
        themePreference !== undefined &&
        normalizedThemePreference === undefined
      ) {
        return res
          .status(400)
          .json({ error: "themePreference must be system, light, or dark" });
      }

      const existingSettings = await prisma.userSettings.findUnique({
        where: { userId: req.userId },
      });

      const currentMetadata =
        (existingSettings?.metadata as Record<string, any>) || {};
      const currentAppearance =
        (currentMetadata?.appearance as Record<string, any>) || {};
      const metadataWithTheme =
        normalizedThemePreference !== undefined
          ? {
              ...currentMetadata,
              appearance: {
                ...currentAppearance,
                themePreference: normalizedThemePreference,
              },
            }
          : undefined;

      // Validate numeric fields
      if (
        wakeWordSensitivity !== undefined &&
        (wakeWordSensitivity < 0 || wakeWordSensitivity > 1)
      ) {
        return res
          .status(400)
          .json({ error: "wakeWordSensitivity must be between 0 and 1" });
      }
      if (
        vadSensitivity !== undefined &&
        (vadSensitivity < 0 || vadSensitivity > 1)
      ) {
        return res
          .status(400)
          .json({ error: "vadSensitivity must be between 0 and 1" });
      }
      if (
        minImportanceThreshold !== undefined &&
        (minImportanceThreshold < 0 || minImportanceThreshold > 1)
      ) {
        return res
          .status(400)
          .json({ error: "minImportanceThreshold must be between 0 and 1" });
      }
      if (
        speakerConfidenceThreshold !== undefined &&
        (speakerConfidenceThreshold < 0 || speakerConfidenceThreshold > 1)
      ) {
        return res.status(400).json({
          error: "speakerConfidenceThreshold must be between 0 and 1",
        });
      }

      const settings = await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: {
          ...(continuousListeningEnabled !== undefined && {
            continuousListeningEnabled,
          }),
          ...(wakeWord !== undefined && { wakeWord }),
          ...(wakeWordSensitivity !== undefined && { wakeWordSensitivity }),
          ...(minImportanceThreshold !== undefined && {
            minImportanceThreshold,
          }),
          ...(silenceDetectionMs !== undefined && { silenceDetectionMs }),
          ...(vadSensitivity !== undefined && { vadSensitivity }),
          ...(speakerConfidenceThreshold !== undefined && {
            speakerConfidenceThreshold,
          }),
          ...(autoDeleteAudioAfterProcess !== undefined && {
            autoDeleteAudioAfterProcess,
          }),
          ...(notifyOnMemoryStored !== undefined && { notifyOnMemoryStored }),
          ...(notifyOnCommandDetected !== undefined && {
            notifyOnCommandDetected,
          }),
          ...(metadataWithTheme !== undefined && {
            metadata: metadataWithTheme,
          }),
        },
        create: {
          userId: req.userId,
          ...(continuousListeningEnabled !== undefined && {
            continuousListeningEnabled,
          }),
          ...(wakeWord !== undefined && { wakeWord }),
          ...(wakeWordSensitivity !== undefined && { wakeWordSensitivity }),
          ...(minImportanceThreshold !== undefined && {
            minImportanceThreshold,
          }),
          ...(silenceDetectionMs !== undefined && { silenceDetectionMs }),
          ...(vadSensitivity !== undefined && { vadSensitivity }),
          ...(speakerConfidenceThreshold !== undefined && {
            speakerConfidenceThreshold,
          }),
          ...(autoDeleteAudioAfterProcess !== undefined && {
            autoDeleteAudioAfterProcess,
          }),
          ...(notifyOnMemoryStored !== undefined && { notifyOnMemoryStored }),
          ...(notifyOnCommandDetected !== undefined && {
            notifyOnCommandDetected,
          }),
          ...(metadataWithTheme !== undefined && {
            metadata: metadataWithTheme,
          }),
        },
      });

      // Update active listening session if settings changed
      await continuousListeningManager.updateSessionConfig(req.userId);

      res.json(settings);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/user-settings/test-wake-word
 * Test if a text matches the wake word
 */
app.post(
  "/api/user-settings/test-wake-word",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "text is required" });
      }

      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.userId },
      });

      const wakeWord = settings?.wakeWord || "Hey Brain";
      const normalizedText = text.toLowerCase().trim();
      const normalizedWakeWord = wakeWord.toLowerCase().trim();

      const matches = normalizedText.startsWith(normalizedWakeWord);
      const remainingText = matches
        ? text
            .slice(normalizedWakeWord.length)
            .trim()
            .replace(/^[,.:;!?\s]+/, "")
        : text;

      res.json({
        matches,
        wakeWord,
        remainingText,
        originalText: text,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==================== User Profile Routes ====================

import {
  getUserProfile as getUserProfileData,
  updateUserProfile,
  mergeUserProfile,
  deleteProfileFields,
  UserProfile,
} from "./user-profile.js";

/**
 * GET /api/user-profile
 * Get user's profile (structural information)
 */
app.get(
  "/api/user-profile",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const profile = await getUserProfileData(req.userId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/user-profile
 * Update user's profile (full replacement)
 */
app.put(
  "/api/user-profile",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const profile: UserProfile = req.body;
      const updatedProfile = await updateUserProfile(req.userId, profile);
      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/user-profile
 * Merge updates into user's profile (partial update)
 */
app.patch(
  "/api/user-profile",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const updates: Partial<UserProfile> = req.body;
      const updatedProfile = await mergeUserProfile(req.userId, updates);
      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/user-profile/fields
 * Delete specific fields from user's profile
 */
app.delete(
  "/api/user-profile/fields",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { fields } = req.body;
      if (!fields || !Array.isArray(fields)) {
        return res.status(400).json({ error: "fields array is required" });
      }

      const updatedProfile = await deleteProfileFields(
        req.userId,
        fields as (keyof UserProfile)[],
      );
      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  },
);

// SPA fallback: serve index.html for all non-API routes
// This must come AFTER all API route definitions
if (process.env.NODE_ENV === "production") {
  app.get("*", (req: Request, res: Response) => {
    // Don't serve index.html for API routes or static files
    if (req.path.startsWith("/api/") || req.path.match(/\.[^/]*$/)) {
      return res.status(404).json({ error: "Not found" });
    }
    // Serve index.html for SPA routing
    const indexPath = new URL("../../../dist/index.html", import.meta.url)
      .pathname;
    res.sendFile(indexPath);
  });
}

/**
 * Initialize and start the API server
 */
export async function startServer(port: number = 3000) {
  try {
    // Validate environment before starting
    validateEnvironment();

    // Test database connection
    await prisma.$connect();
    console.log("✓ Database connected");

    // Initialize training processor service with embedding service
    const trainingProcessor = new TrainingProcessorService(
      speakerRecognitionService,
    );

    try {
      // Initialize embedding service (downloads model on first run)
      await trainingProcessor.initialize();
      console.log("✓ Embedding service initialized");
    } catch (error) {
      console.warn(
        "⚠️  Embedding service initialization failed:",
        error instanceof Error ? error.message : String(error),
      );
      console.warn("Training will use fallback mock embeddings");
    }

    trainingProcessor.startProcessor(5000); // Process every 5 seconds
    console.log("✓ Training processor started");

    // Start the scheduler for background tasks
    schedulerService.start();
    console.log("✓ Scheduler service started");

    // Start the model recovery service for automatic blacklist recovery
    modelRecoveryService.start();
    console.log("✓ Model recovery service started");

    // Initialize user scheduled tasks service
    await scheduledTaskService.initialize();
    console.log("✓ User scheduled tasks service initialized");

    // Initialize long-running task service (recover interrupted tasks)
    const { longRunningTaskService } =
      await import("./tools/long-running-task.service.js");
    await longRunningTaskService.initialize();
    console.log("✓ Long Running Task service initialized");

    // Process any missing embeddings on startup (runs in background)
    // Wait 45 seconds for Weaviate and embedding services to be fully ready
    const EMBEDDING_STARTUP_DELAY_MS = 45000;
    console.log(
      `⏳ Waiting ${EMBEDDING_STARTUP_DELAY_MS / 1000}s before starting embedding processing...`,
    );
    setTimeout(() => {
      embeddingSchedulerService
        .processAllMissingEmbeddings()
        .then((result) => {
          if (result.totalProcessed > 0) {
            console.log(
              `✓ Startup embedding processing: ${result.successful}/${result.totalProcessed} memories indexed`,
            );
          }
        })
        .catch((error) => {
          console.warn("⚠ Startup embedding processing failed:", error);
        });
    }, EMBEDDING_STARTUP_DELAY_MS);

    // Start Telegram polling for all users with configured bots
    try {
      await telegramService.startAllPolling();
      console.log("✓ Telegram polling service started");
    } catch (error) {
      console.warn(
        "⚠️  Telegram polling initialization failed:",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Create HTTP server
    const httpServer: HttpServer = createServer(app);

    // Initialize WebSocket server for continuous listening
    const wss = new WebSocketServer({
      server: httpServer,
      path: "/ws/continuous-listen",
    });

    setupWebSocketServer(wss);
    console.log("✓ WebSocket server initialized at /ws/continuous-listen");

    // Initialize WebSocket server for notifications
    const notificationWss = new WebSocketServer({
      server: httpServer,
      path: "/ws/notifications",
    });

    setupNotificationWebSocketServer(notificationWss);
    console.log(
      "✓ WebSocket notification server initialized at /ws/notifications",
    );

    // Setup graceful shutdown
    const gracefulShutdown = async () => {
      console.log("\n🛑 Starting graceful shutdown...");

      // Stop Telegram polling
      telegramService.stopAllPolling();
      console.log("✓ Telegram polling stopped");

      // Stop continuous listening
      await continuousListeningManager.stopAll();
      console.log("✓ Continuous listening stopped");

      // Close HTTP server
      httpServer.close(() => {
        console.log("✓ HTTP server closed");
        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        console.error("⚠️ Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);

    // Start server
    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`✓ API server running on http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

/**
 * Setup WebSocket server for continuous listening
 */
function setupWebSocketServer(wss: WebSocketServer): void {
  const JWT_SECRET =
    process.env.JWT_SECRET || "your-secret-key-change-in-production";

  // Track connections per user
  const userConnections = new Map<string, WebSocket>();

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    console.log("WebSocket connection attempt...");

    // Extract token from query string
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      console.log("WebSocket connection rejected: no token");
      ws.close(4001, "Authentication required");
      return;
    }

    // Verify token
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch (error) {
      console.log("WebSocket connection rejected: invalid token");
      ws.close(4002, "Invalid token");
      return;
    }

    console.log(`✓ WebSocket connected for user ${userId}`);

    // Close existing connection if any
    const existingConn = userConnections.get(userId);
    if (existingConn) {
      existingConn.close(4003, "New connection established");
    }
    userConnections.set(userId, ws);

    // Register with broadcast service for system-wide notifications
    wsBroadcastService.registerConnection(userId, ws);

    // Start continuous listening session
    let session;
    try {
      session = await continuousListeningManager.startSession(userId);
    } catch (error) {
      console.error("Failed to start listening session:", error);
      ws.close(4004, "Failed to start session");
      return;
    }

    // Send initial state
    ws.send(
      JSON.stringify({
        type: "session_started",
        timestamp: Date.now(),
        data: { state: session.getState() },
      }),
    );

    // Forward session events to WebSocket
    session.on("vad_status", (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "vad_status", timestamp: Date.now(), data }),
        );
      }
    });

    session.on("speaker_status", (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "speaker_status",
            timestamp: Date.now(),
            data,
          }),
        );
      }
    });

    session.on("transcript", (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "transcript", timestamp: Date.now(), data }),
        );
      }
    });

    session.on("command_detected", (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "command_detected",
            timestamp: Date.now(),
            data,
          }),
        );
      }
    });

    session.on("memory_stored", (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "memory_stored",
            timestamp: Date.now(),
            data,
          }),
        );
      }
    });

    session.on("error", (error) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "error",
            timestamp: Date.now(),
            data: {
              message: error instanceof Error ? error.message : String(error),
            },
          }),
        );
      }
    });

    // Handle incoming audio chunks
    ws.on("message", async (data: Buffer | string) => {
      try {
        // Handle binary audio data
        if (Buffer.isBuffer(data)) {
          await session.processAudioChunk({
            data,
            timestamp: Date.now(),
            sampleRate: 16000,
          });
          return;
        }

        // Handle JSON messages
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case "audio_chunk":
            // Base64 encoded audio
            const audioBuffer = Buffer.from(message.data, "base64");
            await session.processAudioChunk({
              data: audioBuffer,
              timestamp: message.timestamp || Date.now(),
              sampleRate: message.sampleRate || 16000,
            });
            break;

          case "config_update":
            // User updated settings
            await continuousListeningManager.updateSessionConfig(userId);
            ws.send(
              JSON.stringify({ type: "config_updated", timestamp: Date.now() }),
            );
            break;

          case "stop":
            // Stop session
            await continuousListeningManager.stopSession(userId);
            ws.send(
              JSON.stringify({
                type: "session_stopped",
                timestamp: Date.now(),
              }),
            );
            break;

          case "ping":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            break;

          default:
            console.warn("Unknown WebSocket message type:", message.type);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "error",
              timestamp: Date.now(),
              data: { message: "Failed to process message" },
            }),
          );
        }
      }
    });

    // Handle disconnection
    ws.on("close", async () => {
      console.log(`WebSocket disconnected for user ${userId}`);
      userConnections.delete(userId);
      wsBroadcastService.removeConnection(userId);
      await continuousListeningManager.stopSession(userId);
    });

    ws.on("error", (error: Error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    });
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("Shutting down WebSocket server...");
    await continuousListeningManager.stopAll();
    wss.close();
  });
}

/**
 * Setup WebSocket server for notifications
 */
function setupNotificationWebSocketServer(wss: WebSocketServer): void {
  const JWT_SECRET =
    process.env.JWT_SECRET || "your-secret-key-change-in-production";

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    console.log("Notification WebSocket connection attempt...");

    // Extract token from query string
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      console.log("Notification WebSocket connection rejected: no token");
      ws.close(4001, "Authentication required");
      return;
    }

    // Verify token
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch (error) {
      console.log("Notification WebSocket connection rejected: invalid token");
      ws.close(4002, "Invalid token");
      return;
    }

    console.log(`✓ Notification WebSocket connected for user ${userId}`);

    // Register with broadcast service
    wsBroadcastService.registerConnection(userId, ws);

    // Send acknowledgement
    ws.send(
      JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
        data: { userId },
      }),
    );

    // Handle incoming messages (ping/pong, etc)
    ws.on("message", (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch (error) {
        console.error("Error processing notification message:", error);
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      console.log(`Notification WebSocket disconnected for user ${userId}`);
      wsBroadcastService.removeConnection(userId);
    });

    ws.on("error", (error: Error) => {
      console.error(`Notification WebSocket error for user ${userId}:`, error);
    });
  });
}

export default app;
// Start the server when this file is run directly
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
startServer(PORT);
