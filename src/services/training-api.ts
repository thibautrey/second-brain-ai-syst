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
      Authorization: `Bearer ${localStorage.getItem("token")}`,
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
        Authorization: `Bearer ${localStorage.getItem("token")}`,
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
export async function getSample(sampleId: string): Promise<VoiceSampleResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/training/samples/${sampleId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
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
        Authorization: `Bearer ${localStorage.getItem("token")}`,
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
      Authorization: `Bearer ${localStorage.getItem("token")}`,
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
  const response = await fetch(`${API_BASE_URL}/api/training/status/${sessionId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

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
): Promise<TrainingSessionResponse> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const session = await getTrainingStatus(sessionId);

        if (
          session.status === "completed" ||
          session.status === "failed"
        ) {
          clearInterval(pollInterval);
          resolve(session);
          return;
        }

        if (Date.now() - startTime > maxDuration) {
          clearInterval(pollInterval);
          reject(
            new Error(
              `Training session timed out after ${maxDuration}ms`,
            ),
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