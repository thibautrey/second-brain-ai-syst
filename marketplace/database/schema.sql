-- =====================================================
-- SECOND BRAIN MARKETPLACE - SUPABASE SCHEMA
-- =====================================================
-- Run this in Supabase SQL Editor to create all tables
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SKILLS MARKETPLACE
-- =====================================================

CREATE TABLE IF NOT EXISTS marketplace_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Content
  instructions TEXT NOT NULL,  -- The actual skill instructions (SKILL.md content)
  category TEXT NOT NULL DEFAULT 'OTHER',
  tags TEXT[] DEFAULT '{}',
  icon TEXT,  -- Emoji or icon URL
  version TEXT DEFAULT '1.0.0',
  
  -- Author info (anonymous but trackable)
  author_instance_id TEXT NOT NULL,  -- Hash of instance ID for tracking
  author_name TEXT,  -- Optional display name
  author_url TEXT,   -- Optional website/github
  
  -- Statistics
  installs_count INTEGER DEFAULT 0,
  upvotes_count INTEGER DEFAULT 0,
  
  -- Security status
  security_status TEXT DEFAULT 'pending' CHECK (security_status IN ('pending', 'approved', 'rejected', 'flagged')),
  security_notes TEXT,
  security_checked_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_skills_category ON marketplace_skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_security ON marketplace_skills(security_status);
CREATE INDEX IF NOT EXISTS idx_skills_installs ON marketplace_skills(installs_count DESC);
CREATE INDEX IF NOT EXISTS idx_skills_upvotes ON marketplace_skills(upvotes_count DESC);
CREATE INDEX IF NOT EXISTS idx_skills_created ON marketplace_skills(created_at DESC);

-- =====================================================
-- TOOLS MARKETPLACE
-- =====================================================

CREATE TABLE IF NOT EXISTS marketplace_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Content
  language TEXT DEFAULT 'python',
  code TEXT NOT NULL,  -- The actual tool code
  input_schema JSONB NOT NULL,  -- JSON Schema for parameters
  output_schema JSONB,
  
  -- Dependencies
  required_secrets TEXT[] DEFAULT '{}',  -- e.g., ['OPENAI_API_KEY', 'WEATHER_API_KEY']
  
  -- Categorization
  category TEXT DEFAULT 'custom',
  tags TEXT[] DEFAULT '{}',
  
  -- Author info
  author_instance_id TEXT NOT NULL,
  author_name TEXT,
  author_url TEXT,
  
  -- Statistics
  installs_count INTEGER DEFAULT 0,
  upvotes_count INTEGER DEFAULT 0,
  
  -- Security status
  security_status TEXT DEFAULT 'pending' CHECK (security_status IN ('pending', 'approved', 'rejected', 'flagged')),
  security_notes TEXT,
  security_checked_at TIMESTAMPTZ,
  
  -- Metadata
  version TEXT DEFAULT '1.0.0',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_tools_category ON marketplace_tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_security ON marketplace_tools(security_status);
CREATE INDEX IF NOT EXISTS idx_tools_installs ON marketplace_tools(installs_count DESC);
CREATE INDEX IF NOT EXISTS idx_tools_upvotes ON marketplace_tools(upvotes_count DESC);
CREATE INDEX IF NOT EXISTS idx_tools_created ON marketplace_tools(created_at DESC);

