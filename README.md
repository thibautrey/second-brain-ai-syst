# Second Brain AI System

An AI-powered personal cognitive operating system that captures, organizes, summarizes, and recalls information to augment human memory and decision-making.

## 🚀 Quick Start (< 1 minute)

```bash
git clone <your-repo-url>
cd second-brain-ai-syst
./scripts/setup.sh
docker compose up --build
```

**That's it!** Open http://localhost:5173 to access your personal AI system.

### What You Get Immediately

✅ **Core Features** (No API keys needed):
- Audio training and speaker recognition
- Voice profile creation
- Memory storage and semantic search
- User authentication and settings
- Database with encryption

🤖 **AI Features** (Optional setup):
- **Local AI**: Run `./scripts/setup-local-llm.sh` for offline chat/analysis
- **Cloud AI**: Configure OpenAI/Anthropic in web interface for advanced features

## Features Overview

### Core System (Always Available)
- **Continuous Memory**: Captures interactions and structures them automatically
- **Audio Processing**: ECAPA-TDNN speaker recognition (completely local)
- **Semantic Search**: Find memories by meaning using vector embeddings
- **Privacy-First**: Self-hosted, encrypted storage, zero telemetry
- **Voice Profiles**: Create and manage speaker recognition profiles

### AI-Powered Features (Requires LLM Setup)
- **Multi-scale Summaries**: Generates summaries from daily to yearly timescales
- **Autonomous Agents**: Background processes for reflection, goals, habits
- **Proactive Coaching**: AI agent that analyzes patterns for health and productivity
- **Smart Chat**: Conversational interface with memory context
- **Tool Integration**: Browser automation, APIs, custom tools

## Add AI Chat Features

Choose your preferred AI setup:

### Option A: Local AI (Recommended for Privacy)
```bash
./scripts/setup-local-llm.sh  # Sets up Ollama + local models
```

### Option B: Cloud AI (More Powerful)
1. Get API keys from:
   - **OpenAI**: https://platform.openai.com/api-keys
   - **Anthropic**: https://console.anthropic.com/
   - **Others**: Any OpenAI-compatible provider

2. Configure in web interface: Settings → AI Configuration

## Documentation

### Quick References
- [Setup Guide](./SETUP.md) - Detailed development setup
- [Architecture & Agents](./agents.md) - Complete system design
- [Quick Reference](./QUICK_REFERENCE.md) - Command reference

### Detailed Docs
- [📁 /docs](./docs/) - Architecture, authentication, database guides
- [📁 /docs/implementation-notes](./docs/implementation-notes/) - Development documentation

### Scripts & Tools
- [📁 /scripts](./scripts/) - Setup and utility scripts
- **Key Scripts**:
  - `./scripts/setup.sh` - Main setup script
  - `./scripts/setup-local-llm.sh` - Local AI setup
  - `./scripts/setup-embedding-service.sh` - Audio processing setup

📄 License For Spark Template Resources

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
