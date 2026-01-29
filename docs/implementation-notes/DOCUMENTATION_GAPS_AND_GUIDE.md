# Documentation Gaps & How-To Guide

Use this document as a checklist to complete the Docs page content section by section. It is based on the current codebase structure and the Docs page sections in `src/pages/DocsPage.tsx`.

---

## 📋 Current Documentation Status

| Section      | Status      | Notes                                      |
| ------------ | ----------- | ------------------------------------------ |
| Overview     | ✅ Complete | Accurate description of the system         |
| Quickstart   | ✅ Complete | Commands verified against `package.json`   |
| Architecture | ✅ Complete | Request flow and storage layers accurate   |
| Agents       | ✅ Complete | All 7 agents documented with correct roles |
| Memory       | ✅ Complete | Time scales and metadata accurate          |
| Tools        | ✅ Complete | All tool categories documented             |
| Security     | ✅ Complete | JWT, encryption, local-first verified      |
| Roadmap      | ✅ Complete | Phases match current development state     |
| FAQ          | ✅ Complete | Answers verified against implementation    |

---

## ✅ Fact-Check Results (Verified January 2026)

### Overview Section - VERIFIED ✅

**Claim**: "A local-first memory system with a React UI and an Express API"
**Verified**: ✅ Correct - `backend/services/api-server.ts` is Express, frontend is React/Vite

**Claim**: "stores memories in Postgres, and indexes embeddings in Weaviate"
**Verified**: ✅ Correct - `backend/prisma/schema.prisma` defines Memory model in Postgres, `backend/services/memory-search.ts` handles Weaviate

**Claim**: "Chat via /api/chat (SSE), audio uploads and streams via /api/audio + WebSocket"
**Verified**: ✅ Correct - `chatStream` function in `chat.controller.ts`, audio via WebSocket in `continuous-listening.ts`

### Quickstart Section - VERIFIED ✅

**Commands verified against `package.json`**:

- `./scripts/setup.sh` - ✅ Exists and generates .env + secrets
- `npm install` - ✅ Standard
- `npm run backend:dev` - ✅ Maps to `cd backend && npm run dev`
- `npm run dev` - ✅ Maps to `vite`

**Docker Compose verified** (`docker-compose.yml`):

- ✅ postgres (PostgreSQL 15 Alpine)
- ✅ weaviate (semitechnologies/weaviate:latest)
- ✅ embedding-service (custom Dockerfile)
- ✅ code-executor (custom Dockerfile with security restrictions)
- ✅ backend
- ✅ frontend

### Architecture Section - VERIFIED ✅

**Request Flow** (verified in `api-server.ts` and services):

1. ✅ API receives chat or ingestion requests - Express routes defined
2. ✅ Context builder loads skills, user profile, memory search - `chat-context.ts`
3. ✅ LLM Router selects provider/model - `llm-router.ts`
4. ✅ Tool Executor runs built-in or generated tools - `tool-executor.ts`
5. ✅ Intent Router stores valuable exchanges - `intent-router.ts`

**Storage Layers**:

- ✅ PostgreSQL: Users, memories, summaries, todos, notifications, tools (verified in Prisma schema)
- ✅ Weaviate: Vector embeddings with manual vectors, `DEFAULT_VECTORIZER_MODULE: none`
- ✅ Local filesystem: Audio samples stored via `audio-storage.ts`

### Agents Section - VERIFIED ✅

| Agent                | File                                       | Status                          |
| -------------------- | ------------------------------------------ | ------------------------------- |
| Intent Router        | `backend/services/intent-router.ts`        | ✅ LLM-based classification     |
| Memory Manager       | `backend/services/memory-manager.ts`       | ✅ CRUD, pin/archive, promotion |
| Memory Retrieval     | `backend/services/memory-search.ts`        | ✅ Weaviate + Postgres fallback |
| Summarization        | `backend/services/summarization.ts`        | ✅ 9 time scales                |
| Proactive Agent      | `backend/services/proactive-agent.ts`      | ✅ Twice daily + health checks  |
| Continuous Listening | `backend/services/continuous-listening.ts` | ✅ WebSocket, VAD, speaker ID   |
| Tool Executor        | `backend/services/tool-executor.ts`        | ✅ 14+ built-in tools           |

### Memory Section - VERIFIED ✅

**Time Scale Cascade** (from `backend/services/summarization.ts`):

```typescript
DAILY (1 day), THREE_DAY, WEEKLY (7 days), BIWEEKLY (14 days),
MONTHLY (30 days), QUARTERLY (90 days), SIX_MONTH (180 days),
YEARLY (365 days), MULTI_YEAR (730 days)
```

**Metadata fields** (from Prisma schema):

