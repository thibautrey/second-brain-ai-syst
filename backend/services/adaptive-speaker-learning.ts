/**
 * Adaptive Speaker Learning Service
 *
 * Enables the speaker detection system to improve over time by:
 * 1. Carefully admitting high-confidence audio samples to the profile
 * 2. Building negative examples from low-confidence (non-user) audio
 * 3. Monitoring profile health to prevent degradation
 * 4. Supporting rollback if quality drops
 *
 * Key Principles:
 * - Conservative admission: Better to miss opportunities than pollute profile
 * - Multi-stage validation: Audio quality + confidence + cross-validation
 * - Bounded growth: Profile never grows unboundedly
 * - Full reversibility: All changes can be undone
 */

import prisma from "./prisma.js";

// ==================== Types & Interfaces ====================

export interface AdaptiveLearningConfig {
  // Gate thresholds
  audioQuality: {
    minDurationSeconds: number;
    maxDurationSeconds: number;
    minSignalToNoiseDb: number;
    maxClippingPercent: number;
    minEnergyConsistency: number;
  };

  confidence: {
    admissionThreshold: number; // Very conservative (0.85+)
    crossValidationMin: number; // Must match existing samples (0.80+)
    mediumZoneUpper: number; // Below this = uncertain
    mediumZoneLower: number; // Below this = negative example
    negativeExampleThreshold: number; // Confident it's NOT user
  };

  profile: {
    maxAdaptiveSamples: number; // Bounded growth
    minSamplesBeforeAdaptive: number; // Need baseline first
    decayHalfLifeDays: number; // Old samples fade
    updateCooldownMinutes: number; // Rate limit
  };

  health: {
    varianceThreshold: number; // Max acceptable variance
    healthCheckIntervalHours: number;
    autoFreezeHealthThreshold: number;
    minSamplesForHealthCheck: number;
  };
}

export interface AudioQualityResult {
  isAcceptable: boolean;
  score: number;
  metrics: {
    durationSeconds: number;
    signalToNoiseDb: number;
    clippingPercent: number;
    energyConsistency: number;
    peakAmplitude: number;
    hasMultipleSpeakers: boolean;
  };
  rejectionReason?: string;
}

export interface CrossValidationResult {
  isConsistent: boolean;
  score: number;
  outlierScore: number;
  details: {
    similaritiesWithExisting: number[];
    medianSimilarity: number;
    minSimilarity: number;
    maxSimilarity: number;
  };
}

export interface AdmissionResult {
  accepted: boolean;
  reason: string;
  sampleId?: string;
  newCentroid?: number[];
  profileHealth?: number;
  details?: {
    similarity: number;
    audioQuality: number;
    crossValidation: number;
  };
}

export interface HealthCheckResult {
  healthScore: number;
  metrics: {
    intraClassVariance: number;
    sampleCount: number;
    adaptiveSampleCount: number;
    averageQuality: number;
    ageDistribution: { recent: number; medium: number; old: number };
    interClassSeparation?: number;
  };
  recommendations: string[];
  shouldFreeze: boolean;
  trend: "improving" | "stable" | "degrading";
}

export interface AdaptiveLearningStatus {
  enabled: boolean;
  profileId: string;
  profileHealth: number;
  isFrozen: boolean;
  frozenReason?: string;
  totalAdaptiveSamples: number;
  totalNegativeExamples: number;
  lastUpdate?: Date;
  config: AdaptiveLearningConfig;
}

// ==================== Default Configuration ====================

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveLearningConfig = {
  audioQuality: {
    minDurationSeconds: 1.5,
    maxDurationSeconds: 10.0,
    minSignalToNoiseDb: 15,
    maxClippingPercent: 0.01,
    minEnergyConsistency: 0.7,
  },
  confidence: {
    admissionThreshold: 0.85,
    crossValidationMin: 0.8,
    mediumZoneUpper: 0.85,
    mediumZoneLower: 0.65,
    negativeExampleThreshold: 0.5,
  },
  profile: {
    maxAdaptiveSamples: 100,
    minSamplesBeforeAdaptive: 10,
    decayHalfLifeDays: 30,
    updateCooldownMinutes: 5,
  },
  health: {
    varianceThreshold: 0.15,
    healthCheckIntervalHours: 24,
    autoFreezeHealthThreshold: 0.5,
    minSamplesForHealthCheck: 5,
  },
};

// ==================== Audio Quality Analyzer ====================

export class AudioQualityAnalyzer {
  private config: AdaptiveLearningConfig;

  constructor(config: AdaptiveLearningConfig = DEFAULT_ADAPTIVE_CONFIG) {
    this.config = config;
  }

