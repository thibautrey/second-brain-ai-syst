/**
 * Input Ingestion Models
 *
 * Data models for storing input records, speaker profiles, and metadata
 */

export interface ProcessedInputRecord {
  id: string;
  user_id: string;
  format: "text" | "audio_stream" | "audio_batch";
  content: string;
  speaker_id: string;
  speaker_confidence: number;
  speaker_method: "assumed" | "identified" | "uncertain";
  status: "pending" | "processing" | "completed" | "failed";
  duration_seconds?: number;
  processing_time_ms: number;
  error?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SpeakerProfileRecord {
  id: string;
  user_id: string;
  speaker_id: string;
  name: string;
  enrollment_date: Date;
  model_version: string;
  centroid_embedding: number[]; // Vector embedding
  confidence_mean: number;
  confidence_std: number;
  confidence_min: number;
  confidence_max: number;
  active: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SpeakerEmbeddingRecord {
  id: string;
  speaker_profile_id: string;
  embedding: number[];
  source: string;
  confidence?: number;
  created_at: Date;
}

export interface AudioBatchRecord {
  id: string;
  user_id: string;
  batch_id: string;
  sequence_number: number;
  chunk_size: number;
  is_final: boolean;
  transcribed_content?: string;
  status: "pending" | "completed" | "failed";
  created_at: Date;
}

export interface AudioStreamSessionRecord {
  id: string;
  user_id: string;
  session_id: string;
  start_time: Date;
  end_time?: Date;
  total_chunks: number;
  total_duration_seconds?: number;
  final_transcription?: string;
  status: "active" | "completed" | "failed";
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface InputProcessingMetricsRecord {
  id: string;
  user_id: string;
  input_format: string;
  processing_time_ms: number;
  success: boolean;
  error_type?: string;
  speaker_identified: boolean;
  speaker_confidence?: number;
  created_at: Date;
}
