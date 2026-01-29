# 🧠 Second Brain AI System

> _Your personal AI cognitive operating system that remembers everything, so you don't have to._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Privacy First](https://img.shields.io/badge/Privacy-First-red.svg)](#security--privacy)

An AI-powered personal cognitive operating system that **captures**, **organizes**, **summarizes**, and **recalls** information to augment human memory and decision-making. Built with **privacy-first principles** and local-first architecture.

## 🚀 Quick Start

Get up and running in seconds:

```bash
git clone https://github.com/thibautrey/second-brain-ai-syst && cd second-brain-ai-syst
./start.sh
```

Then open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## ⚡ What You Get

### 🎯 Core Features (No setup needed)

| Feature                  | Description                                   |
| ------------------------ | --------------------------------------------- |
| 🎙️ **Voice Recognition** | ECAPA-TDNN speaker recognition (100% local)   |
| 🔐 **Encrypted Storage** | End-to-end encryption for all your data       |
| 🔍 **Smart Search**      | Find memories by meaning, not just keywords   |
| 👤 **Auth System**       | Secure user authentication                    |
| 🎤 **Audio Training**    | Create voice profiles for speaker recognition |

### 🤖 AI Features (Optional - bring your own LLM)

| Feature                      | How to Enable                                       |
| ---------------------------- | --------------------------------------------------- |
| 💬 **Smart Chat**            | Local LLM: `./scripts/setup-local-llm.sh`           |
| 📊 **Multi-Scale Summaries** | Cloud AI: Configure in Settings → AI Configuration  |
| 🎯 **Goal Tracking**         | Supports OpenAI, Anthropic, Gemini, or local Ollama |
| 💡 **Proactive Coaching**    | Health & productivity insights                      |
| 🛠️ **Tool Integration**      | Browser automation, APIs, custom tools              |

---

## 💎 Key Capabilities

## Features

### 🎯 Core System (Always Available)

- **Continuous Memory**: Captures interactions and structures them automatically
- **Voice Recognition**: ECAPA-TDNN speaker recognition (fully local)
- **Semantic Search**: Find memories by meaning using vector embeddings
- **Privacy-First**: Self-hosted, encrypted storage, zero telemetry
- **Notifications**: Multi-channel alerts (including Pushover)

### 🤖 AI-Powered Features (Requires LLM Setup)

- **Multi-Scale Summaries**: Daily → yearly time scales
- **Autonomous Agents**: Background processes for reflection, goals, habits
- **Proactive Coaching**: Health and productivity insights
- **Smart Chat**: Conversational interface with memory context
- **Tool Integration**: Browser automation, APIs, custom tools

---

## 💎 Key Capabilities

### 🧠 Memory System

Your personal knowledge base with intelligent retrieval:

- **📝 Short-term Memory**: Full-fidelity capture for recent interactions
- **📚 Long-term Memory**: Progressive summarization across 9 time scales
- **🔎 Hybrid Search**: Vector similarity + keyword + temporal filters

### 🛠️ Tools & Skills

- **⚙️ Tools**: Stateless Python actions (fast, atomic, sandboxed)
- **📖 Skills**: Human-readable workflows that orchestrate tools
- **🎨 Custom Tools**: Dynamically generated and fully customizable

### 🏛️ Architecture

| Component          | Technology                         |
| ------------------ | ---------------------------------- |
| 🎨 **Frontend**    | React 18, TypeScript, Tailwind CSS |
| ⚙️ **Backend**     | Node.js 18+, Express, TypeScript   |
| 🗄️ **Database**    | PostgreSQL 14+                     |
| 🔍 **Vector DB**   | Weaviate (semantic search)         |
| 🤖 **LLM Support** | OpenAI, Anthropic, Gemini, Ollama  |

---

## 🔒 Security & Privacy

Your data stays **yours** and on **your machine**:

```
✅ End-to-end encryption
✅ JWT authentication with data isolation
✅ Zero telemetry & tracking
✅ Self-hosted & local-first
✅ Audit logs for all access
```

---

## 🎯 AI Setup Options

### 🌐 Option 1: Local AI (100% Privacy)

```bash
./scripts/setup-local-llm.sh
```

Uses [Ollama](https://ollama.ai/) for offline chat and analysis.

### ☁️ Option 2: Cloud AI (More Powerful)

1. Get an API key from OpenAI / Anthropic / Gemini
2. Go to **Settings → AI Configuration** in your dashboard
3. Paste your key (stored locally, never sent to our servers)

---

## 📚 Documentation

| Resource                                                | Purpose                                      |
| ------------------------------------------------------- | -------------------------------------------- |
| [📖 Setup Guide](./SETUP.md)                            | Detailed development setup & installation    |
| [🏗️ Architecture & Agents](./agents.md)                 | Complete system design & agent architecture  |
| [⚡ Quick Reference](./QUICK_REFERENCE.md)              | Common commands & quick tips                 |
| [📁 Full Docs](./docs/)                                 | Deep dives into auth, database, integrations |
| [🛠️ Implementation Notes](./docs/implementation-notes/) | Development guides & technical deep-dives    |

---

## 🔧 Available Scripts

```bash
./start.sh                           # 🚀 Interactive setup (installs deps, starts services)
./scripts/setup-local-llm.sh         # 🤖 Configure local AI (Ollama)
./scripts/setup-embedding-service.sh # 🎙️ Configure audio processing
```

---

## 📊 Tech Stack

<details>
<summary><b>Click to expand</b></summary>

**Frontend:**

- React 18 with TypeScript
- Tailwind CSS for styling
- Real-time updates via WebSocket

**Backend:**

- Node.js 18+ with Express
- TypeScript for type safety
- PostgreSQL for structured data
- Weaviate for vector embeddings

**AI & ML:**

- Support for OpenAI, Anthropic, Gemini, Ollama
- ECAPA-TDNN for speaker recognition
- Semantic search via vector embeddings

</details>

---

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, features, or documentation improvements, please feel free to open an issue or submit a pull request.

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=thibautrey/second-brain-ai-syst&type=date&legend=top-left)](https://www.star-history.com/#thibautrey/second-brain-ai-syst&type=date&legend=top-left)

---

<div align="center">

### Made with ❤️ for people who want to remember everything

[⬆ Back to top](#-second-brain-ai-system)

</div>
