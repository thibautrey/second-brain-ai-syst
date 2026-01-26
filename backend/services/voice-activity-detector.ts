/**
 * Voice Activity Detection Service
 *
 * Uses energy-based and optional Silero VAD for accurate, CPU-efficient voice detection.
 *
 * Default behavior (energy-based):
 * - Detects speech with RMS energy analysis
 * - Handles noise and various audio conditions reasonably well
 * - Uses minimal CPU (<5%)
 * - Processes locally (no API calls)
 *
 * Optional Silero VAD (when onnxruntime-node is installed):
 * - Neural network-based detection for higher accuracy
 * - ~95%+ accuracy on clean audio
 * - Requires onnxruntime-node package
 *
 * Hybrid approach:
 * 1. Energy-based detection for quick filtering of obvious silence
 * 2. Silero VAD for accurate speech detection (if available)
 * 3. Confidence scoring to prevent false positives
 */

import * as fs from "fs/promises";
import * as path from "path";

import { fileURLToPath } from "url";

// Lazy-load ONNX runtime to allow the app to start even if not installed
let InferenceSession: any = null;
let Tensor: any = null;

async function loadONNXRuntime(): Promise<{
  InferenceSession: any;
  Tensor: any;
}> {
  if (InferenceSession === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const onnx = await (async () => {
        try {
          // @ts-ignore - Optional dependency
          return await import("onnxruntime-node");
        } catch {
          return null;
        }
      })();

      if (onnx) {
        InferenceSession = onnx.InferenceSession;
        Tensor = onnx.Tensor;
      }
    } catch (error) {
      console.warn(
        "onnxruntime-node not installed. VAD will use fallback energy-based detection.",
      );
    }
  }
  return { InferenceSession, Tensor };
}

// ==================== Types ====================

export interface VADResult {
  isSpeech: boolean;
  confidence: number;
  energyLevel: number;
  vadScore: number;
  timestamp: number;
}

export interface VADConfig {
  sensitivity: number; // 0-1, higher = more sensitive to speech
  energyThreshold: number; // For quick energy-based pre-filtering
  vadThreshold: number; // Silero VAD confidence threshold
  silenceDetectionMs: number; // Duration to confirm silence
  sampleRate: number; // Audio sample rate (16000 Hz)
  chunkDurationMs: number; // Expected chunk duration (100ms)
}

// ==================== State Management ====================

interface VADState {
  speechFrameCount: number;
  silenceFrameCount: number;
  isSpeaking: boolean;
  lastVadScore: number;
  context: Float32Array; // Silero VAD internal state
  srState: Float32Array; // Stream reader state
  h: Float32Array; // Hidden state
  c: Float32Array; // Cell state
}

// ==================== Silero VAD Wrapper ====================

export class VoiceActivityDetector {
  private config: VADConfig;
  private state: VADState;
  private session: any = null;
  private initialized: boolean = false;
  private modelPath: string;

  constructor(config: Partial<VADConfig> = {}) {
    this.config = {
      sensitivity: config.sensitivity ?? 0.6,
      energyThreshold: config.energyThreshold ?? 500,
      vadThreshold: config.vadThreshold ?? 0.5,
      silenceDetectionMs: config.silenceDetectionMs ?? 1500,
      sampleRate: config.sampleRate ?? 16000,
      chunkDurationMs: config.chunkDurationMs ?? 100,
    };

    // Calculate minimum silence frames (at 100ms chunks)
    const minSilenceFrames = Math.ceil(
      this.config.silenceDetectionMs / this.config.chunkDurationMs,
    );

    this.state = {
      speechFrameCount: 0,
      silenceFrameCount: 0,
      isSpeaking: false,
      lastVadScore: 0,
      context: new Float32Array(2),
      srState: new Float32Array(2),
      h: new Float32Array(64),
      c: new Float32Array(64),
    };

    // Set model path - use bundled Silero VAD model
    // Default path, will be updated in initialize()
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    this.modelPath = path.join(__dirname, "../models/silero_vad_16000.onnx");
  }

