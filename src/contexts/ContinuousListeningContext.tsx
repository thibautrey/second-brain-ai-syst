/**
 * Continuous Listening Context
 *
 * Manages the audio connection and state for continuous listening feature.
 * Uses AudioConnectionManager for transparent fallback between protocols:
 * - WebSocket (primary)
 * - SSE + HTTP POST (fallback)
 * - HTTP Polling (final fallback)
 *
 * All connection issues are handled transparently - no error states shown to user.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  UserSettings,
  UpdateUserSettingsInput,
  ContinuousListeningState,
  ContinuousListeningActions,
  VADStatusData,
  SpeakerStatusData,
  TranscriptData,
  CommandDetectedData,
  MemoryStoredData,
  ListeningState,
  WakeWordTestResult,
} from "../types/continuous-listening";
import {
  AudioConnectionManager,
  getAudioConnectionManager,
  resetAudioConnectionManager,
  ConnectionState,
  SessionEvent,
} from "../services/audio-connection-manager";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ==================== State Management ====================

type Action =
  | { type: "SET_STATE"; payload: ListeningState }
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_CONNECTION_STATE"; payload: ConnectionState }
  | { type: "VAD_UPDATE"; payload: VADStatusData }
  | { type: "SPEAKER_UPDATE"; payload: SpeakerStatusData }
  | { type: "TRANSCRIPT"; payload: TranscriptData }
  | { type: "COMMAND_DETECTED"; payload: CommandDetectedData }
  | { type: "MEMORY_STORED"; payload: MemoryStoredData }
  | { type: "RESET" };

const initialState: ContinuousListeningState = {
  state: "idle",
  isConnected: false,
  error: null,
  isSpeechDetected: false,
  audioLevel: 0,
  speakerStatus: "unknown",
  speakerConfidence: 0,
  currentTranscript: null,
  lastCommand: null,
  lastMemory: null,
  sessionsCount: 0,
  memoriesStoredCount: 0,
  commandsDetectedCount: 0,
};

function reducer(
  state: ContinuousListeningState,
  action: Action,
): ContinuousListeningState {
  switch (action.type) {
    case "SET_STATE":
      return { ...state, state: action.payload };

    case "SET_CONNECTED":
      return {
        ...state,
        isConnected: action.payload,
        state: action.payload ? "listening" : "idle",
        error: null, // Clear any errors on successful connection
        sessionsCount: action.payload
          ? state.sessionsCount + 1
          : state.sessionsCount,
      };

    case "SET_CONNECTION_STATE":
      // Map connection states to listening states transparently
      // Don't show errors - handle reconnection silently
      const connectionStateMap: Record<ConnectionState, ListeningState> = {
        disconnected: "idle",
        connecting: "connecting",
        connected: "listening",
        reconnecting: "listening", // Keep listening state during reconnect
        fallback: "listening", // Fallback is still "listening" from user perspective
      };
      return {
        ...state,
        state: connectionStateMap[action.payload] || state.state,
        isConnected: ["connected", "fallback"].includes(action.payload),
        // Never set error state during reconnection/fallback
        error: null,
      };

    case "SET_ERROR":
      // Only set error for unrecoverable situations, not connection issues
      return {
        ...state,
        error: action.payload,
        // Don't change state to error - keep listening state
      };

    case "VAD_UPDATE":
      return {
        ...state,
        isSpeechDetected: action.payload.isSpeech,
        audioLevel: action.payload.energyLevel,
      };

    case "SPEAKER_UPDATE":
      return {
        ...state,
        speakerStatus: action.payload.isTargetUser
          ? "user"
          : action.payload.speakerId === "unknown"
            ? "unknown"
            : "other",
        speakerConfidence: action.payload.confidence,
      };

    case "TRANSCRIPT":
      return { ...state, currentTranscript: action.payload.text };

    case "COMMAND_DETECTED":
      return {
        ...state,
        lastCommand: action.payload,
        commandsDetectedCount: state.commandsDetectedCount + 1,
        currentTranscript: null,
      };

    case "MEMORY_STORED":
      return {
        ...state,
        lastMemory: action.payload,
        memoriesStoredCount: state.memoriesStoredCount + 1,
        currentTranscript: null,
      };

    case "RESET":
      return { ...initialState };

    default:
      return state;
  }
}

// ==================== Context ====================

interface ContinuousListeningContextValue {
  state: ContinuousListeningState;
  settings: UserSettings | null;
  isLoading: boolean;
  actions: ContinuousListeningActions;
}

const ContinuousListeningContext =
  createContext<ContinuousListeningContextValue | null>(null);

// ==================== Audio Processor ====================

class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioData: ((data: ArrayBuffer) => void) | null = null;

  async start(onAudioData: (data: ArrayBuffer) => void): Promise<void> {
    this.onAudioData = onAudioData;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream,
      );

      // Use ScriptProcessorNode for raw PCM access
      // Note: This is deprecated but AudioWorklet requires more setup
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        if (this.onAudioData) {
          this.onAudioData(pcmData.buffer);
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error("Failed to start audio capture:", error);
      throw error;
    }
  }

  stop(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.onAudioData = null;
  }
}

// ==================== Provider ====================

interface ProviderProps {
  children: React.ReactNode;
}

export function ContinuousListeningProvider({ children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [settings, setSettings] = React.useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const connectionManagerRef = useRef<AudioConnectionManager | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
    return () => {
      stopListening();
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/user-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch user settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionEvent = useCallback((event: SessionEvent) => {
    switch (event.type) {
      case "session_started":
      case "session_state":
        console.log("Session event:", event.type, event.data);
        break;

      case "vad_status":
        dispatch({
          type: "VAD_UPDATE",
          payload: event.data as VADStatusData,
        });
        break;

      case "speaker_status":
        dispatch({
          type: "SPEAKER_UPDATE",
          payload: event.data as SpeakerStatusData,
        });
        break;

      case "transcript":
        dispatch({
          type: "TRANSCRIPT",
          payload: event.data as TranscriptData,
        });
        break;

      case "command_detected":
        dispatch({
          type: "COMMAND_DETECTED",
          payload: event.data as CommandDetectedData,
        });
        break;

      case "memory_stored":
        dispatch({
          type: "MEMORY_STORED",
          payload: event.data as MemoryStoredData,
        });
        break;

      case "error":
        // Log but don't show to user - handle transparently
        console.warn("Server event error:", event.data);
        break;

      default:
        console.log("Unknown event type:", event.type, event.data);
    }
  }, []);

  const startListening = useCallback(async () => {
    // Check if already connected
    const existingManager = connectionManagerRef.current;
    if (existingManager && ["connected", "fallback"].includes(existingManager.getState())) {
      console.log("Already connected");
      return;
    }

    // Clean up any existing manager before creating new one
    if (existingManager) {
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
      resetAudioConnectionManager();
      connectionManagerRef.current = null;
    }

    dispatch({ type: "SET_STATE", payload: "connecting" });

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Create fresh connection manager with fallback enabled
      const connectionManager = getAudioConnectionManager({
        deviceType: "BROWSER",
        enableFallback: true,
        maxReconnectAttempts: 10,
        adaptiveChunkSize: true,
      });
      connectionManagerRef.current = connectionManager;

      // Subscribe to events
      const unsubscribeEvents = connectionManager.onEvent(handleSessionEvent);
      cleanupFunctionsRef.current.push(unsubscribeEvents);

      // Subscribe to state changes - handle transparently
      const unsubscribeState = connectionManager.onStateChange((connectionState) => {
        dispatch({ type: "SET_CONNECTION_STATE", payload: connectionState });
        
        // If the connection manager automatically reconnects after session invalidation,
        // we need to restart the audio processor
        if (connectionState === "connected" && !audioProcessorRef.current) {
          const restartAudio = async () => {
            try {
              audioProcessorRef.current = new AudioProcessor();
              await audioProcessorRef.current.start((audioData) => {
                connectionManager.sendAudioChunk(audioData);
              });
            } catch (err) {
              console.error("Failed to restart audio processor:", err);
            }
          };
          restartAudio();
        }
      });
      cleanupFunctionsRef.current.push(unsubscribeState);

      // Connect (handles all fallback logic internally)
      const connected = await connectionManager.connect();

      if (!connected) {
        throw new Error("Failed to connect");
      }

      // Start audio capture
      audioProcessorRef.current = new AudioProcessor();
      await audioProcessorRef.current.start((audioData) => {
        connectionManager.sendAudioChunk(audioData);
      });

      dispatch({ type: "SET_CONNECTED", payload: true });
    } catch (error) {
      console.error("Failed to start listening:", error);
      
      // Reset state on failure
      dispatch({ type: "SET_STATE", payload: "idle" });
      dispatch({ type: "SET_CONNECTED", payload: false });
      
      // Cleanup any partial initialization
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
      if (audioProcessorRef.current) {
        audioProcessorRef.current.stop();
        audioProcessorRef.current = null;
      }
      resetAudioConnectionManager();
      connectionManagerRef.current = null;
      
      // Only show error if it's a critical failure (like no microphone)
      if (error instanceof Error && error.message.includes("microphone")) {
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to access microphone",
        });
      }
      // For other errors, the connection is cleanly reset and user can retry
    }
  }, [handleSessionEvent]);

  const stopListening = useCallback(() => {
    // Cleanup event subscriptions
    cleanupFunctionsRef.current.forEach(cleanup => cleanup());
    cleanupFunctionsRef.current = [];

    // Stop audio processor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.stop();
      audioProcessorRef.current = null;
    }

    // Disconnect and reset connection manager
    resetAudioConnectionManager();
    connectionManagerRef.current = null;

    dispatch({ type: "SET_STATE", payload: "idle" });
    dispatch({ type: "SET_CONNECTED", payload: false });
  }, []);

  const updateSettings = useCallback(
    async (updates: UpdateUserSettingsInput) => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) throw new Error("Not authenticated");

        const response = await fetch(`${API_BASE_URL}/api/user-settings`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update settings");
        }

        const updatedSettings = await response.json();
        setSettings(updatedSettings);

        // Note: Config updates are handled by the session, no need to manually notify
      } catch (error) {
        console.error("Failed to update settings:", error);
        throw error;
      }
    },
    [],
  );

  const testWakeWord = useCallback(
    async (text: string): Promise<WakeWordTestResult> => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) throw new Error("Not authenticated");

        const response = await fetch(
          `${API_BASE_URL}/api/user-settings/test-wake-word`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to test wake word");
        }

        return await response.json();
      } catch (error) {
        console.error("Failed to test wake word:", error);
        throw error;
      }
    },
    [],
  );

  const actions: ContinuousListeningActions = {
    startListening,
    stopListening,
    updateSettings,
    testWakeWord,
  };

  return (
    <ContinuousListeningContext.Provider
      value={{ state, settings, isLoading, actions }}
    >
      {children}
    </ContinuousListeningContext.Provider>
  );
}

// ==================== Hook ====================

export function useContinuousListening() {
  const context = useContext(ContinuousListeningContext);

  if (!context) {
    throw new Error(
      "useContinuousListening must be used within a ContinuousListeningProvider",
    );
  }

  return context;
}
