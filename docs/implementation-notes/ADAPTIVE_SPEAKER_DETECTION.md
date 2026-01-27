# Adaptive Speaker Detection System

## 🎯 Problem Statement

The current speaker detection system faces a fundamental challenge:
- **Training vs Reality Gap**: Users train with clean, deliberate voice samples, but real continuous listening captures short, noisy, variable audio
- **Profile Pollution Risk**: Blindly adding continuous audio to the profile would degrade it over time with:
  - Other people's voices mistakenly attributed to the user
  - Background noise/music/TV
  - Low-quality audio segments
- **Missed Opportunities**: High-quality audio identified as user goes unused for profile improvement

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Continuous Audio Stream                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Voice Activity Detection (VAD)                     │
│                   Filter: silence, background noise                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Speech segments
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Audio Quality Gate                               │
│        Check: duration, SNR, clipping, energy consistency           │
└──────────────┬────────────────┴────────────────────┬────────────────┘
               │ Low quality                          │ High quality
               ▼                                      ▼
┌──────────────────────────┐          ┌──────────────────────────────┐
│    Discard for profile   │          │     Speaker Identification    │
│    (still transcribe)    │          │     Compare vs. centroid      │
└──────────────────────────┘          └──────────────┬───────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────┐
                    │                                 │                          │
              HIGH CONFIDENCE                   MEDIUM ZONE                  LOW CONFIDENCE
              (>= 0.85 similarity)             (0.65-0.85)                  (< 0.65)
                    │                                 │                          │
                    ▼                                 ▼                          ▼
    ┌───────────────────────────┐   ┌──────────────────────────┐   ┌────────────────────────┐
    │   Candidate Pool          │   │   Uncertain Pool         │   │   Negative Examples    │
    │   (Likely User)           │   │   (Maybe User)           │   │   (Probably Not User)  │
    └─────────────┬─────────────┘   └──────────────────────────┘   └────────────┬───────────┘
                  │                                                              │
                  ▼                                                              ▼
    ┌───────────────────────────┐                              ┌────────────────────────────┐
    │   Cross-Validation Gate   │                              │   Build "Not-User" Cluster │
    │   Check: intra-cluster    │                              │   For contrastive learning │
    │   consistency             │                              └────────────────────────────┘
    └─────────────┬─────────────┘
                  │ Validated
                  ▼
    ┌───────────────────────────────────────────────────────────┐
    │                Adaptive Profile Update                     │
    │   - Weighted centroid update (new samples get lower weight)│
    │   - Exponential decay for very old samples                 │
    │   - Never exceed max embeddings (FIFO with quality filter) │
    └───────────────────────────────────────────────────────────┘
```

## 🔑 Key Principles

### 1. **Conservative Admission**
Only very high-confidence samples are considered for profile updates. It's better to miss opportunities than to pollute the profile.

### 2. **Multi-Stage Validation**
Samples must pass multiple gates before updating the profile:
- Audio quality gate
- Confidence threshold gate
- Cross-validation gate (consistency with existing samples)
- Temporal coherence check

### 3. **Bounded Profile Size**
The profile never grows unboundedly. Old samples are pruned using:
- Maximum embedding count (e.g., 100 samples)
- Quality-weighted FIFO (low-quality samples evicted first)
- Exponential time decay

### 4. **Reversibility**
All adaptive updates are logged and can be rolled back if detection degrades.

## 📊 Database Schema Updates

```prisma
model SpeakerProfile {
  // ... existing fields ...
  
  // NEW: Adaptive learning fields
  adaptiveLearningEnabled  Boolean   @default(false)
  lastAdaptiveUpdate       DateTime?
  adaptiveUpdateCount      Int       @default(0)
  
  // Profile health metrics
  profileHealth            Float     @default(1.0)  // 0-1, degradation indicator
  lastHealthCheck          DateTime?
  
  // Frozen flag - stops all updates if health drops
  isFrozen                 Boolean   @default(false)
  frozenAt                 DateTime?
  frozenReason             String?
}

model AdaptiveSample {
  id                String         @id @default(cuid())
  speakerProfileId  String
  speakerProfile    SpeakerProfile @relation(fields: [speakerProfileId], references: [id], onDelete: Cascade)
  
  // Source information
  sourceType        String         // 'continuous_listening', 'manual_training', 'verification'
  sourceSessionId   String?        // Link to listening session
  
  // Audio characteristics
  embedding         Json           // The voice embedding
  durationSeconds   Float
  audioQualityScore Float          // 0-1 computed quality
  
  // Confidence metrics at admission time
  admissionSimilarity    Float     // Similarity to centroid when admitted
  crossValidationScore   Float     // Consistency with other samples
  
  // Contribution tracking
  contributionWeight     Float     @default(1.0)  // How much this affects centroid
  decayFactor           Float     @default(1.0)  // Decreases over time
  
  // Audit
  admittedAt            DateTime  @default(now())
  lastUsedInCentroid    DateTime?
  isActive              Boolean   @default(true)  // Can be soft-deleted
  
  @@index([speakerProfileId])
  @@index([admittedAt])
  @@map("adaptive_samples")
}