  /**
   * Analyze audio quality to determine if it's suitable for profile training
   */
  async analyze(
    audioBuffer: Buffer,
    sampleRate: number = 16000
  ): Promise<AudioQualityResult> {
    const samples = this.bufferToFloat32(audioBuffer);
    const durationSeconds = samples.length / sampleRate;

    // Check duration
    if (durationSeconds < this.config.audioQuality.minDurationSeconds) {
      return {
        isAcceptable: false,
        score: 0,
        metrics: this.computeMetrics(samples, sampleRate),
        rejectionReason: `Audio too short: ${durationSeconds.toFixed(2)}s < ${this.config.audioQuality.minDurationSeconds}s`,
      };
    }

    if (durationSeconds > this.config.audioQuality.maxDurationSeconds) {
      return {
        isAcceptable: false,
        score: 0,
        metrics: this.computeMetrics(samples, sampleRate),
        rejectionReason: `Audio too long: ${durationSeconds.toFixed(2)}s > ${this.config.audioQuality.maxDurationSeconds}s (may have multiple speakers)`,
      };
    }

    const metrics = this.computeMetrics(samples, sampleRate);

    // Check clipping
    if (metrics.clippingPercent > this.config.audioQuality.maxClippingPercent) {
      return {
        isAcceptable: false,
        score: 0.2,
        metrics,
        rejectionReason: `Audio has clipping: ${(metrics.clippingPercent * 100).toFixed(2)}% > ${(this.config.audioQuality.maxClippingPercent * 100).toFixed(2)}%`,
      };
    }

    // Check SNR
    if (metrics.signalToNoiseDb < this.config.audioQuality.minSignalToNoiseDb) {
      return {
        isAcceptable: false,
        score: 0.3,
        metrics,
        rejectionReason: `Audio too noisy: SNR ${metrics.signalToNoiseDb.toFixed(1)}dB < ${this.config.audioQuality.minSignalToNoiseDb}dB`,
      };
    }

    // Check energy consistency
    if (
      metrics.energyConsistency < this.config.audioQuality.minEnergyConsistency
    ) {
      return {
        isAcceptable: false,
        score: 0.4,
        metrics,
        rejectionReason: `Inconsistent volume: ${(metrics.energyConsistency * 100).toFixed(0)}% < ${(this.config.audioQuality.minEnergyConsistency * 100).toFixed(0)}%`,
      };
    }

    // Compute overall quality score
    const score = this.computeQualityScore(metrics);

    return {
      isAcceptable: true,
      score,
      metrics,
    };
  }

  private computeMetrics(
    samples: Float32Array,
    sampleRate: number
  ): AudioQualityResult["metrics"] {
    const durationSeconds = samples.length / sampleRate;

    // Compute peak amplitude and clipping
    let maxAmplitude = 0;
    let clippedSamples = 0;
    const clippingThreshold = 0.99;

    for (const sample of samples) {
      const abs = Math.abs(sample);
      if (abs > maxAmplitude) maxAmplitude = abs;
      if (abs > clippingThreshold) clippedSamples++;
    }

    // Estimate SNR using energy in speech vs silence regions
    const signalToNoiseDb = this.estimateSNR(samples, sampleRate);

    // Compute energy consistency across windows
    const energyConsistency = this.computeEnergyConsistency(samples, sampleRate);

    return {
      durationSeconds,
      signalToNoiseDb,
      clippingPercent: clippedSamples / samples.length,
      energyConsistency,
      peakAmplitude: maxAmplitude,
      hasMultipleSpeakers: false, // Would need diarization to determine
    };
  }

  private estimateSNR(samples: Float32Array, sampleRate: number): number {
    // Divide into frames
    const frameSize = Math.floor(sampleRate * 0.025); // 25ms frames
    const hopSize = Math.floor(frameSize / 2);
    const frameCount =
      Math.floor((samples.length - frameSize) / hopSize) + 1;

    const frameEnergies: number[] = [];

    for (let i = 0; i < frameCount; i++) {
      const start = i * hopSize;
      const end = Math.min(start + frameSize, samples.length);
      let energy = 0;
      for (let j = start; j < end; j++) {
        energy += samples[j] * samples[j];
      }
      frameEnergies.push(energy / (end - start));
    }

    // Sort energies to find speech vs silence
    const sortedEnergies = [...frameEnergies].sort((a, b) => a - b);
    const noiseFloor =
      sortedEnergies[Math.floor(sortedEnergies.length * 0.1)] || 1e-10;
    const signalLevel =
      sortedEnergies[Math.floor(sortedEnergies.length * 0.9)] || 1e-10;

    // Convert to dB
    const snrDb = 10 * Math.log10(signalLevel / Math.max(noiseFloor, 1e-10));

    return Math.max(0, Math.min(60, snrDb)); // Clamp to reasonable range
  }

  private computeEnergyConsistency(
    samples: Float32Array,
    sampleRate: number
  ): number {
    // Divide into ~500ms windows
    const windowSize = Math.floor(sampleRate * 0.5);
    const windowCount = Math.floor(samples.length / windowSize);

    if (windowCount < 2) return 1.0;

    const windowEnergies: number[] = [];

    for (let i = 0; i < windowCount; i++) {
      const start = i * windowSize;
      const end = start + windowSize;
      let energy = 0;
      for (let j = start; j < end; j++) {
        energy += samples[j] * samples[j];
      }
      windowEnergies.push(Math.sqrt(energy / windowSize));
    }

    // Filter out silent windows
    const threshold = Math.max(...windowEnergies) * 0.1;
    const speechWindows = windowEnergies.filter((e) => e > threshold);

    if (speechWindows.length < 2) return 0.5;

    // Compute coefficient of variation
    const mean =
      speechWindows.reduce((a, b) => a + b, 0) / speechWindows.length;
    const variance =
      speechWindows.reduce((a, b) => a + (b - mean) ** 2, 0) /
      speechWindows.length;
    const cv = Math.sqrt(variance) / mean;

    // Convert to 0-1 scale (lower CV = more consistent)
    return Math.max(0, Math.min(1, 1 - cv));
  }

  private computeQualityScore(metrics: AudioQualityResult["metrics"]): number {
    // Weighted combination of factors
    const durationScore = Math.min(1, metrics.durationSeconds / 3.0);
    const snrScore = Math.min(1, metrics.signalToNoiseDb / 30);
    const clippingScore = 1 - metrics.clippingPercent * 100;
    const consistencyScore = metrics.energyConsistency;

    return (
      durationScore * 0.2 +
      snrScore * 0.3 +
      clippingScore * 0.2 +
      consistencyScore * 0.3
    );
  }

  private bufferToFloat32(buffer: Buffer): Float32Array {
    // Assuming PCM16 little-endian
    const samples = new Float32Array(buffer.length / 2);
    for (let i = 0; i < samples.length; i++) {
      const sample = buffer.readInt16LE(i * 2);
      samples[i] = sample / 32768.0;
    }
    return samples;
  }
}

