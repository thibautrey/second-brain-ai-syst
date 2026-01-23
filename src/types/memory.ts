/**
 * Memory Types for Second Brain AI System
 *
 * These types mirror the Prisma schema and backend API responses
 * for memory management and retrieval.
 */

export type MemoryType = "SHORT_TERM" | "LONG_TERM";

export type TimeScale =
  | "DAILY"
  | "THREE_DAY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SIX_MONTH"
  | "YEARLY"
  | "MULTI_YEAR";

export interface Memory {
  id: string;
  userId: string;
  content: string;
  type: MemoryType;
  timeScale?: TimeScale | null;
  sourceType?: string | null;
  sourceId?: string | null;
  embeddingId?: string | null;
  importanceScore: number;
  tags: string[];
  entities: string[];
  metadata: Record<string, unknown>;
  occurredAt?: string | null;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryStats {
  total: number;
  shortTerm: number;
  longTerm: number;
  archived: number;
  pinned: number;
  recentWeek: number;
  topTags: Array<{ tag: string; count: number }>;
}

export interface MemoryFilters {
  type?: MemoryType;
  timeScale?: TimeScale;
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
  startDate?: string;
  endDate?: string;
  isArchived?: boolean;
  isPinned?: boolean;
  search?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedMemories {
  memories: Memory[];
  pagination: PaginationInfo;
}

export interface CreateMemoryInput {
  content: string;
  type?: MemoryType;
  timeScale?: TimeScale;
  sourceType?: string;
  sourceId?: string;
  importanceScore?: number;
  tags?: string[];
  entities?: string[];
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  isPinned?: boolean;
}

export interface UpdateMemoryInput {
  content?: string;
  type?: MemoryType;
  timeScale?: TimeScale;
  importanceScore?: number;
  tags?: string[];
  entities?: string[];
  metadata?: Record<string, unknown>;
  isArchived?: boolean;
  isPinned?: boolean;
}

// Semantic search response from Weaviate
export interface SemanticSearchResult {
  memory: Memory;
  score: number;
  distance: number;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  query: string;
  total: number;
}

// Time grouping for timeline display
export interface MemoryTimeGroup {
  date: string;
  label: string;
  memories: Memory[];
}

// View mode for memory display
export type MemoryViewMode = "list" | "grid";
