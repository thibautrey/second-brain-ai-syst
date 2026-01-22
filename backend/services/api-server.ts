import { AuthRequest, authMiddleware } from "../middlewares/auth.middleware.js";
import express, { Express, NextFunction, Request, Response } from "express";
import {
  getUserProfile,
  signin,
  signup,
} from "../controllers/auth.controller.js";
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

// ==================== Health Check ====================

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

/**
 * Initialize and start the API server
 */
export async function startServer(port: number = 3000) {
  try {
    // Test database connection
    await prisma.$connect();
    console.log("✓ Database connected");

    // Start training processor service
    const trainingProcessor = new TrainingProcessorService(
      speakerRecognitionService,
    );
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
