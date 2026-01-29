# Second Brain AI System - Development Roadmap & Agent Architecture

## 📋 System Overview

The Second Brain AI System is a personal cognitive operating system designed to:

- **Continuously capture** information from user interactions and external sources
- **Organize & structure** data with semantic understanding
- **Generate summaries** at multiple time scales (daily → yearly)
- **Enable autonomous reasoning** through memory retrieval and tool execution
- **Maintain privacy** with local-first architecture

---

## ⚠️ Agent Instructions

**DO NOT attempt to test code by running `docker compose`**. Agents should focus on implementing features and making code changes. Code testing and Docker container execution should be left to the user. If you need to verify something, check the actual code or ask the user to test it.

---

## 🤖 Core Agents

### 1. **Intent Router Agent**

**Purpose**: Classify incoming user inputs and determine system response

**Responsibilities**:

- Classify input type: Question, Command, Reflection, Observation, Conversation, Noise
- Assess temporal context (past week, month, year, all-time)
- Determine if memory retrieval is needed
- Decide whether input should be stored in long-term memory
- Route to appropriate handler

**Key Metrics**:

- Classification accuracy
- False positive rate for noise filtering
- Latency (<100ms)

---

### 2. **Memory Manager Agent**

**Purpose**: Handle short-term and long-term memory lifecycle

**Responsibilities**:

- **Short-term memory**: Ingest user inputs, tool results, responses
- **Vectorization**: Convert text to embeddings via Weaviate
- **Summarization**: Generate summaries at scheduled intervals
- **Indexing**: Create searchable indices for fast retrieval
- **Retention policies**: Apply TTL and compression strategies
- **Garbage collection**: Remove low-relevance data

**Time Scale Summarization**:

```
Daily → 3-day → Weekly → Bi-weekly → Monthly → Quarterly → 6-month → Yearly → Multi-year
```

**Storage**:

- PostgreSQL: Structured metadata, configurations, audit logs
- Weaviate: Vector embeddings and semantic search

---

### 3. **Memory Retrieval Agent**

**Purpose**: Fetch relevant memories based on context

**Responsibilities**:

- Parse temporal references from user input
- Execute hybrid search: vector + keyword + temporal filters
- Rank results by relevance and recency
- Apply personalization filters
- Format retrieved memories for LLM context injection

**Search Types**:

- Semantic similarity
- Exact keyword match
- Time-based queries
- Entity-based retrieval
- Topic clustering

---

### 4. **Tool Execution Engine**

**Purpose**: Safely execute external operations (Tools)