-- =====================================================
-- INSTALLS TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS marketplace_installs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  item_type TEXT NOT NULL CHECK (item_type IN ('skill', 'tool')),
  item_id UUID NOT NULL,
  instance_id TEXT NOT NULL,  -- Anonymized instance identifier
  
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ,  -- NULL if still installed
  
  -- Prevent duplicate installs
  UNIQUE(item_type, item_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_installs_item ON marketplace_installs(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_installs_instance ON marketplace_installs(instance_id);

-- =====================================================
-- VOTES (Upvotes only, 1 per instance per item)
-- =====================================================

CREATE TABLE IF NOT EXISTS marketplace_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  item_type TEXT NOT NULL CHECK (item_type IN ('skill', 'tool')),
  item_id UUID NOT NULL,
  instance_id TEXT NOT NULL,
  
  vote INTEGER DEFAULT 1 CHECK (vote IN (1)),  -- Only upvotes for now
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One vote per instance per item
  UNIQUE(item_type, item_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_item ON marketplace_votes(item_type, item_id);

-- =====================================================
-- REPORTS (For flagging inappropriate content)
-- =====================================================

CREATE TABLE IF NOT EXISTS marketplace_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  item_type TEXT NOT NULL CHECK (item_type IN ('skill', 'tool')),
  item_id UUID NOT NULL,
  reporter_instance_id TEXT NOT NULL,
  
  reason TEXT NOT NULL,  -- 'security', 'inappropriate', 'spam', 'other'
  details TEXT,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON marketplace_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_item ON marketplace_reports(item_type, item_id);

-- =====================================================
-- FUNCTIONS FOR ATOMIC OPERATIONS
-- =====================================================

-- Increment install count
CREATE OR REPLACE FUNCTION increment_installs(p_item_type TEXT, p_item_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_item_type = 'skill' THEN
    UPDATE marketplace_skills SET installs_count = installs_count + 1, updated_at = NOW() WHERE id = p_item_id;
  ELSE
    UPDATE marketplace_tools SET installs_count = installs_count + 1, updated_at = NOW() WHERE id = p_item_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Decrement install count (on uninstall)
CREATE OR REPLACE FUNCTION decrement_installs(p_item_type TEXT, p_item_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_item_type = 'skill' THEN
    UPDATE marketplace_skills SET installs_count = GREATEST(0, installs_count - 1), updated_at = NOW() WHERE id = p_item_id;
  ELSE
    UPDATE marketplace_tools SET installs_count = GREATEST(0, installs_count - 1), updated_at = NOW() WHERE id = p_item_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Increment upvote count
CREATE OR REPLACE FUNCTION increment_upvotes(p_item_type TEXT, p_item_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_item_type = 'skill' THEN
    UPDATE marketplace_skills SET upvotes_count = upvotes_count + 1, updated_at = NOW() WHERE id = p_item_id;
  ELSE
    UPDATE marketplace_tools SET upvotes_count = upvotes_count + 1, updated_at = NOW() WHERE id = p_item_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Decrement upvote count (on vote removal)
CREATE OR REPLACE FUNCTION decrement_upvotes(p_item_type TEXT, p_item_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_item_type = 'skill' THEN
    UPDATE marketplace_skills SET upvotes_count = GREATEST(0, upvotes_count - 1), updated_at = NOW() WHERE id = p_item_id;
  ELSE
    UPDATE marketplace_tools SET upvotes_count = GREATEST(0, upvotes_count - 1), updated_at = NOW() WHERE id = p_item_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE marketplace_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reports ENABLE ROW LEVEL SECURITY;

-- Public read access for approved items
CREATE POLICY "Public can view approved skills" ON marketplace_skills
  FOR SELECT USING (security_status = 'approved');

CREATE POLICY "Public can view approved tools" ON marketplace_tools
  FOR SELECT USING (security_status = 'approved');

-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access skills" ON marketplace_skills
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access tools" ON marketplace_tools
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access installs" ON marketplace_installs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access votes" ON marketplace_votes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access reports" ON marketplace_reports
  FOR ALL USING (auth.role() = 'service_role');

-- Anon key can insert (for publishing from instances)
CREATE POLICY "Anon can publish skills" ON marketplace_skills
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can publish tools" ON marketplace_tools
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can track installs" ON marketplace_installs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can vote" ON marketplace_votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can report" ON marketplace_reports
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- DONE! Your marketplace database is ready.
-- =====================================================
