# 📑 Complete Documentation Index

## 🎯 Start Here (in order)

1. **[COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)** ⭐
   - What was done, what's ready, next steps
   - 2 min read

2. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** 📚
   - One-page system overview
   - Key metrics, agent descriptions, quick commands
   - 3 min read

3. **[README.md](./README.md)** 📖
   - Project vision and features
   - Architecture diagram
   - 5 min read

## 📋 Core Documentation

### System Design

- **[agents.md](./agents.md)** - Complete agent architecture (8 agents described)
  - Agent responsibilities and metrics
  - Backend service architecture
  - Request flow diagram
  - Development phases
  - Success criteria

- **[docs/architecture.md](./docs/architecture.md)** - System components
  - Component descriptions
  - Data flow diagrams
  - Technology stack
  - Privacy & security

### Database & Schema

- **[docs/database.md](./docs/database.md)** - PostgreSQL + Weaviate
  - SQL table schemas
  - Index definitions
  - Weaviate collection setup
  - Query examples

## 🚀 Development & Setup

### Getting Started

- **[SETUP.md](./SETUP.md)** - Complete development guide
  - Environment setup
  - Project structure explanation
  - Quick start instructions
  - Next steps checklist
  - Development tips

### Configuration

- **[.env.example](./.env.example)** - Environment template
  - Frontend configuration
  - Backend configuration
  - Database settings
  - LLM settings
  - Memory configuration

## 📁 Project Structure

### Root Level

```
COMPLETION_SUMMARY.md   ← What was accomplished
QUICK_REFERENCE.md      ← One-page overview
README.md               ← Project description
SETUP.md                ← Development setup
agents.md               ← Agent architecture
SECURITY.md             ← Security policy
LICENSE                 ← MIT License
.env.example            ← Configuration template
```

### Backend Services

```
backend/services/
├── api-server.ts       ← REST API setup
├── intent-router.ts    ← Input classification
├── memory-manager.ts   ← Memory lifecycle
├── tool-executor.ts    ← Tool execution
└── llm-router.ts       ← Model selection
```

### Database & Models

```
backend/
├── models/index.ts     ← TypeScript data models
├── database/migrations/ ← Prisma migrations
└── database/schemas/   ← Schema definitions
```

### Docker

```
docker/
├── docker-compose.yml  ← Development stack
├── Dockerfile.backend  ← Backend image
└── Dockerfile.frontend ← Frontend image
```

### Documentation

```
docs/
├── architecture.md     ← System design
├── database.md         ← Schema details
└── (index.md)          ← This file
```

### Frontend

```
frontend/
├── components/ui/      ← React components
├── hooks/              ← Custom hooks
├── lib/                ← Utilities
└── styles/             ← Global styles
```

## 🤖 Agent Reference

### 8 Core Agents Documented

**Synchronous Agents** (request-response):

1. **Intent Router** - Classify user input
2. **Memory Retrieval** - Find relevant memories
3. **Tool Executor** - Execute external tools
4. **LLM Router** - Select appropriate model

**Asynchronous/Background Agents**: 5. **Memory Manager** - Handle memory lifecycle 6. **Summarization** - Generate summaries 7. **Noise Filter** - Distinguish signal from noise 8. **Background Tasks** - Daily/weekly/monthly operations

Each agent has:

- Detailed responsibilities
- Key metrics
- Implementation notes
- Integration points

