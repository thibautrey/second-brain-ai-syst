# 🧠 Second Brain AI System - Quick Reference

## What Was Cleaned Up

❌ **Removed**:

- `spark-template` branding and configurations
- 46 unnecessary UI components (kept foundation with shadcn/ui)
- `@github/spark`, `@octokit/core`, `@phosphor-icons/react` dependencies
- Template configuration files (`runtime.config.json`, `spark.meta.json`, `theme.json`)

✅ **Kept**:

- React + TypeScript foundation
- Tailwind CSS + Radix UI components
- Vite build configuration
- Core build tooling

---

## New Project Structure

```
project/
├── backend/                 # Node.js + TypeScript services
│   ├── services/           # 5 core services (Intent Router, Memory Manager, etc.)
│   ├── models/             # TypeScript data models
│   ├── database/           # Migrations & schema designs
│   └── controllers/        # API handlers
├── frontend/               # React + TypeScript UI
├── docker/                 # Docker Compose for local dev
├── docs/                   # Architecture & schema docs
├── agents.md              # **Complete system architecture**
├── SETUP.md               # **Setup & development guide**
└── .env.example           # Environment configuration
```

---

## 🤖 Core System Agents

1. **Intent Router** - Classifies user input (question/command/noise/etc)
2. **Memory Manager** - Handles memory ingestion and summarization
3. **Memory Retrieval** - Semantic search across memories
4. **Tool Executor** - Runs external tools and APIs
5. **LLM Router** - Selects optimal language model
6. **Summarization** - Generates summaries at multiple time scales
7. **Noise Filter** - Distinguishes meaningful interactions from noise
8. **Background Agents** - Daily reflection, weekly summaries, goal tracking, etc.

---

## 📊 Database Design

**PostgreSQL Tables**:

- `users` - User accounts
- `interactions` - Raw user inputs
- `memories` - Short & long-term memory entries
- `summaries` - Multi-scale summaries
- `tools` - Tool configurations
- `audit_logs` - Access tracking
- `background_agents` - Agent state

**Weaviate**:

- Vector embeddings for semantic search
- Hybrid search: vector + keyword + temporal

---

## 🚀 Development Roadmap

| Phase | Timeline    | Focus                                             |
| ----- | ----------- | ------------------------------------------------- |
| 1     | Weeks 1-4   | Foundation: API, database, basic memory           |
| 2     | Weeks 5-8   | Memory core: ingestion, embeddings, summarization |
| 3     | Weeks 9-12  | Autonomy: background agents                       |
| 4     | Weeks 13-16 | Tools: browser automation, APIs                   |
| 5     | Weeks 17+   | Polish: UI, deployment, monitoring                |

---

## 📚 Key Documentation

| File                                           | Purpose                                 |
| ---------------------------------------------- | --------------------------------------- |
| [agents.md](./agents.md)                       | **START HERE** - Complete system design |
| [SETUP.md](./SETUP.md)                         | Development setup & quick start         |
| [docs/architecture.md](./docs/architecture.md) | System components & data flow           |
| [docs/database.md](./docs/database.md)         | SQL schema & Weaviate design            |

---

## 🎯 Success Metrics

- Memory accuracy: >95%
- Retrieval relevance: >90%
- Noise filtering precision: >85%
- Response latency: <5s
- System uptime: >99.5%

---

## 🔧 Quick Commands

```bash
# Install & setup
npm install
cp .env.example .env

# Development
npm run dev              # Start frontend
npm run backend:dev     # Start backend
docker-compose up       # Start all services

# Database
npm run db:studio      # Edit data
npx prisma migrate     # Run migrations
```

---

## 🔑 System Architecture in One Diagram

```
User Input → Intent Router → Memory Retrieval → LLM Router → Tool Executor
     ↓                             ↓                              ↓
   PostgreSQL              Weaviate Search              External APIs
   Audit Log               Hybrid Search                Browser Automation
     ↓                             ↓                              ↓
Memory Manager → (Store → Embed → Index) → Response to User
```

---

## 💡 Core Philosophy

- **Privacy First**: Local-first, encrypted storage, zero telemetry
- **Memory as Foundation**: Accuracy over autonomy initially
- **Multi-Scale Thinking**: Summaries from daily to yearly
- **Transparent Reasoning**: Show which memories influenced each answer
- **Tool Integration**: Extend capabilities safely and sandboxed

---

**Version**: 0.1.0 | **Status**: Foundation Phase | **Last Updated**: Jan 22, 2026