// ==================== Cross Validator ====================

export class CrossValidator {
  private config: AdaptiveLearningConfig;

  constructor(config: AdaptiveLearningConfig = DEFAULT_ADAPTIVE_CONFIG) {
    this.config = config;
  }

  /**
   * Validate that a new embedding is consistent with existing samples
   */
  async validate(
    newEmbedding: number[],
    existingSamples: Array<{ embedding: unknown }>,
    centroid: number[]
  ): Promise<CrossValidationResult> {
    if (existingSamples.length === 0) {
      // No existing samples - just check against centroid
      const centroidSimilarity = this.cosineSimilarity(newEmbedding, centroid);
      return {
        isConsistent:
          centroidSimilarity >= this.config.confidence.crossValidationMin,
        score: centroidSimilarity,
        outlierScore: 0,
        details: {
          similaritiesWithExisting: [],
          medianSimilarity: centroidSimilarity,
          minSimilarity: centroidSimilarity,
          maxSimilarity: centroidSimilarity,
        },
      };
    }

    // Compute similarity with each existing sample
    const similarities: number[] = [];
    for (const sample of existingSamples) {
      const sampleEmbedding = sample.embedding as number[];
      const similarity = this.cosineSimilarity(newEmbedding, sampleEmbedding);
      similarities.push(similarity);
    }

    // Sort for statistics
    const sorted = [...similarities].sort((a, b) => a - b);
    const medianSimilarity = sorted[Math.floor(sorted.length / 2)];
    const minSimilarity = sorted[0];
    const maxSimilarity = sorted[sorted.length - 1];

    // Compute outlier score: how far is this from the median of intra-sample similarities?
    const intraClassSimilarities =
      this.computeIntraClassSimilarities(existingSamples);
    const avgIntraClass =
      intraClassSimilarities.reduce((a, b) => a + b, 0) /
      intraClassSimilarities.length;

    const outlierScore = Math.abs(medianSimilarity - avgIntraClass);

    // Determine if consistent
    const isConsistent =
      medianSimilarity >= this.config.confidence.crossValidationMin &&
      outlierScore < 0.15; // Not too different from intra-class

    return {
      isConsistent,
      score: medianSimilarity,
      outlierScore,
      details: {
        similaritiesWithExisting: similarities,
        medianSimilarity,
        minSimilarity,
        maxSimilarity,
      },
    };
  }

  private computeIntraClassSimilarities(
    samples: Array<{ embedding: unknown }>
  ): number[] {
    const similarities: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      for (let j = i + 1; j < samples.length; j++) {
        const sim = this.cosineSimilarity(
          samples[i].embedding as number[],
          samples[j].embedding as number[]
        );
        similarities.push(sim);
      }
    }
    return similarities.length > 0 ? similarities : [1.0];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }
}

// ==================== Adaptive Profile Updater ====================

export class AdaptiveProfileUpdater {
  private config: AdaptiveLearningConfig;
  private qualityAnalyzer: AudioQualityAnalyzer;
  private crossValidator: CrossValidator;

  constructor(config: AdaptiveLearningConfig = DEFAULT_ADAPTIVE_CONFIG) {
    this.config = config;
    this.qualityAnalyzer = new AudioQualityAnalyzer(config);
    this.crossValidator = new CrossValidator(config);
  }

