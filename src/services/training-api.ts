/**
 * Voice Training API Service
 *
 * Client-side service for communicating with the backend voice training API.
 * Handles voice sample uploads, training sessions, and status monitoring.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface VoiceSampleResponse {
  id: string;
  speakerProfileId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  phraseText?: string;
  phraseCategory?: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSessionResponse {
  id: string;
  speakerProfileId: string;
  modelType: string;
  sampleCount: number;
  totalDuration: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  currentStep?: string;
  errorMessage?: string;
  centroidEmbedding?: number[];
  confidenceScore?: number;
  intraClassVariance?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  voiceSample?: T;
  samples?: T[];
  sample?: T;
  trainingSession?: TrainingSessionResponse;
  activeTrainingSessions?: TrainingSessionResponse[];
  error?: string;
}

/**
 * Upload a voice sample for training
 */
export async function uploadSample(
  audioFile: File,
  speakerProfileId?: string,
  phraseText?: string,
  phraseCategory?: string,
): Promise<VoiceSampleResponse> {
  const formData = new FormData();
  formData.append("audio", audioFile);

  if (speakerProfileId) {
    formData.append("speakerProfileId", speakerProfileId);
  }
  if (phraseText) {
    formData.append("phraseText", phraseText);
  }
  if (phraseCategory) {
    formData.append("phraseCategory", phraseCategory);
  }

  const response = await fetch(`${API_BASE_URL}/api/training/samples`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to upload sample");
  }

  const data: ApiResponse<VoiceSampleResponse> = await response.json();
  if (!data.voiceSample) {
    throw new Error("No voice sample returned");
  }

  return data.voiceSample;
}

/**
 * List all voice samples for a speaker profile
 */
export async function listSamples(
  speakerProfileId?: string,
): Promise<VoiceSampleResponse[]> {
  const params = new URLSearchParams();
  if (speakerProfileId) {
    params.append("speakerProfileId", speakerProfileId);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/training/samples?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to list samples");
  }

  const data: ApiResponse<VoiceSampleResponse> = await response.json();
  return data.samples || [];
}

/**
 * Get a specific voice sample
 */
export async function getSample(
  sampleId: string,
): Promise<VoiceSampleResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/training/samples/${sampleId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get sample");
  }

  const data: ApiResponse<VoiceSampleResponse> = await response.json();
  if (!data.sample) {
    throw new Error("No voice sample returned");
  }

  return data.sample;
}

/**
 * Delete a voice sample
 */
export async function deleteSample(sampleId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/training/samples/${sampleId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete sample");
  }
}

/**
 * Start a training session for a speaker profile
 */
export async function startTraining(
  speakerProfileId: string,
): Promise<TrainingSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/training/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    },
    body: JSON.stringify({
      speakerProfileId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to start training");
  }

  const data: ApiResponse<TrainingSessionResponse> = await response.json();
  if (!data.trainingSession) {
    throw new Error("No training session returned");
  }

  return data.trainingSession;
}

/**
 * Get the status of a training session
 */
export async function getTrainingStatus(
  sessionId: string,
): Promise<TrainingSessionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/training/status/${sessionId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get training status");
  }

  const data: ApiResponse<TrainingSessionResponse> = await response.json();
  if (!data.trainingSession) {
    throw new Error("No training session returned");
  }

  return data.trainingSession;
}

/**
 * Poll training status until completion
 */
export async function pollTrainingStatus(
  sessionId: string,
  interval: number = 2000,
  maxDuration: number = 300000, // 5 minutes
  onProgress?: (session: TrainingSessionResponse) => void,
): Promise<TrainingSessionResponse> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const session = await getTrainingStatus(sessionId);

        // Call progress callback if provided
        if (onProgress) {
          onProgress(session);
        }

        if (session.status === "completed" || session.status === "failed") {
          clearInterval(pollInterval);
          resolve(session);
          return;
        }

        if (Date.now() - startTime > maxDuration) {
          clearInterval(pollInterval);
          reject(
            new Error(`Training session timed out after ${maxDuration}ms`),
          );
          return;
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, interval);
  });
}

/**
 * Training session update event from SSE
 */
export interface TrainingUpdateEvent {
  id: string;
  progress: number;
  currentStep: string | null;
  status: string;
  errorMessage?: string;
}

/**
 * SSE message types
 */
export interface SSEMessage {
  type: "connected" | "sessions_update" | "update";
  sessions?: TrainingUpdateEvent[];
  // Single update fields (for direct updates)
  id?: string;
  progress?: number;
  currentStep?: string | null;
  status?: string;
  errorMessage?: string;
}

/**
 * Subscribe to real-time training session updates via SSE
 * @param onUpdate Callback when a training session is updated
 * @param onError Callback when an error occurs
 * @returns Cleanup function to close the connection
 */
