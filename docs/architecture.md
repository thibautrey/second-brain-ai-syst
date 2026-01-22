# Architecture Overview

## System Components

### Frontend (React + TypeScript)

- Memory browser with timeline and search
- Configuration dashboard
- Activity logs and audit trail
- Real-time memory updates via WebSocket

### Backend API (Node.js + Express/Fastify)

- REST endpoints for memory CRUD
- Intent classification
- Tool execution coordination
- LLM request routing
- Summarization scheduling

### Database Layer

- **PostgreSQL**: Structured data, metadata, logs
- **Weaviate**: Vector embeddings for semantic search

### Memory Architecture

#### Short-term Memory

- Captures all meaningful interactions
- 24h - 7 days retention
- Full fidelity storage
- Vectorized in Weaviate

#### Long-term Memory

- Progressively summarized from short-term
- Time scales: daily → multi-year
- Tagged with topics, entities, sentiment
- Linked to source interactions

### Service Communication Flow

```
┌─────────────────┐
│  User Request   │
└────────┬────────┘
         │
    ┌────▼─────────────────────────────────┐
    │    Intent Router Service             │
    │  - Classify input type               │
    │  - Assess confidence                 │
    │  - Determine scope                   │
    └────┬─────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │   Memory Retrieval Service            │
    │  - Fetch relevant context             │
    │  - Hybrid search (vector + keyword)   │
    └────┬──────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │   LLM Router Service                  │
    │  - Select optimal model               │
    │  - Route to provider                  │
    └────┬──────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │    Tool Executor (if needed)          │
    │  - Execute tools                      │
    │  - Capture results                    │
    └────┬──────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │   Memory Manager Service              │
    │  - Store interaction                  │
    │  - Generate embeddings                │
    │  - Log audit trail                    │
    └────┬──────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │   Response to User                    │
    └─────────────────────────────────────────┘
```

## Data Flow

### Memory Ingestion

1. User input arrives
2. Intent Router classifies
3. If not noise → Memory Manager ingests
4. Generate embedding via OpenAI
5. Store in both PostgreSQL and Weaviate
6. Update user's short-term memory

### Summarization Cycle

1. Scheduled task triggers (daily at 11 PM)
2. Memory Manager retrieves last 24h of memories
3. LLM generates summary
4. Link summary to source memories
5. Move summarized short-term to long-term
6. Clean up old short-term entries

### Query Processing

1. User asks a question
2. Intent Router analyzes temporal and topic context
3. Memory Retrieval determines scopes to search
4. Weaviate semantic search returns top-K similar memories
5. PostgreSQL filters by time and metadata
6. LLM context built from retrieved memories
7. LLM generates response with memory context

## Technology Stack

| Layer            | Technology                         | Purpose                  |
| ---------------- | ---------------------------------- | ------------------------ |
| Frontend         | React 18, TypeScript, Tailwind CSS | User interface           |
| Backend          | Node.js 18, Express/Fastify        | API server               |
| Database         | PostgreSQL 14+                     | Structured data          |
| Vector DB        | Weaviate                           | Semantic search          |
| ORM              | Prisma                             | Database access          |
| LLM              | OpenAI API                         | Language models          |
| Vector Embedding | OpenAI text-embedding-ada-002      | Embeddings               |
| Tools            | Browseruse, REST APIs, MCP         | External integrations    |
| Containerization | Docker                             | Development & deployment |

## Privacy & Security

- **Data at Rest**: PostgreSQL and Weaviate behind authentication
- **Data in Transit**: HTTPS, secure WebSocket connections
- **Encryption**: Sensitive fields encrypted in database
- **Audit Logging**: Every read/write operation logged
- **Access Control**: User-scoped queries, no cross-user data access
- **Local Mode**: All processing can run locally, no cloud dependency
