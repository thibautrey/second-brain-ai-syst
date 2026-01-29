# Second Brain AI System

An AI-powered personal cognitive operating system that captures, organizes, summarizes, and recalls information to augment human memory and decision-making. Built with privacy-first principles.

## 🚀 Quickstart

```bash
git clone https://github.com/thibautrey/second-brain-ai-syst && cd second-brain-ai-syst
./start.sh
```

Open http://localhost:5173 to access your Second Brain dashboard.

### What You Get Immediately

✅ **Core Features** (No API keys needed):
- Audio training and speaker recognition
- Voice profile creation
- Memory storage and semantic search
- User authentication
- Encrypted database

🤖 **AI Features** (Optional setup):
- **Local AI**: Run `./scripts/setup-local-llm.sh` for offline chat/analysis
- **Cloud AI**: Configure OpenAI/Anthropic in Settings → AI Configuration

## Features

### Core System (Always Available)
- **Continuous Memory**: Captures interactions and structures them automatically
- **Voice Recognition**: ECAPA-TDNN speaker recognition (fully local)
- **Semantic Search**: Find memories by meaning using vector embeddings
- **Privacy-First**: Self-hosted, encrypted storage, zero telemetry
- **Notifications**: Multi-channel alerts (including Pushover)

### AI-Powered Features (Requires LLM Setup)
- **Multi-Scale Summaries**: Daily → yearly time scales
- **Autonomous Agents**: Background processes for reflection, goals, habits
- **Proactive Coaching**: Health and productivity insights
- **Smart Chat**: Conversational interface with memory context
- **Tool Integration**: Browser automation, APIs, custom tools

## Memory System

- **Short-term Memory**: Full-fidelity capture for recent interactions
- **Long-term Memory**: Progressive summarization across 9 time scales
- **Hybrid Search**: Vector similarity + keyword + temporal filters

## Tools & Skills

- **Tools**: Stateless Python actions (fast, atomic)
- **Skills**: Human-readable workflows that orchestrate tools
- **Custom Tools**: Dynamically generated and sandboxed

## Security & Privacy

- End-to-end encryption for data and secrets
- JWT auth with user-scoped data isolation
- Zero telemetry, local-first architecture

## Architecture Highlights

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js 18, Express, TypeScript
- **Database**: PostgreSQL 14+
- **Vector DB**: Weaviate
- **LLM Providers**: OpenAI, Anthropic, Gemini, or local (Ollama)

## AI Setup Options

### Local AI (Privacy-Focused)
```bash
./scripts/setup-local-llm.sh
```

### Cloud AI (More Powerful)
1. Get API keys (OpenAI / Anthropic / Gemini).
2. Configure in web interface: Settings → AI Configuration.

## Documentation

- [Setup Guide](./SETUP.md) - Detailed development setup
- [Architecture & Agents](./agents.md) - Complete system design
- [Quick Reference](./QUICK_REFERENCE.md) - Command reference
- [📁 /docs](./docs/) - Architecture, authentication, database guides
- [📁 /docs/implementation-notes](./docs/implementation-notes/) - Development documentation

## Scripts

- `./start.sh` - Interactive setup (deps, env, services)
- `./scripts/setup-local-llm.sh` - Local AI setup
- `./scripts/setup-embedding-service.sh` - Audio processing setup

## License

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
