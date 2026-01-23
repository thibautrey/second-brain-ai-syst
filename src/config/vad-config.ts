/**
 * Voice Activity Detection Configuration
 * Customize VAD parameters for different use cases
 */

export interface VADConfig {
  enabled: boolean;
  silenceThreshold: number; // 0-255, default: 25
  silenceDuration: number; // milliseconds, minimum: 500, default: 1500
  minRecordingDuration: number; // milliseconds, minimum recording time before VAD can trigger
}

/**
 * Default VAD configuration for verification recording
 */
export const DEFAULT_VERIFICATION_VAD_CONFIG: VADConfig = {
  enabled: true,
  silenceThreshold: 25, // Sensitive to detect soft speech
  silenceDuration: 1500, // 1.5 seconds of silence
  minRecordingDuration: 500, // Allow stop after 0.5s of recording
};

/**
 * Preset configurations for different scenarios
 */
export const VAD_PRESETS = {
  /**
   * Verification: Quick, responsive recording
   * Good for voice verification where users speak briefly
   */
  verification: {
    silenceThreshold: 25,
    silenceDuration: 1200, // Shorter timeout for quicker response
    minRecordingDuration: 500,
  },

  /**
   * Training: More forgiving, allows longer pauses
   * Good for training recordings where users might pause between sentences
   */
  training: {
    silenceThreshold: 20,
    silenceDuration: 2000, // Longer timeout to allow sentence pauses
    minRecordingDuration: 1000,
  },

  /**
   * Noise-sensitive: Less sensitive to background noise
   * Good for noisy environments
   */
  noisySensitive: {
    silenceThreshold: 40, // Less sensitive
    silenceDuration: 1500,
    minRecordingDuration: 500,
  },

  /**
   * Quiet environments: More sensitive
   * Good for quiet environments where you want to catch soft speech
   */
  quietEnvironment: {
    silenceThreshold: 15, // More sensitive
    silenceDuration: 1200,
    minRecordingDuration: 300,
  },
};

/**
 * Get VAD config for a specific preset
 */
export function getVADConfig(preset: keyof typeof VAD_PRESETS): VADConfig {
  const presetConfig = VAD_PRESETS[preset];
  return {
    enabled: true,
    ...presetConfig,
  };
}
