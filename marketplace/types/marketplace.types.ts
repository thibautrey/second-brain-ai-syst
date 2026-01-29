/**
 * Marketplace Types
 *
 * Shared types for the Second Brain Marketplace
 */

// ==================== Enums ====================

export type ItemType = "skill" | "tool";

export type SecurityStatus = "pending" | "approved" | "rejected" | "flagged";

export type ReportReason = "security" | "inappropriate" | "spam" | "other";

export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

export type SortBy = "popular" | "recent" | "top_rated" | "most_installed";

// ==================== Marketplace Skill ====================

export interface MarketplaceSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  category: string;
  tags: string[];
  icon?: string;
  version: string;

  // Author
  author_instance_id: string;
  author_name?: string;
  author_url?: string;

  // Stats
  installs_count: number;
  upvotes_count: number;

  // Security
  security_status: SecurityStatus;
  security_notes?: string;
  security_checked_at?: string;

  // Metadata
  metadata?: Record<string, any>;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PublishSkillRequest {
  name: string;
  description: string;
  instructions: string;
  category: string;
  tags?: string[];
  icon?: string;
  version?: string;
  author_name?: string;
  author_url?: string;
  metadata?: Record<string, any>;
}

// ==================== Marketplace Tool ====================

export interface MarketplaceTool {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  description: string;

  // Code
  language: string;
  code: string;
  input_schema: Record<string, any>;
  output_schema?: Record<string, any>;

  // Dependencies
  required_secrets: string[];

  // Categorization
  category: string;
  tags: string[];

  // Author
  author_instance_id: string;
  author_name?: string;
  author_url?: string;

  // Stats
  installs_count: number;
  upvotes_count: number;

  // Security
  security_status: SecurityStatus;
  security_notes?: string;
  security_checked_at?: string;

  // Metadata
  version: string;
  metadata?: Record<string, any>;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PublishToolRequest {
  name: string;
  display_name: string;
  description: string;
  language?: string;
  code: string;
  input_schema: Record<string, any>;
  output_schema?: Record<string, any>;
  required_secrets?: string[];
  category?: string;
  tags?: string[];
  version?: string;
  author_name?: string;
  author_url?: string;
  metadata?: Record<string, any>;
}

// ==================== Install Tracking ====================

export interface MarketplaceInstall {
  id: string;
  item_type: ItemType;
  item_id: string;
  instance_id: string;
  installed_at: string;
  uninstalled_at?: string;
}

export interface TrackInstallRequest {
  item_type: ItemType;
  item_id: string;
}

// ==================== Votes ====================

export interface MarketplaceVote {
  id: string;
  item_type: ItemType;
  item_id: string;
  instance_id: string;
  vote: number;
  created_at: string;
}

export interface VoteRequest {
  item_type: ItemType;
  item_id: string;
}

// ==================== Reports ====================

export interface MarketplaceReport {
  id: string;
  item_type: ItemType;
  item_id: string;
  reporter_instance_id: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  reviewed_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface ReportRequest {
  item_type: ItemType;
  item_id: string;
  reason: ReportReason;
  details?: string;
}

// ==================== Browse/Search ====================

export interface BrowseOptions {
  category?: string;
  search?: string;
  tags?: string[];
  sort_by?: SortBy;
  page?: number;
  limit?: number;
}

export interface BrowseResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ==================== Security Check ====================

export interface SecurityCheckResult {
  approved: boolean;
  issues: SecurityIssue[];
  summary: string;
}

export interface SecurityIssue {
  severity: "critical" | "high" | "medium" | "low";
  type: string;
  description: string;
  line?: number;
  suggestion?: string;
}

// ==================== API Responses ====================

export interface MarketplaceApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==================== Instance Info ====================

export interface InstanceInfo {
  instance_id: string;
  // We don't store any user info - completely anonymous
}
