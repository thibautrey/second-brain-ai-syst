/**
 * Elegant Notification Sound Service
 *
 * Generates smooth, elegant notification sounds using Web Audio API
 */

class NotificationSoundService {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
    return this.audioContext;
  }

  /**
   * Play a smooth, elegant notification sound
   * Uses sine wave oscillators for a harmonious tone
   */
  playElegantSound(): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Resume audio context if suspended (required for user interaction)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Create master gain
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.value = 0.3; // Gentle volume

      // Note frequencies for a pleasant chord (C major)
      const notes = [
        { frequency: 261.63, startTime: 0, duration: 0.4 }, // C
        { frequency: 329.63, startTime: 0.1, duration: 0.4 }, // E
        { frequency: 392.0, startTime: 0.2, duration: 0.6 }, // G
      ];

      notes.forEach(({ frequency, startTime, duration }) => {
        // Create oscillator for each note
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency;

        // Create gain envelope for smooth attack/release
        const envelope = ctx.createGain();
        envelope.gain.setValueAtTime(0, now + startTime);
        envelope.gain.linearRampToValueAtTime(1, now + startTime + 0.05);
        envelope.gain.exponentialRampToValueAtTime(
          0.01,
          now + startTime + duration,
        );

        // Connect nodes
        osc.connect(envelope);
        envelope.connect(masterGain);

        // Start and stop
        osc.start(now + startTime);
        osc.stop(now + startTime + duration);
      });

      // Add gentle reverb-like effect using delay
      const delayNode = ctx.createDelay();
      delayNode.delayTime.value = 0.1;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.15;

      masterGain.connect(delayNode);
      delayNode.connect(delayGain);
      delayGain.connect(ctx.destination);
    } catch (error) {
      console.error("[NotificationSoundService] Failed to play sound:", error);
    }
  }

  /**
   * Play a subtle notification chime (shorter version)
   */
  playChime(): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.value = 0.25;

      // Single note with quick decay - very elegant
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 523.25; // C5

      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(1, now);
      envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(envelope);
      envelope.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (error) {
      console.error("[NotificationSoundService] Failed to play chime:", error);
    }
  }
}

export const notificationSoundService = new NotificationSoundService();
