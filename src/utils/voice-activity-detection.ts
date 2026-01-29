/**
 * Voice Activity Detection (VAD) Service
 * Detects when a user stops speaking to automatically stop recording
 */

export interface VADOptions {
  silenceThreshold?: number;
  silenceDuration?: number;
  minRecordingDuration?: number;
}

export class VoiceActivityDetector {
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private silenceThreshold: number;
  private silenceDuration: number;
  private minRecordingDuration: number;
  private lastSpeechTime: number = 0;
  private recordingStartTime: number = 0;
  private onSilenceDetected: (() => void) | null = null;

  constructor(
    audioContext: AudioContext,
    stream: MediaStream,
    options?: VADOptions,
  ) {
    // Create analyser
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;

    // Connect stream to analyser
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);

    // Set configuration
    this.silenceThreshold = options?.silenceThreshold ?? 25;
    this.silenceDuration = options?.silenceDuration ?? 1500;
    this.minRecordingDuration = options?.minRecordingDuration ?? 500;
  }

  /**
   * Start monitoring voice activity
   */
  start(onSilenceDetected: () => void): void {
    this.onSilenceDetected = onSilenceDetected;
    this.lastSpeechTime = Date.now();
    this.recordingStartTime = Date.now();
    this.monitorActivity();
  }

  /**
   * Stop monitoring voice activity
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Monitor audio activity continuously
   */
  private monitorActivity(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average frequency energy
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

    if (average > this.silenceThreshold) {
      // User is speaking
      this.lastSpeechTime = Date.now();
    } else {
      // Silence detected
      const timeSilent = Date.now() - this.lastSpeechTime;
      const recordingDuration = Date.now() - this.recordingStartTime;

      // Only trigger if minimum recording duration has passed
      if (
        timeSilent >= this.silenceDuration &&
        recordingDuration >= this.minRecordingDuration
      ) {
        // Extended silence detected
        if (this.onSilenceDetected) {
          this.onSilenceDetected();
        }
        return;
      }
    }

    // Continue monitoring
    this.rafId = requestAnimationFrame(() => this.monitorActivity());
  }

  /**
   * Adjust silence threshold (0-100)
   */
  setSilenceThreshold(value: number): void {
    this.silenceThreshold = Math.max(0, Math.min(100, value));
  }

  /**
   * Adjust minimum silence duration before triggering stop (ms)
   */
  setSilenceDuration(value: number): void {
    this.silenceDuration = Math.max(500, value); // Minimum 500ms
  }

  /**
   * Adjust minimum recording duration (ms)
   */
  setMinRecordingDuration(value: number): void {
    this.minRecordingDuration = Math.max(0, value);
  }
}