- ✅ `tags: String[]`
- ✅ `entities: String[]`
- ✅ `importanceScore: Float`
- ✅ `isPinned: Boolean`
- ✅ `isArchived: Boolean`

### Tools Section - VERIFIED ✅

**Built-in tools** (from `tool-executor.ts`):

- ✅ `todo` - Todo Manager
- ✅ `notification` - Notifications (browser + Pushover routing)
- ✅ `scheduled_task` - Scheduled Tasks (cron-like)
- ✅ `curl` - HTTP Requests
- ✅ `brave_search` - Brave Web Search
- ✅ `user_context` - User Context retrieval
- ✅ `user_profile` - User Profile management
- ✅ `long_running_task` - Background task management
- ✅ `code_executor` - Python sandbox (network off by default)
- ✅ `generate_tool` - Dynamic Tool Generator
- ✅ `secrets` - User Secrets Manager
- ✅ `goals` - Goals management
- ✅ `achievements` - Achievements system
- ✅ `subagent` - Sub-agent runner

**MCP Status**:

- ⚠️ `backend/services/mcp-manager.ts` exists but `MARKETPLACE_CATALOG` is empty array
- MCP server CRUD operations are implemented but no active integrations

### Security Section - VERIFIED ✅

**JWT Authentication**:

- ✅ `backend/middlewares/auth.middleware.ts` - JWT verification on protected routes
- ✅ Environment validation requires JWT_SECRET (min 32 chars)

**Encryption**:

- ✅ `backend/services/secrets.ts` - AES-256-GCM encryption
- ✅ ENCRYPTION_KEY required (64 hex chars = 32 bytes)

**Local-first**:

- ✅ Docker Compose runs all services locally
- ✅ LLM provider is configurable (can use local endpoints)

### FAQ Section - VERIFIED ✅

**Q: Does it run fully locally?**

- ✅ Verified: Docker Compose includes postgres, weaviate, embedding-service, code-executor, backend, frontend
- ✅ LLM calls configurable via AI settings

**Q: How are summaries and agents triggered?**

- ✅ `backend/services/scheduler.ts` defines cron jobs:
  - Daily summarization: `0 0 * * *` (midnight)
  - Weekly: `0 0 * * 0` (Sunday midnight)
  - Monthly: `0 0 1 * *` (1st of month)
  - Memory pruning: `0 1 * * *` (1 AM)
  - Daily reflection: `0 21 * * *` (9 PM)

**Q: Can I edit, archive, or delete memories?**

- ✅ `backend/controllers/memory.controller.ts` exports:
  - `createMemory`, `getMemoryById`, `getMemories`, `updateMemory`, `deleteMemory`
  - `archiveMemory`, `unarchiveMemory`, `pinMemory`, `unpinMemory`

---

## How to Use This Guide

For each section below:

1. Open the referenced source files.
2. Summarize the real behavior and constraints (not plans).
3. Replace mock text with factual text.
4. Avoid claims that are not implemented.

**Tone & Depth**:

- Write for a developer who has never seen the project.
- Be concise, but explain domain-specific concepts once (e.g., "Weaviate is a vector database used for semantic search").
- Prefer clear, testable statements: "This endpoint exists and returns X" over "The system will support X."

**What to include**:

- What it does
- Where it lives (file/service)
- How it is triggered (API, scheduler, WebSocket, etc.)
- Key limitations or TODOs

**What to avoid**:

- Roadmap claims in factual sections
- "Audit log for every memory access" unless implemented
- Security promises not enforced in code

---

## Sections to Document (and Source Pointers)

### 1) Overview

**What to document**

- What the system is, in practical terms (local-first memory system).
- What kinds of data are captured (chat, audio, tools, scheduled agents).
- The two primary storage layers (PostgreSQL + Weaviate) and their roles.

**Where to look**

- `src/pages/DocsPage.tsx` (current mock text)
- `README.md` (project positioning)
- `backend/services/memory-manager.ts`
- `backend/services/memory-search.ts`

**Implementation Details**:

- System captures: chat messages (SSE streaming), audio via WebSocket, tool execution results
- PostgreSQL stores structured data (User, Memory, Summary, Todo, Notification, etc.)
- Weaviate stores vector embeddings with `DEFAULT_VECTORIZER_MODULE: none` (manual vectors)

---

### 2) Quickstart

**What to document**

- Actual commands that work from `package.json`.
- When Docker Compose is required (full local stack).
- Which services are needed for embeddings, code execution, and vector search.

**Where to look**

- `package.json`
- `backend/package.json`
- `docker-compose.yml`
- `SETUP.md`

**Implementation Details**:

