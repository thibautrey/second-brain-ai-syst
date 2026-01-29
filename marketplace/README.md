# Second Brain Marketplace

Public marketplace for sharing Skills and Tools across Second Brain instances.

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Project name**: `second-brain-marketplace`
   - **Database password**: Generate a strong one (save it!)
   - **Region**: Choose closest to you
4. Wait ~2 minutes for setup

### Step 2: Create Database Tables

1. In Supabase dashboard, go to **SQL Editor**
2. Copy and paste the content from `database/schema.sql`
3. Click "Run"

### Step 3: Get Your API Keys

In Supabase dashboard:

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (safe for frontend)
   - **service_role** key (for backend only, keep secret!)

### Step 4: Configure Your Instance

Add these environment variables to your `.env`:

```bash
# Marketplace (Supabase)
MARKETPLACE_SUPABASE_URL=https://your-project.supabase.co
MARKETPLACE_SUPABASE_ANON_KEY=your-anon-key
MARKETPLACE_SUPABASE_SERVICE_KEY=your-service-role-key  # Backend only

# Instance identification (generated automatically on first run)
INSTANCE_ID=  # Leave empty, will be auto-generated
```

### Step 5: Restart Your Backend

```bash
docker compose up -d --build
```

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MARKETPLACE FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐    PUBLISH     ┌──────────────────────┐     │
│  │ User Instance  │───────────────▶│  Supabase            │     │
│  │                │                │                      │     │
│  │ • Create Skill │    BROWSE      │  • marketplace_skills│     │
│  │ • Create Tool  │◀──────────────▶│  • marketplace_tools │     │
│  │                │                │  • installs          │     │
│  │                │    INSTALL     │  • votes             │     │
│  │                │───────────────▶│                      │     │
│  │                │                │                      │     │
│  │                │    UPVOTE      │                      │     │
│  │                │───────────────▶│                      │     │
│  └────────────────┘                └──────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Check Flow

When publishing a skill/tool:

1. **Backend** receives publish request
2. **LLM Analysis** checks for:
   - Hardcoded secrets/API keys
   - Malicious patterns (eval, exec, rm -rf, etc.)
   - Dangerous system calls
   - Data exfiltration attempts
3. If **approved** → Published with `security_status: 'approved'`
4. If **rejected** → Returns error with explanation

---

## 📁 Folder Structure

```
marketplace/
├── README.md                 # This file
├── database/
│   └── schema.sql           # Supabase schema (run in SQL Editor)
├── backend/
│   ├── marketplace.service.ts   # Supabase client & operations
│   └── marketplace.controller.ts # REST API endpoints
└── types/
    └── marketplace.types.ts     # TypeScript types
```

---

## 🔌 API Endpoints

| Method | Endpoint                          | Description                  |
| ------ | --------------------------------- | ---------------------------- |
| GET    | `/api/marketplace/skills`         | Browse public skills         |
| GET    | `/api/marketplace/tools`          | Browse public tools          |
| POST   | `/api/marketplace/skills/publish` | Publish a skill              |
| POST   | `/api/marketplace/tools/publish`  | Publish a tool               |
| POST   | `/api/marketplace/install`        | Track installation           |
| POST   | `/api/marketplace/vote`           | Upvote an item               |
| DELETE | `/api/marketplace/vote`           | Remove upvote                |
| POST   | `/api/marketplace/report`         | Report inappropriate content |

---

## 🔑 Required Environment Variables

| Variable                           | Where to find             | Purpose           |
| ---------------------------------- | ------------------------- | ----------------- |
| `MARKETPLACE_SUPABASE_URL`         | Supabase → Settings → API | API endpoint      |
| `MARKETPLACE_SUPABASE_ANON_KEY`    | Supabase → Settings → API | Public operations |
| `MARKETPLACE_SUPABASE_SERVICE_KEY` | Supabase → Settings → API | Backend admin ops |