> ⚠️ **Important**: This engine executes **Tools**, not **Skills**.
>
> - **Tools** = Stateless Python functions (atomic actions)
> - **Skills** = Human-readable instructions (workflows)
>
> See [/docs/index.md#-tools-vs-skills](/docs/index.md#-tools-vs-skills) for the complete distinction.

**Responsibilities**:

- Browser automation (Browseruse)
- HTTP API calls
- MCP server invocation
- Custom tool adapters
- Sandboxing & safety constraints
- Result capture and logging

**Tool Categories** (Built-in):

- `todo` - Task management
- `notification` - Send alerts to user
- `scheduled_task` - Cron-like scheduling
- `curl` / `http_request` - API calls
- `brave_search` - Web search
- `browser` - Web automation
- `memory_search` - Query memories

**Custom Tools**:

Generated dynamically via AI - Python code executed in sandbox.

Example tool:

```python
# get_weather tool - stateless, atomic
result = requests.get(f"api.weather.com/{city}").json()
```

---

### 4b. **Skills System**

**Purpose**: Provide high-level workflow orchestration through natural language instructions

> 📚 **Skills** complement **Tools** by providing the "how" rather than the "what".
> See [/docs/index.md#-tools-vs-skills](/docs/index.md#-tools-vs-skills) for detailed documentation.

**What is a Skill?**

A skill is a set of human-readable instructions (like a recipe) that tell the AI how to accomplish a goal by orchestrating tools and reasoning.

**Example Skills**:

1. **Weather Alert Skill**:

```markdown
Check the weather every day at 7 AM using the `get_weather` tool.
Only notify the user if there will be snow today or temperatures below freezing.
```

2. **Order Tracking Skill**:

```markdown
Verify the status of my pending orders using the `track_package` tool.
Notify me only if the status has changed since the last check.
```

3. **Meeting Prep Skill**:

```markdown
Before each meeting:

1. Get meeting details from calendar
2. Search memories for previous interactions with attendees
3. Create a brief summary with context and suggested talking points
4. Send a notification 15 minutes before
```

**Skill vs Tool Comparison**:

| Aspect    | Tool                   | Skill                      |
| --------- | ---------------------- | -------------------------- |
| Format    | Python code            | Markdown instructions      |
| Nature    | Stateless function     | Contextual workflow        |
| Execution | Direct code execution  | AI interprets and follows  |
| Example   | `get_weather("Paris")` | "Alert me if it will snow" |

**Skill Categories**:

- `PRODUCTIVITY` - Task automation, scheduling
- `DEVELOPMENT` - Code assistance, deployments
- `RESEARCH` - Information gathering, analysis
- `COMMUNICATION` - Email, notifications, messaging
- `HEALTH` - Health tracking, reminders
- `FINANCE` - Budget tracking, alerts

---

### 5. **LLM Router Agent**

**Purpose**: Determine which model to use and optimize for task

**Responsibilities**:

- Route to appropriate model: GPT-4, GPT-3.5, Local LLM
- Cost optimization based on task complexity
- Context window management
- Streaming vs batch execution decision

**Routing Logic**:

- Complex reasoning → GPT-4 Turbo
- Simple tasks → GPT-3.5
- Sensitive data → Local LLM
- Batch jobs → Cheaper models

---

### 6. **Summarization Agent**

**Purpose**: Generate high-quality summaries across time scales

**Responsibilities**:

- Extract key information from raw interactions
- Generate summaries: daily, weekly, monthly, etc.
- Tag with: topics, entities, sentiment, importance
- Create bidirectional links to source segments
- Version tracking (how summaries evolve)

**Summary Quality Metrics**:

- Factual accuracy
- Completeness
- Conciseness
- Relevance retention

---

### 7. **Noise Filter Agent**

**Purpose**: Distinguish meaningful interactions from noise

**Responsibilities**:

- Analyze speaker and context
- Intent classification scoring
- Semantic relevance assessment
- Confidence thresholding
- User confirmation for ambiguous cases

**Noise Categories**:

- Background conversations
- Random speech fragments
- Environmental sounds
- Media playback
- Unaddressed utterances

---

### 8. **Background Agents** (Autonomous)

#### 8.1 Daily Reflection Generator

- Generates daily summaries at set time
- Extracts key insights and patterns
- Suggests important items for pinning
- Runs every 24h

#### 8.2 Weekly Life Summary

- Aggregates 7-day summaries
- Identifies trends and patterns
- Highlights decisions made
- Suggests action items

#### 8.3 Goal Tracker Agent

- Monitors progress on long-term goals
- Alerts on goal-relevant events
- Updates goal status
- Suggests micro-actions

#### 8.4 Habit Analyzer

- Tracks recurring behaviors
- Measures habit consistency
- Suggests optimization
- Correlates with decisions

#### 8.5 Financial Analyzer

- Tracks spending patterns
- Analyzes financial decisions
- Alerts on anomalies
- Generates financial summaries

#### 8.6 Knowledge Gap Detector

- Identifies missing information
- Suggests learning resources
- Tracks knowledge evolution
- Recommends skill development

#### 8.7 Proactive Agent (NEW)

- **Purpose**: Analyzes memories proactively to help user in daily life
- **Runs**: Twice daily (8 AM and 6 PM)
- **Special Mode**: Health check (Mon/Thu at 10 AM)
- **Non-invasive**: Gentle suggestions, never demanding
- **Categories**: Health, mental wellbeing, productivity, goals, habits, relationships, learning
- **Features**:
  - Detects patterns requiring attention
  - Provides actionable steps
  - Sends priority-based notifications
  - Acts as personal coach for physical and mental health
  - Avoids repetitive suggestions
- **Documentation**: See `/docs/proactive-agent.md` for details

---

## 🏗️ Backend Service Architecture

### Service Structure

```
backend/
├── services/
│   ├── api-server.ts          # REST API + request routing
│   ├── memory-manager.ts      # Memory lifecycle
│   ├── intent-router.ts       # Input classification
│   ├── memory-retrieval.ts    # Semantic search
│   ├── tool-executor.ts       # External tool execution
│   ├── llm-router.ts          # Model selection
│   └── summarization.ts       # Summary generation
├── models/
│   ├── memory.ts              # Memory data structures
│   ├── interaction.ts         # User interactions
│   ├── agent.ts               # Agent state
│   └── config.ts              # System configuration
├── controllers/
│   ├── memory.controller.ts   # Memory CRUD API
│   ├── config.controller.ts   # Settings API
│   └── logs.controller.ts     # Activity logging
├── database/
│   ├── migrations/            # Prisma migrations
│   └── schemas/               # Database schema definitions
└── utils/
    ├── embeddings.ts          # Vector generation
    ├── safety.ts              # Security & validation
    └── logger.ts              # Structured logging
```

---

## 📊 Database Schema

### Core Tables (PostgreSQL)

**users**

- id, email, created_at, preferences

**interactions**

- id, user_id, type (question/command/reflection/etc), content, timestamp, confidence_score, is_noise

**memories**

- id, user_id, interaction_id, content, type (short/long_term), time_scale, embedding_id, created_at, updated_at, importance_score, tags

**summaries**

- id, user_id, time_scale, period_start, period_end, content, source_memory_ids, created_at

**tools**

- id, name, category, enabled, config, rate_limit

**audit_logs**

- id, user_id, action, resource, timestamp, ip_address

---

## 🔄 Request Flow

```
User Input
    ↓
[Intent Router] → Classify input type + confidence
    ↓
Is it noise? → No
    ↓
[Memory Retrieval] → Fetch relevant context (if needed)
    ↓
[LLM Router] → Select appropriate model
    ↓
[LLM Call] → Generate response with context
    ↓
[Tool Executor] → Execute if tools requested
    ↓
[Memory Manager] → Store interaction + results
    ↓
Response to user
```

---

## 📅 Development Phases

### Phase 1: Foundation (Weeks 1-4)

- [ ] Backend API scaffolding
- [ ] PostgreSQL + Weaviate setup
- [ ] Basic memory CRUD
- [ ] Intent router MVP (binary: meaningful vs noise)
- [ ] Simple memory retrieval
- [ ] Basic React frontend

### Phase 2: Memory Core (Weeks 5-8)

- [ ] Short-term memory ingestion
- [ ] Embedding pipeline with Weaviate
- [ ] Summarization scheduler
- [ ] Memory browser UI
- [ ] Hybrid search implementation

### Phase 3: Autonomy (Weeks 9-12)

- [ ] Daily reflection generator
- [ ] Weekly summary agent
- [ ] Goal tracker
- [ ] Habit analyzer
- [ ] Background agent scheduling

### Phase 4: Tool Integration (Weeks 13-16)

- [ ] Tool executor framework
- [ ] Browser automation (Browseruse)
- [ ] API integrations
- [ ] MCP server support
- [ ] Safety constraints

### Phase 5: Polish & Deployment (Weeks 17+)

- [ ] Performance optimization
- [ ] Frontend UI refinement
- [ ] Docker containerization
- [ ] Documentation
- [ ] Monitoring & observability

---

## 🎯 Success Criteria

- **Memory accuracy**: >95% factual correctness
- **Retrieval relevance**: >90% user satisfaction with retrieved memories
- **Noise filtering**: >85% precision in meaningful interaction detection
- **Response latency**: <2s for simple queries, <5s for complex reasoning
- **System uptime**: >99.5%
- **Privacy**: Zero data leaves user's infrastructure in local mode

---

## 🔐 Privacy & Security

- End-to-end encryption for all memory
- Local-first architecture option (all processing on device)
- Audit log for every memory access
- User can delete/edit any memory at any time
- Role-based access control for future multi-user
- No telemetry or tracking

---

## 🚀 Next Steps

1. **Backend Setup**
   - Initialize Node.js + TypeScript project
   - Configure Prisma ORM
   - Setup PostgreSQL + Weaviate
   - Create basic API endpoints

2. **Frontend Setup**
   - React + TypeScript scaffold (in progress)
   - Implement memory browser component
   - Create settings panel
   - Setup real-time updates (WebSocket)

3. **Core Services**
   - Implement Intent Router
   - Build Memory Manager
   - Create basic LLM integration

4. **Testing**
   - Unit tests for classifiers
   - Integration tests for memory flow
   - E2E tests for user journeys

---

## 📚 Resources & References

- **Memory Architecture**: Based on cognitive science (spaced repetition, forgetting curves)
- **LLM Integration**: OpenAI API with fallback to local models
- **Vector Search**: Weaviate for semantic similarity
- **Real-time Sync**: WebSocket for live updates
- **Safety**: Sandbox.run or similar for tool execution

---

## 📚 Documentation & Implementation Notes Management

### 🎯 Quick Rule: Where Files Go

| File Type                      | Location                      | Rule                                                                                |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| **Essential docs**             | Root directory                | `README.md`, `SETUP.md`, `SECURITY.md`, `agents.md`, `QUICK_REFERENCE.md` only      |
| **Permanent documentation**    | `/docs/`                      | Architecture, databases, authentication, integration guides - stable reference docs |
| **Implementation/Debug notes** | `/docs/implementation-notes/` | **ALL** temporary, feature-specific docs go here - NEVER at root                    |

### ⚠️ GOLDEN RULE

```
🚫 NEVER create markdown files at root for implementation/debug
✅ ALWAYS use /docs/implementation-notes/ for anything temporary
```

### Markdown File Organization

To maintain a clean repository structure, all markdown documentation is organized as follows:

#### **Root Level** (Essential files only)

These files remain at the project root for critical developer reference:

- `README.md` - Project overview and getting started
- `SETUP.md` - Initial development setup guide
- `SECURITY.md` - Security policies and best practices
- `agents.md` - This file - Core architecture documentation
- `QUICK_REFERENCE.md` - Quick command reference

#### **Documentation** (`/docs`)

Permanent architectural and reference documentation:

- `docs/architecture.md` - System design and data flow
- `docs/authentication.md` - Auth system documentation
- `docs/database.md` - Database schema and relationships
- `docs/input-ingestion.md` - Input processing system
- `docs/input-integration-guide.md` - Integration instructions
- `docs/index.md` - Documentation index

#### **Implementation Notes** (`/docs/implementation-notes`)

Temporary implementation documentation created during development:

- Implementation guides and technical deep-dives
- Completion summaries and status reports
- Quick start guides for features
- Feature checklists and verification documents
- Architecture decision documents (ADDs)

### Guidelines for Managing Implementation Notes

#### ⚠️ CRITICAL RULE: Implementation notes MUST NOT be created at root level

**ALL** debugging/implementation markdown files go to `/docs/implementation-notes/` directory - NEVER at project root.

#### When Creating New Implementation Notes

1. **Location**: ALWAYS create in `/docs/implementation-notes/` directory
   - ❌ DO NOT create at root level
   - ✅ DO create here: `/docs/implementation-notes/FEATURE_NAME.md`
   - This keeps root directory clean (only 6-7 essential files)
   - Consolidates temporary documentation in one place
   - Easy to identify and archive when complete

2. **Naming Convention**: Use `FEATURE_IMPLEMENTATION.md` or `FEATURE_STATUS.md`
   - Example: `/docs/implementation-notes/AUDIO_TRAINING_IMPLEMENTATION.md`
   - Example: `/docs/implementation-notes/EMBEDDING_STATUS.md`
   - Example: `/docs/implementation-notes/SCRIPTS_ORGANIZATION_COMPLETE.md`
   - Be descriptive so the purpose is clear

3. **Content**:
   - Focus on implementation details and decisions made
   - Include architecture diagrams for the feature
   - Document any setup or configuration required
   - List files created or modified
   - Include troubleshooting and examples

#### When to Remove Implementation Notes

Remove implementation notes from `/docs/implementation-notes/` after the debug/implementation process is complete when:

1. **Feature is production-ready** - Core functionality is stable and tested
2. **Knowledge is transferred** - Important information consolidated into permanent docs
3. **No longer referenced** - Team no longer needs the implementation guide
4. **Documentation is outdated** - Information no longer accurate after refactoring

#### Migration Process

When transitioning from implementation notes to production:

1. Extract essential information from implementation notes
2. Consolidate into permanent documentation in `/docs/`
3. Update links in README.md or SETUP.md if relevant
4. Remove the implementation note file from `/docs/implementation-notes/`
5. Commit the changes with clear commit message

Example:

```bash
# Move content from implementation notes to permanent docs
# Update any references
# Remove the implementation note file
git rm docs/implementation-notes/FEATURE_IMPLEMENTATION.md
git add docs/feature.md
git commit -m "Move FEATURE documentation to permanent docs, archive implementation notes"
```

### Examples of Implementation Notes

These are temporary and can be archived once the feature is stable:

- `docs/implementation-notes/AUDIO_TRAINING_IMPLEMENTATION.md`
- `docs/implementation-notes/AUTHENTICATION_COMPLETE.md`
- `docs/implementation-notes/EMBEDDING_STATUS.md`
- `docs/implementation-notes/INPUT_IMPLEMENTATION.md`
- `docs/implementation-notes/COMPLETION_SUMMARY.md`

### Maintenance Schedule

**Monthly Review**:

- Check `/docs/implementation-notes/` for outdated or completed features
- Archive or remove notes for completed phases
- Consolidate duplicate information

**End of Phase**:

- Migrate all relevant implementation notes to permanent documentation
- Clean up obsolete files
- Update the main README with new feature status

---

**Last Updated**: January 23, 2026
**Version**: 0.1.0
**Status**: In Development