  /**
   * Attempt to add a sample to the profile
   * Returns detailed result about acceptance/rejection
   */
  async attemptUpdate(
    profileId: string,
    embedding: number[],
    audioBuffer: Buffer,
    similarity: number,
    sourceInfo: { type: string; sessionId?: string }
  ): Promise<AdmissionResult> {
    // 1. Get profile and check if adaptive learning is enabled
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
      include: {
        adaptiveSamples: {
          where: { isActive: true },
          orderBy: { admittedAt: "desc" },
        },
        voiceSamples: {
          where: { status: "completed" },
        },
      },
    });

    if (!profile) {
      return { accepted: false, reason: "Profile not found" };
    }

    if (!profile.adaptiveLearningEnabled) {
      return {
        accepted: false,
        reason: "Adaptive learning not enabled for this profile",
      };
    }

    if (profile.isFrozen) {
      return {
        accepted: false,
        reason: `Profile is frozen: ${profile.frozenReason || "Health degradation"}`,
      };
    }

    // 2. Check cooldown
    if (profile.lastAdaptiveUpdate) {
      const cooldownMs = this.config.profile.updateCooldownMinutes * 60 * 1000;
      const timeSinceLastUpdate =
        Date.now() - profile.lastAdaptiveUpdate.getTime();
      if (timeSinceLastUpdate < cooldownMs) {
        return {
          accepted: false,
          reason: `Cooldown active: ${Math.ceil((cooldownMs - timeSinceLastUpdate) / 1000 / 60)} minutes remaining`,
        };
      }
    }

    // 3. Check minimum samples requirement
    const totalSamples =
      profile.voiceSamples.length + profile.adaptiveSamples.length;
    if (totalSamples < this.config.profile.minSamplesBeforeAdaptive) {
      return {
        accepted: false,
        reason: `Insufficient baseline: ${totalSamples} samples < ${this.config.profile.minSamplesBeforeAdaptive} minimum`,
      };
    }

    // 4. Analyze audio quality
    const qualityResult = await this.qualityAnalyzer.analyze(audioBuffer);
    if (!qualityResult.isAcceptable) {
      return {
        accepted: false,
        reason: `Audio quality rejected: ${qualityResult.rejectionReason}`,
        details: {
          similarity,
          audioQuality: qualityResult.score,
          crossValidation: 0,
        },
      };
    }

    // 5. Check confidence threshold
    if (similarity < this.config.confidence.admissionThreshold) {
      return {
        accepted: false,
        reason: `Similarity too low: ${(similarity * 100).toFixed(1)}% < ${(this.config.confidence.admissionThreshold * 100).toFixed(1)}%`,
        details: {
          similarity,
          audioQuality: qualityResult.score,
          crossValidation: 0,
        },
      };
    }

    // 6. Cross-validation with existing samples
    const existingEmbeddings = [
      ...(profile.voiceSamples as Array<{ embedding: unknown }>)
        .filter((s): s is { embedding: number[] } => s.embedding != null && Array.isArray(s.embedding))
        .map((s) => ({
          embedding: s.embedding as number[],
        })),
      ...(profile.adaptiveSamples as Array<{ embedding: unknown }>)
        .filter((s): s is { embedding: number[] } => s.embedding != null && Array.isArray(s.embedding))
        .map((s) => ({
          embedding: s.embedding as number[],
        })),
    ];

    const centroid = profile.centroidEmbedding as number[];
    const crossValidation = await this.crossValidator.validate(
      embedding,
      existingEmbeddings,
      centroid
    );

    if (!crossValidation.isConsistent) {
      return {
        accepted: false,
        reason: `Failed cross-validation: median similarity ${(crossValidation.score * 100).toFixed(1)}% < ${(this.config.confidence.crossValidationMin * 100).toFixed(1)}%`,
        details: {
          similarity,
          audioQuality: qualityResult.score,
          crossValidation: crossValidation.score,
        },
      };
    }

    // 7. Create snapshot before update
    await this.createSnapshot(profile, "before_adaptive_update");

    // 8. Add the adaptive sample
    const adaptiveSample = await prisma.adaptiveSample.create({
      data: {
        speakerProfileId: profileId,
        sourceType: sourceInfo.type,
        sourceSessionId: sourceInfo.sessionId,
        embedding: embedding,
        durationSeconds: qualityResult.metrics.durationSeconds,
        audioQualityScore: qualityResult.score,
        admissionSimilarity: similarity,
        crossValidationScore: crossValidation.score,
        contributionWeight: 0.5, // New samples start with lower weight
      },
    });

    // 9. Prune excess samples if needed
    await this.pruneExcessSamples(profileId);

    // 10. Apply time decay and recompute centroid
    await this.applyTimeDecay(profileId);
    const newCentroid = await this.computeWeightedCentroid(profileId);

    // 11. Update profile
    await prisma.speakerProfile.update({
      where: { id: profileId },
      data: {
        centroidEmbedding: newCentroid,
        lastAdaptiveUpdate: new Date(),
        adaptiveUpdateCount: { increment: 1 },
      },
    });

    // 12. Run health check
    const healthResult = await this.checkHealth(profileId);

    // 13. Auto-freeze if health is critical
    if (healthResult.shouldFreeze) {
      await prisma.speakerProfile.update({
        where: { id: profileId },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: "Health score dropped below threshold",
          profileHealth: healthResult.healthScore,
        },
      });
    } else {
      await prisma.speakerProfile.update({
        where: { id: profileId },
        data: { profileHealth: healthResult.healthScore },
      });
    }

    console.log(
      `[AdaptiveLearning] Sample admitted to profile ${profileId}: similarity=${(similarity * 100).toFixed(1)}%, quality=${(qualityResult.score * 100).toFixed(1)}%, health=${(healthResult.healthScore * 100).toFixed(1)}%`
    );

    return {
      accepted: true,
      reason: "Sample admitted successfully",
      sampleId: adaptiveSample.id,
      newCentroid,
      profileHealth: healthResult.healthScore,
      details: {
        similarity,
        audioQuality: qualityResult.score,
        crossValidation: crossValidation.score,
      },
    };
  }

  /**
   * Create a snapshot of the current profile state
   */
  private async createSnapshot(
    profile: {
      id: string;
      centroidEmbedding: unknown;
      profileHealth: number;
      voiceSamples: { embedding: unknown }[];
      adaptiveSamples: { id: string }[];
    },
    reason: string
  ): Promise<void> {
    if (!profile.centroidEmbedding) return;

    const variance = await this.computeIntraClassVariance(profile.id);

    await prisma.profileSnapshot.create({
      data: {
        speakerProfileId: profile.id,
        centroid: profile.centroidEmbedding as number[],
        adaptiveSampleIds: profile.adaptiveSamples.map((s) => s.id),
        trainingSampleCount: profile.voiceSamples.length,
        adaptiveSampleCount: profile.adaptiveSamples.length,
        healthScore: profile.profileHealth,
        intraClassVariance: variance,
        reason,
      },
    });
  }

  /**
   * Prune lowest-quality adaptive samples when at capacity
   */
  private async pruneExcessSamples(profileId: string): Promise<void> {
    const samples = await prisma.adaptiveSample.findMany({
      where: { speakerProfileId: profileId, isActive: true },
      orderBy: [{ audioQualityScore: "desc" }, { admittedAt: "desc" }],
    });

    if (samples.length <= this.config.profile.maxAdaptiveSamples) {
      return;
    }

    // Keep best quality samples, remove excess
    const toRemove = samples.slice(this.config.profile.maxAdaptiveSamples);

    await prisma.adaptiveSample.updateMany({
      where: { id: { in: toRemove.map((s) => s.id) } },
      data: { isActive: false },
    });

    console.log(
      `[AdaptiveLearning] Pruned ${toRemove.length} low-quality samples from profile ${profileId}`
    );
  }

  /**
   * Apply exponential time decay to sample weights
   */
  private async applyTimeDecay(profileId: string): Promise<void> {
    const samples = await prisma.adaptiveSample.findMany({
      where: { speakerProfileId: profileId, isActive: true },
    });

    const halfLifeMs =
      this.config.profile.decayHalfLifeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const sample of samples) {
      const age = now - sample.admittedAt.getTime();
      const decayFactor = Math.pow(0.5, age / halfLifeMs);

      await prisma.adaptiveSample.update({
        where: { id: sample.id },
        data: { decayFactor },
      });
    }
  }

  /**
   * Compute weighted centroid from all active samples
   */
  async computeWeightedCentroid(profileId: string): Promise<number[]> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
      include: {
        voiceSamples: {
          where: { status: "completed" },
        },
        adaptiveSamples: {
          where: { isActive: true },
        },
      },
    });

    if (!profile) {
      throw new Error("Profile not found");
    }

    // Training samples get full weight
    const trainingEmbeddings = (profile.voiceSamples as Array<{ embedding: unknown }>)
      .filter((s): s is { embedding: number[] } => s.embedding != null && Array.isArray(s.embedding))
      .map((s) => ({
        embedding: s.embedding as number[],
        weight: 1.0,
      }));

    // Adaptive samples get weighted by quality and decay
    const adaptiveEmbeddings = (profile.adaptiveSamples as Array<{ embedding: unknown; contributionWeight: number; decayFactor: number }>)
      .filter((s): s is { embedding: number[]; contributionWeight: number; decayFactor: number } => s.embedding != null && Array.isArray(s.embedding))
      .map((s) => ({
        embedding: s.embedding as number[],
        weight: s.contributionWeight * s.decayFactor,
      }));

    const allEmbeddings = [...trainingEmbeddings, ...adaptiveEmbeddings];

    if (allEmbeddings.length === 0) {
      return (profile.centroidEmbedding as number[]) || [];
    }

    // Compute weighted average
    const embeddingSize = allEmbeddings[0].embedding.length;
    const centroid = new Array(embeddingSize).fill(0);
    let totalWeight = 0;

    for (const { embedding, weight } of allEmbeddings) {
      for (let i = 0; i < embeddingSize; i++) {
        centroid[i] += embedding[i] * weight;
      }
      totalWeight += weight;
    }

    for (let i = 0; i < embeddingSize; i++) {
      centroid[i] /= totalWeight;
    }

    // Normalize to unit length
    const norm = Math.sqrt(centroid.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < embeddingSize; i++) {
        centroid[i] /= norm;
      }
    }

    return centroid;
  }

  /**
   * Compute intra-class variance (how spread out the samples are)
   */
  async computeIntraClassVariance(profileId: string): Promise<number> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
      include: {
        voiceSamples: {
          where: { status: "completed" },
        },
        adaptiveSamples: {
          where: { isActive: true },
        },
      },
    });

    if (!profile || !profile.centroidEmbedding) return 0;

    const centroid = profile.centroidEmbedding as number[];
    const allEmbeddings = [
      ...(profile.voiceSamples as Array<{ embedding: unknown }>)
        .filter((s): s is { embedding: number[] } => s.embedding != null && Array.isArray(s.embedding))
        .map((s) => s.embedding as number[]),
      ...(profile.adaptiveSamples as Array<{ embedding: unknown }>)
        .filter((s): s is { embedding: number[] } => s.embedding != null && Array.isArray(s.embedding))
        .map((s) => s.embedding as number[]),
    ];

    if (allEmbeddings.length < 2) return 0;

    // Compute average distance from centroid
    let totalDistance = 0;
    for (const embedding of allEmbeddings) {
      const similarity = this.cosineSimilarity(embedding, centroid);
      totalDistance += 1 - similarity; // Convert similarity to distance
    }

    return totalDistance / allEmbeddings.length;
  }

  /**
   * Check profile health
   */
  async checkHealth(profileId: string): Promise<HealthCheckResult> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
      include: {
        voiceSamples: {
          where: { status: "completed" },
        },
        adaptiveSamples: {
          where: { isActive: true },
          orderBy: { admittedAt: "desc" },
        },
        healthLogs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!profile) {
      throw new Error("Profile not found");
    }

    const variance = await this.computeIntraClassVariance(profileId);
    const sampleCount =
      profile.voiceSamples.length + profile.adaptiveSamples.length;
    const adaptiveSampleCount = profile.adaptiveSamples.length;

    // Compute average quality of adaptive samples
    const avgQuality =
      profile.adaptiveSamples.length > 0
        ? (profile.adaptiveSamples as Array<{ audioQualityScore: number }>).reduce(
            (sum: number, s: { audioQualityScore: number }) => sum + s.audioQualityScore,
            0
          ) / profile.adaptiveSamples.length
        : 1.0;

    // Age distribution
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    const ageDistribution = {
      recent: (profile.adaptiveSamples as Array<{ admittedAt: Date }>).filter(
        (s: { admittedAt: Date }) => now - s.admittedAt.getTime() < oneDay
      ).length,
      medium: (profile.adaptiveSamples as Array<{ admittedAt: Date }>).filter(
        (s: { admittedAt: Date }) =>
          now - s.admittedAt.getTime() >= oneDay &&
          now - s.admittedAt.getTime() < oneWeek
      ).length,
      old: (profile.adaptiveSamples as Array<{ admittedAt: Date }>).filter(
        (s: { admittedAt: Date }) => now - s.admittedAt.getTime() >= oneWeek
      ).length,
    };

    // Compute health score
    let healthScore = 1.0;

    // Penalize high variance
    if (variance > this.config.health.varianceThreshold) {
      healthScore -= (variance - this.config.health.varianceThreshold) * 2;
    }

    // Bonus for good quality samples
    healthScore += (avgQuality - 0.7) * 0.2;

    // Clamp to 0-1
    healthScore = Math.max(0, Math.min(1, healthScore));

    // Determine trend from history
    let trend: "improving" | "stable" | "degrading" = "stable";
    if (profile.healthLogs.length >= 2) {
      const recentHealth = profile.healthLogs[0]?.healthScore || healthScore;
      const olderHealth =
        profile.healthLogs[profile.healthLogs.length - 1]?.healthScore ||
        healthScore;

      if (recentHealth - olderHealth > 0.05) trend = "improving";
      else if (olderHealth - recentHealth > 0.05) trend = "degrading";
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (variance > this.config.health.varianceThreshold * 0.8) {
      recommendations.push(
        "Consider removing outlier samples or retraining from scratch"
      );
    }
    if (avgQuality < 0.7) {
      recommendations.push(
        "Audio quality of recent samples is low - check microphone setup"
      );
    }
    if (trend === "degrading") {
      recommendations.push(
        "Profile quality is degrading - consider pausing adaptive learning"
      );
    }

    const shouldFreeze =
      healthScore < this.config.health.autoFreezeHealthThreshold;

    // Log health check
    await prisma.profileHealthLog.create({
      data: {
        speakerProfileId: profileId,
        healthScore,
        intraClassVariance: variance,
        sampleCount,
        adaptiveSampleCount,
        eventType: "after_update",
        recommendations,
      },
    });

    await prisma.speakerProfile.update({
      where: { id: profileId },
      data: { lastHealthCheck: new Date() },
    });

    return {
      healthScore,
      metrics: {
        intraClassVariance: variance,
        sampleCount,
        adaptiveSampleCount,
        averageQuality: avgQuality,
        ageDistribution,
      },
      recommendations,
      shouldFreeze,
      trend,
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }
}