  /**
   * Find the actual model path by checking multiple locations
   * Returns the first path that exists, or null if none found
   */
  private async findModelPath(): Promise<string | null> {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const possiblePaths = [
      path.join(__dirname, "../models/silero_vad_16000.onnx"), // compiled source
      path.join(process.cwd(), "models/silero_vad_16000.onnx"), // backend root
      path.join(process.cwd(), "../models/silero_vad_16000.onnx"), // project root
      "/app/backend/models/silero_vad_16000.onnx", // docker path
      "/app/models/silero_vad_16000.onnx", // docker alternative
    ];

    for (const p of possiblePaths) {
      try {
        await fs.access(p);
        return p; // Path exists
      } catch {
        // Continue to next path
      }
    }
    return null; // No path found
  }

  /**
   * Initialize the VAD model
   * Should be called once before processing audio
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Find the model path (check multiple locations)
      const modelPath = await this.findModelPath();
      if (modelPath) {
        this.modelPath = modelPath;
      }

      // Check if model file exists
      try {
        await fs.access(this.modelPath);
      } catch {
        // Model file doesn't exist, will use fallback energy-based VAD
        console.warn(
          `Silero VAD model not found at ${this.modelPath}. Using energy-based VAD.`,
        );
        this.initialized = true;
        return;
      }

      // Load ONNX runtime
      const { InferenceSession: IS } = await loadONNXRuntime();
      if (!IS) {
        console.warn(
          "ONNX runtime not available. Using energy-based VAD fallback.",
        );
        this.initialized = true;
        return;
      }

      // Load ONNX model
      this.session = await IS.create(this.modelPath, {
        executionProviders: ["cpu"],
      });

      // Reset state for ONNX session
      this.state.h.fill(0);
      this.state.c.fill(0);
      this.state.srState.fill(0);
      this.state.context.fill(0);

      this.initialized = true;
      console.log("✓ Silero VAD model loaded successfully");
    } catch (error) {
      console.error("Failed to initialize Silero VAD:", error);
      console.warn("Falling back to energy-based VAD");
      this.initialized = true;
    }
  }

  /**
   * Analyze audio chunk for voice activity
   * Returns confidence score and detection result
   */
  async analyze(chunk: Buffer): Promise<VADResult> {
    const timestamp = Date.now();

    // Step 1: Quick energy-based pre-filtering
    const energyLevel = this.calculateEnergy(chunk);
    const hasEnergy = energyLevel > this.config.energyThreshold;

    // Step 2: Run Silero VAD if session is available
    let vadScore = 0;
    if (this.session && hasEnergy) {
      try {
        vadScore = await this.runSileroVad(chunk);
      } catch (error) {
        console.error("Error running Silero VAD:", error);
        // Fall back to energy-based score
        vadScore = Math.min(1, energyLevel / (this.config.energyThreshold * 3));
      }
    } else if (!this.session) {
      // Fallback: use energy-based score if no Silero model
      vadScore = Math.min(1, energyLevel / (this.config.energyThreshold * 3));
    }

    // Apply sensitivity adjustment
    const adjustedThreshold =
      this.config.vadThreshold * (2 - this.config.sensitivity); // Lower sensitivity = higher threshold
    const isSpeech = vadScore > adjustedThreshold;

    // Step 3: Track speech/silence frames
    if (isSpeech) {
      this.state.speechFrameCount++;
      this.state.silenceFrameCount = 0;
    } else {
      this.state.silenceFrameCount++;
      const minSilenceFrames = Math.ceil(
        this.config.silenceDetectionMs / this.config.chunkDurationMs,
      );
      if (this.state.silenceFrameCount >= minSilenceFrames) {
        this.state.speechFrameCount = 0;
      }
    }

    // Step 4: Update speaking state
    const minSpeechFrames = 3; // Require 3 frames (300ms) of continuous speech
    if (
      !this.state.isSpeaking &&
      this.state.speechFrameCount >= minSpeechFrames
    ) {
      this.state.isSpeaking = true;
    } else if (
      this.state.isSpeaking &&
      this.state.silenceFrameCount >=
        Math.ceil(this.config.silenceDetectionMs / this.config.chunkDurationMs)
    ) {
      this.state.isSpeaking = false;
    }

    this.state.lastVadScore = vadScore;

    return {
      isSpeech: this.state.isSpeaking,
      confidence: Math.min(1, vadScore),
      energyLevel,
      vadScore,
      timestamp,
    };
  }

