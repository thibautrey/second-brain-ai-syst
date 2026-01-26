# Second Brain AI System

An AI-powered personal cognitive operating system that captures, organizes, summarizes, and recalls information to augment human memory and decision-making.

## Features

- **Continuous Memory**: Captures interactions and structures them automatically
- **Multi-scale Summaries**: Generates summaries from daily to yearly timescales
- **Semantic Search**: Find memories by meaning, not just keywords
- **Autonomous Agents**: Background processes for reflection, goals, habits
- **Proactive Coaching**: AI agent that analyzes patterns and provides helpful suggestions for health, productivity, and wellbeing
- **Privacy-First**: Self-hosted, encrypted storage, zero telemetry
- **Tool Integration**: Browser automation, APIs, custom tools
- **Mobile App**: iOS/Android app for chat access on the go (see `/mobile-app`)

## Quick Start

### Web Application

```bash
# Setup embedding service (optional, or use Docker)
./scripts/setup-embedding-service.sh

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run development
npm run dev

# Or use Docker for everything
docker compose up --build
```

### Mobile App (iOS/Android)

For mobile access to the chat feature:

```bash
cd mobile-app
npm install
cp .env.example .env
# Edit .env to set EXPO_PUBLIC_API_URL
npm start
```

See [mobile-app/QUICKSTART.md](./mobile-app/QUICKSTART.md) for detailed mobile setup instructions.

## Scripts

All utility scripts are located in `/scripts/`:

- **`./scripts/setup-embedding-service.sh`** - Setup ECAPA-TDNN embedding service
- **`./scripts/setup-input-system.sh`** - Setup input ingestion system
- **`./scripts/archive-notes.sh`** - Manage implementation notes archival

See [Scripts Documentation](./scripts/README.md) for details.

## Documentation

### Essential References

- [Architecture & Agents](./agents.md) - Complete system design and agent architecture
- [Setup Guide](./SETUP.md) - Initial development setup
- [Quick Reference](./QUICK_REFERENCE.md) - Quick command reference

### Organized Documentation

- [Permanent Documentation](/docs) - Architecture, authentication, database, and integration guides
  - [Proactive Agent](/docs/proactive-agent.md) - AI coaching system for health and productivity
- [Implementation Notes](/docs/implementation-notes) - Temporary development documentation and feature guides

**Note**: Documentation is organized to keep the repository clean. Implementation notes are archived to `/docs/implementation-notes/` during development and moved to permanent documentation when features become stable. See [Documentation Organization](./agents.md#-documentation--implementation-notes-management) for details.

📄 License For Spark Template Resources

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