export function subscribeToTrainingUpdates(
  onUpdate: (sessions: TrainingUpdateEvent[]) => void,
  onError?: (error: Event) => void,
): () => void {
  const token = localStorage.getItem("authToken");
  if (!token) {
    console.error("No auth token available for SSE connection");
    return () => {};
  }

  // Create EventSource with auth token in URL (SSE doesn't support custom headers)
  const url = new URL(`${API_BASE_URL}/api/training/active/stream`);

  // Create a custom EventSource-like connection using fetch
  const controller = new AbortController();
  let isConnected = true;

  const connect = async () => {
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (isConnected) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("[SSE] Stream ended");
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete messages (separated by double newlines)
        const messages = buffer.split("\n\n");
        buffer = messages.pop() || ""; // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim()) continue;

          // Parse SSE format: "data: {...}"
          const dataMatch = message.match(/^data:\s*(.+)$/m);
          if (dataMatch) {
            try {
              const data: SSEMessage = JSON.parse(dataMatch[1]);

              if (data.type === "connected") {
                console.log("[SSE] Connected to training updates");
              } else if (data.type === "sessions_update" && data.sessions) {
                onUpdate(data.sessions);
              } else if (data.id && data.status) {
                // Single session update
                onUpdate([
                  {
                    id: data.id,
                    progress: data.progress || 0,
                    currentStep: data.currentStep || null,
                    status: data.status,
                    errorMessage: data.errorMessage,
                  },
                ]);
              }
            } catch (parseError) {
              // Ignore heartbeat comments (": heartbeat")
              if (!message.startsWith(":")) {
                console.warn("[SSE] Failed to parse message:", message);
              }
            }
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("[SSE] Connection error:", error);
        onError?.(error as Event);
      }
    }
  };

  connect();

  // Return cleanup function
  return () => {
    isConnected = false;
    controller.abort();
  };
}

/**
 * Get active training sessions for current user
 */
export async function getActiveTrainingSessions(): Promise<
  TrainingSessionResponse[]
> {
  const response = await fetch(`${API_BASE_URL}/api/training/active`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get active training sessions");
  }

  const data: ApiResponse<TrainingSessionResponse> = await response.json();
  if (!data.activeTrainingSessions) {
    return [];
  }

  return data.activeTrainingSessions;
}

/**
 * List all speaker profiles for current user
 */
export async function listSpeakerProfiles(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/api/speaker-profiles`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to list speaker profiles");
  }

  const data = await response.json();
  return data.profiles || [];
}

/**
 * Create a new speaker profile
 */
export async function createSpeakerProfile(name: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/speaker-profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create speaker profile");
  }

  const data = await response.json();
  return data.profile;
}

/**
 * Get a specific speaker profile with samples
 */
export async function getSpeakerProfile(profileId: string): Promise<any> {
  const response = await fetch(
    `${API_BASE_URL}/api/speaker-profiles/${profileId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get speaker profile");
  }

  const data = await response.json();
  return data.profile;
}

export interface VerificationResult {
  recognized: boolean;
  confidence: number;
  similarity: number;
  profileId: string;
  profileName: string;
}

/**
 * Verify voice against an enrolled speaker profile
 */
export async function verifyVoice(
  audioFile: File,
  profileId: string,
): Promise<VerificationResult> {
  const formData = new FormData();
  formData.append("audio", audioFile);

  const response = await fetch(
    `${API_BASE_URL}/api/training/verify/${profileId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to verify voice");
  }

  const data = await response.json();
  return data.verification;
}

// ==================== Recent Recordings Management ====================

export interface RecentRecording {
  id: string;
  type: "negative_example" | "adaptive_sample" | "unclassified";
  capturedAt: string;
  confidence: number;
  sourceSessionId?: string;
  similarity?: number;
  duration?: number;
  hasAudio?: boolean;
}

export interface RecentRecordingsResponse {
  success: boolean;
  recordings: RecentRecording[];
  stats: {
    totalNegatives: number;
    totalPositives: number;
  };
}

/**
 * Get recent recordings from continuous listening with classification status
 * Returns both negative examples and adaptive samples for user review
 */
export async function getRecentRecordings(
  profileId?: string,
  limit: number = 50,
): Promise<RecentRecordingsResponse> {
  const params = new URLSearchParams();
  if (profileId) params.append("profileId", profileId);
  params.append("limit", limit.toString());

  const response = await fetch(
    `${API_BASE_URL}/api/adaptive-learning/recent-recordings?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get recent recordings");
  }

  return response.json();
}

export interface ReclassifyResult {
  success: boolean;
  message: string;
  action: "removed_negative" | "converted_to_negative";
}

/**
 * Reclassify a recording - mark as user's voice or someone else's
 * @param recordingId The ID of the recording to reclassify
 * @param newClassification 'user' if it's the user's voice, 'other' if it's not
 * @param profileId Required when reclassifying adaptive samples
 */
export async function reclassifyRecording(
  recordingId: string,
  newClassification: "user" | "other",
  profileId?: string,
): Promise<ReclassifyResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/adaptive-learning/reclassify/${recordingId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ newClassification, profileId }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to reclassify recording");
  }

  return response.json();
}

/**
 * Clear all negative examples to reset voice detection
 * Use when the system has accumulated too many wrong classifications
 */
export async function clearAllNegatives(): Promise<{
  success: boolean;
  deletedCount: number;
}> {
  const response = await fetch(
    `${API_BASE_URL}/api/adaptive-learning/recent-recordings/clear-negatives`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to clear negative examples");
  }

  return response.json();
}