// ==================== Negative Example Manager ====================

export class NegativeExampleManager {
  private config: AdaptiveLearningConfig;

  constructor(config: AdaptiveLearningConfig = DEFAULT_ADAPTIVE_CONFIG) {
    this.config = config;
  }

  /**
   * Store a confident negative example (audio NOT from the user)
   */
  async addNegativeExample(
    userId: string,
    embedding: number[],
    confidence: number,
    sourceSessionId?: string
  ): Promise<{ added: boolean; reason: string }> {
    // Only store if we're confident it's not the user
    if (confidence < 1 - this.config.confidence.negativeExampleThreshold) {
      return {
        added: false,
        reason: `Confidence too low: ${(confidence * 100).toFixed(1)}%`,
      };
    }

    // Check for duplicates (very similar to existing negatives)
    const existingNegatives = await prisma.negativeExample.findMany({
      where: { userId },
      take: 100,
      orderBy: { capturedAt: "desc" },
    });

    for (const existing of existingNegatives) {
      const similarity = this.cosineSimilarity(
        embedding,
        existing.embedding as number[]
      );
      if (similarity > 0.95) {
        // Too similar to existing - skip
        return { added: false, reason: "Duplicate of existing negative example" };
      }
    }

    await prisma.negativeExample.create({
      data: {
        userId,
        embedding,
        confidence,
        sourceSessionId,
      },
    });

    // Limit total stored negatives
    const totalCount = await prisma.negativeExample.count({ where: { userId } });
    if (totalCount > 500) {
      // Remove oldest
      const oldest = await prisma.negativeExample.findMany({
        where: { userId },
        orderBy: { capturedAt: "asc" },
        take: totalCount - 500,
      });
      await prisma.negativeExample.deleteMany({
        where: { id: { in: oldest.map((n) => n.id) } },
      });
    }

    console.log(
      `[AdaptiveLearning] Added negative example for user ${userId}: confidence=${(confidence * 100).toFixed(1)}%`
    );

    return { added: true, reason: "Negative example stored" };
  }