```bash
# Generate .env + secrets (Docker-first)
./scripts/setup.sh

# Install dependencies
npm install

# Start backend API (port 3001 by default)
npm run backend:dev

# Start frontend UI (port 5173 by default)
npm run dev

# Full local stack with Docker
docker compose up --build
```

---

### 3) Architecture

**What to document**

- Request flow: API → context builder → LLM → tools → memory store.
- Main runtime services (API server, scheduler, memory search, tool executor).
- Storage layers and which data goes where.

**Where to look**

- `backend/services/api-server.ts`
- `backend/services/chat-context.ts`
- `backend/services/tool-executor.ts`
- `backend/services/scheduler.ts`
- `docs/architecture.md`

**Implementation Details**:
Request flow verified in code:

1. Express API receives requests (`api-server.ts`)
2. `chat-context.ts` builds context with skills, user profile, memory search results
3. `llm-router.ts` selects provider/model based on task type
4. `tool-executor.ts` runs tools when LLM requests them
5. `intent-router.ts` analyzes and stores valuable exchanges

---

### 4) Agents

**What to document**

- Which agents/services are real and currently running.
- What "agent" means in this codebase (often a service + scheduler job).
- Distinguish continuous listening, proactive agent, summarization, etc.

**Where to look**

- `backend/services/intent-router.ts`
- `backend/services/background-agents.ts`
- `backend/services/proactive-agent.ts`
- `backend/services/continuous-listening.ts`
- `backend/services/summarization.ts`

**Implementation Details**:

| Agent                | Description                                            | Trigger                                  |
| -------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Intent Router        | LLM-based classification, no regex                     | Per request                              |
| Memory Manager       | Store, promote, archive memories                       | API calls                                |
| Memory Retrieval     | Hybrid search (Weaviate + Postgres)                    | API calls                                |
| Summarization        | 9 time scales (daily to multi-year)                    | Scheduler cron jobs                      |
| Proactive Agent      | Health coaching, pertinence scoring                    | Twice daily (8 AM, 6 PM) + Mon/Thu 10 AM |
| Continuous Listening | VAD + speaker ID + transcription                       | WebSocket audio                          |
| Background Agents    | Daily reflection, weekly insights, goal/habit tracking | Scheduler                                |

---

### 5) Memory

**What to document**

- Memory CRUD and metadata (tags, entities, importance, pin/archive).
- Short-term vs long-term handling in the current implementation.
- Summaries and how they're generated (time scales, caching).
- Semantic search and fallback behavior when Weaviate is unavailable.

**Where to look**

- `backend/controllers/memory.controller.ts`
- `backend/services/memory-manager.ts`
- `backend/services/summarization.ts`
- `backend/services/memory-search.ts`
- `backend/prisma/schema.prisma` (Memory & Summary models)

**Implementation Details**:

Memory types (from Prisma enum):

- `SHORT_TERM` - Recent interactions
- `LONG_TERM` - Promoted/summarized content

Time scales implemented:

```
DAILY → THREE_DAY → WEEKLY → BIWEEKLY → MONTHLY → QUARTERLY → SIX_MONTH → YEARLY → MULTI_YEAR
```

Search fallback behavior (`memory-search.ts`):

- Primary: Weaviate semantic search with manual vectors
- Fallback: PostgreSQL text search when Weaviate unavailable
- Retry mechanism: 15 attempts with 5s delay on startup

---

### 6) Tools

**What to document**

- Built-in tools: todos, notifications, scheduled tasks, curl, search, etc.
- Execution flow: how tools are invoked and verified.
- Code executor and embedding service (Python services).
- MCP server manager and current limitations (placeholders).
- Dynamic tool generation system (if documented).

**Where to look**

- `backend/services/tool-executor.ts`
- `backend/controllers/tools.controller.ts`
- `backend/services/tools/*`
- `backend/services/mcp-manager.ts`
- `backend/services/code-executor-wrapper.ts`
- `backend/services/embedding-wrapper.ts`

**Implementation Details**:

Built-in tools (14 total):
| Tool | Actions | Rate Limit |
|------|---------|------------|
| todo | create, get, list, update, complete, delete, stats, overdue, due_soon | 100/interval |
| notification | send, schedule, get, list, unread_count, mark_read, dismiss, delete, cancel_scheduled | 50/interval |
| scheduled_task | create, get, list, update, enable, disable, delete, execute_now, history | 20/interval |
| curl | request, get, post, put, delete, patch | 30/interval |
| brave_search | search | 40/interval |
| user_context | get_location, get_preferences, search_facts | 50/interval |
| user_profile | get, update, delete_fields | 50/interval |
| long_running_task | create, add_steps, start, pause, resume, cancel, get, list, etc. | 10/interval |
| code_executor | execute, validate, get_limits, get_examples | 10/interval |
| generate_tool | generate, list, get, execute, delete, search | 5/interval |
| secrets | (manages API keys encrypted with AES-256-GCM) | 20/interval |
| goals | (goal management) | - |
| achievements | (achievement tracking) | - |
| subagent | (sub-agent runner with templates) | - |

