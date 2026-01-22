/**
 * Speaker Recognition Service
 *
 * Supports multiple speaker identification strategies:
 * - Option A: SpeechBrain ECAPA-TDNN
 * - Option B: WeSpeaker
 * - Option C: pyannote.audio (with diarization)
 * - Option D: Resemblyzer
 */

export enum SpeakerRecognitionModel {
  ECAPA_TDNN = "ecapa-tdnn",
  WESPEAKER = "wespeaker",
  PYANNOTE = "pyannote",
  RESEMBLYZER = "resemblyzer",
}

export interface SpeakerProfile {
  speaker_id: string;
  name: string;
  enrollment_date: Date;
  embeddings: SpeakerEmbedding[];
  centroid_embedding: number[];
  model_version: string;
  confidence_scores: {
    mean: number;
    std: number;
    min: number;
    max: number;
  };
  metadata?: Record<string, any>;
}

export interface SpeakerEmbedding {
  embedding: number[];
  source: string; // e.g., "daily_note_20260122"
  timestamp: Date;
  confidence?: number;
}

export interface SpeakerRecognitionConfig {
  model: SpeakerRecognitionModel;
  threshold_high: number; // 0.85 for ECAPA
  threshold_low: number; // 0.70 for ECAPA
  window_seconds: number; // How much audio to embed (e.g., 3)
  use_vad: boolean; // Voice Activity Detection
  use_diarization: boolean; // For multi-speaker scenarios
  multi_speaker_mode: boolean;
  device: "cpu" | "gpu" | "auto";
}

export interface SpeakerMatch {
  speaker_id: string;
  confidence: number;
  method: "confirmed" | "uncertain" | "unknown";
  similarity_score: number;
  threshold_used: number;
  details?: {
    diarization_cluster?: string;
    segment_count?: number;
  };
}

export interface DiarizationResult {
  segments: DiarizationSegment[];
  num_speakers: number;
}

export interface DiarizationSegment {
  start_time: number;
  end_time: number;
  speaker_label: string;
  embedding?: number[];
  confidence?: number;
}

/**
 * Main Speaker Recognition Service
 */
export class SpeakerRecognitionService {
  private profiles: Map<string, SpeakerProfile> = new Map();
  private config: SpeakerRecognitionConfig;

  constructor(config: SpeakerRecognitionConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Enroll a new speaker
   * Store multiple audio samples and compute centroid embedding
   */
  async enrollSpeaker(
    speaker_id: string,
    name: string,
    audioSamples: Buffer[],
    sampleRate: number = 16000,
  ): Promise<SpeakerProfile> {
    if (audioSamples.length < 3) {
      throw new Error("Require at least 3 audio samples for enrollment");
    }

    const embeddings: SpeakerEmbedding[] = [];

    // Extract embedding from each sample
    for (let i = 0; i < audioSamples.length; i++) {
      const embedding = await this.extractEmbedding(
        audioSamples[i],
        sampleRate,
      );
      embeddings.push({
        embedding,
        source: `enrollment_sample_${i + 1}`,
        timestamp: new Date(),
      });
    }

    // Compute centroid
    const centroid = this.computeCentroid(embeddings.map((e) => e.embedding));

    // Calculate confidence metrics
    const similarities = this.computePairwiseSimilarities(
      embeddings.map((e) => e.embedding),
    );

    const profile: SpeakerProfile = {
      speaker_id,
      name,
      enrollment_date: new Date(),
      embeddings,
      centroid_embedding: centroid,
      model_version: this.config.model,
      confidence_scores: {
        mean: similarities.mean,
        std: similarities.std,
        min: similarities.min,
        max: similarities.max,
      },
    };

    this.profiles.set(speaker_id, profile);
    return profile;
  }

  /**
   * Identify speaker from audio
   * Returns match confidence and classification
   */
  async identifySpeaker(
    audioData: Buffer,
    sampleRate: number = 16000,
  ): Promise<SpeakerMatch> {
    // Extract embedding from input audio
    const inputEmbedding = await this.extractEmbedding(audioData, sampleRate);

    let bestMatch: SpeakerMatch | null = null;
    let bestSimilarity = -1;

    // Compare against all enrolled speakers
    for (const [speaker_id, profile] of this.profiles) {
      const similarity = this.cosineSimilarity(
        inputEmbedding,
        profile.centroid_embedding,
      );

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = {
          speaker_id,
          similarity_score: similarity,
          confidence: this.confidenceFromSimilarity(similarity),
          threshold_used: this.config.threshold_high,
          method: this.classifyMatch(similarity),
        };
      }
    }

    if (!bestMatch) {
      return {
        speaker_id: "unknown",
        confidence: 0,
        method: "unknown",
        similarity_score: 0,
        threshold_used: this.config.threshold_high,
      };
    }

    return bestMatch;
  }

