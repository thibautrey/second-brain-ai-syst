# Project Setup Guide

## ✅ Completed

- ✅ Cleaned up spark-template specific files
- ✅ Removed unnecessary UI component library
- ✅ Created modular project structure
- ✅ Implemented core service skeletons
- ✅ Created database schema design
- ✅ Setup Docker Compose for development
- ✅ Created comprehensive documentation
- ✅ Defined agent architecture and roadmap

## 📁 Project Structure

```
second-brain-ai-syst/
├── backend/                    # Node.js backend services
│   ├── services/               # Core business logic
│   │   ├── api-server.ts       # REST API setup
│   │   ├── intent-router.ts    # Input classification
│   │   ├── memory-manager.ts   # Memory lifecycle
│   │   ├── tool-executor.ts    # External tools
│   │   └── llm-router.ts       # Model selection
│   ├── models/                 # Data model definitions
│   ├── controllers/            # API route handlers
│   ├── database/               # Migrations & schemas
│   ├── middlewares/            # Express middleware
│   └── utils/                  # Helper functions
│
├── frontend/                   # React application
│   ├── components/ui/          # Shadcn UI components (to be populated)
│   ├── hooks/                  # Custom React hooks
│   ├── styles/                 # Global styles
│   └── lib/                    # Utilities
│
├── docker/                     # Docker configuration
│   ├── docker-compose.yml      # Development stack
│   ├── Dockerfile.backend      # Backend image
│   └── Dockerfile.frontend     # Frontend image
│
├── docs/                       # Documentation
│   ├── architecture.md         # System design
│   ├── database.md             # Schema definitions
│   └── ...
│
├── agents.md                   # Agent system & roadmap
├── README.md                   # Project overview
├── .env.example                # Environment template
└── package.json                # Monorepo root
```

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
# OPENAI_API_KEY=sk-...
# DB_PASSWORD=your_secure_password
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Environment

```bash
# Option A: With Docker Compose (recommended)
cd docker
docker-compose up -d

# Option B: Manual setup
# Terminal 1: Backend
npm run backend:dev

# Terminal 2: Frontend
npm run dev
```

### 4. Verify Services

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Weaviate**: http://localhost:8080

## 📋 Next Steps (Phase 1)

### Week 1-2: Backend Foundation

- [ ] Initialize Express/Fastify server
- [ ] Setup Prisma ORM
- [ ] Connect to PostgreSQL
- [ ] Create database migrations
- [ ] Implement basic API endpoints

### Week 3-4: Core Services

- [ ] Implement Intent Router service
- [ ] Build Memory Manager (short-term storage)
- [ ] Create basic memory retrieval
- [ ] Setup vector embedding pipeline
- [ ] Connect to Weaviate

### Week 5: Frontend Foundation

- [ ] Setup React app with TypeScript
- [ ] Create memory browser component
- [ ] Build settings panel
- [ ] Implement WebSocket connection

## 🔑 Key Features to Implement (Priority Order)

1. **Memory Ingestion Pipeline**
   - Accept user input
   - Classify intent
   - Filter noise
   - Store in short-term memory

2. **Semantic Search**
   - Vector embeddings via OpenAI
   - Hybrid search (vector + keyword + temporal)
   - Ranking and relevance scoring

3. **Summarization Engine**
   - Daily summary generation
   - Progressive summarization
   - Summary versioning

4. **Tool Integration**
   - Browser automation (Browseruse)
   - External API calls
   - MCP server support

5. **UI & Dashboard**
   - Memory browser
   - Timeline view
   - Search interface
   - Settings panel

## 📊 Database Setup

```bash
# Initialize database with Prisma
npx prisma migrate dev --name init

# View and edit data
npm run db:studio
```

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f backend

# Reset database
docker-compose down -v
docker-compose up -d
```

## 🔐 Environment Variables

Key variables to configure in `.env`:

```
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/second_brain

# Services
WEAVIATE_URL=http://localhost:8080
JWT_SECRET=your-secret-key

# Configuration
LOG_LEVEL=info
MEMORY_RETENTION_DAYS=7
```

## 📚 Documentation

- **[agents.md](./agents.md)** - Complete agent architecture and roadmap
- **[docs/architecture.md](./docs/architecture.md)** - System design
- **[docs/database.md](./docs/database.md)** - Database schema
- **[README.md](./README.md)** - Project overview

## 💡 Development Tips

- Each service is independent and testable
- Add tests as you implement features
- Use TypeScript strict mode for type safety
- Document API endpoints with JSDoc
- Keep business logic separate from infrastructure

## ❓ Support

For detailed architecture information, see [agents.md](./agents.md)

For database design, see [docs/database.md](./docs/database.md)
