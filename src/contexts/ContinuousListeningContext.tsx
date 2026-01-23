/**
 * Continuous Listening Context
 *
 * Manages the WebSocket connection and state for continuous listening feature.
 * Provides real-time audio streaming and event handling.
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
  WebSocketMessage,
  VADStatusData,
  SpeakerStatusData,
  TranscriptData,
  CommandDetectedData,
  MemoryStoredData,
  ListeningState,
  WakeWordTestResult,
} from "../types/continuous-listening";

// ==================== State Management ====================

type Action =
  | { type: "SET_STATE"; payload: ListeningState }
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
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
        sessionsCount: action.payload
          ? state.sessionsCount + 1
          : state.sessionsCount,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        state: action.payload ? "error" : state.state,
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

  const wsRef = useRef<WebSocket | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

      const response = await fetch("/api/user-settings", {
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

  const startListening = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("Already connected");
      return;
    }

    dispatch({ type: "SET_STATE", payload: "connecting" });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Determine WebSocket URL
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/continuous-listen?token=${token}`;

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log("WebSocket connected");
        dispatch({ type: "SET_CONNECTED", payload: true });

        // Start audio capture
        try {
          audioProcessorRef.current = new AudioProcessor();
          await audioProcessorRef.current.start((data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data);
            }
          });
        } catch (error) {
          console.error("Failed to start audio capture:", error);
          dispatch({
            type: "SET_ERROR",
            payload: "Failed to access microphone",
          });
          ws.close();
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        dispatch({ type: "SET_ERROR", payload: "Connection error" });
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        dispatch({ type: "SET_CONNECTED", payload: false });

        // Stop audio processor
        if (audioProcessorRef.current) {
          audioProcessorRef.current.stop();
          audioProcessorRef.current = null;
        }

        // Handle reconnection for unexpected closures
        if (event.code !== 1000 && event.code !== 4003) {
          dispatch({
            type: "SET_ERROR",
            payload: event.reason || "Connection closed",
          });
        }
      };
    } catch (error) {
      console.error("Failed to start listening:", error);
      dispatch({
        type: "SET_ERROR",
        payload: error instanceof Error ? error.message : "Failed to connect",
      });
      dispatch({ type: "SET_STATE", payload: "error" });
    }
  }, []);

  const stopListening = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Stop audio processor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.stop();
      audioProcessorRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, "User stopped listening");
      wsRef.current = null;
    }

    dispatch({ type: "SET_STATE", payload: "idle" });
    dispatch({ type: "SET_CONNECTED", payload: false });
  }, []);

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case "session_started":
        console.log("Session started");
        break;

      case "vad_status":
        dispatch({
          type: "VAD_UPDATE",
          payload: message.data as VADStatusData,
        });
        break;

      case "speaker_status":
        dispatch({
          type: "SPEAKER_UPDATE",
          payload: message.data as SpeakerStatusData,
        });
        break;

      case "transcript":
        dispatch({
          type: "TRANSCRIPT",
          payload: message.data as TranscriptData,
        });
        break;

      case "command_detected":
        dispatch({
          type: "COMMAND_DETECTED",
          payload: message.data as CommandDetectedData,
        });
        break;

      case "memory_stored":
        dispatch({
          type: "MEMORY_STORED",
          payload: message.data as MemoryStoredData,
        });
        break;

      case "error":
        console.error("Server error:", message.data);
        dispatch({
          type: "SET_ERROR",
          payload: (message.data as { message: string })?.message,
        });
        break;

      case "config_updated":
        console.log("Config updated on server");
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  };

  const updateSettings = useCallback(
    async (updates: UpdateUserSettingsInput) => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) throw new Error("Not authenticated");

        const response = await fetch("/api/user-settings", {
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

        // Notify WebSocket of config change
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "config_update" }));
        }
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

        const response = await fetch("/api/user-settings/test-wake-word", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        });

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
