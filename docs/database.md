# Database Schema

## PostgreSQL Tables

### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### interactions

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- question|command|reflection|observation|conversation|noise
  content TEXT NOT NULL,
  metadata JSONB,
  is_noise BOOLEAN DEFAULT false,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX idx_interactions_user_created ON interactions(user_id, created_at DESC);
```

### memories

```sql
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  interaction_id UUID REFERENCES interactions(id),
  type VARCHAR(20) NOT NULL, -- short_term|long_term
  time_scale VARCHAR(20), -- daily|3day|weekly|biweekly|monthly|quarterly|6month|yearly|multiyear
  content TEXT NOT NULL,
  summary TEXT,
  embedding_id VARCHAR(255), -- Reference to Weaviate object ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  importance_score DECIMAL(3,2),
  tags TEXT[] DEFAULT '{}',
  source_memory_ids UUID[] DEFAULT '{}',
  accuracy DECIMAL(3,2),
  provenance VARCHAR(50), -- user_said|api_result|browser_data|inferred

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX idx_memories_user_type ON memories(user_id, type);
CREATE INDEX idx_memories_time_scale ON memories(time_scale, created_at DESC);
CREATE INDEX idx_memories_tags ON memories USING gin(tags);
```

### summaries

```sql
CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  time_scale VARCHAR(20) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  content TEXT NOT NULL,
  key_insights TEXT[],
  tags TEXT[] DEFAULT '{}',
  source_memory_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX idx_summaries_user_timescale ON summaries(user_id, time_scale);
```

### tools

```sql
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- browser|api|mcp|custom
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  rate_limit INTEGER DEFAULT 100,
  timeout INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(name)
);
```

### audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
```

### background_agents

```sql
CREATE TABLE background_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'idle',
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  result JSONB,
  error TEXT,

  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

## Weaviate Collections

### memories_collection

Vector embeddings for semantic search

```json
{
  "class": "Memory",
  "properties": [
    {
      "name": "content",
      "dataType": ["text"]
    },
    {
      "name": "user_id",
      "dataType": ["string"]
    },
    {
      "name": "memory_id",
      "dataType": ["string"]
    },
    {
      "name": "time_scale",
      "dataType": ["string"]
    },
    {
      "name": "tags",
      "dataType": ["string[]"]
    },
    {
      "name": "importance_score",
      "dataType": ["number"]
    },
    {
      "name": "created_at",
      "dataType": ["date"]
    }
  ],
  "vectorizer": "text2vec-openai",
  "moduleConfig": {
    "text2vec-openai": {
      "model": "ada",
      "type": "text"
    }
  }
}
```

## Query Examples

### Find recent memories with vector search

```sql
SELECT m.id, m.content, m.importance_score
FROM memories m
WHERE m.user_id = $1 AND m.type = 'short_term'
ORDER BY m.created_at DESC
LIMIT 50;
```

### Find summaries for time range

```sql
SELECT * FROM summaries
WHERE user_id = $1
  AND time_scale = $2
  AND period_start >= $3
  AND period_end <= $4
ORDER BY period_start DESC;
```

### Audit trail for memory access

```sql
SELECT * FROM audit_logs
WHERE user_id = $1 AND action IN ('memory_read', 'memory_write')
ORDER BY timestamp DESC
LIMIT 100;
```