  /**
   * Identify speaker with diarization (multi-speaker support)
   * Segments audio by speaker and identifies each
   */
  async identifySpeakerWithDiarization(
    audioData: Buffer,
    sampleRate: number = 16000,
  ): Promise<{
    diarization: DiarizationResult;
    matches: Map<string, SpeakerMatch>;
    target_speaker_found: boolean;
  }> {
    // Perform diarization
    const diarization = await this.diarizeAudio(audioData, sampleRate);

    const matches = new Map<string, SpeakerMatch>();
    let targetFound = false;

    // Identify speaker for each segment
    for (const segment of diarization.segments) {
      if (!segment.embedding) {
        // Extract embedding if not already present
        const segmentAudio = audioData.slice(
          Math.floor(segment.start_time * sampleRate * 2),
          Math.floor(segment.end_time * sampleRate * 2),
        );
        segment.embedding = await this.extractEmbedding(
          segmentAudio,
          sampleRate,
        );
      }

      // Find best match
      let bestSpeaker = "unknown";
      let bestScore = -1;

      for (const profile of this.profiles.values()) {
        const similarity = this.cosineSimilarity(
          segment.embedding,
          profile.centroid_embedding,
        );
        if (similarity > bestScore && similarity > this.config.threshold_high) {
          bestScore = similarity;
          bestSpeaker = profile.speaker_id;
          targetFound = true;
        }
      }

      if (!matches.has(bestSpeaker)) {
        matches.set(bestSpeaker, {
          speaker_id: bestSpeaker,
          similarity_score: bestScore,
          confidence: this.confidenceFromSimilarity(bestScore),
          threshold_used: this.config.threshold_high,
          method: this.classifyMatch(bestScore),
          details: {
            segment_count: diarization.segments.length,
          },
        });
      }
    }

    return {
      diarization,
      matches,
      target_speaker_found: targetFound,
    };
  }

  /**
   * Update speaker profile with new samples
   * Useful for incremental enrollment
   */
  async updateSpeakerProfile(
    speaker_id: string,
    newAudioSample: Buffer,
    sampleRate: number = 16000,
  ): Promise<SpeakerProfile> {
    const profile = this.profiles.get(speaker_id);
    if (!profile) {
      throw new Error(`Speaker profile not found: ${speaker_id}`);
    }

    // Extract embedding
    const newEmbedding = await this.extractEmbedding(
      newAudioSample,
      sampleRate,
    );

    // Add to profile
    profile.embeddings.push({
      embedding: newEmbedding,
      source: `update_${new Date().toISOString()}`,
      timestamp: new Date(),
    });

    // Recompute centroid
    profile.centroid_embedding = this.computeCentroid(
      profile.embeddings.map((e) => e.embedding),
    );

    // Update confidence scores
    const similarities = this.computePairwiseSimilarities(
      profile.embeddings.map((e) => e.embedding),
    );
    profile.confidence_scores = {
      mean: similarities.mean,
      std: similarities.std,
      min: similarities.min,
      max: similarities.max,
    };

    return profile;
  }

  /**
   * Delete speaker profile
   */
  deleteSpeakerProfile(speaker_id: string): void {
    this.profiles.delete(speaker_id);
  }

  /**
   * Get speaker profile
   */
  getSpeakerProfile(speaker_id: string): SpeakerProfile | undefined {
    return this.profiles.get(speaker_id);
  }

  /**
   * List all speaker profiles
   */
  listSpeakerProfiles(): SpeakerProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Export profiles for backup
   */
  exportProfiles(): Record<string, SpeakerProfile> {
    const exported: Record<string, SpeakerProfile> = {};
    for (const [id, profile] of this.profiles) {
      exported[id] = profile;
    }
    return exported;
  }

  /**
   * Import profiles from backup
   */
  importProfiles(profiles: Record<string, SpeakerProfile>): void {
    for (const [id, profile] of Object.entries(profiles)) {
      this.profiles.set(id, profile);
    }
  }

