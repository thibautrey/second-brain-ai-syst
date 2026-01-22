/**
 * Input Ingestion Controllers
 *
 * REST API endpoints for:
 * - Text input processing
 * - Audio stream management
 * - Audio batch submission
 * - Speaker profile management
 */

import { NextFunction, Request, Response } from "express";
import {
  SpeakerRecognitionConfig,
  SpeakerRecognitionService,
} from "../services/speaker-recognition";

import { InputIngestionService } from "../services/input-ingestion";

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
