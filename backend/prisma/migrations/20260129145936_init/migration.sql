-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('SHORT_TERM', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "TimeScale" AS ENUM ('DAILY', 'THREE_DAY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SIX_MONTH', 'YEARLY', 'MULTI_YEAR');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('BROWSER', 'MOBILE_APP', 'WEARABLE', 'IOT', 'DESKTOP_APP', 'OTHER');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CONNECTING', 'ACTIVE', 'PAUSED', 'RESUMING', 'COMPLETING', 'COMPLETED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ConnectionProtocol" AS ENUM ('WEBSOCKET', 'SSE', 'HTTP_POLLING', 'HTTP_STREAMING');

-- CreateEnum
CREATE TYPE "ChunkStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'ERROR', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ChatSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('OPENAI', 'OPENAI_COMPATIBLE');

-- CreateEnum
CREATE TYPE "ModelCapability" AS ENUM ('SPEECH_TO_TEXT', 'ROUTING', 'REFLECTION', 'IMAGE_GENERATION', 'EMBEDDINGS', 'CHAT', 'SUMMARIZATION', 'ANALYSIS');

-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TodoPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('ONE_TIME', 'CRON', 'INTERVAL');

-- CreateEnum
CREATE TYPE "TaskActionType" AS ENUM ('SEND_NOTIFICATION', 'CREATE_TODO', 'GENERATE_SUMMARY', 'RUN_AGENT', 'WEBHOOK', 'WATCH_RESOURCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('HEALTH', 'MENTAL', 'PRODUCTIVITY', 'GOALS', 'HABITS', 'RELATIONSHIPS', 'LEARNING', 'FINANCIAL', 'SYSTEM', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'WEBHOOK', 'PUSHOVER', 'TELEGRAM', 'CHAT');

-- CreateEnum
CREATE TYPE "MCPTransportType" AS ENUM ('STDIO', 'HTTP', 'SSE');

-- CreateEnum
CREATE TYPE "LongRunningTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskCompletionBehavior" AS ENUM ('SILENT', 'NOTIFY_USER', 'NOTIFY_AND_SUMMARIZE');

-- CreateEnum
CREATE TYPE "GenerationSessionStatus" AS ENUM ('PENDING', 'SPECIFICATION', 'PLANNING', 'IMPLEMENTING', 'TESTING', 'FIXING', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HealthReportStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'FAILING', 'HEALING', 'HEALED', 'REQUIRES_ATTENTION');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AIInstructionCategory" AS ENUM ('DATA_COHERENCE', 'USER_PATTERN', 'USER_PREFERENCE', 'TASK_OPTIMIZATION', 'GOAL_TRACKING', 'HEALTH_INSIGHT', 'COMMUNICATION_STYLE', 'SCHEDULING', 'SYSTEM_IMPROVEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FactCheckStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('RECORDING', 'PAUSED', 'COMPLETED', 'PROCESSING', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('PRODUCTIVITY', 'DEVELOPMENT', 'WRITING', 'RESEARCH', 'AUTOMATION', 'ANALYSIS', 'COMMUNICATION', 'CREATIVITY', 'HEALTH', 'FINANCE', 'LEARNING', 'OTHER');

-- CreateEnum
CREATE TYPE "SkillSourceType" AS ENUM ('BUILTIN', 'HUB', 'MARKETPLACE', 'GITHUB', 'LOCAL');

-- CreateEnum
CREATE TYPE "SkillPriority" AS ENUM ('WORKSPACE', 'MANAGED', 'BUILTIN', 'CRITICAL', 'HIGH', 'NORMAL', 'LOW');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "continuousListeningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "wakeWord" TEXT NOT NULL DEFAULT 'Hey Brain',
    "wakeWordSensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "minImportanceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "silenceDetectionMs" INTEGER NOT NULL DEFAULT 1500,
    "autoRespondToQuestions" BOOLEAN NOT NULL DEFAULT true,
    "vadSensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "speakerConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "autoDeleteAudioAfterProcess" BOOLEAN NOT NULL DEFAULT true,
    "noiseFilterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "noiseFilterSensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "filterMediaPlayback" BOOLEAN NOT NULL DEFAULT true,
    "filterBackgroundConvo" BOOLEAN NOT NULL DEFAULT true,
    "filterTrivialSelfTalk" BOOLEAN NOT NULL DEFAULT true,
    "filterThirdPartyAddress" BOOLEAN NOT NULL DEFAULT true,
    "askConfirmationOnAmbiguous" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnMemoryStored" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnCommandDetected" BOOLEAN NOT NULL DEFAULT true,
    "pushoverUserKey" TEXT,
    "pushoverApiToken" TEXT,
    "telegramBotToken" TEXT,
    "telegramChatId" TEXT,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultMaxTokens" INTEGER NOT NULL DEFAULT 4096,
    "userProfile" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL DEFAULT 'SHORT_TERM',
    "timeScale" "TimeScale",
    "sourceType" TEXT,
    "sourceId" TEXT,
    "interactionId" TEXT,
    "embeddingId" TEXT,
    "embedding" JSONB,
    "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "timeScale" "TimeScale" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sourceMemoryCount" INTEGER NOT NULL DEFAULT 0,
    "keyInsights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentiment" TEXT,
    "actionItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embeddingId" TEXT,
    "embedding" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "lastLlmGenerationAt" TIMESTAMP(3),
    "cacheValidUntil" TIMESTAMP(3),
    "isCached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_inputs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "originalContent" BYTEA,
    "speakerId" TEXT NOT NULL,
    "speakerConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "speakerMethod" TEXT NOT NULL DEFAULT 'assumed',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "durationSeconds" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "audioStreamId" TEXT,

    CONSTRAINT "processed_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaker_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "voiceCharacteristics" JSONB NOT NULL DEFAULT '{}',
    "identificationMethod" TEXT NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "centroidEmbedding" JSONB,
    "embeddingModel" TEXT NOT NULL DEFAULT 'ecapa-tdnn',
    "embeddingVersion" TEXT NOT NULL DEFAULT '1.0',
    "isEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "enrollmentDate" TIMESTAMP(3),
    "lastTrainingDate" TIMESTAMP(3),
    "adaptiveLearningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastAdaptiveUpdate" TIMESTAMP(3),
    "adaptiveUpdateCount" INTEGER NOT NULL DEFAULT 0,
    "profileHealth" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lastHealthCheck" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "frozenAt" TIMESTAMP(3),
    "frozenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_samples" (
    "id" TEXT NOT NULL,
    "speakerProfileId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/wav',
    "fileSizeBytes" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "phraseText" TEXT,
    "phraseCategory" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "embedding" JSONB,
    "embeddingModel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "speakerProfileId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL DEFAULT 'ecapa-tdnn',
    "sampleCount" INTEGER NOT NULL,
    "totalDuration" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "errorMessage" TEXT,
    "centroidEmbedding" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "intraClassVariance" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adaptive_samples" (
    "id" TEXT NOT NULL,
    "speakerProfileId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceSessionId" TEXT,
    "embedding" JSONB NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "audioQualityScore" DOUBLE PRECISION NOT NULL,
    "audioData" BYTEA,
    "audioMimeType" TEXT,
    "admissionSimilarity" DOUBLE PRECISION NOT NULL,
    "crossValidationScore" DOUBLE PRECISION NOT NULL,
    "contributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "decayFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedInCentroid" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "adaptive_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negative_examples" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clusterId" TEXT,
    "embedding" DOUBLE PRECISION[],
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceSessionId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "audioData" BYTEA,
    "audioMimeType" TEXT,
    "externalPersonId" TEXT,

    CONSTRAINT "negative_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_snapshots" (
    "id" TEXT NOT NULL,
    "speakerProfileId" TEXT NOT NULL,
    "centroid" JSONB NOT NULL,
    "adaptiveSampleIds" TEXT[],
    "trainingSampleCount" INTEGER NOT NULL,
    "adaptiveSampleCount" INTEGER NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "intraClassVariance" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_health_logs" (
    "id" TEXT NOT NULL,
    "speakerProfileId" TEXT NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "intraClassVariance" DOUBLE PRECISION NOT NULL,
    "interClassSeparation" DOUBLE PRECISION,
    "sampleCount" INTEGER NOT NULL,
    "adaptiveSampleCount" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "recommendations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_stream_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionName" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'wav',
    "sampleRate" INTEGER NOT NULL DEFAULT 16000,
    "channelCount" INTEGER NOT NULL DEFAULT 1,
    "duration" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audio_stream_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_batches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchName" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "totalDuration" DOUBLE PRECISION,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audio_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "deviceName" TEXT,
    "deviceToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastProtocol" TEXT,
    "lastIpAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universal_audio_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'CONNECTING',
    "protocol" "ConnectionProtocol" NOT NULL DEFAULT 'WEBSOCKET',
    "fallbackCount" INTEGER NOT NULL DEFAULT 0,
    "audioFormat" JSONB NOT NULL DEFAULT '{}',
    "chunksReceived" INTEGER NOT NULL DEFAULT 0,
    "bytesReceived" INTEGER NOT NULL DEFAULT 0,
    "lastChunkSeq" INTEGER NOT NULL DEFAULT 0,
    "missingChunks" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "lastChunkAt" TIMESTAMP(3),
    "pendingEvents" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "lastEventId" INTEGER NOT NULL DEFAULT 0,
    "lastEventDelivery" TIMESTAMP(3),
    "totalTranscripts" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universal_audio_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_chunks" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "audioData" BYTEA NOT NULL,
    "audioFormat" TEXT NOT NULL,
    "sampleRate" INTEGER NOT NULL DEFAULT 16000,
    "durationMs" INTEGER NOT NULL,
    "bytesReceived" INTEGER NOT NULL,
    "status" "ChunkStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "transcript" TEXT,
    "vadDetected" BOOLEAN,
    "speakerId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_processing_results" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "processedInputId" TEXT NOT NULL,
    "fileIndex" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "processingTime" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,

    CONSTRAINT "batch_processing_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "input_processing_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "totalInputs" INTEGER NOT NULL,
    "successfulInputs" INTEGER NOT NULL,
    "failedInputs" INTEGER NOT NULL,
    "averageProcessingTime" DOUBLE PRECISION,
    "lastProcessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "input_processing_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capabilities" "ModelCapability"[],
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_task_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" "ModelCapability" NOT NULL,
    "providerId" TEXT,
    "modelId" TEXT,
    "fallbackProviderId" TEXT,
    "fallbackModelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_task_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_compatibility_hints" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "supportedEndpoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unsupportedEndpoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredEndpoint" TEXT,
    "lastErrorType" TEXT,
    "lastErrorMessage" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorTime" TIMESTAMP(3),
    "lastSuccessTime" TIMESTAMP(3),
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_compatibility_hints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatgpt_oauth_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatgpt_oauth_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatgpt_oauth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatgpt_oauth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "serializedContext" JSONB NOT NULL DEFAULT '{}',
    "lastProvider" TEXT,
    "lastModelId" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "totalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "status" "ChatSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastMessageAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TodoPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueDate" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "completedAt" TIMESTAMP(3),
    "sourceMemoryId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scheduleType" "ScheduleType" NOT NULL,
    "cronExpression" TEXT,
    "executeAt" TIMESTAMP(3),
    "interval" INTEGER,
    "actionType" "TaskActionType" NOT NULL,
    "actionPayload" JSONB NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunStatus" TEXT,
    "lastRunError" TEXT,
    "maxRuns" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_executions" (
    "id" TEXT NOT NULL,
    "scheduledTaskId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "task_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "topicTrackerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_topic_trackers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'GENERAL',
    "lastContentHash" TEXT NOT NULL,
    "sampleMessages" TEXT[],
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "nextAllowedAt" TIMESTAMP(3) NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "isGivenUp" BOOLEAN NOT NULL DEFAULT false,
    "lastUserResponse" TIMESTAMP(3),
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 1,
    "totalBlocked" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_topic_trackers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tips" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "targetFeature" TEXT,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tool_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "rateLimit" INTEGER,
    "timeout" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tool_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_servers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "transportType" "MCPTransportType" NOT NULL DEFAULT 'STDIO',
    "command" TEXT,
    "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "env" JSONB NOT NULL DEFAULT '{}',
    "url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastConnected" TIMESTAMP(3),
    "lastError" TEXT,
    "availableTools" JSONB NOT NULL DEFAULT '[]',
    "serverInfo" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_tools" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolSlug" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "marketplace_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "long_running_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "estimatedDurationMinutes" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastPausedAt" TIMESTAMP(3),
    "lastResumedAt" TIMESTAMP(3),
    "status" "LongRunningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "errorMessage" TEXT,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "completedSteps" INTEGER NOT NULL DEFAULT 0,
    "lastCheckpointAt" TIMESTAMP(3),
    "lastCheckpointSummary" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "completionBehavior" "TaskCompletionBehavior" NOT NULL DEFAULT 'NOTIFY_USER',
    "notifyOnProgress" BOOLEAN NOT NULL DEFAULT false,
    "progressIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "context" JSONB NOT NULL DEFAULT '{}',
    "finalSummary" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "long_running_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_steps" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "action" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "expectedDurationMinutes" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "TaskStepStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "isCheckpoint" BOOLEAN NOT NULL DEFAULT false,
    "onError" TEXT NOT NULL DEFAULT 'abort',
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_secrets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "displayName" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_tools" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'python',
    "code" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "outputSchema" JSONB,
    "requiredSecrets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL DEFAULT 'custom',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousCode" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_generation_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolId" TEXT,
    "objective" TEXT NOT NULL,
    "context" TEXT,
    "suggestedSecrets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "GenerationSessionStatus" NOT NULL DEFAULT 'PENDING',
    "currentPhase" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "specDocument" TEXT,
    "implementationPlan" TEXT,
    "generatedCode" TEXT,
    "testCode" TEXT,
    "testResults" JSONB,
    "schemaJson" JSONB,
    "currentIteration" INTEGER NOT NULL DEFAULT 0,
    "maxIterations" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "errorHistory" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_generation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_generation_logs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "step" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "promptSent" TEXT,
    "responseReceived" TEXT,
    "modelUsed" TEXT,
    "tokensUsed" INTEGER,
    "codeExecuted" TEXT,
    "executionResult" JSONB,
    "executionTimeMs" INTEGER,
    "metadata" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_health_reports" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "status" "HealthReportStatus" NOT NULL DEFAULT 'HEALTHY',
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "issuesDetected" JSONB NOT NULL DEFAULT '[]',
    "errorPatterns" JSONB,
    "suggestedFixes" JSONB,
    "rootCauseAnalysis" TEXT,
    "healingAttempted" BOOLEAN NOT NULL DEFAULT false,
    "healingSuccess" BOOLEAN,
    "healedCode" TEXT,
    "healingLog" JSONB,
    "recentSuccessRate" DOUBLE PRECISION,
    "recentErrorCount" INTEGER NOT NULL DEFAULT 0,
    "recentUsageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_health_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_execution_logs" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputParams" JSONB,
    "success" BOOLEAN NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "errorType" TEXT,
    "executionTimeMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "triggeredBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "detectedFrom" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedMemoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_instructions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "category" "AIInstructionCategory" NOT NULL,
    "sourceAgent" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "relatedGoalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedTodoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedMemoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "isUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "detectedFrom" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "significance" TEXT NOT NULL DEFAULT 'normal',
    "relatedGoalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedMemoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_presence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "isFocused" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_check_results" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "originalAnswer" TEXT NOT NULL,
    "claimsIdentified" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "claimsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "status" "FactCheckStatus" NOT NULL DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "overallAccuracy" TEXT,
    "needsCorrection" BOOLEAN NOT NULL DEFAULT false,
    "correctionNeeded" TEXT,
    "suggestedCorrection" TEXT,
    "verificationMethod" TEXT,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationNotes" TEXT,
    "notificationId" TEXT,
    "correctionSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "fact_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "factCheckId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "correction" TEXT NOT NULL,
    "originalClaim" TEXT,
    "notificationId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correction_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_recordings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "conversationId" TEXT NOT NULL,
    "status" "RecordingStatus" NOT NULL DEFAULT 'RECORDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalDurationSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "audioChunkCount" INTEGER NOT NULL DEFAULT 0,
    "totalAudioSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "transcriptionStatus" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "fullTranscript" TEXT,
    "summaryShort" TEXT,
    "summaryLong" TEXT,
    "keyPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentiment" TEXT,
    "emotions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "speakerName" TEXT,
    "speakerRole" TEXT,
    "isMainSpeaker" BOOLEAN NOT NULL DEFAULT false,
    "voiceEmbedding" JSONB,
    "speakTimeSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_audio_segments" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "startTimeMs" DOUBLE PRECISION NOT NULL,
    "endTimeMs" DOUBLE PRECISION NOT NULL,
    "durationMs" DOUBLE PRECISION NOT NULL,
    "audioData" BYTEA NOT NULL,
    "audioCodec" TEXT NOT NULL DEFAULT 'aac',
    "sampleRate" INTEGER NOT NULL DEFAULT 16000,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_audio_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_segments" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "startTimeMs" DOUBLE PRECISION NOT NULL,
    "endTimeMs" DOUBLE PRECISION NOT NULL,
    "transcript" TEXT NOT NULL,
    "speakerId" TEXT,
    "confidence" DOUBLE PRECISION,
    "language" TEXT DEFAULT 'en',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcription_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_hub_entries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "author" TEXT NOT NULL DEFAULT 'community',
    "category" "SkillCategory" NOT NULL DEFAULT 'OTHER',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "icon" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installs" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" "SkillSourceType" NOT NULL DEFAULT 'BUILTIN',
    "sourceUrl" TEXT,
    "downloadUrl" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "skillContent" TEXT,
    "hasScripts" BOOLEAN NOT NULL DEFAULT false,
    "hasReferences" BOOLEAN NOT NULL DEFAULT false,
    "hasAssets" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_hub_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installed_skills" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hubEntryId" TEXT,
    "skillSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "installedVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "updateAvailable" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "env" JSONB NOT NULL DEFAULT '{}',
    "apiKey" TEXT,
    "localPath" TEXT,
    "skillMdContent" TEXT,
    "frontmatter" JSONB NOT NULL DEFAULT '{}',
    "priority" "SkillPriority" NOT NULL DEFAULT 'MANAGED',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installed_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SourceMemories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ConversationMemories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "memories_userId_idx" ON "memories"("userId");

-- CreateIndex
CREATE INDEX "memories_type_idx" ON "memories"("type");

-- CreateIndex
CREATE INDEX "memories_timeScale_idx" ON "memories"("timeScale");

-- CreateIndex
CREATE INDEX "memories_importanceScore_idx" ON "memories"("importanceScore");

-- CreateIndex
CREATE INDEX "memories_isArchived_idx" ON "memories"("isArchived");

-- CreateIndex
CREATE INDEX "memories_createdAt_idx" ON "memories"("createdAt");

-- CreateIndex
CREATE INDEX "summaries_userId_idx" ON "summaries"("userId");

-- CreateIndex
CREATE INDEX "summaries_timeScale_idx" ON "summaries"("timeScale");

-- CreateIndex
CREATE INDEX "summaries_periodStart_periodEnd_idx" ON "summaries"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "processed_inputs_userId_idx" ON "processed_inputs"("userId");

-- CreateIndex
CREATE INDEX "processed_inputs_status_idx" ON "processed_inputs"("status");

-- CreateIndex
CREATE INDEX "speaker_profiles_userId_idx" ON "speaker_profiles"("userId");

-- CreateIndex
CREATE INDEX "voice_samples_speakerProfileId_idx" ON "voice_samples"("speakerProfileId");

-- CreateIndex
CREATE INDEX "voice_samples_status_idx" ON "voice_samples"("status");

-- CreateIndex
CREATE INDEX "training_sessions_speakerProfileId_idx" ON "training_sessions"("speakerProfileId");

-- CreateIndex
CREATE INDEX "training_sessions_status_idx" ON "training_sessions"("status");

-- CreateIndex
CREATE INDEX "adaptive_samples_speakerProfileId_idx" ON "adaptive_samples"("speakerProfileId");

-- CreateIndex
CREATE INDEX "adaptive_samples_admittedAt_idx" ON "adaptive_samples"("admittedAt");

-- CreateIndex
CREATE INDEX "adaptive_samples_isActive_idx" ON "adaptive_samples"("isActive");

-- CreateIndex
CREATE INDEX "negative_examples_userId_idx" ON "negative_examples"("userId");

-- CreateIndex
CREATE INDEX "negative_examples_clusterId_idx" ON "negative_examples"("clusterId");

-- CreateIndex
CREATE INDEX "profile_snapshots_speakerProfileId_idx" ON "profile_snapshots"("speakerProfileId");

-- CreateIndex
CREATE INDEX "profile_snapshots_createdAt_idx" ON "profile_snapshots"("createdAt");

-- CreateIndex
CREATE INDEX "profile_health_logs_speakerProfileId_idx" ON "profile_health_logs"("speakerProfileId");

-- CreateIndex
CREATE INDEX "profile_health_logs_createdAt_idx" ON "profile_health_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audio_stream_sessions_userId_idx" ON "audio_stream_sessions"("userId");

-- CreateIndex
CREATE INDEX "audio_batches_userId_idx" ON "audio_batches"("userId");

-- CreateIndex
CREATE INDEX "audio_batches_status_idx" ON "audio_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "audio_devices_deviceToken_key" ON "audio_devices"("deviceToken");

-- CreateIndex
CREATE INDEX "audio_devices_userId_idx" ON "audio_devices"("userId");

-- CreateIndex
CREATE INDEX "audio_devices_deviceToken_idx" ON "audio_devices"("deviceToken");

-- CreateIndex
CREATE INDEX "audio_devices_isActive_idx" ON "audio_devices"("isActive");

-- CreateIndex
CREATE INDEX "universal_audio_sessions_userId_idx" ON "universal_audio_sessions"("userId");

-- CreateIndex
CREATE INDEX "universal_audio_sessions_deviceId_idx" ON "universal_audio_sessions"("deviceId");

-- CreateIndex
CREATE INDEX "universal_audio_sessions_status_idx" ON "universal_audio_sessions"("status");

-- CreateIndex
CREATE INDEX "universal_audio_sessions_startedAt_idx" ON "universal_audio_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "audio_chunks_sessionId_idx" ON "audio_chunks"("sessionId");

-- CreateIndex
CREATE INDEX "audio_chunks_status_idx" ON "audio_chunks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "audio_chunks_sessionId_sequence_key" ON "audio_chunks"("sessionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "batch_processing_results_batchId_fileIndex_key" ON "batch_processing_results"("batchId", "fileIndex");

-- CreateIndex
CREATE UNIQUE INDEX "input_processing_metrics_snapshotId_key" ON "input_processing_metrics"("snapshotId");

-- CreateIndex
CREATE INDEX "input_processing_metrics_userId_idx" ON "input_processing_metrics"("userId");

-- CreateIndex
CREATE INDEX "ai_providers_userId_idx" ON "ai_providers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_userId_name_key" ON "ai_providers"("userId", "name");

-- CreateIndex
CREATE INDEX "ai_models_providerId_idx" ON "ai_models"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_providerId_modelId_key" ON "ai_models"("providerId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_task_configs_taskType_key" ON "ai_task_configs"("taskType");

-- CreateIndex
CREATE INDEX "ai_task_configs_userId_idx" ON "ai_task_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_task_configs_userId_taskType_key" ON "ai_task_configs"("userId", "taskType");

-- CreateIndex
CREATE INDEX "model_compatibility_hints_providerId_idx" ON "model_compatibility_hints"("providerId");

-- CreateIndex
CREATE INDEX "model_compatibility_hints_isBlacklisted_idx" ON "model_compatibility_hints"("isBlacklisted");

-- CreateIndex
CREATE UNIQUE INDEX "model_compatibility_hints_providerId_modelId_key" ON "model_compatibility_hints"("providerId", "modelId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "chatgpt_oauth_credentials_userId_key" ON "chatgpt_oauth_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chatgpt_oauth_sessions_state_key" ON "chatgpt_oauth_sessions"("state");

-- CreateIndex
CREATE INDEX "chatgpt_oauth_sessions_userId_idx" ON "chatgpt_oauth_sessions"("userId");

-- CreateIndex
CREATE INDEX "chatgpt_oauth_sessions_state_idx" ON "chatgpt_oauth_sessions"("state");

-- CreateIndex
CREATE INDEX "chatgpt_oauth_sessions_expiresAt_idx" ON "chatgpt_oauth_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "chat_sessions_userId_idx" ON "chat_sessions"("userId");

-- CreateIndex
CREATE INDEX "chat_sessions_status_idx" ON "chat_sessions"("status");

-- CreateIndex
CREATE INDEX "chat_sessions_isPinned_idx" ON "chat_sessions"("isPinned");

-- CreateIndex
CREATE INDEX "chat_sessions_lastMessageAt_idx" ON "chat_sessions"("lastMessageAt");

-- CreateIndex
CREATE INDEX "chat_sessions_createdAt_idx" ON "chat_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "todos_userId_idx" ON "todos"("userId");

-- CreateIndex
CREATE INDEX "todos_status_idx" ON "todos"("status");

-- CreateIndex
CREATE INDEX "todos_dueDate_idx" ON "todos"("dueDate");

-- CreateIndex
CREATE INDEX "todos_priority_idx" ON "todos"("priority");

-- CreateIndex
CREATE INDEX "scheduled_tasks_userId_idx" ON "scheduled_tasks"("userId");

-- CreateIndex
CREATE INDEX "scheduled_tasks_isEnabled_idx" ON "scheduled_tasks"("isEnabled");

-- CreateIndex
CREATE INDEX "scheduled_tasks_nextRunAt_idx" ON "scheduled_tasks"("nextRunAt");

-- CreateIndex
CREATE INDEX "task_executions_scheduledTaskId_idx" ON "task_executions"("scheduledTaskId");

-- CreateIndex
CREATE INDEX "task_executions_startedAt_idx" ON "task_executions"("startedAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_scheduledFor_idx" ON "notifications"("scheduledFor");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_topicTrackerId_idx" ON "notifications"("topicTrackerId");

-- CreateIndex
CREATE INDEX "notification_topic_trackers_userId_idx" ON "notification_topic_trackers"("userId");

-- CreateIndex
CREATE INDEX "notification_topic_trackers_nextAllowedAt_idx" ON "notification_topic_trackers"("nextAllowedAt");

-- CreateIndex
CREATE INDEX "notification_topic_trackers_isGivenUp_idx" ON "notification_topic_trackers"("isGivenUp");

-- CreateIndex
CREATE INDEX "notification_topic_trackers_category_idx" ON "notification_topic_trackers"("category");

-- CreateIndex
CREATE UNIQUE INDEX "notification_topic_trackers_userId_topic_key" ON "notification_topic_trackers"("userId", "topic");

-- CreateIndex
CREATE INDEX "tips_userId_idx" ON "tips"("userId");

-- CreateIndex
CREATE INDEX "tips_isDismissed_idx" ON "tips"("isDismissed");

-- CreateIndex
CREATE INDEX "tips_targetFeature_idx" ON "tips"("targetFeature");

-- CreateIndex
CREATE INDEX "tips_priority_idx" ON "tips"("priority");

-- CreateIndex
CREATE INDEX "user_tool_configs_userId_idx" ON "user_tool_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_tool_configs_userId_toolId_key" ON "user_tool_configs"("userId", "toolId");

-- CreateIndex
CREATE INDEX "mcp_servers_userId_idx" ON "mcp_servers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_servers_userId_name_key" ON "mcp_servers"("userId", "name");

-- CreateIndex
CREATE INDEX "marketplace_tools_userId_idx" ON "marketplace_tools"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_tools_userId_toolSlug_key" ON "marketplace_tools"("userId", "toolSlug");

-- CreateIndex
CREATE INDEX "long_running_tasks_userId_idx" ON "long_running_tasks"("userId");

-- CreateIndex
CREATE INDEX "long_running_tasks_status_idx" ON "long_running_tasks"("status");

-- CreateIndex
CREATE INDEX "long_running_tasks_priority_idx" ON "long_running_tasks"("priority");

-- CreateIndex
CREATE INDEX "long_running_tasks_createdAt_idx" ON "long_running_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "task_steps_taskId_idx" ON "task_steps"("taskId");

-- CreateIndex
CREATE INDEX "task_steps_status_idx" ON "task_steps"("status");

-- CreateIndex
CREATE UNIQUE INDEX "task_steps_taskId_stepOrder_key" ON "task_steps"("taskId", "stepOrder");

-- CreateIndex
CREATE INDEX "task_logs_taskId_idx" ON "task_logs"("taskId");

-- CreateIndex
CREATE INDEX "task_logs_createdAt_idx" ON "task_logs"("createdAt");

-- CreateIndex
CREATE INDEX "user_secrets_userId_idx" ON "user_secrets"("userId");

-- CreateIndex
CREATE INDEX "user_secrets_category_idx" ON "user_secrets"("category");

-- CreateIndex
CREATE UNIQUE INDEX "user_secrets_userId_key_key" ON "user_secrets"("userId", "key");

-- CreateIndex
CREATE INDEX "generated_tools_userId_idx" ON "generated_tools"("userId");

-- CreateIndex
CREATE INDEX "generated_tools_category_idx" ON "generated_tools"("category");

-- CreateIndex
CREATE INDEX "generated_tools_enabled_idx" ON "generated_tools"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "generated_tools_userId_name_key" ON "generated_tools"("userId", "name");

-- CreateIndex
CREATE INDEX "tool_generation_sessions_userId_idx" ON "tool_generation_sessions"("userId");

-- CreateIndex
CREATE INDEX "tool_generation_sessions_status_idx" ON "tool_generation_sessions"("status");

-- CreateIndex
CREATE INDEX "tool_generation_sessions_toolId_idx" ON "tool_generation_sessions"("toolId");

-- CreateIndex
CREATE INDEX "tool_generation_logs_sessionId_idx" ON "tool_generation_logs"("sessionId");

-- CreateIndex
CREATE INDEX "tool_generation_logs_phase_idx" ON "tool_generation_logs"("phase");

-- CreateIndex
CREATE INDEX "tool_generation_logs_level_idx" ON "tool_generation_logs"("level");

-- CreateIndex
CREATE INDEX "tool_health_reports_toolId_idx" ON "tool_health_reports"("toolId");

-- CreateIndex
CREATE INDEX "tool_health_reports_status_idx" ON "tool_health_reports"("status");

-- CreateIndex
CREATE INDEX "tool_health_reports_healthScore_idx" ON "tool_health_reports"("healthScore");

-- CreateIndex
CREATE INDEX "tool_execution_logs_toolId_idx" ON "tool_execution_logs"("toolId");

-- CreateIndex
CREATE INDEX "tool_execution_logs_userId_idx" ON "tool_execution_logs"("userId");

-- CreateIndex
CREATE INDEX "tool_execution_logs_success_idx" ON "tool_execution_logs"("success");

-- CreateIndex
CREATE INDEX "tool_execution_logs_createdAt_idx" ON "tool_execution_logs"("createdAt");

-- CreateIndex
CREATE INDEX "goals_userId_idx" ON "goals"("userId");

-- CreateIndex
CREATE INDEX "goals_status_idx" ON "goals"("status");

-- CreateIndex
CREATE INDEX "goals_category_idx" ON "goals"("category");

-- CreateIndex
CREATE INDEX "goals_createdAt_idx" ON "goals"("createdAt");

-- CreateIndex
CREATE INDEX "ai_instructions_userId_idx" ON "ai_instructions"("userId");

-- CreateIndex
CREATE INDEX "ai_instructions_category_idx" ON "ai_instructions"("category");

-- CreateIndex
CREATE INDEX "ai_instructions_sourceAgent_idx" ON "ai_instructions"("sourceAgent");

-- CreateIndex
CREATE INDEX "ai_instructions_isActive_idx" ON "ai_instructions"("isActive");

-- CreateIndex
CREATE INDEX "ai_instructions_priority_idx" ON "ai_instructions"("priority");

-- CreateIndex
CREATE INDEX "ai_instructions_createdAt_idx" ON "ai_instructions"("createdAt");

-- CreateIndex
CREATE INDEX "achievements_userId_idx" ON "achievements"("userId");

-- CreateIndex
CREATE INDEX "achievements_isUnlocked_idx" ON "achievements"("isUnlocked");

-- CreateIndex
CREATE INDEX "achievements_category_idx" ON "achievements"("category");

-- CreateIndex
CREATE INDEX "achievements_unlockedAt_idx" ON "achievements"("unlockedAt");

-- CreateIndex
CREATE INDEX "achievements_createdAt_idx" ON "achievements"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_presence_userId_key" ON "user_presence"("userId");

-- CreateIndex
CREATE INDEX "fact_check_results_userId_idx" ON "fact_check_results"("userId");

-- CreateIndex
CREATE INDEX "fact_check_results_status_idx" ON "fact_check_results"("status");

-- CreateIndex
CREATE INDEX "fact_check_results_conversationId_idx" ON "fact_check_results"("conversationId");

-- CreateIndex
CREATE INDEX "fact_check_results_needsCorrection_idx" ON "fact_check_results"("needsCorrection");

-- CreateIndex
CREATE INDEX "fact_check_results_createdAt_idx" ON "fact_check_results"("createdAt");

-- CreateIndex
CREATE INDEX "correction_notifications_userId_idx" ON "correction_notifications"("userId");

-- CreateIndex
CREATE INDEX "correction_notifications_factCheckId_idx" ON "correction_notifications"("factCheckId");

-- CreateIndex
CREATE INDEX "correction_notifications_isRead_idx" ON "correction_notifications"("isRead");

-- CreateIndex
CREATE INDEX "correction_notifications_createdAt_idx" ON "correction_notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_recordings_conversationId_key" ON "conversation_recordings"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_recordings_userId_idx" ON "conversation_recordings"("userId");

-- CreateIndex
CREATE INDEX "conversation_recordings_conversationId_idx" ON "conversation_recordings"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_recordings_status_idx" ON "conversation_recordings"("status");

-- CreateIndex
CREATE INDEX "conversation_recordings_isActive_idx" ON "conversation_recordings"("isActive");

-- CreateIndex
CREATE INDEX "conversation_recordings_startedAt_idx" ON "conversation_recordings"("startedAt");

-- CreateIndex
CREATE INDEX "conversation_recordings_createdAt_idx" ON "conversation_recordings"("createdAt");

-- CreateIndex
CREATE INDEX "conversation_participants_recordingId_idx" ON "conversation_participants"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_recordingId_speakerId_key" ON "conversation_participants"("recordingId", "speakerId");

-- CreateIndex
CREATE INDEX "conversation_audio_segments_recordingId_idx" ON "conversation_audio_segments"("recordingId");

-- CreateIndex
CREATE INDEX "conversation_audio_segments_sequenceNumber_idx" ON "conversation_audio_segments"("sequenceNumber");

-- CreateIndex
CREATE INDEX "transcription_segments_recordingId_idx" ON "transcription_segments"("recordingId");

-- CreateIndex
CREATE INDEX "transcription_segments_speakerId_idx" ON "transcription_segments"("speakerId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_hub_entries_slug_key" ON "skill_hub_entries"("slug");

-- CreateIndex
CREATE INDEX "skill_hub_entries_category_idx" ON "skill_hub_entries"("category");

-- CreateIndex
CREATE INDEX "skill_hub_entries_sourceType_idx" ON "skill_hub_entries"("sourceType");

-- CreateIndex
CREATE INDEX "installed_skills_userId_idx" ON "installed_skills"("userId");

-- CreateIndex
CREATE INDEX "installed_skills_enabled_idx" ON "installed_skills"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "installed_skills_userId_skillSlug_key" ON "installed_skills"("userId", "skillSlug");

-- CreateIndex
CREATE UNIQUE INDEX "_SourceMemories_AB_unique" ON "_SourceMemories"("A", "B");

-- CreateIndex
CREATE INDEX "_SourceMemories_B_index" ON "_SourceMemories"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ConversationMemories_AB_unique" ON "_ConversationMemories"("A", "B");

-- CreateIndex
CREATE INDEX "_ConversationMemories_B_index" ON "_ConversationMemories"("B");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_inputs" ADD CONSTRAINT "processed_inputs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_inputs" ADD CONSTRAINT "processed_inputs_audioStreamId_fkey" FOREIGN KEY ("audioStreamId") REFERENCES "audio_stream_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_profiles" ADD CONSTRAINT "speaker_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adaptive_samples" ADD CONSTRAINT "adaptive_samples_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negative_examples" ADD CONSTRAINT "negative_examples_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_health_logs" ADD CONSTRAINT "profile_health_logs_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_stream_sessions" ADD CONSTRAINT "audio_stream_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_batches" ADD CONSTRAINT "audio_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_devices" ADD CONSTRAINT "audio_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universal_audio_sessions" ADD CONSTRAINT "universal_audio_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universal_audio_sessions" ADD CONSTRAINT "universal_audio_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "audio_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_chunks" ADD CONSTRAINT "audio_chunks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "universal_audio_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_processing_results" ADD CONSTRAINT "batch_processing_results_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "audio_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_processing_results" ADD CONSTRAINT "batch_processing_results_processedInputId_fkey" FOREIGN KEY ("processedInputId") REFERENCES "processed_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_processing_metrics" ADD CONSTRAINT "input_processing_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_processing_metrics" ADD CONSTRAINT "input_processing_metrics_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "processed_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_task_configs" ADD CONSTRAINT "ai_task_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_task_configs" ADD CONSTRAINT "ai_task_configs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_task_configs" ADD CONSTRAINT "ai_task_configs_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_task_configs" ADD CONSTRAINT "ai_task_configs_fallbackProviderId_fkey" FOREIGN KEY ("fallbackProviderId") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_task_configs" ADD CONSTRAINT "ai_task_configs_fallbackModelId_fkey" FOREIGN KEY ("fallbackModelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_compatibility_hints" ADD CONSTRAINT "model_compatibility_hints_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatgpt_oauth_credentials" ADD CONSTRAINT "chatgpt_oauth_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_scheduledTaskId_fkey" FOREIGN KEY ("scheduledTaskId") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_topicTrackerId_fkey" FOREIGN KEY ("topicTrackerId") REFERENCES "notification_topic_trackers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_topic_trackers" ADD CONSTRAINT "notification_topic_trackers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips" ADD CONSTRAINT "tips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tool_configs" ADD CONSTRAINT "user_tool_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_tools" ADD CONSTRAINT "marketplace_tools_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "long_running_tasks" ADD CONSTRAINT "long_running_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "long_running_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "long_running_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_secrets" ADD CONSTRAINT "user_secrets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_tools" ADD CONSTRAINT "generated_tools_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_generation_sessions" ADD CONSTRAINT "tool_generation_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_generation_sessions" ADD CONSTRAINT "tool_generation_sessions_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "generated_tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_generation_logs" ADD CONSTRAINT "tool_generation_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tool_generation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_health_reports" ADD CONSTRAINT "tool_health_reports_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "generated_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_execution_logs" ADD CONSTRAINT "tool_execution_logs_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "generated_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_instructions" ADD CONSTRAINT "ai_instructions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_check_results" ADD CONSTRAINT "fact_check_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_notifications" ADD CONSTRAINT "correction_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_notifications" ADD CONSTRAINT "correction_notifications_factCheckId_fkey" FOREIGN KEY ("factCheckId") REFERENCES "fact_check_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_recordings" ADD CONSTRAINT "conversation_recordings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "conversation_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_audio_segments" ADD CONSTRAINT "conversation_audio_segments_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "conversation_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcription_segments" ADD CONSTRAINT "transcription_segments_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "conversation_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_skills" ADD CONSTRAINT "installed_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_skills" ADD CONSTRAINT "installed_skills_hubEntryId_fkey" FOREIGN KEY ("hubEntryId") REFERENCES "skill_hub_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SourceMemories" ADD CONSTRAINT "_SourceMemories_A_fkey" FOREIGN KEY ("A") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SourceMemories" ADD CONSTRAINT "_SourceMemories_B_fkey" FOREIGN KEY ("B") REFERENCES "summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConversationMemories" ADD CONSTRAINT "_ConversationMemories_A_fkey" FOREIGN KEY ("A") REFERENCES "conversation_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConversationMemories" ADD CONSTRAINT "_ConversationMemories_B_fkey" FOREIGN KEY ("B") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