  // ==================== Private Methods ====================

  /**
   * Extract embedding from audio
   * This would delegate to the specific model implementation
   */
  private async extractEmbedding(
    audioData: Buffer,
    sampleRate: number,
  ): Promise<number[]> {
    // Placeholder - would call actual model based on config.model
    switch (this.config.model) {
      case SpeakerRecognitionModel.ECAPA_TDNN:
        return this.extractEmbeddingECAPATDNN(audioData, sampleRate);
      case SpeakerRecognitionModel.WESPEAKER:
        return this.extractEmbeddingWeSpeaker(audioData, sampleRate);
      case SpeakerRecognitionModel.PYANNOTE:
        return this.extractEmbeddingPyannote(audioData, sampleRate);
      case SpeakerRecognitionModel.RESEMBLYZER:
        return this.extractEmbeddingResembyzer(audioData, sampleRate);
      default:
        throw new Error(`Unknown model: ${this.config.model}`);
    }
  }

  private async extractEmbeddingECAPATDNN(
    audioData: Buffer,
    sampleRate: number,
  ): Promise<number[]> {
    // TODO: Integrate with SpeechBrain ECAPA-TDNN
    // from speechbrain.pretrained import SpeakerRecognition
    return new Array(192).fill(0).map(() => Math.random()); // Placeholder
  }

  private async extractEmbeddingWeSpeaker(
    audioData: Buffer,
    sampleRate: number,
  ): Promise<number[]> {
    // TODO: Integrate with WeSpeaker
    return new Array(256).fill(0).map(() => Math.random()); // Placeholder
  }

  private async extractEmbeddingPyannote(
    audioData: Buffer,
    sampleRate: number,
  ): Promise<number[]> {
    // TODO: Integrate with pyannote.audio
    return new Array(512).fill(0).map(() => Math.random()); // Placeholder
  }

  private async extractEmbeddingResembyzer(
    audioData: Buffer,
    sampleRate: number,
  ): Promise<number[]> {
    // TODO: Integrate with Resemblyzer
    return new Array(256).fill(0).map(() => Math.random()); // Placeholder
  }

  /**
   * Diarization - identify who spoke when
   */
  private async diarizeAudio(
    audioData: Buffer,
    sampleRate: number,
  ): Promise<DiarizationResult> {
    // TODO: Integrate with pyannote.audio
    // from pyannote.audio import Pipeline
    return {
      segments: [
        {
          start_time: 0,
          end_time: 5,
          speaker_label: "speaker_0",
          confidence: 0.95,
        },
      ],
      num_speakers: 1,
    };
  }

  /**
   * Cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have same dimension");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Compute centroid of multiple embeddings
   */
  private computeCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error("No embeddings to compute centroid");
    }

    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }

  /**
   * Compute pairwise similarities
   */
  private computePairwiseSimilarities(embeddings: number[][]): {
    mean: number;
    std: number;
    min: number;
    max: number;
  } {
    const similarities: number[] = [];

    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const sim = this.cosineSimilarity(embeddings[i], embeddings[j]);
        similarities.push(sim);
      }
    }

    const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const variance =
      similarities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      similarities.length;
    const std = Math.sqrt(variance);

    return {
      mean,
      std,
      min: Math.min(...similarities),
      max: Math.max(...similarities),
    };
  }

  /**
   * Classify match based on similarity score
   */
  private classifyMatch(
    similarity: number,
  ): "confirmed" | "uncertain" | "unknown" {
    if (similarity >= this.config.threshold_high) {
      return "confirmed";
    }
    if (similarity >= this.config.threshold_low) {
      return "uncertain";
    }
    return "unknown";
  }

  /**
   * Convert similarity score to confidence (0-1)
   */
  private confidenceFromSimilarity(similarity: number): number {
    // Map similarity score to 0-1 confidence
    // Assuming similarity is in range [0, 1]
    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.threshold_high < this.config.threshold_low) {
      throw new Error("threshold_high must be >= threshold_low");
    }
    if (this.config.threshold_high > 1 || this.config.threshold_high < 0) {
      throw new Error("threshold_high must be between 0 and 1");
    }
    if (this.config.window_seconds < 1) {
      throw new Error("window_seconds must be at least 1");
    }
  }
}
