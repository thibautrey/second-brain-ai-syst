/**
 * Input Ingestion Controllers
 *
 * REST API endpoints for:
 * - Text input processing
 * - Audio stream management
 * - Audio batch submission
 * - Speaker profile management
 * - Voice training & sample management
 */

import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import {
  SpeakerRecognitionConfig,
  SpeakerRecognitionService,
} from "../services/speaker-recognition.js";

import { InputIngestionService } from "../services/input-ingestion.js";
import { audioUploadService } from "../services/audio-upload.js";
import { audioStorage } from "../services/audio-storage.js";
import prisma from "../services/prisma.js";

export class InputIngestionController {
  constructor(
    private ingestionService: InputIngestionService,
    private speakerService: SpeakerRecognitionService,
  ) {}

  /**
   * POST /api/input/text
   * Process text input
   */
  async processTextInput(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { content, speaker_id, metadata } = req.body;

      if (!content || typeof content !== "string") {
        res
          .status(400)
          .json({ error: "Content is required and must be a string" });
        return;
      }

      const processed = await this.ingestionService.processTextInput({
        content,
        speaker_id,
        metadata,
      });

      res.status(200).json({
        success: true,
        input: processed,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/input/audio-stream/start
   * Initialize audio stream
   */
  async startAudioStream(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        sample_rate = 16000,
        channels = 1,
        encoding = "pcm16",
      } = req.body;

      const processor = this.ingestionService.startAudioStream({
        sample_rate,
        channels,
        encoding: encoding as any,
      });

      res.status(200).json({
        success: true,
        stream_id: processor.id,
        message:
          "Audio stream initialized. Start sending chunks via WebSocket or subsequent requests.",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/input/audio-batch
   * Submit audio batch/chunk
   */
  async submitAudioBatch(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { chunk_id, sequence_number, audio_data, is_final } = req.body;

      if (!chunk_id || sequence_number === undefined || !audio_data) {
        res.status(400).json({
          error: "chunk_id, sequence_number, and audio_data are required",
        });
        return;
      }

      // Convert base64 audio_data to Buffer
      const buffer = Buffer.from(audio_data, "base64");

      const result = await this.ingestionService.processAudioBatch({
        chunk_id,
        sequence_number,
        audio_data: buffer,
        is_final: is_final || false,
        timestamp: new Date(),
      });

      if (result) {
        res.status(200).json({
          success: true,
          completed: true,
          input: result,
        });
      } else {
        res.status(202).json({
          success: true,
          completed: false,
          message:
            "Audio batch chunk received. Waiting for more chunks or final signal.",
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/input/:input_id
   * Retrieve processed input
   */
  async getProcessedInput(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { input_id } = req.params;

      const input = this.ingestionService.getProcessedInput(input_id);

      if (!input) {
        res.status(404).json({ error: "Input not found" });
        return;
      }

      res.status(200).json({
        success: true,
        input,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/input
   * List processed inputs with filtering
   */
  async listProcessedInputs(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { format, status } = req.query;

      const inputs = this.ingestionService.getAllProcessedInputs({
        format: format as any,
        status: status as any,
      });

      res.status(200).json({
        success: true,
        count: inputs.length,
        inputs,
      });
    } catch (error) {
      next(error);
    }
  }
}

export class SpeakerManagementController {
  constructor(private speakerService: SpeakerRecognitionService) {}

  /**
   * POST /api/speakers/enroll
   * Enroll a new speaker
   */
  async enrollSpeaker(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { speaker_id, name, audio_samples, sample_rate = 16000 } = req.body;

      if (
        !speaker_id ||
        !name ||
        !audio_samples ||
        !Array.isArray(audio_samples)
      ) {
        res.status(400).json({
          error: "speaker_id, name, and audio_samples (array) are required",
        });
        return;
      }

      // Convert base64 samples to Buffers
      const buffers = audio_samples.map((sample: string) =>
        Buffer.from(sample, "base64"),
      );

      const profile = await this.speakerService.enrollSpeaker(
        speaker_id,
        name,
        buffers,
        sample_rate,
      );

      res.status(201).json({
        success: true,
        profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/speakers/identify
   * Identify speaker from audio
   */
  async identifySpeaker(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        audio_data,
        sample_rate = 16000,
        use_diarization = false,
      } = req.body;

      if (!audio_data) {
        res.status(400).json({ error: "audio_data is required" });
        return;
      }

      const buffer = Buffer.from(audio_data, "base64");

      let result: any;

      if (use_diarization) {
        result = await this.speakerService.identifySpeakerWithDiarization(
          buffer,
          sample_rate,
        );
      } else {
        result = await this.speakerService.identifySpeaker(buffer, sample_rate);
      }

      res.status(200).json({
        success: true,
        result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/speakers/:speaker_id/update
   * Update speaker profile with new sample
   */
  async updateSpeakerProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { speaker_id } = req.params;
      const { audio_data, sample_rate = 16000 } = req.body;

      if (!audio_data) {
        res.status(400).json({ error: "audio_data is required" });
        return;
      }

      const buffer = Buffer.from(audio_data, "base64");

      const profile = await this.speakerService.updateSpeakerProfile(
        speaker_id,
        buffer,
        sample_rate,
      );

      res.status(200).json({
        success: true,
        profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/speakers/:speaker_id
   * Get speaker profile
   */
  async getSpeakerProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { speaker_id } = req.params;

      const profile = this.speakerService.getSpeakerProfile(speaker_id);

      if (!profile) {
        res.status(404).json({ error: "Speaker profile not found" });
        return;
      }

      res.status(200).json({
        success: true,
        profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/speakers
   * List all speaker profiles
   */
  async listSpeakerProfiles(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const profiles = this.speakerService.listSpeakerProfiles();

      res.status(200).json({
        success: true,
        count: profiles.length,
        profiles,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/speakers/:speaker_id
   * Delete speaker profile
   */
  async deleteSpeakerProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { speaker_id } = req.params;

      this.speakerService.deleteSpeakerProfile(speaker_id);

      res.status(200).json({
        success: true,
        message: `Speaker profile deleted: ${speaker_id}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/speakers/export
   * Export speaker profiles
   */
  async exportProfiles(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const profiles = this.speakerService.exportProfiles();

      res.status(200).json({
        success: true,
        profiles,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/speakers/import
   * Import speaker profiles
   */
  async importProfiles(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { profiles } = req.body;

      if (!profiles || typeof profiles !== "object") {
        res.status(400).json({ error: "profiles object is required" });
        return;
      }

      this.speakerService.importProfiles(profiles);

      res.status(200).json({
        success: true,
        message: `Imported ${Object.keys(profiles).length} speaker profiles`,
      });
    } catch (error) {
      next(error);
    }
  }
}

/**
 * Voice Training Controller
 *
 * Manages voice sample uploads, training sessions, and model generation
 * for speaker enrollment and recognition
 */
export class VoiceTrainingController {
  /**
   * GET /api/speaker-profiles
   * List all speaker profiles for current user
   */
  async listSpeakerProfiles(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const profiles = await prisma.speakerProfile.findMany({
        where: { userId: req.userId },
        include: {
          voiceSamples: {
            select: {
              id: true,
              phraseText: true,
              phraseCategory: true,
              status: true,
              durationSeconds: true,
              createdAt: true,
            },
          },
          trainingSessions: {
            select: {
              id: true,
              status: true,
              progress: true,
              confidenceScore: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.status(200).json({
        success: true,
        count: profiles.length,
        profiles,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/speaker-profiles
   * Create a new speaker profile
   */
  async createSpeakerProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { name } = req.body;

      if (!name || typeof name !== "string") {
        res.status(400).json({ error: "Profile name is required" });
        return;
      }

      const profile = await prisma.speakerProfile.create({
        data: {
          userId: req.userId,
          name: name.trim(),
          identificationMethod: "manual",
          confidence: 1.0,
        },
      });

      res.status(201).json({
        success: true,
        profile,
        message: "Speaker profile created",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/speaker-profiles/:profileId
   * Get a specific speaker profile with samples
   */
  async getSpeakerProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const profile = await prisma.speakerProfile.findUnique({
        where: { id: profileId },
        include: {
          voiceSamples: {
            select: {
              id: true,
              phraseText: true,
              phraseCategory: true,
              status: true,
              durationSeconds: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          trainingSessions: {
            select: {
              id: true,
              status: true,
              progress: true,
              confidenceScore: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!profile || profile.userId !== req.userId) {
        res.status(404).json({ error: "Speaker profile not found" });
        return;
      }

      res.status(200).json({
        success: true,
        profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/speaker-profiles/:profileId
   * Delete a speaker profile and all associated data
   */
  async deleteSpeakerProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      // Verify profile belongs to user
      const profile = await prisma.speakerProfile.findUnique({
        where: { id: profileId },
        include: {
          voiceSamples: true,
        },
      });

      if (!profile || profile.userId !== req.userId) {
        res.status(404).json({ error: "Speaker profile not found" });
        return;
      }

      // Delete associated voice sample files from storage
      for (const sample of profile.voiceSamples) {
        try {
          await audioStorage.deleteFile(sample.storagePath);
        } catch (err) {
          console.warn(
            `Failed to delete voice sample file: ${sample.storagePath}`,
            err,
          );
        }
      }

      // Delete profile (cascade will delete related records)
      await prisma.speakerProfile.delete({
        where: { id: profileId },
      });

      res.status(200).json({
        success: true,
        message: "Speaker profile deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/training/samples
   * Upload a voice sample for training
   */
  async uploadVoiceSample(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { speakerProfileId, phraseText, phraseCategory } = req.body;

      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      // Use audio upload service
      const uploaded = await audioUploadService.uploadFromRequest(
        req,
        req.userId,
        {
          speakerProfileId,
          phraseText,
          phraseCategory,
        },
      );

      res.status(201).json({
        success: true,
        voiceSample: uploaded.voiceSample,
        message: "Voice sample uploaded successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/training/samples
   * List voice samples for a speaker profile
   */
  async listVoiceSamples(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { speakerProfileId } = req.query;

      const samples = await audioUploadService.getUserVoiceSamples(
        req.userId,
        speakerProfileId as string | undefined,
      );

      res.status(200).json({
        success: true,
        count: samples.length,
        samples,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/training/samples/:sampleId
   * Delete a voice sample
   */
  async deleteVoiceSample(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { sampleId } = req.params;

      await audioUploadService.deleteVoiceSample(sampleId, req.userId);

      res.status(200).json({
        success: true,
        message: `Voice sample deleted: ${sampleId}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/training/start
   * Start a training session for a speaker profile
   */
  async startTrainingSession(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { speakerProfileId } = req.body;

      if (!speakerProfileId) {
        res.status(400).json({ error: "speakerProfileId is required" });
        return;
      }

      // Verify speaker profile belongs to user
      const speakerProfile = await prisma.speakerProfile.findUnique({
        where: { id: speakerProfileId },
        include: { voiceSamples: true },
      });

      if (!speakerProfile || speakerProfile.userId !== req.userId) {
        res.status(404).json({ error: "Speaker profile not found" });
        return;
      }

      if (speakerProfile.voiceSamples.length === 0) {
        res
          .status(400)
          .json({ error: "No voice samples available for training" });
        return;
      }

      // Create training session
      const trainingSession = await prisma.trainingSession.create({
        data: {
          speakerProfileId,
          modelType: "ecapa-tdnn",
          sampleCount: speakerProfile.voiceSamples.length,
          totalDuration: speakerProfile.voiceSamples.reduce(
            (sum, sample) => sum + sample.durationSeconds,
            0,
          ),
          status: "pending",
          progress: 0,
        },
      });

      res.status(201).json({
        success: true,
        trainingSession,
        message: "Training session started",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/training/status/:sessionId
   * Get the status of a training session
   */
  async getTrainingStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { sessionId } = req.params;

      const session = await prisma.trainingSession.findUnique({
        where: { id: sessionId },
        include: { speakerProfile: true },
      });

      if (!session || session.speakerProfile.userId !== req.userId) {
        res.status(404).json({ error: "Training session not found" });
        return;
      }

      res.status(200).json({
        success: true,
        trainingSession: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/training/active
   * Get active training sessions for the current user
   */
  async getActiveTrainingSessions(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

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

      res.status(200).json({
        success: true,
        activeTrainingSessions: sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/training/samples/:sampleId
   * Get a specific voice sample
   */
  async getVoiceSample(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { sampleId } = req.params;

      const sample = await audioUploadService.getVoiceSample(
        sampleId,
        req.userId,
      );

      if (!sample) {
        res.status(404).json({ error: "Voice sample not found" });
        return;
      }

      res.status(200).json({
        success: true,
        sample,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/training/verify/:profileId
   * Verify voice against an enrolled speaker profile
   */
  async verifyVoice(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      // Get speaker profile with centroid embedding
      const profile = await prisma.speakerProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile || profile.userId !== req.userId) {
        res.status(404).json({ error: "Speaker profile not found" });
        return;
      }

      if (!profile.isEnrolled || !profile.centroidEmbedding) {
        res.status(400).json({
          error: "Profile is not enrolled. Please train the profile first.",
        });
        return;
      }

      // Save the uploaded audio temporarily and extract embedding
      const { getEmbeddingService } =
        await import("../services/embedding-wrapper.js");
      const embeddingService = await getEmbeddingService();

      // Store audio in shared volume for processing
      const fs = await import("fs/promises");
      const path = await import("path");
      const audioStoragePath =
        process.env.AUDIO_STORAGE_PATH || "/app/data/audio";
      const tempDir = path.join(audioStoragePath, "temp");

      // Ensure temp directory exists
      await fs.mkdir(tempDir, { recursive: true }).catch(() => {});

      const tempPath = path.join(
        tempDir,
        `verify-${Date.now()}-${Math.random().toString(36).substring(7)}.webm`,
      );
      await fs.writeFile(tempPath, req.file.buffer);

      try {
        // Extract embedding from the uploaded audio
        const testEmbedding = await embeddingService.extractEmbedding(tempPath);

        // Compute cosine similarity between test embedding and centroid
        const centroidEmbedding = profile.centroidEmbedding as number[];
        const similarity = this.cosineSimilarity(
          testEmbedding,
          centroidEmbedding,
        );

        // Convert similarity to confidence (threshold-based)
        const confidence = Math.max(0, Math.min(1, (similarity + 1) / 2)); // Normalize from [-1,1] to [0,1]
        const recognized = similarity >= 0.6; // Threshold for recognition

        res.status(200).json({
          success: true,
          verification: {
            recognized,
            confidence,
            similarity,
            profileId,
            profileName: profile.name,
          },
        });
      } finally {
        // Clean up temp file
        await fs.unlink(tempPath).catch(() => {});
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
}
