-- CreateIndex: Optimized indices for fast user responses
-- This migration adds indices optimized for common query patterns
-- Note: Removed CONCURRENTLY as it cannot run inside Prisma's transaction block

-- Index for fast memory retrieval by user and time (descending)
-- Used for: Recent memories, timeline queries
CREATE INDEX IF NOT EXISTS "idx_memories_user_time" 
ON "memories" ("userId", "createdAt" DESC) 
WHERE "isArchived" = false;

-- Index for high-importance memories (likely to be retrieved)
-- Used for: Important context retrieval, filtering by importance
CREATE INDEX IF NOT EXISTS "idx_memories_user_importance" 
ON "memories" ("userId", "importanceScore" DESC) 
WHERE "isArchived" = false AND "importanceScore" >= 0.7;

-- Index for pinned memories (frequently accessed)
-- Used for: Quick access to user's pinned content
CREATE INDEX IF NOT EXISTS "idx_memories_user_pinned" 
ON "memories" ("userId") 
WHERE "isPinned" = true AND "isArchived" = false;

-- Index for memory type filtering (short-term vs long-term)
-- Used for: Type-specific memory retrieval
CREATE INDEX IF NOT EXISTS "idx_memories_user_type" 
ON "memories" ("userId", "type", "createdAt" DESC) 
WHERE "isArchived" = false;

-- Composite index for tag-based queries
-- Used for: Tag filtering with recency
CREATE INDEX IF NOT EXISTS "idx_memories_tags" 
ON "memories" USING GIN ("tags")
WHERE "isArchived" = false;

-- Index for entity-based queries
-- Used for: Finding memories by mentioned entities
CREATE INDEX IF NOT EXISTS "idx_memories_entities" 
ON "memories" USING GIN ("entities")
WHERE "isArchived" = false;

-- Index for summaries by user and time scale
-- Used for: Summary retrieval at different time scales
CREATE INDEX IF NOT EXISTS "idx_summaries_user_timescale" 
ON "summaries" ("userId", "timeScale", "periodEnd" DESC);

-- Index for ProcessedInput by user and time
-- Used for: Recent interaction retrieval
CREATE INDEX IF NOT EXISTS "idx_processed_inputs_user_time" 
ON "processed_inputs" ("userId", "createdAt" DESC);

-- Index for AITaskConfig lookup (frequently accessed for provider routing)
-- Used for: Fast provider/model lookup by task type
CREATE INDEX IF NOT EXISTS "idx_ai_task_config_user_task" 
ON "ai_task_configs" ("userId", "taskType");

-- Index for user settings (frequently accessed)
-- Note: userId is already unique, but adding explicit index for joins
CREATE INDEX IF NOT EXISTS "idx_user_settings_user" 
ON "user_settings" ("userId");

-- Index for notifications by user and read status
-- Used for: Unread notification count, notification list
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" 
ON "notifications" ("userId", "isRead", "createdAt" DESC);

-- Index for scheduled tasks by user and enabled status
-- Used for: Active task retrieval
CREATE INDEX IF NOT EXISTS "idx_scheduled_tasks_user_enabled" 
ON "scheduled_tasks" ("userId", "isEnabled", "nextRunAt");

-- Index for todos by user and status
-- Used for: Active todo list
CREATE INDEX IF NOT EXISTS "idx_todos_user_status" 
ON "todos" ("userId", "status", "createdAt" DESC);

-- Note: Removed idx_memories_recent_hot index that used NOW() - INTERVAL '30 days'
-- PostgreSQL requires functions in index predicates to be IMMUTABLE, but NOW() is not.
-- The idx_memories_user_time index above already covers recent memory queries efficiently.

-- Analyze tables to update statistics for query planner
ANALYZE "memories";
ANALYZE "summaries";
ANALYZE "processed_inputs";
ANALYZE "ai_task_configs";
ANALYZE "user_settings";
ANALYZE "notifications";
ANALYZE "scheduled_tasks";
ANALYZE "todos";