See [agents.md](./agents.md#-core-agents) for full details.

## 🔧 Tools vs Skills

Understanding the difference between **Tools** and **Skills** is fundamental to the Second Brain AI System architecture.

### Quick Summary

| Aspect        | Tools                      | Skills                           |
| ------------- | -------------------------- | -------------------------------- |
| **Nature**    | Stateless Python functions | Human-readable instructions      |
| **Format**    | Code (Python)              | Natural language (Markdown)      |
| **Purpose**   | Execute atomic actions     | Orchestrate complex workflows    |
| **Analogy**   | A hammer, a screwdriver    | A recipe, a procedure            |
| **State**     | Stateless                  | Can reference context and memory |
| **Execution** | Direct code execution      | AI interprets and follows steps  |

---

### 🔧 Tools

#### Definition

A **Tool** is a **stateless Python function** that executes a specific, atomic action. Tools are the building blocks—the low-level primitives that interact with external systems, APIs, or perform computations.

#### Characteristics

- **Stateless**: No memory of previous executions
- **Atomic**: Performs a single, well-defined operation
- **Programmatic**: Written in Python code
- **Deterministic**: Same inputs produce same outputs
- **Sandboxed**: Runs in an isolated environment for security

#### Built-in Tools

The system includes several built-in tools:

| Tool                    | Description                         | Actions                         |
| ----------------------- | ----------------------------------- | ------------------------------- |
| `todo`                  | Manage tasks and to-do items        | create, list, complete, delete  |
| `notification`          | Send notifications to user          | send, schedule, dismiss         |
| `scheduled_task`        | Schedule tasks for future execution | create, update, delete, execute |
| `curl` / `http_request` | Make HTTP API calls                 | GET, POST, PUT, DELETE          |
| `brave_search`          | Search the web                      | search                          |
| `browser`               | Automated web browsing              | navigate, click, extract        |
| `memory_search`         | Search user's memories              | search, get_context             |

#### Custom Tools (Generated)

Users and the AI can create **custom tools** dynamically using the Tool Generator:

```python
# Example: A weather tool
import requests
import os

def get_weather(city: str) -> dict:
    """Get current weather for a city."""
    api_key = os.environ.get('OPENWEATHERMAP_API_KEY')
    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"

    response = requests.get(url, timeout=10)
    data = response.json()

    result = {
        "city": city,
        "temperature": data["main"]["temp"],
        "description": data["weather"][0]["description"],
        "humidity": data["main"]["humidity"]
    }
    return result
```

#### Tool Execution Flow

```
User Request → AI identifies tool needed → Tool Executor
                                              ↓
                                    Code Executor Service (Python sandbox)
                                              ↓
                                    Execute code with env vars
                                              ↓
                                    Return structured result
```

---

### 📚 Skills

#### Definition

A **Skill** is a **set of human-readable instructions** written in natural language (Markdown) that describes how to accomplish a goal. Think of it as a recipe or a procedure that the AI follows.

#### Characteristics

- **Declarative**: Describes _what_ to do, not _how_ (in code)
- **Human-readable**: Written in natural language (Markdown)
- **Context-aware**: Can reference user preferences, memories, and context
- **Composable**: Can combine multiple tools in a workflow
- **Adaptable**: AI interprets and adapts execution based on situation

#### Skill Structure

Skills are stored as Markdown files with YAML frontmatter:

```markdown
---
name: Weather Alert Monitor
description: Monitor weather and notify about important changes
version: 1.0.0
author: User
---

# Weather Alert Monitor

## Purpose

Check the weather regularly and alert the user about significant conditions.

## Workflow

1. **Get current location** using the user's configured home location
2. **Check weather** using the `get_weather` tool for that location
3. **Analyze conditions**:
   - If snow is expected → Notify immediately
   - If temperature drops below 0°C → Send morning alert
   - If heavy rain expected → Remind to take umbrella
4. **Send notification** only if relevant conditions are detected

## When to Run

- Daily at 7:00 AM
- Can be invoked manually by asking about weather alerts
```

---

### Examples: Tool vs Skill

#### Example 1: Weather Notification

**Tool** (`get_weather`):

```python
# Stateless function that fetches weather data
result = requests.get(f"api.weather.com/{city}").json()
```

**Skill** (`daily-weather-alert`):

```markdown
Check the weather every day at 7 AM using the `get_weather` tool.
Only notify the user if:

- There will be snow today
- Temperature will be below freezing
- Severe weather warnings exist
  Otherwise, stay silent.
```

#### Example 2: Package Tracking

**Tool** (`track_package`):

```python
# Fetches package status from courier API
result = requests.get(f"api.courier.com/track/{tracking_number}").json()
```

**Skill** (`order-status-monitor`):

```markdown
Monitor my recent orders:

1. Get the list of pending orders from memory
2. For each order, check the delivery status using `track_package`
3. Compare with the last known status
4. If status changed → Send notification with the update
5. Store the new status in memory for next check

Run this check every 6 hours.
```

#### Example 3: Meeting Preparation

**Tools used**: `calendar_get_events`, `memory_search`, `notification`, `todo`

**Skill** (`meeting-prep`):

```markdown
When I have a meeting in the next 30 minutes:

1. Get meeting details from calendar
2. Search my memories for:
   - Previous meetings with same participants
   - Related projects or topics
   - Any pending action items
3. Create a brief summary of relevant context
4. Send me a notification with:
   - Meeting reminder
   - Key points from previous interactions
   - Suggested talking points
```

---

### 🔄 How They Work Together

```
User: "Let me know if it's going to snow this week"

    ↓

AI activates skill: "Weather Alert Monitor"

    ↓

Skill interprets request:
  1. User wants snow alerts
  2. Time scope: this week
  3. Action: notify only on snow

    ↓

Skill orchestrates tools:
  - get_weather(city, days=7)     ← Tool execution
  - analyze snow probability       ← AI reasoning
  - notification.schedule(...)     ← Tool execution
  - scheduled_task.create(...)     ← Tool execution

    ↓

Result: Monitoring set up, user will be notified if snow expected
```

---

### 📋 When to Use What

#### Create a Tool When:

- You need to interact with an external API
- You need a reusable, atomic function
- The operation is stateless and deterministic
- You need sandboxed execution for security
- Performance is critical (direct code execution)

#### Create a Skill When:

- You need to orchestrate multiple tools
- The workflow requires context or memory
- Steps need AI interpretation and adaptation
- The procedure should be human-readable
- You want to share knowledge with the AI about "how to do X"

---

### 🏗️ Implementation Details

#### Tools Storage

Tools are stored in the database with:

- Python code
- Input/output JSON schemas
- Required secrets/API keys
- Execution statistics

#### Skills Storage

Skills are stored as:

- Markdown content (SKILL.md)
- YAML frontmatter for metadata
- Optional bundled resources (scripts, references)

#### Execution Model

| Tools                             | Skills                 |
| --------------------------------- | ---------------------- |
| Executed by Code Executor Service | Interpreted by LLM     |
| Returns structured JSON           | Returns AI response    |
| ~100ms execution                  | ~seconds (LLM + tools) |
| Sandboxed Python                  | Full AI reasoning      |

## 📊 Memory Model

**Short-term Memory**:

- 24h - 7 days retention
- Full fidelity storage
- All meaningful interactions
- Vectorized in Weaviate

**Long-term Memory**:

- 9 time scales: daily → multi-year
- Progressive summarization
- Tagged with topics, entities, sentiment
- Linked to source interactions

**Retrieval**:

- Hybrid search: vector + keyword + temporal
- Ranked by relevance and recency
- Context injection into LLM

See [docs/database.md](./docs/database.md) for schema details.

## 🔧 Command Reference

```bash
# Installation
npm install
cp .env.example .env

# Development
npm run dev              # Frontend (React)
npm run backend:dev      # Backend (Node.js)

# Docker
docker-compose up        # All services
docker-compose down      # Stop services

# Database
npm run db:studio       # Edit data
npx prisma migrate      # Run migrations
```

See [SETUP.md](./SETUP.md#-docker-commands) for full command list.

## 📈 Development Phases

**Phase 1: Foundation** (Weeks 1-4)

- Backend API scaffolding
- PostgreSQL + Weaviate setup
- Basic memory CRUD
- Intent router MVP

**Phase 2: Memory Core** (Weeks 5-8)

- Short-term memory ingestion
- Embedding pipeline
- Summarization scheduler
- Memory browser UI

**Phase 3: Autonomy** (Weeks 9-12)

- Daily reflection generator
- Weekly summary agent
- Goal tracker
- Habit analyzer

**Phase 4: Tool Integration** (Weeks 13-16)

- Tool executor framework
- Browser automation
- API integrations
- MCP server support

**Phase 5: Polish** (Weeks 17+)

- Performance optimization
- UI refinement
- Docker containerization
- Production deployment

See [agents.md](./agents.md#-development-phases) for detailed checklist.

## 🎯 Key Success Metrics

| Metric                    | Target                     |
| ------------------------- | -------------------------- |
| Memory accuracy           | >95%                       |
| Retrieval relevance       | >90%                       |
| Noise filtering precision | >85%                       |
| Response latency          | <5s                        |
| System uptime             | >99.5%                     |
| Privacy                   | Zero external transmission |

See [agents.md](./agents.md#-success-criteria) for details.

## 🔐 Privacy & Security

Key principles:

- End-to-end encryption
- Local-first architecture
- Complete audit logging
- User-controlled data
- Role-based access
- No telemetry

See [docs/architecture.md](./docs/architecture.md#-privacy--security) for implementation details.

## 📚 External Resources

Concepts implemented:

- Cognitive science (spaced repetition, forgetting curves)
- Vector databases (semantic search)
- LLM integration (prompt engineering)
- System design (microservices)
- Privacy-first architecture

## ❓ Common Questions

**"Where do I start?"**
→ [SETUP.md](./SETUP.md)

**"How does the system work?"**
→ [agents.md](./agents.md)

**"What's the architecture?"**
→ [docs/architecture.md](./docs/architecture.md)

**"What data gets stored?"**
→ [docs/database.md](./docs/database.md)

**"What agents exist?"**
→ [agents.md](./agents.md#-core-agents)

**"What's the difference between Tools and Skills?"**
→ See [Tools vs Skills](#-tools-vs-skills) section above

**"Quick overview?"**
→ [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

**"What changed?"**
→ [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)

## 📝 File Size Reference

| Document              | Size | Content                      |
| --------------------- | ---- | ---------------------------- |
| agents.md             | 10KB | Complete system architecture |
| SETUP.md              | 5KB  | Development setup guide      |
| docs/database.md      | 6KB  | Database schema              |
| docs/architecture.md  | 4KB  | System design                |
| QUICK_REFERENCE.md    | 3KB  | One-page overview            |
| COMPLETION_SUMMARY.md | 5KB  | What was accomplished        |

**Total Documentation**: 1,300+ lines

## 🎓 Learning Path

1. **Beginner**: Read QUICK_REFERENCE.md (3 min)
2. **Intermediate**: Read agents.md (15 min)
3. **Advanced**: Read docs/architecture.md + database.md (20 min)
4. **Implementation**: Follow SETUP.md and begin development

---

**Last Updated**: January 22, 2026
**Version**: 0.1.0
**Status**: Foundation Phase - Ready for Development

For questions, refer to the appropriate document above or check [agents.md](./agents.md).