  /**
   * Check if speech just ended (for processing accumulated speech)
   */
  hasSpeechEnded(): boolean {
    const minSilenceFrames = Math.ceil(
      this.config.silenceDetectionMs / this.config.chunkDurationMs,
    );
    return (
      !this.state.isSpeaking &&
      this.state.silenceFrameCount === minSilenceFrames
    );
  }

  /**
   * Reset detector state (e.g., for new recording session)
   */
  reset(): void {
    this.state.speechFrameCount = 0;
    this.state.silenceFrameCount = 0;
    this.state.isSpeaking = false;
    this.state.lastVadScore = 0;
    if (this.session) {
      this.state.h.fill(0);
      this.state.c.fill(0);
      this.state.srState.fill(0);
      this.state.context.fill(0);
    }
  }

  /**
   * Get current VAD state
   */
  getState() {
    return {
      isSpeaking: this.state.isSpeaking,
      lastVadScore: this.state.lastVadScore,
      speechFrameCount: this.state.speechFrameCount,
      silenceFrameCount: this.state.silenceFrameCount,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==================== Private Methods ====================

  /**
   * Calculate RMS energy of audio chunk
   */
  private calculateEnergy(chunk: Buffer): number {
    const samples = new Int16Array(
      chunk.buffer,
      chunk.byteOffset,
      chunk.length / 2,
    );
    let sumSquares = 0;

    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }

    const rms = Math.sqrt(sumSquares / samples.length);
    return rms;
  }

  /**
   * Run Silero VAD model on audio chunk
   * Returns confidence score (0-1)
   */
  private async runSileroVad(chunk: Buffer): Promise<number> {
    if (!this.session) {
      return 0;
    }

    try {
      const { Tensor: T } = await loadONNXRuntime();
      if (!T) {
        return 0;
      }

      // Convert PCM16 to float32
      const samples = new Int16Array(
        chunk.buffer,
        chunk.byteOffset,
        chunk.length / 2,
      );
      const audioFloat = new Float32Array(samples.length);

      // Normalize to [-1, 1] range
      for (let i = 0; i < samples.length; i++) {
        audioFloat[i] = samples[i] / 32768.0;
      }

      // Create input tensors for Silero VAD
      const input = new T("float32", audioFloat, [1, audioFloat.length]);
      const srState = new T("float32", this.state.srState, [1, 2]);
      const h = new T("float32", this.state.h, [1, 64]);
      const c = new T("float32", this.state.c, [1, 64]);
      const context = new T("float32", this.state.context, [1, 2]);

      // Run inference
      const feeds = {
        input,
        state: [srState, h, c],
        context,
      };

      const results = await this.session.run(feeds);

      // Extract output (confidence score)
      const output = results.output.data;
      const vadScore = output[0] as number;

      // Update internal state for next chunk
      const newSrState = results.sr_state;
      const newH = results.h;
      const newC = results.c;

      if (newSrState instanceof T) {
        const srStateData = await newSrState.data();
        this.state.srState = new Float32Array(srStateData);
      }

      if (newH instanceof T) {
        const hData = await newH.data();
        this.state.h = new Float32Array(hData);
      }

      if (newC instanceof T) {
        const cData = await newC.data();
        this.state.c = new Float32Array(cData);
      }

      return Math.min(1, Math.max(0, vadScore));
    } catch (error) {
      console.error("Error in Silero VAD inference:", error);
      return 0;
    }
  }
}

// ==================== Singleton Instance ====================

let voiceActivityDetectorInstance: VoiceActivityDetector | null = null;

export async function getVoiceActivityDetector(
  config?: Partial<VADConfig>,
): Promise<VoiceActivityDetector> {
  if (!voiceActivityDetectorInstance) {
    voiceActivityDetectorInstance = new VoiceActivityDetector(config);
    await voiceActivityDetectorInstance.initialize();
  }
  return voiceActivityDetectorInstance;
}

export function resetVoiceActivityDetector(): void {
  voiceActivityDetectorInstance = null;
}
