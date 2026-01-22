// Database Models
// TypeScript definitions for database entities

/**
 * User account and preferences
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  preferences: {
    defaultLLMModel?: string;
    memoryRetentionDays?: number;
    summarizationSchedule?: string;
    privacyMode?: "local" | "cloud";
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raw user interactions
 */
export interface Interaction {
  id: string;
  userId: string;
  type:
    | "question"
    | "command"
    | "reflection"
    | "observation"
    | "conversation"
    | "noise";
  content: string;
  metadata?: Record<string, any>;
  isNoise: boolean;
  confidenceScore: number;
  createdAt: Date;
}

/**
 * Memory entries (short-term and long-term)
 */
export interface Memory {
  id: string;
  userId: string;
  interactionId?: string;
  type: "short_term" | "long_term";
  timeScale?:
    | "daily"
    | "3day"
    | "weekly"
    | "biweekly"
    | "monthly"
    | "quarterly"
    | "6month"
    | "yearly"
    | "multiyear";
  content: string;
  summary?: string;
  embeddingId?: string;
  createdAt: Date;
  updatedAt: Date;
  importanceScore: number; // 0-1
  tags: string[];
  sourceMemoryIds?: string[]; // For summaries
  accuracy?: number; // 0-1
  provenance?: "user_said" | "api_result" | "browser_data" | "inferred";
}

/**
 * Generated summaries at various time scales
 */
export interface Summary {
  id: string;
  userId: string;
  timeScale:
    | "daily"
    | "3day"
    | "weekly"
    | "biweekly"
    | "monthly"
    | "quarterly"
    | "6month"
    | "yearly"
    | "multiyear";
  periodStart: Date;
  periodEnd: Date;
  content: string;
  keyInsights: string[];
  tags: string[];
  sourceMemoryIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tool configuration and usage
 */
export interface Tool {
  id: string;
  name: string;
  category: "browser" | "api" | "mcp" | "custom";
  description?: string;
  enabled: boolean;
  config: Record<string, any>;
  rateLimit: number;
  timeout: number;
  createdAt: Date;
}

/**
 * Audit log for privacy and security
 */
export interface AuditLog {
  id: string;
  userId: string;
  action: string; // 'memory_read', 'memory_write', 'tool_execute', etc.
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  timestamp: Date;
}

/**
 * Agent background tasks and state
 */
export interface BackgroundAgent {
  id: string;
  userId: string;
  type:
    | "daily_reflection"
    | "weekly_summary"
    | "goal_tracker"
    | "habit_analyzer"
    | "financial_analyzer"
    | "knowledge_gap_detector";
  status: "idle" | "running" | "completed" | "failed";
  lastRun?: Date;
  nextRun?: Date;
  result?: Record<string, any>;
  error?: string;
}
