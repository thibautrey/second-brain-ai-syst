/**
 * Types for Continuous Listening Feature
 */

// ==================== User Settings ====================

export interface UserSettings {
  id: string;
  userId: string;

  // Continuous Listening Settings
  continuousListeningEnabled: boolean;
  wakeWord: string;
  wakeWordSensitivity: number; // 0.0 - 1.0
  minImportanceThreshold: number; // 0.0 - 1.0
  silenceDetectionMs: number;

  // Audio Processing Settings
  vadSensitivity: number; // 0.0 - 1.0
  speakerConfidenceThreshold: number; // 0.0 - 1.0
  autoDeleteAudioAfterProcess: boolean;

  // Notification Settings
  notifyOnMemoryStored: boolean;
  notifyOnCommandDetected: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserSettingsInput {
  continuousListeningEnabled?: boolean;
  wakeWord?: string;
  wakeWordSensitivity?: number;
  minImportanceThreshold?: number;
  silenceDetectionMs?: number;
  vadSensitivity?: number;
  speakerConfidenceThreshold?: number;
  autoDeleteAudioAfterProcess?: boolean;
  notifyOnMemoryStored?: boolean;
  notifyOnCommandDetected?: boolean;
}

// ==================== WebSocket Messages ====================

export type WebSocketMessageType =
  | "session_started"
  | "session_stopped"
  | "vad_status"
  | "speaker_status"
  | "transcript"
  | "command_detected"
  | "memory_stored"
  | "config_updated"
  | "error"
  | "pong";

export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  timestamp: number;
  data?: T;
}

export interface VADStatusData {
  isSpeech: boolean;
  energyLevel: number;
}

export interface SpeakerStatusData {
  isTargetUser: boolean;
  confidence: number;
  speakerId: string;
}

export interface TranscriptData {
  text: string;
  confidence: number;
  language: string;
  duration: number;
}

export interface CommandDetectedData {
  text: string;
  originalText: string;
  classification: ClassificationResult;
}

export interface MemoryStoredData {
  memoryId: string;
  text: string;
  classification: ClassificationResult;
}

export interface ErrorData {
  message: string;
}

// ==================== Classification ====================

export type InputType =
  | "question"
  | "command"
  | "reflection"
  | "observation"
  | "conversation"
  | "noise";

export type TimeBucket =
  | "today"
  | "past_week"
  | "past_month"
  | "past_year"
  | "all_time";

export interface ClassificationResult {
  inputType: InputType;
  confidence: number;
  topic?: string;
  temporalReference?: string;
  timeBucket?: TimeBucket;
  shouldStore: boolean;
  shouldCallTools: boolean;
  memoryScopes: string[];
  importanceScore: number;
  entities: string[];
  sentiment: "positive" | "negative" | "neutral";
}

// ==================== Listening State ====================

export type ListeningState =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "error";

export interface ContinuousListeningState {
  // Connection state
  state: ListeningState;
  isConnected: boolean;
  error: string | null;

  // VAD state
  isSpeechDetected: boolean;
  audioLevel: number;

  // Speaker state
  speakerStatus: "unknown" | "user" | "other";
  speakerConfidence: number;

  // Processing state
  currentTranscript: string | null;
  lastCommand: CommandDetectedData | null;
  lastMemory: MemoryStoredData | null;

  // Statistics
  sessionsCount: number;
  memoriesStoredCount: number;
  commandsDetectedCount: number;
}

// ==================== Context Actions ====================

export interface ContinuousListeningActions {
  startListening: () => Promise<void>;
  stopListening: () => void;
  updateSettings: (settings: UpdateUserSettingsInput) => Promise<void>;
  testWakeWord: (
    text: string,
  ) => Promise<{ matches: boolean; remainingText: string }>;
}

// ==================== Wake Word Test ====================

export interface WakeWordTestResult {
  matches: boolean;
  wakeWord: string;
  remainingText: string;
  originalText: string;
}