model NegativeExample {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Cluster information
  clusterId        String?  // For grouping similar negatives
  embedding        Json
  
  // Source
  capturedAt       DateTime @default(now())
  sourceSessionId  String?
  confidence       Float    // How confident we are this is NOT the user
  
  // Optional: identified person
  externalPersonId String?  // If this was identified as a known external person
  
  @@index([userId])
  @@index([clusterId])
  @@map("negative_examples")
}

model ProfileHealthLog {
  id               String         @id @default(cuid())
  speakerProfileId String
  speakerProfile   SpeakerProfile @relation(fields: [speakerProfileId], references: [id], onDelete: Cascade)
  
  // Snapshot
  healthScore      Float
  intraClassVariance Float
  interClassSeparation Float?  // If negative examples exist
  sampleCount      Int
  
  // Event
  eventType        String   // 'scheduled_check', 'after_update', 'manual_audit'
  recommendations  Json?    // Suggested actions
  
  createdAt        DateTime @default(now())
  
  @@index([speakerProfileId])
  @@map("profile_health_logs")
}
```

## 🎛️ Configuration

```typescript
interface AdaptiveLearningConfig {
  // Gate thresholds
  audioQuality: {
    minDurationSeconds: number;      // 1.5 - minimum audio length
    maxDurationSeconds: number;      // 10.0 - too long might have multiple speakers
    minSignalToNoiseDb: number;      // 15 - reject noisy audio
    maxClippingPercent: number;      // 0.01 - reject clipped audio
    minEnergyConsistency: number;    // 0.7 - stable volume throughout
  };
  
  confidence: {
    admissionThreshold: number;      // 0.85 - very conservative
    crossValidationMin: number;      // 0.80 - must match existing samples
    mediumZoneUpper: number;         // 0.85 - below this = uncertain
    mediumZoneLower: number;         // 0.65 - below this = negative
    negativeExampleThreshold: number; // 0.50 - confident it's NOT user
  };
  
  profile: {
    maxAdaptiveSamples: number;      // 100 - bounded growth
    minSamplesBeforeAdaptive: number; // 10 - need baseline first
    decayHalfLifeDays: number;       // 30 - old samples fade
    updateCooldownMinutes: number;   // 5 - rate limit updates
  };
  
  health: {
    varianceThreshold: number;       // 0.15 - max acceptable variance
    healthCheckIntervalHours: number; // 24
    autoFreezeHealthThreshold: number; // 0.5 - freeze if health drops
    minSamplesForHealthCheck: number; // 5
  };
}

