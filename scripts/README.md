# Scripts Directory

This directory contains all utility scripts for the Second Brain AI System.

## Available Scripts

### `setup-embedding-service.sh`

Sets up the ECAPA-TDNN embedding service environment.

**Usage:**

```bash
./scripts/setup-embedding-service.sh
```

**What it does:**

- Checks Python 3 and pip installation
- Creates models directory
- Installs Python dependencies (torch, speechbrain, flask)
- Installs Node.js dependencies
- Creates `.env` file if needed

**First run time:** 10-30 minutes (downloads ~150 MB model)

---

### `setup-input-system.sh`

Sets up the input ingestion system and validates the configuration.

**Usage:**

```bash
./scripts/setup-input-system.sh
```

**What it does:**

- Checks npm and PostgreSQL
- Verifies database schema
- Checks configuration files
- Validates documentation

---

### `archive-notes.sh`

Helps manage and archive implementation notes as features become stable.

**Usage:**

```bash
./scripts/archive-notes.sh list
./scripts/archive-notes.sh move <file>
./scripts/archive-notes.sh rm <file>
```

**What it does:**

- Lists current implementation notes
- Provides archival workflow guidance
- Helps migrate documentation to permanent docs

---

### `check-doc-organization.sh`

Validates that documentation is properly organized according to project rules.

**Usage:**

```bash
./scripts/check-doc-organization.sh
```

**What it does:**

- Checks that no temporary markdown files are at root level
- Verifies implementation notes are in `/docs/implementation-notes/`
- Validates that `agents.md` contains organization guidelines
- Reports any violations of the documentation organization rule

**Why use it:**

- Ensures documentation stays organized as project grows
- Catches accidental creation of markdown files at root
- Validates before committing changes
- Good pre-commit hook candidate

---

### `make-executable.sh`

Makes all scripts in this directory executable.

**Usage:**

```bash
./scripts/make-executable.sh
```

---

## Quick Start

### For Embedding Service (Local Development)

```bash
# Setup environment
./scripts/setup-embedding-service.sh

# Terminal 1: Run Python service
python3 backend/services/embedding-service.py

# Terminal 2: Run Backend
cd backend && npm run dev
```

### With Docker

```bash
docker compose up --build
```

---

## Script Paths

All scripts are designed to be run from the project root:

```bash
# ✅ Correct
./scripts/setup-embedding-service.sh

# ❌ Don't do this
cd scripts && ./setup-embedding-service.sh
```

---

## Environment

These scripts use relative paths from the project root and expect the following structure:

```
second-brain-ai-syst/
├── scripts/              (this directory)
├── backend/
│   ├── services/
│   ├── requirements.txt
│   └── package.json
├── docs/
├── config/
├── .env
└── package.json
```

---

## Requirements

### setup-embedding-service.sh

- Python 3.8+
- pip3
- Node.js 18+
- npm

### setup-input-system.sh

- Node.js 18+
- npm
- PostgreSQL (optional, for testing)

### Docker

- Docker
- Docker Compose

---

## Troubleshooting

### "Permission denied" error

```bash
# Make scripts executable
./scripts/make-executable.sh
# or manually
chmod +x scripts/*.sh
```

### Python not found

```bash
# Install Python 3.8+
# macOS:
brew install python3

# Ubuntu:
sudo apt install python3 python3-pip

# Or download from https://www.python.org/downloads/
```

### Model download fails

```bash
# Check internet connection
# Try manually:
python3 backend/services/embedding-service.py

# If still fails, check ./models directory permissions:
mkdir -p ./models
chmod 755 ./models
```

---

## Maintenance

- Scripts should be self-contained and work from project root
- Update paths if directory structure changes
- Add new scripts following the same naming convention: `action-target.sh`
- Always include usage documentation

---

**Last Updated**: January 23, 2026
