/**
 * Audio Storage Service
 *
 * Handles local filesystem storage of audio files for voice training.
 * Designed to work with Docker volumes for easy container persistence.
 */

import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

export interface AudioFileMetadata {
  id: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
}

export interface AudioStorageConfig {
  basePath: string; // Base directory for audio storage
  maxFileSizeMB: number;
  allowedMimeTypes: string[];
}

const DEFAULT_CONFIG: AudioStorageConfig = {
  basePath: process.env.AUDIO_STORAGE_PATH || "/app/data/audio",
  maxFileSizeMB: 50,
  allowedMimeTypes: [
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/mp3",
    "audio/mpeg",
    "audio/ogg",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/flac",
    "audio/mp4",
  ],
};

export class AudioStorageService {
  private config: AudioStorageConfig;

  constructor(config: Partial<AudioStorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    await this.ensureDirectory(this.config.basePath);
    await this.ensureDirectory(path.join(this.config.basePath, "samples"));
    await this.ensureDirectory(path.join(this.config.basePath, "temp"));
    console.log(`✓ Audio storage initialized at ${this.config.basePath}`);
  }

  /**
   * Check if a MIME type is allowed (handles codecs in MIME type)
   */
  private isAllowedMimeType(mimeType: string): boolean {
    // Check exact match first
    if (this.config.allowedMimeTypes.includes(mimeType)) {
      return true;
    }
    // Check base MIME type (without codecs)
    const baseMimeType = mimeType.split(";")[0].trim();
    return this.config.allowedMimeTypes.some(
      (allowed) =>
        allowed === baseMimeType ||
        allowed.split(";")[0].trim() === baseMimeType,
    );
  }

  /**
   * Store an audio file from base64 data
   */
  async storeFromBase64(
    base64Data: string,
    userId: string,
    originalName: string,
    mimeType: string,
  ): Promise<AudioFileMetadata> {
    // Validate mime type
    if (!this.isAllowedMimeType(mimeType)) {
      throw new Error(`Unsupported audio format: ${mimeType}`);
    }

    // Decode base64
    const buffer = Buffer.from(base64Data, "base64");

    // Check file size
    const fileSizeMB = buffer.length / (1024 * 1024);
    if (fileSizeMB > this.config.maxFileSizeMB) {
      throw new Error(
        `File too large: ${fileSizeMB.toFixed(2)}MB (max: ${this.config.maxFileSizeMB}MB)`,
      );
    }

    // Generate unique file ID and path
    const fileId = randomUUID();
    const extension = this.getExtensionFromMimeType(mimeType);
    const fileName = `${fileId}${extension}`;

    // Create user-specific directory
    const userDir = path.join(this.config.basePath, "samples", userId);
    await this.ensureDirectory(userDir);

    const storagePath = path.join(userDir, fileName);

    // Write file
    await fs.writeFile(storagePath, buffer);

    return {
      id: fileId,
      originalName,
      storagePath,
      mimeType,
      fileSizeBytes: buffer.length,
    };
  }

  /**
   * Store an audio file from Buffer
   */
  async storeFromBuffer(
    buffer: Buffer,
    userId: string,
    originalName: string,
    mimeType: string,
  ): Promise<AudioFileMetadata> {
    // Validate mime type
    if (!this.isAllowedMimeType(mimeType)) {
      throw new Error(`Unsupported audio format: ${mimeType}`);
    }

    // Check file size
    const fileSizeMB = buffer.length / (1024 * 1024);
    if (fileSizeMB > this.config.maxFileSizeMB) {
      throw new Error(
        `File too large: ${fileSizeMB.toFixed(2)}MB (max: ${this.config.maxFileSizeMB}MB)`,
      );
    }

    // Generate unique file ID and path
    const fileId = randomUUID();
    const extension = this.getExtensionFromMimeType(mimeType);
    const fileName = `${fileId}${extension}`;

    // Create user-specific directory
    const userDir = path.join(this.config.basePath, "samples", userId);
    await this.ensureDirectory(userDir);

    const storagePath = path.join(userDir, fileName);

    // Write file
    await fs.writeFile(storagePath, buffer);

    return {
      id: fileId,
      originalName,
      storagePath,
      mimeType,
      fileSizeBytes: buffer.length,
    };
  }

  /**
   * Read an audio file
   */
  async readFile(storagePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(storagePath);
    } catch (error) {
      throw new Error(`Failed to read audio file: ${storagePath}`);
    }
  }

  /**
   * Read an audio file as base64
   */
  async readFileAsBase64(storagePath: string): Promise<string> {
    const buffer = await this.readFile(storagePath);
    return buffer.toString("base64");
  }

  /**
   * Delete an audio file
   */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      await fs.unlink(storagePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * Delete all audio files for a user
   */
  async deleteUserFiles(userId: string): Promise<void> {
    const userDir = path.join(this.config.basePath, "samples", userId);
    try {
      await fs.rm(userDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(
    storagePath: string,
  ): Promise<{ size: number; created: Date; modified: Date }> {
    const stats = await fs.stat(storagePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
    };
  }

  /**
   * Check if file exists
   */
  async fileExists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(storagePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage usage for a user
   */
  async getUserStorageUsage(userId: string): Promise<{
    totalFiles: number;
    totalBytes: number;
  }> {
    const userDir = path.join(this.config.basePath, "samples", userId);

    try {
      const files = await fs.readdir(userDir);
      let totalBytes = 0;

      for (const file of files) {
        const filePath = path.join(userDir, file);
        const stats = await fs.stat(filePath);
        totalBytes += stats.size;
      }

      return {
        totalFiles: files.length,
        totalBytes,
      };
    } catch (error) {
      // Directory doesn't exist = no usage
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { totalFiles: 0, totalBytes: 0 };
      }
      throw error;
    }
  }

  // ==================== Private Methods ====================

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    // Remove codec info (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const baseMimeType = mimeType.split(";")[0].trim();

    const mimeToExt: Record<string, string> = {
      "audio/wav": ".wav",
      "audio/wave": ".wav",
      "audio/x-wav": ".wav",
      "audio/mp3": ".mp3",
      "audio/mpeg": ".mp3",
      "audio/ogg": ".ogg",
      "audio/webm": ".webm",
      "audio/flac": ".flac",
      "audio/mp4": ".mp4",
    };
    return mimeToExt[baseMimeType] || ".audio";
  }
}

// Singleton instance
export const audioStorage = new AudioStorageService();
