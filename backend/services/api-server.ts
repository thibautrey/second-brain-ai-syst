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
import { audioUploadService } from "./audio-upload.js";
import { speakerRecognitionService } from "./speaker-recognition.js";
import { VoiceTrainingController } from "../controllers/input-ingestion.controller.js";
import { TrainingProcessorService } from "./training-processor.js";

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

// ==================== Health Check ====================

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

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
  }
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
        tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
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
        isArchived: req.query.isArchived === "true" ? true : req.query.isArchived === "false" ? false : undefined,
        isPinned: req.query.isPinned === "true" ? true : req.query.isPinned === "false" ? false : undefined,
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
  }
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
  }
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
  }
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
  }
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
  }
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
  }
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
  }
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
  }
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
  }
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
  }
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

      if (!input.content || !input.timeScale || !input.periodStart || !input.periodEnd) {
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
  }
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
  }
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
  }
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
  }
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
      const summary = await updateSummary(req.userId, req.params.summaryId, input);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
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
  }
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

    // Start server
    app.listen(port, "0.0.0.0", () => {
      console.log(`✓ API server running on http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

export default app;
// Start the server when this file is run directly
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
startServer(PORT);