const DEFAULT_CONFIG: AdaptiveLearningConfig = {
  audioQuality: {
    minDurationSeconds: 1.5,
    maxDurationSeconds: 10.0,
    minSignalToNoiseDb: 15,
    maxClippingPercent: 0.01,
    minEnergyConsistency: 0.7,
  },
  confidence: {
    admissionThreshold: 0.85,
    crossValidationMin: 0.80,
    mediumZoneUpper: 0.85,
    mediumZoneLower: 0.65,
    negativeExampleThreshold: 0.50,
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
```

## 🔧 Implementation Components

### 1. Audio Quality Analyzer

```typescript
interface AudioQualityResult {
  isAcceptable: boolean;
  score: number;  // 0-1
  metrics: {
    durationSeconds: number;
    signalToNoiseDb: number;
    clippingPercent: number;
    energyConsistency: number;
    hasMultipleSpeakers: boolean;  // Basic diarization check
  };
  rejectionReason?: string;
}

class AudioQualityAnalyzer {
  async analyze(audioBuffer: Buffer, config: AdaptiveLearningConfig): Promise<AudioQualityResult>;
}
```

### 2. Cross-Validator

```typescript
interface CrossValidationResult {
  isConsistent: boolean;
  score: number;  // Average similarity to existing samples
  outlierScore: number;  // How different from worst-matching existing sample
  details: {
    similaritiesWithExisting: number[];
    medianSimilarity: number;
    minSimilarity: number;
  };
}

class CrossValidator {
  async validate(
    newEmbedding: number[],
    existingSamples: AdaptiveSample[],
    config: AdaptiveLearningConfig
  ): Promise<CrossValidationResult>;
}
```

### 3. Profile Updater

```typescript
class AdaptiveProfileUpdater {
  /**
   * Attempt to add a sample to the profile
   * Returns success/failure with detailed reason
   */
  async attemptUpdate(
    profileId: string,
    embedding: number[],
    audioMetrics: AudioQualityResult,
    similarity: number,
    sourceInfo: { type: string; sessionId?: string }
  ): Promise<{
    accepted: boolean;
    reason: string;
    newCentroid?: number[];
    profileHealth?: number;
  }>;
  
  /**
   * Compute weighted centroid from all active samples
   */
  private computeWeightedCentroid(samples: AdaptiveSample[]): number[];
  
  /**
   * Apply time decay to sample weights
   */
  private applyTimeDecay(samples: AdaptiveSample[]): void;
  
  /**
   * Prune lowest-quality samples when at capacity
   */
  private pruneExcessSamples(samples: AdaptiveSample[], maxCount: number): void;
}
```

### 4. Profile Health Monitor

```typescript
class ProfileHealthMonitor {
  /**
   * Compute comprehensive health score
   */
  async checkHealth(profileId: string): Promise<{
    healthScore: number;
    metrics: {
      intraClassVariance: number;
      sampleCount: number;
      averageQuality: number;
      ageDistribution: { recent: number; medium: number; old: number };
    };
    recommendations: string[];
    shouldFreeze: boolean;
  }>;
  
  /**
   * Detect if profile quality is degrading
   */
  async detectDegradation(profileId: string): Promise<{
    isDegrading: boolean;
    trend: 'improving' | 'stable' | 'degrading';
    suggestedAction: 'continue' | 'pause' | 'rollback' | 'retrain';
  }>;
}
```

### 5. Negative Example Manager

```typescript
class NegativeExampleManager {
  /**
   * Store a confident negative example
   */
  async addNegativeExample(
    userId: string,
    embedding: number[],
    confidence: number,
    sourceSessionId?: string
  ): Promise<void>;
  
  /**
   * Cluster negative examples to identify recurring speakers
   */
  async clusterNegatives(userId: string): Promise<{
    clusters: {
      id: string;
      centroid: number[];
      sampleCount: number;
      suggestedName?: string;  // e.g., "Frequent Speaker #1"
    }[];
  }>;
  
  /**
   * Use negatives for contrastive adjustment
   * Pushes user centroid away from negative clusters
   */
  async computeContrastiveAdjustment(
    userCentroid: number[],
    negativeClusters: number[][]
  ): number[];
}
```

## 🔄 Integration with Continuous Listening

### Modified Flow

```typescript
// In continuous-listening.ts

private async processSpeechSegment(audioData: Buffer, duration: number): Promise<void> {
  // 1. Existing speaker identification
  const speakerResult = await this.identifySpeaker(audioData, duration);
  
  // 2. NEW: Consider for adaptive learning
  if (this.adaptiveLearningEnabled) {
    await this.considerForAdaptiveLearning(
      audioData,
      duration,
      speakerResult
    );
  }
  
  // 3. Continue with normal processing (transcription, etc.)
  // ...
}

private async considerForAdaptiveLearning(
  audioData: Buffer,
  duration: number,
  speakerResult: SpeakerIdentificationResult
): Promise<void> {
  const embeddingService = await getEmbeddingService();
  
  // Extract embedding (may already have it from identification)
  const embedding = await embeddingService.extractEmbedding(audioData);
  
  // Analyze audio quality
  const qualityResult = await this.audioQualityAnalyzer.analyze(audioData);
  
  if (!qualityResult.isAcceptable) {
    // Low quality audio - skip entirely
    return;
  }
  
  const similarity = speakerResult.confidence;
  
  if (similarity >= this.adaptiveConfig.confidence.admissionThreshold) {
    // HIGH CONFIDENCE - Candidate for profile update
    await this.adaptiveUpdater.attemptUpdate(
      this.config.speakerProfileId,
      embedding,
      qualityResult,
      similarity,
      { type: 'continuous_listening', sessionId: this.sessionId }
    );
  } else if (similarity < this.adaptiveConfig.confidence.negativeExampleThreshold) {
    // LOW CONFIDENCE - Store as negative example
    await this.negativeManager.addNegativeExample(
      this.config.userId,
      embedding,
      1 - similarity,  // confidence that it's NOT the user
      this.sessionId
    );
  }
  // MEDIUM ZONE (0.50-0.85) - Do nothing, too uncertain
}
```

## 📈 Monitoring & Alerts

### Metrics to Track

1. **Profile Quality Over Time**
   - Intra-class variance trend
   - Detection accuracy (via user feedback)
   - False positive/negative rates

2. **Adaptive Learning Efficiency**
   - Samples admitted per day
   - Samples rejected (and reasons)
   - Profile update frequency

3. **Health Alerts**
   - Profile variance exceeding threshold
   - Detection confidence dropping
   - Too many false positives reported

### User Feedback Loop

```typescript
// Allow users to correct misidentifications
interface SpeakerFeedback {
  transcriptId: string;
  wasCorrectlyIdentified: boolean;
  actualSpeaker: 'me' | 'other' | 'unknown';
}

// Use feedback to:
// 1. Adjust admission thresholds
// 2. Remove bad samples that were mistakenly admitted
// 3. Add confirmed samples that were incorrectly rejected
```

## 🛡️ Safety Mechanisms

### 1. Profile Snapshot & Rollback

```typescript
// Before any adaptive update, snapshot the profile
interface ProfileSnapshot {
  id: string;
  profileId: string;
  centroid: number[];
  sampleIds: string[];
  healthScore: number;
  createdAt: Date;
  reason: string;  // 'before_adaptive_update', 'manual_backup', 'scheduled'
}

// If health degrades significantly, rollback
async function rollbackProfile(profileId: string, snapshotId: string): Promise<void>;
```

### 2. Gradual Updates

Never update the centroid dramatically. Use weighted averaging:

```typescript
function updateCentroid(
  currentCentroid: number[],
  newSampleEmbedding: number[],
  newSampleWeight: number = 0.1  // New samples have low initial weight
): number[] {
  const totalWeight = 1.0;  // Current centroid has weight 1.0
  const combinedWeight = totalWeight + newSampleWeight;
  
  return currentCentroid.map((val, i) => 
    (val * totalWeight + newSampleEmbedding[i] * newSampleWeight) / combinedWeight
  );
}
```

### 3. Freeze Conditions

Auto-freeze adaptive learning if:
- Health score drops below threshold
- Variance increases rapidly
- User reports multiple false positives
- No negative examples available (can't validate separation)

## 🚀 Rollout Strategy

### Phase 1: Observation Mode
- Collect candidate samples but don't update profile
- Log what WOULD be admitted
- Build negative example clusters
- Monitor theoretical impact

### Phase 2: Conservative Rollout
- Enable with very high thresholds (0.90+ similarity)
- Limit to 1-2 updates per day
- Require user confirmation for first 10 updates
- Monitor closely

### Phase 3: Automatic Mode
- Lower thresholds gradually based on success
- Full automatic updates with health monitoring
- Periodic user feedback requests

## 📝 API Endpoints

```typescript
// GET /api/speaker-profiles/:id/adaptive-learning
// Returns adaptive learning status and settings

// PUT /api/speaker-profiles/:id/adaptive-learning
// Enable/disable adaptive learning, update config

// GET /api/speaker-profiles/:id/adaptive-samples
// List all adaptive samples with their metrics

// DELETE /api/speaker-profiles/:id/adaptive-samples/:sampleId
// Remove a specific adaptive sample

// POST /api/speaker-profiles/:id/rollback
// Rollback to a previous snapshot

// GET /api/speaker-profiles/:id/health
// Get current health metrics and recommendations

// POST /api/speaker-profiles/:id/feedback
// Submit feedback about a speaker identification
```

## 🔮 Future Enhancements

### 1. External Person Profiles
Build profiles for frequently-detected other speakers, enabling:
- "Who said this?" queries
- Better separation between user and known others
- Context-aware transcriptions

### 2. Contextual Adaptation
Different centroids for different contexts:
- "Morning voice" vs "evening voice"
- "Speaking normally" vs "speaking loudly"
- "Indoors" vs "outdoors" acoustics

### 3. Active Learning
Occasionally prompt user for verification:
- "Was this you speaking at 3:45 PM?"
- Use responses to refine thresholds
- Identify systematic errors

---

## Summary

This system provides a **safe, gradual** way to improve speaker detection over time by:

1. **Strict admission gates** - Only the best audio enters the profile
2. **Cross-validation** - New samples must match existing ones
3. **Bounded growth** - Profile never becomes bloated
4. **Health monitoring** - Automatic freeze if quality degrades
5. **Negative examples** - Learning what the user DOESN'T sound like
6. **Full reversibility** - Every change can be undone

The key insight is that **conservative admission + negative examples** beats aggressive learning every time.
