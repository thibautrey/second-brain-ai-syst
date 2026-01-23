import { AuthRequest, authMiddleware } from "../middlewares/auth.middleware.js";
import express, { Express, NextFunction, Request, Response } from "express";
import {
  getUserProfile,
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
import { audioUploadService } from "./audio-upload.js";
import { speakerRecognitionService } from "./speaker-recognition.js";
import { VoiceTrainingController } from "../controllers/input-ingestion.controller.js";
import { chatStream } from "../controllers/chat.controller.js";
import { TrainingProcessorService } from "./training-processor.js";
import { memorySearchService } from "./memory-search.js";
import { continuousListeningManager } from "./continuous-listening.js";
import { schedulerService } from "./scheduler.js";
import { backgroundAgentService } from "./background-agents.js";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, Server as HttpServer, IncomingMessage } from "http";
import jwt from "jsonwebtoken";

import cors from "cors";
import prisma from "./prisma.js";
import multer from "multer";

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
app.use(cors());
app.use(express.json());

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

// ==================== Health Check ====================

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

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
      } = req.body;

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

/**
 * Initialize and start the API server
 */
export async function startServer(port: number = 3000) {
  try {
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

    // Create HTTP server
    const httpServer: HttpServer = createServer(app);

    // Initialize WebSocket server for continuous listening
    const wss = new WebSocketServer({
      server: httpServer,
      path: "/ws/continuous-listen",
    });

    setupWebSocketServer(wss);
    console.log("✓ WebSocket server initialized at /ws/continuous-listen");

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
  const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

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

export default app;
// Start the server when this file is run directly
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
startServer(PORT);
