/**
 * Audio Upload Service
 *
 * Generic service for handling audio file uploads via HTTP.
 * Supports both base64 and multipart form data.
 * Integrates with audio storage and database for voice training.
 */

import { Request } from "express";
import { randomUUID } from "crypto";
import { audioStorage, AudioFileMetadata } from "./audio-storage.js";
import prisma from "./prisma.js";
import { SpeakerProfile, VoiceSample } from "@prisma/client";

export interface UploadedAudioSample {
  voiceSample: VoiceSample;
  audioMetadata: AudioFileMetadata;
}

export interface AudioUploadOptions {
  speakerProfileId?: string;
  phraseText?: string;
  phraseCategory?: string;
  language?: string; // ISO 639-1 language code (e.g., "en", "fr", "es")
  autoProcess?: boolean;
}

export class AudioUploadService {
  /**
   * Handle audio upload from base64 data
   */
  async uploadFromBase64(
    base64Data: string,
    userId: string,
    originalName: string,
    mimeType: string,
    options: AudioUploadOptions = {},
  ): Promise<UploadedAudioSample> {
    // Validate and get or create speaker profile
    let speakerProfileId = options.speakerProfileId;
    if (speakerProfileId) {
      const profile = await prisma.speakerProfile.findUnique({
        where: { id: speakerProfileId, userId },
      });
      if (!profile) {
        // Auto-create the speaker profile if it doesn't exist
        // This handles the case where the frontend generates a profile ID
        // but it hasn't been created in the database yet
        const newProfile = await prisma.speakerProfile.create({
          data: {
            id: speakerProfileId,
            userId,
            name: `Profile (${new Date().toLocaleString()})`,
            identificationMethod: "manual",
            confidence: 1.0,
          },
        });
        speakerProfileId = newProfile.id;
      }
    } else {
      // Create default speaker profile if none exists
      const defaultProfile = await prisma.speakerProfile.findFirst({
        where: { userId, name: "Default" },
      });

      if (!defaultProfile) {
        const newProfile = await prisma.speakerProfile.create({
          data: {
            userId,
            name: "Default",
            identificationMethod: "manual",
            confidence: 1.0,
          },
        });
        speakerProfileId = newProfile.id;
      } else {
        speakerProfileId = defaultProfile.id;
      }
    }

    // Store the audio file
    const audioMetadata = await audioStorage.storeFromBase64(
      base64Data,
      userId,
      originalName,
      mimeType,
    );

    // Create voice sample record in database
    const voiceSample = await prisma.voiceSample.create({
      data: {
        speakerProfileId: speakerProfileId!,
        storagePath: audioMetadata.storagePath,
        originalName: audioMetadata.originalName,
        mimeType: audioMetadata.mimeType,
        fileSizeBytes: audioMetadata.fileSizeBytes,
        durationSeconds: audioMetadata.durationSeconds || 0,
        phraseText: options.phraseText,
        phraseCategory: options.phraseCategory,
        language: options.language || "en",
        status: options.autoProcess ? "pending" : "uploaded",
      },
    });

    return {
      voiceSample,
      audioMetadata,
    };
  }

  /**
   * Handle audio upload from Express request (multipart form data)
   */
  async uploadFromRequest(
    req: Request,
    userId: string,
    options: AudioUploadOptions = {},
  ): Promise<UploadedAudioSample> {
    if (!req.file) {
      throw new Error("No audio file provided in request");
    }

    const file = req.file;
    const base64Data = file.buffer.toString("base64");

    return this.uploadFromBase64(
      base64Data,
      userId,
      file.originalname,
      file.mimetype,
      options,
    );
  }

  /**
   * Get all voice samples for a user
   */
  async getUserVoiceSamples(
    userId: string,
    speakerProfileId?: string,
  ): Promise<VoiceSample[]> {
    const whereClause: any = {
      speakerProfile: {
        userId,
      },
    };

    if (speakerProfileId) {
      whereClause.speakerProfileId = speakerProfileId;
    }

    return prisma.voiceSample.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        speakerProfile: true,
      },
    });
  }

  /**
   * Delete a voice sample
   */
  async deleteVoiceSample(sampleId: string, userId: string): Promise<void> {
    // Get sample to verify ownership and get storage path
    const sample = await prisma.voiceSample.findUnique({
      where: { id: sampleId },
      include: {
        speakerProfile: true,
      },
    });

    if (!sample) {
      throw new Error(`Voice sample not found: ${sampleId}`);
    }

    if (sample.speakerProfile.userId !== userId) {
      throw new Error("Unauthorized: Sample belongs to another user");
    }

    // Delete from storage
    await audioStorage.deleteFile(sample.storagePath);

    // Delete from database
    await prisma.voiceSample.delete({
      where: { id: sampleId },
    });
  }

  /**
   * Get voice sample by ID
   */
  async getVoiceSample(
    sampleId: string,
    userId: string,
  ): Promise<VoiceSample | null> {
    const sample = await prisma.voiceSample.findUnique({
      where: { id: sampleId },
      include: {
        speakerProfile: true,
      },
    });

    if (!sample || sample.speakerProfile.userId !== userId) {
      return null;
    }

    return sample;
  }

  /**
   * Get audio file content as base64
   */
  async getAudioFileBase64(sampleId: string, userId: string): Promise<string> {
    const sample = await this.getVoiceSample(sampleId, userId);
    if (!sample) {
      throw new Error(`Voice sample not found or unauthorized: ${sampleId}`);
    }

    return audioStorage.readFileAsBase64(sample.storagePath);
  }
}

// Singleton instance
export const audioUploadService = new AudioUploadService();