  /**
   * Get negative examples for contrastive scoring
   */
  async getNegativeExamples(
    userId: string
  ): Promise<Array<{ id: string; embedding: number[]; confidence: number }>> {
    const negatives = await prisma.negativeExample.findMany({
      where: { userId },
      select: { id: true, embedding: true, confidence: true },
      orderBy: { capturedAt: "desc" },
      take: 50,
    });

    return negatives.map((n) => ({
      id: n.id,
      embedding: n.embedding as number[],
      confidence: n.confidence,
    }));
  }

  /**
   * Compute separation between user profile and negative examples
   * Higher is better (more distinct from others)
   */
  async computeInterClassSeparation(
    userId: string,
    userCentroid: number[]
  ): Promise<number | null> {
    const negatives = await this.getNegativeExamples(userId);

    if (negatives.length === 0) return null;

    // Average similarity to negative examples (lower is better)
    let totalSimilarity = 0;
    for (const negative of negatives) {
      totalSimilarity += this.cosineSimilarity(userCentroid, negative.embedding);
    }

    const avgSimilarity = totalSimilarity / negatives.length;

    // Return separation (1 - similarity)
    return 1 - avgSimilarity;
  }

  /**
   * Get statistics about negative examples
   */
  async getStats(userId: string): Promise<{
    total: number;
    avgConfidence: number;
    oldestDate?: Date;
    newestDate?: Date;
  }> {
    const negatives = await prisma.negativeExample.findMany({
      where: { userId },
      select: { confidence: true, capturedAt: true },
      orderBy: { capturedAt: "asc" },
    });

    if (negatives.length === 0) {
      return { total: 0, avgConfidence: 0 };
    }

    const avgConfidence =
      negatives.reduce((sum, n) => sum + n.confidence, 0) / negatives.length;

    return {
      total: negatives.length,
      avgConfidence,
      oldestDate: negatives[0].capturedAt,
      newestDate: negatives[negatives.length - 1].capturedAt,
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }
}

// ==================== Profile Rollback Service ====================

export class ProfileRollbackService {
  /**
   * Rollback a profile to a previous snapshot
   */
  async rollback(
    profileId: string,
    snapshotId?: string
  ): Promise<{
    success: boolean;
    message: string;
    restoredSnapshotId?: string;
  }> {
    // Get the profile
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return { success: false, message: "Profile not found" };
    }