Code Executor security:

- Docker container with `security_opt: no-new-privileges`
- `cap_drop: ALL`
- Network access disabled by default
- 30s max execution time, 10KB max output

MCP Status:

- Manager exists (`mcp-manager.ts`)
- CRUD operations implemented
- `MARKETPLACE_CATALOG` is empty - no active tool integrations

---

### 7) Security

**What to document**

- JWT auth and middleware coverage.
- Encryption of secrets (AES-256-GCM).
- What is stored on disk (audio, models, embeddings cache).
- What is NOT implemented (e.g., RBAC, full audit logging).

**Where to look**

- `backend/middlewares/auth.middleware.ts`
- `backend/services/secrets.ts`
- `backend/services/chatgpt-oauth.ts`
- `backend/services/audio-storage.ts`
- `docs/SECURITY.md`

**Implementation Details**:

✅ **Implemented**:

- JWT authentication with minimum 32-char secret
- Per-user scoping via auth middleware
- AES-256-GCM encryption for secrets (64 hex char key)
- Environment validation on startup
- Audio stored on local filesystem (Docker volume)
- Configurable LLM providers per task

⚠️ **NOT Implemented**:

- RBAC (Role-Based Access Control)
- Full audit logging for memory access
- Rate limiting per user (only per tool)
- Two-factor authentication

---

### 8) Roadmap

**What to document**

- Clarify what is implemented vs planned.
- Link to `agents.md` or implementation notes.

**Where to look**

- `agents.md`
- `docs/implementation-notes/*`

**Implementation Details**:
Current phase: "Core Platform"

- ✅ Auth + user profiles
- ✅ Memory CRUD + summaries
- ✅ Tool execution + notifications
- ✅ Proactive agent + background agents
- ✅ Skills system (Moltbot-style)

---

### 9) FAQ

**What to document**

- Answers grounded in code (e.g., local stack, summaries, memory editing).
- Be explicit about what requires external providers.

**Where to look**

- `docker-compose.yml`
- `backend/services/scheduler.ts`
- `backend/controllers/memory.controller.ts`
- `backend/controllers/ai-settings.controller.ts`

**Implementation Details**:
All FAQ answers verified against code - see Fact-Check Results section above.

---

## Optional: Extra Sections You May Want to Add

If you expand the Docs page beyond its current sections, consider:

### A) API Reference (summary)

Include a short list of key endpoints and what they do.

**Key Endpoints** (from `api-server.ts`):

- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `GET /api/user/profile` - Get user profile
- `GET /api/memories` - List memories with filters
- `POST /api/memories` - Create memory
- `GET /api/memories/search/semantic` - Semantic search
- `GET /api/summaries` - List summaries
- `POST /api/chat` - Chat with SSE streaming
- `GET /api/tools` - List available tools
- `POST /api/tools/execute` - Execute a tool
- `GET /api/notifications` - List notifications
- `POST /api/todos` - Create todo

### B) Integrations

Document Telegram, MCP servers, tool marketplace stubs.

**Current Status**:

- Telegram: Settings exist in `UserSettings` model (`telegramBotToken`, `telegramChatId`, `telegramEnabled`)
- Pushover: Implemented for mobile notifications
- MCP: Manager exists, no active integrations
- Marketplace: Empty catalog

### C) Audio Ingestion & Voice Training

Document voice pipelines and storage details.

**Components**:

- `continuous-listening.ts` - Main orchestrator (VAD → Speaker ID → Transcription → Intent)
- `voice-activity-detector.ts` - Filters silence
- `speaker-recognition.ts` - User identification
- `audio-storage.ts` - File management
- `adaptive-speaker-learning.ts` - Improves recognition over time

### D) Skills System

Document skills storage, installation, and how they are injected into prompts.

**Structure** (from `skill-manager.ts`):

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/
    ├── references/
    └── assets/
```

**Categories**: PRODUCTIVITY, DEVELOPMENT, WRITING, RESEARCH, AUTOMATION, ANALYSIS, COMMUNICATION, CREATIVITY, HEALTH, FINANCE, LEARNING, OTHER

**Sources**: BUILTIN, HUB, MARKETPLACE, GITHUB, LOCAL

---

## 🔄 Last Updated

- **Date**: January 29, 2026
- **Verified against**: Current codebase
- **Status**: All sections fact-checked and verified ✅
