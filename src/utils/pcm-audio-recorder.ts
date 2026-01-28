/**
 * PCM Audio Recorder Utility
 *
 * Captures audio as raw PCM16 (Int16Array) format, matching the continuous listening
 * implementation. This ensures consistency between training samples and real-time
 * voice recognition.
 *
 * Features:
 * - Same audio parameters as continuous listening (16kHz, mono, noise suppression)
 * - Raw PCM16 format for direct compatibility with embedding service
 * - Audio level monitoring via callback
 * - Converts to WAV format for file upload compatibility
 */

export interface PCMRecorderConfig {
  sampleRate?: number;
  onAudioLevel?: (level: number) => void;
  onSilenceDetected?: () => void;
  silenceThreshold?: number;
  silenceDurationMs?: number;
}

export interface PCMRecorderResult {
  /** Raw PCM16 audio data */
  pcmData: Int16Array;
  /** Duration in seconds */
  duration: number;
  /** Sample rate used */
  sampleRate: number;
  /** Audio as WAV Blob for file upload */
  wavBlob: Blob;
}

export class PCMAudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private pcmChunks: Int16Array[] = [];
  private isRecording = false;
  private startTime: number = 0;
  private config: Required<PCMRecorderConfig>;
  private rafId: number | null = null;
  private silenceStartTime: number | null = null;

  constructor(config: PCMRecorderConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 16000,
      onAudioLevel: config.onAudioLevel ?? (() => {}),
      onSilenceDetected: config.onSilenceDetected ?? (() => {}),
      silenceThreshold: config.silenceThreshold ?? 0.01,
      silenceDurationMs: config.silenceDurationMs ?? 1500,
    };
  }

  /**
   * Start recording audio as PCM16
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.warn("[PCMAudioRecorder] Already recording");
      return;
    }

    try {
      // Get microphone access with same parameters as continuous listening
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: this.config.sampleRate,
          channelCount: 1,
        },
      });

      // Create audio context at 16kHz
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });
      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream,
      );

      // Create analyser for audio level monitoring
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Create ScriptProcessor for raw PCM access (same as continuous listening)
      // Note: ScriptProcessor is deprecated but AudioWorklet requires more setup
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (!this.isRecording) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM (same conversion as continuous listening)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        this.pcmChunks.push(pcmData);

        // Check for silence detection
        this.checkSilence(inputData);
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Start audio level monitoring
      this.startLevelMonitoring();

      this.pcmChunks = [];
      this.startTime = Date.now();
      this.isRecording = true;
      this.silenceStartTime = null;

      console.log("[PCMAudioRecorder] Recording started");
    } catch (error) {
      console.error("[PCMAudioRecorder] Failed to start recording:", error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording and return the captured audio
   */
  stop(): PCMRecorderResult {
    if (!this.isRecording) {
      throw new Error("Not recording");
    }

    this.isRecording = false;
    const duration = (Date.now() - this.startTime) / 1000;

    // Combine all PCM chunks
    const totalLength = this.pcmChunks.reduce(
      (acc, chunk) => acc + chunk.length,
      0,
    );
    const pcmData = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      pcmData.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to WAV for file upload
    const wavBlob = this.pcmToWav(pcmData, this.config.sampleRate);

    // Cleanup
    this.cleanup();

    console.log(
      `[PCMAudioRecorder] Recording stopped. Duration: ${duration.toFixed(2)}s, Samples: ${pcmData.length}`,
    );

    return {
      pcmData,
      duration,
      sampleRate: this.config.sampleRate,
      wavBlob,
    };
  }

  /**
   * Cancel recording without returning data
   */
  cancel(): void {
    this.isRecording = false;
    this.cleanup();
    console.log("[PCMAudioRecorder] Recording cancelled");
  }

  /**
   * Check if currently recording
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current recording duration in seconds
   */
  get currentDuration(): number {
    if (!this.isRecording) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  private startLevelMonitoring(): void {
    if (!this.analyser) return;

    const updateLevel = () => {
      if (!this.analyser || !this.isRecording) return;

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const level = (average / 255) * 100;

      this.config.onAudioLevel(level);
      this.rafId = requestAnimationFrame(updateLevel);
    };

    this.rafId = requestAnimationFrame(updateLevel);
  }

  private checkSilence(samples: Float32Array): void {
    // Calculate RMS energy
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / samples.length);

    if (rms < this.config.silenceThreshold) {
      if (this.silenceStartTime === null) {
        this.silenceStartTime = Date.now();
      } else if (
        Date.now() - this.silenceStartTime >
        this.config.silenceDurationMs
      ) {
        this.config.onSilenceDetected();
        this.silenceStartTime = null; // Reset to avoid multiple triggers
      }
    } else {
      this.silenceStartTime = null;
    }
  }

  private cleanup(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.pcmChunks = [];
  }

  /**
   * Convert PCM16 data to WAV format
   */
  private pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bytesPerSample = 2;
    const dataLength = pcmData.length * bytesPerSample;

    // WAV header is 44 bytes
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, "WAVE");

    // fmt sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // ByteRate
    view.setUint16(32, numChannels * bytesPerSample, true); // BlockAlign
    view.setUint16(34, bytesPerSample * 8, true); // BitsPerSample

    // data sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, dataLength, true);

    // Write PCM data
    const pcmOffset = 44;
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(pcmOffset + i * 2, pcmData[i], true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}

/**
 * Create a WAV file from PCM16 data
 */
export function pcmToWavFile(
  pcmData: Int16Array,
  sampleRate: number,
  filename: string = "recording.wav",
): File {
  const recorder = new PCMAudioRecorder({ sampleRate });
  const wavBlob = (recorder as any).pcmToWav(pcmData, sampleRate);
  return new File([wavBlob], filename, { type: "audio/wav" });
}