    // Get snapshot (latest if not specified)
    const snapshot = snapshotId
      ? await prisma.profileSnapshot.findUnique({ where: { id: snapshotId } })
      : await prisma.profileSnapshot.findFirst({
          where: { speakerProfileId: profileId },
          orderBy: { createdAt: "desc" },
        });

    if (!snapshot) {
      return { success: false, message: "No snapshot available for rollback" };
    }

    // Deactivate all adaptive samples added after the snapshot
    await prisma.adaptiveSample.updateMany({
      where: {
        speakerProfileId: profileId,
        admittedAt: { gt: snapshot.createdAt },
      },
      data: { isActive: false },
    });

    // Restore centroid
    await prisma.speakerProfile.update({
      where: { id: profileId },
      data: {
        centroidEmbedding: snapshot.centroid !== null ? snapshot.centroid : undefined,
        profileHealth: snapshot.healthScore,
        isFrozen: false,
        frozenAt: null,
        frozenReason: null,
      },
    });

    console.log(
      `[AdaptiveLearning] Rolled back profile ${profileId} to snapshot from ${snapshot.createdAt.toISOString()}`
    );

    return {
      success: true,
      message: `Rolled back to snapshot from ${snapshot.createdAt.toISOString()}`,
      restoredSnapshotId: snapshot.id,
    };
  }

  /**
   * List available snapshots for a profile
   */
  async listSnapshots(profileId: string): Promise<
    Array<{
      id: string;
      createdAt: Date;
      reason: string;
      healthScore: number;
      sampleCounts: { training: number; adaptive: number };
    }>
  > {
    const snapshots = await prisma.profileSnapshot.findMany({
      where: { speakerProfileId: profileId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return snapshots.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      reason: s.reason,
      healthScore: s.healthScore,
      sampleCounts: {
        training: s.trainingSampleCount,
        adaptive: s.adaptiveSampleCount,
      },
    }));
  }

  /**
   * Create a manual backup snapshot
   */
  async createManualSnapshot(profileId: string): Promise<{
    success: boolean;
    snapshotId?: string;
    message: string;
  }> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
      include: {
        voiceSamples: {
          where: { status: "completed" },
          select: { id: true },
        },
        adaptiveSamples: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    if (!profile || !profile.centroidEmbedding) {
      return { success: false, message: "Profile not found or has no centroid" };
    }

    const snapshot = await prisma.profileSnapshot.create({
      data: {
        speakerProfileId: profileId,
        centroid: profile.centroidEmbedding as number[],
        adaptiveSampleIds: profile.adaptiveSamples.map((s) => s.id),
        trainingSampleCount: profile.voiceSamples.length,
        adaptiveSampleCount: profile.adaptiveSamples.length,
        healthScore: profile.profileHealth,
        reason: "manual_backup",
      },
    });

    return {
      success: true,
      snapshotId: snapshot.id,
      message: "Manual snapshot created",
    };
  }
}

// ==================== Main Adaptive Learning Service ====================

export class AdaptiveSpeakerLearningService {
  private config: AdaptiveLearningConfig;
  private qualityAnalyzer: AudioQualityAnalyzer;
  private crossValidator: CrossValidator;
  private profileUpdater: AdaptiveProfileUpdater;
  private negativeManager: NegativeExampleManager;
  private rollbackService: ProfileRollbackService;

  constructor(config: AdaptiveLearningConfig = DEFAULT_ADAPTIVE_CONFIG) {
    this.config = config;
    this.qualityAnalyzer = new AudioQualityAnalyzer(config);
    this.crossValidator = new CrossValidator(config);
    this.profileUpdater = new AdaptiveProfileUpdater(config);
    this.negativeManager = new NegativeExampleManager(config);
    this.rollbackService = new ProfileRollbackService();
  }

  /**
   * Process audio from continuous listening and decide what to do with it
   */
  async processAudioForLearning(
    profileId: string,
    embedding: number[],
    similarity: number,
    audioBuffer: Buffer,
    sessionId?: string
  ): Promise<{
    action: "admitted" | "negative_stored" | "ignored" | "rejected";
    reason: string;
    details?: AdmissionResult | { added: boolean; reason: string };
  }> {
    // Get userId from profileId
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });
    if (!profile) {
      throw new Error("Profile not found");
    }

    // High confidence - try to admit to profile
    if (similarity >= this.config.confidence.admissionThreshold) {
      const result = await this.profileUpdater.attemptUpdate(
        profileId,
        embedding,
        audioBuffer,
        similarity,
        { type: "continuous_listening", sessionId }
      );

      return {
        action: result.accepted ? "admitted" : "rejected",
        reason: result.reason,
        details: result,
      };
    }

    // Low confidence - store as negative example
    if (similarity < this.config.confidence.negativeExampleThreshold) {
      const confidence = 1 - similarity; // Confidence that it's NOT the user
      const result = await this.negativeManager.addNegativeExample(
        profile.userId,
        embedding,
        confidence,
        sessionId
      );

      return {
        action: result.added ? "negative_stored" : "ignored",
        reason: result.reason,
        details: result,
      };
    }

    // Medium zone - ignore
    return {
      action: "ignored",
      reason: `Similarity in uncertain zone: ${(similarity * 100).toFixed(1)}% (${(this.config.confidence.negativeExampleThreshold * 100).toFixed(0)}%-${(this.config.confidence.admissionThreshold * 100).toFixed(0)}%)`,
    };
  }

  /**
   * Get status of adaptive learning for a profile
   */
  async getStatus(profileId: string, userId: string): Promise<AdaptiveLearningStatus | null> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
      include: {
        adaptiveSamples: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    if (!profile || profile.userId !== userId) {
      return null;
    }

    const negativeCount = await prisma.negativeExample.count({
      where: { userId },
    });

    return {
      enabled: profile.adaptiveLearningEnabled,
      profileId: profile.id,
      profileHealth: profile.profileHealth,
      isFrozen: profile.isFrozen,
      frozenReason: profile.frozenReason || undefined,
      totalAdaptiveSamples: profile.adaptiveSamples.length,
      totalNegativeExamples: negativeCount,
      lastUpdate: profile.lastAdaptiveUpdate || undefined,
      config: this.config,
    };
  }

  /**
   * Enable adaptive learning for a profile
   */
  async enable(profileId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
      include: {
        voiceSamples: {
          where: { status: "completed" },
          select: { id: true },
        },
      },
    });

    if (!profile || profile.userId !== userId) {
      return { success: false, message: "Profile not found" };
    }

    if (!profile.isEnrolled || !profile.centroidEmbedding) {
      return {
        success: false,
        message: "Profile must be enrolled with a trained model before enabling adaptive learning",
      };
    }

    if (profile.voiceSamples.length < this.config.profile.minSamplesBeforeAdaptive) {
      return {
        success: false,
        message: `Need at least ${this.config.profile.minSamplesBeforeAdaptive} training samples before enabling adaptive learning (current: ${profile.voiceSamples.length})`,
      };
    }

    // Create initial snapshot
    await this.rollbackService.createManualSnapshot(profileId);

    await prisma.speakerProfile.update({
      where: { id: profileId },
      data: {
        adaptiveLearningEnabled: true,
        isFrozen: false,
        frozenAt: null,
        frozenReason: null,
      },
    });

    return { success: true, message: "Adaptive learning enabled" };
  }

  /**
   * Disable adaptive learning for a profile
   */
  async disable(profileId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== userId) {
      return { success: false, message: "Profile not found" };
    }

    await prisma.speakerProfile.update({
      where: { id: profileId },
      data: { adaptiveLearningEnabled: false },
    });

    return { success: true, message: "Adaptive learning disabled" };
  }

  /**
   * Unfreeze a frozen profile
   */
  async unfreeze(profileId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== userId) {
      return { success: false, message: "Profile not found" };
    }

    if (!profile.isFrozen) {
      return { success: false, message: "Profile is not frozen" };
    }

    await prisma.speakerProfile.update({
      where: { id: profileId },
      data: {
        isFrozen: false,
        frozenAt: null,
        frozenReason: null,
      },
    });

    return { success: true, message: "Profile unfrozen" };
  }

  /**
   * Run a health check on a profile
   */
  async runHealthCheck(profileId: string, userId: string): Promise<HealthCheckResult | null> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== userId) {
      return null;
    }

    return this.profileUpdater.checkHealth(profileId);
  }

  /**
   * Get adaptive samples for a profile
   */
  async getAdaptiveSamples(
    profileId: string,
    userId: string,
    options: { includeInactive?: boolean } = {}
  ): Promise<
    Array<{
      id: string;
      admittedAt: Date;
      audioQualityScore: number;
      admissionSimilarity: number;
      crossValidationScore: number;
      contributionWeight: number;
      decayFactor: number;
      isActive: boolean;
    }>
  > {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== userId) {
      return [];
    }

    const whereClause: { speakerProfileId: string; isActive?: boolean } = {
      speakerProfileId: profileId,
    };
    if (!options.includeInactive) {
      whereClause.isActive = true;
    }

    const samples = await prisma.adaptiveSample.findMany({
      where: whereClause,
      orderBy: { admittedAt: "desc" },
      select: {
        id: true,
        admittedAt: true,
        audioQualityScore: true,
        admissionSimilarity: true,
        crossValidationScore: true,
        contributionWeight: true,
        decayFactor: true,
        isActive: true,
      },
    });

    return samples;
  }

  /**
   * Remove a specific adaptive sample
   */
  async removeAdaptiveSample(
    profileId: string,
    sampleId: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const profile = await prisma.speakerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== userId) {
      return { success: false, message: "Profile not found" };
    }

    const sample = await prisma.adaptiveSample.findUnique({
      where: { id: sampleId },
    });

    if (!sample || sample.speakerProfileId !== profileId) {
      return { success: false, message: "Sample not found" };
    }

    await prisma.adaptiveSample.update({
      where: { id: sampleId },
      data: { isActive: false },
    });

    // Recompute centroid
    const newCentroid = await this.profileUpdater.computeWeightedCentroid(profileId);
    await prisma.speakerProfile.update({
      where: { id: profileId },
      data: { centroidEmbedding: newCentroid },
    });

    return { success: true, message: "Sample removed" };
  }

  // Expose sub-services
  get quality(): AudioQualityAnalyzer {
    return this.qualityAnalyzer;
  }
  get validation(): CrossValidator {
    return this.crossValidator;
  }
  get updater(): AdaptiveProfileUpdater {
    return this.profileUpdater;
  }
  get negatives(): NegativeExampleManager {
    return this.negativeManager;
  }
  get rollback(): ProfileRollbackService {
    return this.rollbackService;
  }
}

// ==================== Singleton Instance ====================

export const adaptiveSpeakerLearningService = new AdaptiveSpeakerLearningService();

// Export individual components for direct use
export const audioQualityAnalyzer = new AudioQualityAnalyzer();
export const crossValidator = new CrossValidator();
export const adaptiveProfileUpdater = new AdaptiveProfileUpdater();
export const negativeExampleManager = new NegativeExampleManager();
export const profileRollbackService = new ProfileRollbackService();
