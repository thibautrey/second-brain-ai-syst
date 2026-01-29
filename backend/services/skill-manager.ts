/**
 * Skill Manager Service
 *
 * Manages skills lifecycle following Moltbot/AgentSkills patterns.
 * Skills are modular packages that extend the AI's capabilities with
 * specialized knowledge, workflows, and tool integrations.
 *
 * Skills Structure:
 * ```
 * skill-name/
 * ├── SKILL.md (required)
 * │   ├── YAML frontmatter (name, description)
 * │   └── Markdown instructions
 * └── Bundled Resources (optional)
 *     ├── scripts/
 *     ├── references/
 *     └── assets/
 * ```
 */

import * as fs from "fs/promises";
import * as path from "path";

import prisma from "./prisma.js";

// ==================== Local Enums (will be replaced by Prisma after migration) ====================

export enum SkillCategory {
  PRODUCTIVITY = "PRODUCTIVITY",
  DEVELOPMENT = "DEVELOPMENT",
  WRITING = "WRITING",
  RESEARCH = "RESEARCH",
  AUTOMATION = "AUTOMATION",
  ANALYSIS = "ANALYSIS",
  COMMUNICATION = "COMMUNICATION",
  CREATIVITY = "CREATIVITY",
  HEALTH = "HEALTH",
  FINANCE = "FINANCE",
  LEARNING = "LEARNING",
  OTHER = "OTHER",
}

export enum SkillSourceType {
  BUILTIN = "BUILTIN",
  HUB = "HUB",
  MARKETPLACE = "MARKETPLACE",
  GITHUB = "GITHUB",
  LOCAL = "LOCAL",
}

export enum SkillPriority {
  WORKSPACE = "WORKSPACE",
  MANAGED = "MANAGED",
  BUILTIN = "BUILTIN",
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  NORMAL = "NORMAL",
  LOW = "LOW",
}

// ==================== Types ====================

export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  author?: string;
  homepage?: string;
  "user-invocable"?: boolean;
  "disable-model-invocation"?: boolean;
  "command-dispatch"?: "tool";
  "command-tool"?: string;
  metadata?: {
    moltbot?: {
      always?: boolean;
      emoji?: string;
      homepage?: string;
      os?: string[];
      requires?: {
        bins?: string[];
        anyBins?: string[];
        env?: string[];
        config?: string[];
      };
      primaryEnv?: string;
      install?: SkillInstaller[];
      skillKey?: string;
    };
  };
}

export interface SkillInstaller {
  id: string;
  kind: "brew" | "node" | "go" | "uv" | "download";
  formula?: string;
  package?: string;
  bins?: string[];
  label?: string;
  url?: string;
  os?: string[];
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  body: string; // Markdown instructions
  rawContent: string;
}

export interface SkillHubEntryData {
  slug: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  category?: SkillCategory;
  tags?: string[];
  icon?: string;
  sourceType?: SkillSourceType;
  sourceUrl?: string;
  downloadUrl?: string;
  metadata?: any;
  skillContent?: string;
  hasScripts?: boolean;
  hasReferences?: boolean;
  hasAssets?: boolean;
}

export interface InstalledSkillData {
  skillSlug: string;
  name: string;
  description: string;
  version?: string;
  enabled?: boolean;
  config?: Record<string, any>;
  env?: Record<string, any>;
  apiKey?: string;
  localPath?: string;
  skillMdContent?: string;
  frontmatter?: any;
  priority?: SkillPriority;
  hubEntryId?: string;
}

// Type for installed skill from database (used before Prisma types are generated)
export interface InstalledSkillRecord {
  id: string;
  userId: string;
  hubEntryId?: string | null;
  skillSlug: string;
  name: string;
  description: string;
  version: string;
  installedVersion: string;
  updateAvailable: boolean;
  enabled: boolean;
  config: any;
  env: any;
  apiKey?: string | null;
  localPath?: string | null;
  skillMdContent?: string | null;
  frontmatter: any;
  priority: SkillPriority;
  usageCount: number;
  lastUsedAt?: Date | null;
  installedAt: Date;
  updatedAt: Date;
  hubEntry?: any;
}

export interface SkillMetadataForPrompt {
  id: string;
  name: string;
  description: string;
  location: string;
  tools?: string[];
  emoji?: string;
}

// ==================== Built-in Skills Catalog ====================

/**
 * Built-in skills that ship with the system.
 * These provide core functionality and examples.
 */
export const BUILTIN_SKILLS: SkillHubEntryData[] = [
  {
    slug: "weather-monitor",
    name: "Weather Monitor",
    description:
      "Monitor weather conditions and set up alerts. Use when the user wants to check weather, set weather alerts, or get weather forecasts for any location.",
    version: "1.0.0",
    author: "Second Brain",
    category: SkillCategory.PRODUCTIVITY,
    tags: ["weather", "alerts", "forecast", "notifications"],
    icon: "🌤️",
    sourceType: SkillSourceType.BUILTIN,
    metadata: {
      moltbot: {
        emoji: "🌤️",
        requires: { env: ["OPENWEATHERMAP_API_KEY"] },
        primaryEnv: "OPENWEATHERMAP_API_KEY",
      },
    },
    skillContent: `---
name: Weather Monitor
description: Monitor weather conditions and set up alerts. Use when the user wants to check weather, set weather alerts, or get weather forecasts for any location.
---

# Weather Monitor

Use the \`scheduled_task\` and \`notification\` tools to provide weather monitoring capabilities.

## Capabilities

1. **Current Weather**: Get current conditions for any city
2. **Forecasts**: Get multi-day forecasts
3. **Alerts**: Set up weather alerts (rain, temperature thresholds, etc.)

## Workflow

1. For current weather: Use \`http_request\` to call OpenWeatherMap API
2. For forecasts: Query forecast endpoint
3. For alerts: Create a \`scheduled_task\` that checks conditions periodically

## API Usage

Base URL: \`https://api.openweathermap.org/data/2.5\`

- Current: \`/weather?q={city}&appid={API_KEY}&units=metric\`
- Forecast: \`/forecast?q={city}&appid={API_KEY}&units=metric\`

## Example Alert Setup

To set up a rain alert:
1. Create scheduled task running every 6 hours
2. Check precipitation probability
3. Send notification if > 70%
`,
    hasScripts: false,
    hasReferences: false,
    hasAssets: false,
  },
  {
    slug: "task-manager",
    name: "Task & Todo Manager",
    description:
      "Create, update, and manage tasks and todos with reminders. Use when the user wants to create tasks, set reminders, mark items complete, or organize their to-do list.",
    version: "1.0.0",
    author: "Second Brain",
    category: SkillCategory.PRODUCTIVITY,
    tags: ["tasks", "todos", "reminders", "productivity", "gtd"],
    icon: "✅",
    sourceType: SkillSourceType.BUILTIN,
    metadata: { moltbot: { emoji: "✅" } },
    skillContent: `---
name: Task & Todo Manager
description: Create, update, and manage tasks and todos with reminders. Use when the user wants to create tasks, set reminders, mark items complete, or organize their to-do list.
---

# Task & Todo Manager

Manage the user's tasks and to-do items using the \`todo\` and \`notification\` tools.

## Available Actions

### Creating Tasks
- Use \`todo.create\` with title, description, priority, and optional due date
- Priorities: high, medium, low
- Due dates can be relative ("tomorrow", "next week") or absolute

### Managing Tasks
- \`todo.list\` - Show all tasks, optionally filtered by status
- \`todo.update\` - Modify task details
- \`todo.complete\` - Mark task as done
- \`todo.delete\` - Remove a task

### Reminders
- For time-sensitive tasks, create a \`scheduled_task\` to send a reminder notification
- Combine with \`notification\` tool for alerts

## Best Practices

1. Always confirm task creation with the user
2. When listing tasks, organize by priority and due date
3. Suggest related tasks that might be needed
4. Offer to set reminders for important tasks
`,
    hasScripts: false,
    hasReferences: false,
    hasAssets: false,
  },
  {
    slug: "memory-search",
    name: "Memory Search & Retrieval",
    description:
      "Search and retrieve information from the user's memory. Use when the user asks about past conversations, stored information, or wants to recall something from their history.",
    version: "1.0.0",
    author: "Second Brain",
    category: SkillCategory.PRODUCTIVITY,
    tags: ["memory", "search", "recall", "history", "knowledge"],
    icon: "🧠",
    sourceType: SkillSourceType.BUILTIN,
    metadata: { moltbot: { emoji: "🧠", always: true } },
    skillContent: `---
name: Memory Search & Retrieval
description: Search and retrieve information from the user's memory. Use when the user asks about past conversations, stored information, or wants to recall something from their history.
---

# Memory Search & Retrieval

Use the \`memory\` tool to search and retrieve information from the user's stored memories.

## Search Strategies

### Semantic Search
Best for: "What do I know about X?", conceptual queries
- Use \`memory.search\` with natural language query
- Results ranked by semantic similarity

### Time-based Search
Best for: "What happened yesterday?", "Last week's meetings"
- Use date filters: \`startDate\`, \`endDate\`
- Combine with semantic search for best results

### Entity Search
Best for: Finding mentions of specific people, places, projects
- Search for entity names directly
- Use tags filter if available

## Workflow

1. Identify the user's information need
2. Choose appropriate search strategy
3. Execute search with relevant filters
4. Summarize findings clearly
5. Offer to refine search if needed

## Response Format

When presenting memories:
- Organize chronologically or by relevance
- Include source date/time
- Highlight key information
- Offer to dive deeper into specific items
`,
    hasScripts: false,
    hasReferences: false,
    hasAssets: false,
  },
  {
    slug: "code-executor",
    name: "Code Executor",
    description:
      "Execute Python code snippets safely. Use when the user needs calculations, data processing, file operations, or any task requiring code execution.",
    version: "1.0.0",
    author: "Second Brain",
    category: SkillCategory.DEVELOPMENT,
    tags: ["code", "python", "execution", "automation", "scripting"],
    icon: "🐍",
    sourceType: SkillSourceType.BUILTIN,
    metadata: { moltbot: { emoji: "🐍" } },
    skillContent: `---
name: Code Executor
description: Execute Python code snippets safely. Use when the user needs calculations, data processing, file operations, or any task requiring code execution.
---

# Code Executor

Execute Python code using the \`code_executor\` tool.

## Capabilities

- Mathematical calculations
- Data processing (pandas, numpy available)
- JSON/CSV manipulation
- Date/time operations
- String processing
- Simple file operations (within sandbox)

## Safety Constraints

- Network access is limited
- No system modification allowed
- Execution timeout: 30 seconds
- Memory limit enforced

## Best Practices

1. **Keep code simple**: Break complex tasks into smaller steps
2. **Handle errors**: Use try/except for robustness
3. **Show intermediate results**: Print progress for long operations
4. **Explain the code**: Help users understand what's happening

## Example Patterns

### Calculations
\`\`\`python
result = sum([1, 2, 3, 4, 5]) * 2
print(f"Result: {result}")
\`\`\`

### Data Processing
\`\`\`python
import json
data = json.loads(input_json)
filtered = [x for x in data if x['value'] > 100]
print(json.dumps(filtered, indent=2))
\`\`\`

### Date Operations
\`\`\`python
from datetime import datetime, timedelta
future = datetime.now() + timedelta(days=30)
print(f"30 days from now: {future.strftime('%Y-%m-%d')}")
\`\`\`
`,
    hasScripts: false,
    hasReferences: false,
    hasAssets: false,
  },
  {
    slug: "notification-sender",
    name: "Notification Sender",
    description:
      "Send notifications to the user across multiple channels (app, Telegram, Pushover). Use when something important needs to be communicated proactively.",
    version: "1.0.0",
    author: "Second Brain",
    category: SkillCategory.COMMUNICATION,
    tags: ["notifications", "alerts", "messaging", "telegram", "pushover"],
    icon: "🔔",
    sourceType: SkillSourceType.BUILTIN,
    metadata: { moltbot: { emoji: "🔔" } },
    skillContent: `---
name: Notification Sender
description: Send notifications to the user across multiple channels (app, Telegram, Pushover). Use when something important needs to be communicated proactively.
---

# Notification Sender

Use the \`notification\` tool to send messages to the user.

## Priority Levels

- **critical**: Urgent matters requiring immediate attention
- **high**: Important but not urgent
- **medium**: Regular notifications
- **low**: Informational, can wait

## Channels

Notifications are automatically routed based on user settings:
1. **In-app**: Always available
2. **Telegram**: If configured and enabled
3. **Pushover**: If configured and enabled

## Best Practices

1. **Be concise**: Keep messages short and actionable
2. **Use appropriate priority**: Don't cry wolf
3. **Include context**: Why is this notification being sent?
4. **Actionable when possible**: What should the user do?

## Usage

\`\`\`
notification.send({
  title: "Task Reminder",
  message: "You have a meeting in 15 minutes",
  priority: "high"
})
\`\`\`
`,
    hasScripts: false,
    hasReferences: false,
    hasAssets: false,
  },
  {
    slug: "scheduled-tasks",
    name: "Scheduled Tasks",
    description:
      "Create and manage scheduled/recurring tasks. Use when the user wants something to happen automatically at specific times or intervals.",
    version: "1.0.0",
    author: "Second Brain",
    category: SkillCategory.AUTOMATION,
    tags: ["scheduling", "automation", "cron", "recurring", "timers"],
    icon: "⏰",
    sourceType: SkillSourceType.BUILTIN,
    metadata: { moltbot: { emoji: "⏰" } },
    skillContent: `---
name: Scheduled Tasks
description: Create and manage scheduled/recurring tasks. Use when the user wants something to happen automatically at specific times or intervals.
---

# Scheduled Tasks

Use the \`scheduled_task\` tool to create automated recurring operations.

## Task Types

### One-time Tasks
- Execute once at a specific datetime
- Good for reminders, one-off checks

### Recurring Tasks
- Cron-style scheduling
- Daily, weekly, monthly patterns

## Common Patterns

### Daily at specific time
\`0 9 * * *\` - Every day at 9 AM

### Weekly
\`0 10 * * 1\` - Every Monday at 10 AM

### Every N hours
\`0 */6 * * *\` - Every 6 hours

## Workflow

1. Understand the user's scheduling need
2. Determine one-time vs recurring
3. Create task with appropriate schedule
4. Define the action (notification, API call, etc.)
5. Confirm creation with user

## Task Actions

Scheduled tasks can:
- Send notifications
- Make HTTP requests
- Execute code snippets
- Trigger other tools

## Management

- List active tasks
- Pause/resume tasks
- Delete tasks
- Modify schedule
`,
    hasScripts: false,
    hasReferences: false,
    hasAssets: false,
  },
  {
    slug: "http-requests",
    name: "HTTP Request Handler",
    description:
      "Make HTTP requests to external APIs and services. Use when the user needs to interact with web services, fetch data, or integrate with external systems.",
    version: "1.0.0",
    author: "Second Brain",
    category: SkillCategory.DEVELOPMENT,
    tags: ["http", "api", "rest", "integration", "web"],
    icon: "🌐",
    sourceType: SkillSourceType.BUILTIN,
    metadata: { moltbot: { emoji: "🌐" } },
    skillContent: `---
name: HTTP Request Handler
description: Make HTTP requests to external APIs and services. Use when the user needs to interact with web services, fetch data, or integrate with external systems.
---

# HTTP Request Handler

Use the \`http_request\` tool to interact with external APIs.

## Supported Methods

- GET - Retrieve data
- POST - Create resources
- PUT - Update resources
- PATCH - Partial updates
- DELETE - Remove resources

## Request Options

- **url**: Target endpoint (required)
- **method**: HTTP method (default: GET)
- **headers**: Custom headers
- **body**: Request body for POST/PUT/PATCH
- **timeout**: Request timeout in seconds

## Common Headers

\`\`\`json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {token}",
  "Accept": "application/json"
}
\`\`\`

## Security Notes

1. Never log or expose sensitive tokens
2. Use environment variables for API keys
3. Validate responses before processing
4. Handle errors gracefully

## Response Handling

Parse responses appropriately:
- JSON: Parse and extract needed data
- HTML: Extract text content
- Binary: Handle as appropriate

## Rate Limiting

Be mindful of API rate limits:
- Add delays between requests if needed
- Handle 429 responses gracefully
- Cache responses when appropriate
`,
    hasScripts: false,
    hasReferences: false,
    hasAssets: false,
  },
  {
    slug: "goal-tracker",
    name: "Goal Tracker",
    description:
      "Track and manage long-term goals and progress. Use when the user sets goals, wants to check progress, or needs motivation on their objectives.",
    version: "1.0.0",
    author: "Second Brain",
    category: SkillCategory.PRODUCTIVITY,
    tags: ["goals", "tracking", "progress", "achievements", "okr"],
    icon: "🎯",
    sourceType: SkillSourceType.BUILTIN,
    metadata: { moltbot: { emoji: "🎯" } },
    skillContent: `---
name: Goal Tracker
description: Track and manage long-term goals and progress. Use when the user sets goals, wants to check progress, or needs motivation on their objectives.
---

# Goal Tracker

Use the \`goals\` tool to help users achieve their objectives.

## Goal Structure

- **Title**: Clear, specific goal name
- **Description**: Detailed explanation
- **Target Date**: When to achieve by
- **Progress**: 0-100%
- **Milestones**: Intermediate checkpoints

## Workflow

### Creating Goals
1. Clarify the goal with the user
2. Make it SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
3. Break into milestones
4. Set initial progress

### Tracking Progress
1. Regular check-ins
2. Update progress percentage
3. Celebrate milestones
4. Adjust timeline if needed

### Motivation
1. Remind of progress made
2. Connect to user's values
3. Suggest next small step
4. Acknowledge setbacks constructively

## Best Practices

- Keep goals visible and top of mind
- Break big goals into weekly actions
- Review and adjust regularly
- Celebrate small wins
`,
    hasScripts: false,
    hasReferences: false,
    hasAssets: false,
  },
];

// ==================== Community Skills Catalog ====================

/**
 * Community/Hub skills available for installation.
 * In production, this would be fetched from a remote registry.
 */
export const HUB_SKILLS: SkillHubEntryData[] = [
  //   {
  //     slug: "github-integration",
  //     name: "GitHub Integration",
  //     description:
  //       "Interact with GitHub repositories, issues, and pull requests. Use when the user wants to check PRs, create issues, or manage their GitHub projects.",
  //     version: "1.0.0",
  //     author: "community",
  //     category: SkillCategory.DEVELOPMENT,
  //     tags: ["github", "git", "issues", "pull-requests", "code-review"],
  //     icon: "🐙",
  //     sourceType: SkillSourceType.HUB,
  //     downloadUrl: "https://skills.secondbrain.dev/github-integration.skill",
  //     metadata: {
  //       moltbot: {
  //         emoji: "🐙",
  //         requires: { env: ["GITHUB_TOKEN"] },
  //         primaryEnv: "GITHUB_TOKEN",
  //       },
  //     },
  //     skillContent: `---
  // name: GitHub Integration
  // description: Interact with GitHub repositories, issues, and pull requests. Use when the user wants to check PRs, create issues, or manage their GitHub projects.
  // ---
  // # GitHub Integration
  // Interact with GitHub using the \`http_request\` tool and GitHub API.
  // ## Authentication
  // Requires GITHUB_TOKEN environment variable with appropriate scopes.
  // ## Common Operations
  // ### List Open PRs
  // \`\`\`
  // GET https://api.github.com/repos/{owner}/{repo}/pulls
  // \`\`\`
  // ### Create Issue
  // \`\`\`
  // POST https://api.github.com/repos/{owner}/{repo}/issues
  // Body: { "title": "...", "body": "..." }
  // \`\`\`
  // ### Get Repository Info
  // \`\`\`
  // GET https://api.github.com/repos/{owner}/{repo}
  // \`\`\`
  // ## Best Practices
  // 1. Always include proper authorization header
  // 2. Handle pagination for large result sets
  // 3. Respect rate limits (5000 requests/hour authenticated)
  // `,
  //     hasScripts: false,
  //     hasReferences: true,
  //     hasAssets: false,
  //   },
  //   {
  //     slug: "finance-tracker",
  //     name: "Finance Tracker",
  //     description:
  //       "Track expenses, budgets, and financial goals. Use when the user wants to log expenses, check spending, or manage their budget.",
  //     version: "1.0.0",
  //     author: "community",
  //     category: SkillCategory.FINANCE,
  //     tags: ["finance", "budget", "expenses", "money", "tracking"],
  //     icon: "💰",
  //     sourceType: SkillSourceType.HUB,
  //     downloadUrl: "https://skills.secondbrain.dev/finance-tracker.skill",
  //     metadata: { moltbot: { emoji: "💰" } },
  //     skillContent: `---
  // name: Finance Tracker
  // description: Track expenses, budgets, and financial goals. Use when the user wants to log expenses, check spending, or manage their budget.
  // ---
  // # Finance Tracker
  // Help users manage their finances using memory and code execution tools.
  // ## Capabilities
  // 1. Log expenses with categories
  // 2. Set and track budgets
  // 3. Analyze spending patterns
  // 4. Financial goal tracking
  // ## Data Storage
  // Store financial data in user memories with tags:
  // - \`finance:expense\`
  // - \`finance:income\`
  // - \`finance:budget\`
  // - \`finance:goal\`
  // ## Workflow
  // ### Logging Expense
  // 1. Get amount, category, description
  // 2. Store in memory with appropriate tags
  // 3. Update running totals if tracked
  // ### Budget Analysis
  // 1. Retrieve expenses for period
  // 2. Group by category
  // 3. Compare to budget limits
  // 4. Generate summary
  // ## Categories
  // Common expense categories:
  // - Food & Dining
  // - Transportation
  // - Entertainment
  // - Utilities
  // - Shopping
  // - Healthcare
  // - Education
  // `,
  //     hasScripts: false,
  //     hasReferences: false,
  //     hasAssets: false,
  //   },
  //   {
  //     slug: "learning-assistant",
  //     name: "Learning Assistant",
  //     description:
  //       "Support learning and knowledge retention with spaced repetition and study plans. Use when the user wants to learn something new or review material.",
  //     version: "1.0.0",
  //     author: "community",
  //     category: SkillCategory.LEARNING,
  //     tags: ["learning", "education", "spaced-repetition", "study", "flashcards"],
  //     icon: "📚",
  //     sourceType: SkillSourceType.HUB,
  //     downloadUrl: "https://skills.secondbrain.dev/learning-assistant.skill",
  //     metadata: { moltbot: { emoji: "📚" } },
  //     skillContent: `---
  // name: Learning Assistant
  // description: Support learning and knowledge retention with spaced repetition and study plans. Use when the user wants to learn something new or review material.
  // ---
  // # Learning Assistant
  // Help users learn effectively using memory and scheduling tools.
  // ## Spaced Repetition
  // Schedule reviews at optimal intervals:
  // - First review: 1 day
  // - Second: 3 days
  // - Third: 1 week
  // - Fourth: 2 weeks
  // - Fifth: 1 month
  // ## Workflow
  // ### Creating Study Items
  // 1. Extract key concepts from material
  // 2. Create question-answer pairs
  // 3. Store in memory with learning tags
  // 4. Schedule first review
  // ### Review Session
  // 1. Retrieve due items
  // 2. Present question
  // 3. Show answer on request
  // 4. Rate recall (easy/medium/hard)
  // 5. Adjust next review date
  // ## Study Plans
  // Help users create structured learning plans:
  // 1. Define learning goal
  // 2. Break into topics
  // 3. Estimate time per topic
  // 4. Create schedule
  // 5. Track progress
  // `,
  //     hasScripts: false,
  //     hasReferences: false,
  //     hasAssets: false,
  //   },
  //   {
  //     slug: "health-tracker",
  //     name: "Health & Wellness Tracker",
  //     description:
  //       "Track health metrics, habits, and wellness goals. Use when the user logs workouts, tracks sleep, or monitors health habits.",
  //     version: "1.0.0",
  //     author: "community",
  //     category: SkillCategory.HEALTH,
  //     tags: ["health", "fitness", "habits", "sleep", "wellness"],
  //     icon: "🏃",
  //     sourceType: SkillSourceType.HUB,
  //     downloadUrl: "https://skills.secondbrain.dev/health-tracker.skill",
  //     metadata: { moltbot: { emoji: "🏃" } },
  //     skillContent: `---
  // name: Health & Wellness Tracker
  // description: Track health metrics, habits, and wellness goals. Use when the user logs workouts, tracks sleep, or monitors health habits.
  // ---
  // # Health & Wellness Tracker
  // Help users maintain healthy habits and track wellness metrics.
  // ## Trackable Metrics
  // - Exercise/Workouts
  // - Sleep duration and quality
  // - Water intake
  // - Mood/energy levels
  // - Weight
  // - Medication adherence
  // ## Data Storage
  // Store health data in memories with tags:
  // - \`health:exercise\`
  // - \`health:sleep\`
  // - \`health:mood\`
  // - \`health:habit\`
  // ## Workflows
  // ### Log Workout
  // 1. Get exercise type, duration, intensity
  // 2. Store with timestamp
  // 3. Update streak if applicable
  // 4. Provide encouragement
  // ### Sleep Tracking
  // 1. Log bed time and wake time
  // 2. Calculate duration
  // 3. Note quality (1-5)
  // 4. Track patterns over time
  // ### Habit Streaks
  // 1. Track daily completion
  // 2. Calculate current streak
  // 3. Send reminders
  // 4. Celebrate milestones
  // ## Privacy
  // Health data is sensitive - remind users this is stored locally.
  // `,
  //     hasScripts: false,
  //     hasReferences: false,
  //     hasAssets: false,
  //   },
  //   {
  //     slug: "meeting-assistant",
  //     name: "Meeting Assistant",
  //     description:
  //       "Help prepare for and summarize meetings. Use when the user has upcoming meetings, wants to prepare talking points, or needs meeting notes summarized.",
  //     version: "1.0.0",
  //     author: "community",
  //     category: SkillCategory.PRODUCTIVITY,
  //     tags: ["meetings", "notes", "agenda", "summary", "calendar"],
  //     icon: "📅",
  //     sourceType: SkillSourceType.HUB,
  //     downloadUrl: "https://skills.secondbrain.dev/meeting-assistant.skill",
  //     metadata: { moltbot: { emoji: "📅" } },
  //     skillContent: `---
  // name: Meeting Assistant
  // description: Help prepare for and summarize meetings. Use when the user has upcoming meetings, wants to prepare talking points, or needs meeting notes summarized.
  // ---
  // # Meeting Assistant
  // Help users prepare for and get the most out of meetings.
  // ## Pre-Meeting
  // ### Preparation
  // 1. Review context from memories about attendees
  // 2. Review previous meeting notes with same people
  // 3. Suggest talking points
  // 4. Create agenda template
  // ### Reminder
  // - Send notification before meeting
  // - Include key talking points
  // - Surface relevant context
  // ## During Meeting
  // ### Note Taking
  // - Capture key points
  // - Track action items
  // - Note decisions made
  // - Record follow-ups needed
  // ## Post-Meeting
  // ### Summary
  // 1. Consolidate notes
  // 2. Extract action items
  // 3. List decisions
  // 4. Identify follow-ups
  // 5. Store in memory
  // ### Follow-up
  // - Create tasks for action items
  // - Schedule follow-up reminders
  // - Update relevant goals/projects
  // `,
  //     hasScripts: false,
  //     hasReferences: false,
  //     hasAssets: false,
  //   },
];

// ==================== Skill Manager Service ====================

class SkillManagerService {
  private skillsDir: string;

  constructor() {
    // Default skills directory
    this.skillsDir =
      process.env.SKILLS_DIR || path.join(process.cwd(), "backend", "skills");
  }

  // ==================== SKILL.md Parsing ====================

  /**
   * Parse SKILL.md content into frontmatter and body
   */
  parseSkillMd(content: string): ParsedSkill {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      throw new Error("Invalid SKILL.md format: missing frontmatter");
    }

    const [, frontmatterYaml, body] = match;
    const frontmatter = this.parseYamlFrontmatter(frontmatterYaml);

    return {
      frontmatter,
      body: body.trim(),
      rawContent: content,
    };
  }

  /**
   * Parse YAML frontmatter (simple key-value parsing)
   */
  private parseYamlFrontmatter(yaml: string): SkillFrontmatter {
    const lines = yaml.split("\n");
    const result: any = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Handle quoted strings
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Handle JSON metadata
      if (key === "metadata" && value.startsWith("{")) {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      } else if (value === "true") {
        result[key] = true;
      } else if (value === "false") {
        result[key] = false;
      } else {
        result[key] = value;
      }
    }

    return result as SkillFrontmatter;
  }

  // ==================== Skill Hub (Registry) ====================

  /**
   * Get all available skills from the hub
   */
  async getHubCatalog(
    category?: SkillCategory,
    search?: string,
  ): Promise<any[]> {
    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    return (prisma as any).skillHubEntry.findMany({
      where,
      orderBy: [{ installs: "desc" }, { rating: "desc" }],
    });
  }

  /**
   * Get a specific skill from the hub
   */
  async getHubSkill(slug: string) {
    return (prisma as any).skillHubEntry.findUnique({
      where: { slug },
    });
  }

  /**
   * Seed the hub with builtin and community skills
   */
  async seedHub() {
    const allSkills = [...BUILTIN_SKILLS, ...HUB_SKILLS];

    for (const skill of allSkills) {
      await (prisma as any).skillHubEntry.upsert({
        where: { slug: skill.slug },
        create: {
          slug: skill.slug,
          name: skill.name,
          description: skill.description,
          version: skill.version || "1.0.0",
          author: skill.author || "community",
          category: (skill.category as SkillCategory) || "GENERAL",
          tags: skill.tags || [],
          icon: skill.icon,
          sourceType: (skill.sourceType as SkillSourceType) || "BUILTIN",
          sourceUrl: skill.sourceUrl,
          downloadUrl: skill.downloadUrl,
          metadata: skill.metadata || {},
          skillContent: skill.skillContent,
          hasScripts: skill.hasScripts || false,
          hasReferences: skill.hasReferences || false,
          hasAssets: skill.hasAssets || false,
        },
        update: {
          name: skill.name,
          description: skill.description,
          version: skill.version || "1.0.0",
          author: skill.author || "community",
          category: (skill.category as SkillCategory) || "GENERAL",
          tags: skill.tags || [],
          icon: skill.icon,
          metadata: skill.metadata || {},
          skillContent: skill.skillContent,
          hasScripts: skill.hasScripts || false,
          hasReferences: skill.hasReferences || false,
          hasAssets: skill.hasAssets || false,
        },
      });
    }

    console.log(`[SkillManager] Seeded ${allSkills.length} skills to hub`);
  }

  // ==================== Installed Skills ====================

  /**
   * Get all installed skills for a user
   */
  async getInstalledSkills(
    userId: string,
    enabledOnly = false,
  ): Promise<InstalledSkillRecord[]> {
    const where: any = { userId };
    if (enabledOnly) {
      where.enabled = true;
    }

    return (prisma as any).installedSkill.findMany({
      where,
      include: { hubEntry: true },
      orderBy: [
        { priority: "asc" }, // WORKSPACE > MANAGED > BUILTIN
        { name: "asc" },
      ],
    }) as Promise<InstalledSkillRecord[]>;
  }

  /**
   * Get a specific installed skill
   */
  async getInstalledSkill(
    userId: string,
    skillSlug: string,
  ): Promise<InstalledSkillRecord | null> {
    return (prisma as any).installedSkill.findUnique({
      where: { userId_skillSlug: { userId, skillSlug } },
      include: { hubEntry: true },
    }) as Promise<InstalledSkillRecord | null>;
  }

  /**
   * Install a skill from the hub
   */
  async installSkill(
    userId: string,
    slug: string,
    config?: Record<string, any>,
  ) {
    // Get skill from hub
    const hubEntry = await (prisma as any).skillHubEntry.findUnique({
      where: { slug },
    });

    if (!hubEntry) {
      throw new Error(`Skill not found: ${slug}`);
    }

    // Parse frontmatter from skill content
    let frontmatter: any = {};
    if (hubEntry.skillContent) {
      try {
        const parsed = this.parseSkillMd(hubEntry.skillContent);
        frontmatter = parsed.frontmatter;
      } catch (e) {
        console.warn(`[SkillManager] Could not parse skill ${slug}:`, e);
      }
    }

    // Create installed skill
    const installed = await (prisma as any).installedSkill.create({
      data: {
        userId,
        hubEntryId: hubEntry.id,
        skillSlug: slug,
        name: hubEntry.name,
        description: hubEntry.description,
        version: hubEntry.version,
        installedVersion: hubEntry.version,
        enabled: true,
        config: config || {},
        skillMdContent: hubEntry.skillContent,
        frontmatter,
        priority:
          hubEntry.sourceType === "BUILTIN"
            ? SkillPriority.BUILTIN
            : SkillPriority.MANAGED,
      },
    });

    // Increment install count
    await (prisma as any).skillHubEntry.update({
      where: { slug },
      data: { installs: { increment: 1 } },
    });

    return installed;
  }

  /**
   * Install all builtin skills for a new user
   */
  async installBuiltinSkills(userId: string) {
    const builtinSlugs = BUILTIN_SKILLS.map((s) => s.slug);

    for (const slug of builtinSlugs) {
      try {
        const existing = await this.getInstalledSkill(userId, slug);
        if (!existing) {
          await this.installSkill(userId, slug);
        }
      } catch (e) {
        console.warn(`[SkillManager] Could not install builtin ${slug}:`, e);
      }
    }
  }

  /**
   * Uninstall a skill
   */
  async uninstallSkill(userId: string, skillSlug: string) {
    const skill = await (prisma as any).installedSkill.findUnique({
      where: { userId_skillSlug: { userId, skillSlug } },
      include: { hubEntry: true },
    });

    if (!skill) {
      throw new Error(`Skill not installed: ${skillSlug}`);
    }

    // Delete installed skill
    await (prisma as any).installedSkill.delete({
      where: { userId_skillSlug: { userId, skillSlug } },
    });

    // Decrement install count
    if (skill.hubEntryId) {
      await (prisma as any).skillHubEntry.update({
        where: { id: skill.hubEntryId },
        data: { installs: { decrement: 1 } },
      });
    }

    return { success: true };
  }

  /**
   * Update skill configuration
   */
  async updateSkillConfig(
    userId: string,
    skillSlug: string,
    data: {
      enabled?: boolean;
      config?: Record<string, any>;
      env?: Record<string, any>;
      apiKey?: string;
    },
  ) {
    return (prisma as any).installedSkill.update({
      where: { userId_skillSlug: { userId, skillSlug } },
      data: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.config && { config: data.config }),
        ...(data.env && { env: data.env }),
        ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Toggle skill enabled status
   */
  async toggleSkill(userId: string, skillSlug: string, enabled: boolean) {
    return this.updateSkillConfig(userId, skillSlug, { enabled });
  }

  // ==================== Skill Content Access ====================

  /**
   * Get skill content for the LLM
   * This is called by the read_skill tool
   */
  async getSkillContent(
    userId: string,
    skillSlug: string,
  ): Promise<string | null> {
    const skill = await this.getInstalledSkill(userId, skillSlug);

    if (!skill) {
      // Try hub if not installed
      const hubSkill = await this.getHubSkill(skillSlug);
      return hubSkill?.skillContent || null;
    }

    // Update usage stats
    await (prisma as any).installedSkill.update({
      where: { userId_skillSlug: { userId, skillSlug } },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return skill.skillMdContent || null;
  }

  /**
   * Get skill body (instructions) without frontmatter
   */
  async getSkillBody(
    userId: string,
    skillSlug: string,
  ): Promise<string | null> {
    const content = await this.getSkillContent(userId, skillSlug);
    if (!content) return null;

    try {
      const parsed = this.parseSkillMd(content);
      return parsed.body;
    } catch {
      return content;
    }
  }

  // ==================== Skills for System Prompt ====================

  /**
   * Build the skills metadata section for the system prompt
   * Only includes metadata (name, description) - not full instructions
   */
  async buildSkillsPromptSection(userId: string): Promise<string> {
    const skills = await this.getInstalledSkills(userId, true);

    if (skills.length === 0) {
      return "";
    }

    const skillsXml = skills
      .map((s) => {
        const emoji = (s.frontmatter as any)?.metadata?.moltbot?.emoji || "";
        return `<skill id="${s.skillSlug}"><name>${emoji} ${s.name}</name><description>${s.description}</description><location>skill:${s.skillSlug}</location></skill>`;
      })
      .join("\n");

    return `
## SKILLS (MANDATORY)
Before replying: scan <available_skills> descriptions.
- If exactly one skill clearly applies: read its instructions at <location> with \`read_skill\` tool, then follow it.
- If multiple could apply: choose the most specific one, then read/follow it.
- If none clearly apply: do not read any skill.

Constraints: never read more than one skill up front; only read after selecting.

<available_skills>
${skillsXml}
</available_skills>
`;
  }

  /**
   * Get skill metadata for the prompt (lightweight)
   */
  async getSkillMetadataForPrompt(
    userId: string,
  ): Promise<SkillMetadataForPrompt[]> {
    const skills = await this.getInstalledSkills(userId, true);

    return skills.map((s) => ({
      id: s.skillSlug,
      name: s.name,
      description: s.description,
      location: `skill:${s.skillSlug}`,
      emoji: (s.frontmatter as any)?.metadata?.moltbot?.emoji,
    }));
  }

  // ==================== Skill Requirements Check ====================

  /**
   * Check if a skill's requirements are met
   */
  checkSkillRequirements(
    skill: any,
    userEnv: Record<string, string | undefined>,
  ): { met: boolean; missing: string[] } {
    const metadata =
      skill.frontmatter?.metadata?.moltbot || skill.metadata?.moltbot;
    if (!metadata?.requires) {
      return { met: true, missing: [] };
    }

    const missing: string[] = [];
    const requires = metadata.requires;

    // Check required environment variables
    if (requires.env) {
      for (const envVar of requires.env) {
        if (!userEnv[envVar]) {
          missing.push(`env:${envVar}`);
        }
      }
    }

    // Note: bins and config checks would require additional system access
    // For now, we only check env variables

    return {
      met: missing.length === 0,
      missing,
    };
  }

  // ==================== Custom Skills (User-created) ====================

  /**
   * Create a custom skill for a user
   * Allows the agent to create new skills with markdown instructions
   */
  async createCustomSkill(
    userId: string,
    data: {
      slug: string;
      name: string;
      description: string;
      instructions: string;
      category?: SkillCategory;
      tags?: string[];
      icon?: string;
    },
  ): Promise<InstalledSkillRecord> {
    // Validate slug (lowercase, alphanumeric, dashes only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(data.slug)) {
      throw new Error(
        "Invalid slug format. Use lowercase letters, numbers, and dashes only.",
      );
    }

    // Check if skill with this slug already exists
    const existing = await this.getInstalledSkill(userId, data.slug);
    if (existing) {
      throw new Error(
        `Skill with slug '${data.slug}' already exists. Use update instead.`,
      );
    }

    // Build skill content in SKILL.md format
    const skillContent = `---
name: ${data.name}
description: ${data.description}
---

${data.instructions}`;

    // Create the custom skill
    const skill = await (prisma as any).installedSkill.create({
      data: {
        userId,
        skillSlug: data.slug,
        name: data.name,
        description: data.description,
        version: "1.0.0",
        installedVersion: "1.0.0",
        enabled: true,
        config: {},
        skillMdContent: skillContent,
        frontmatter: {
          name: data.name,
          description: data.description,
          metadata: {
            moltbot: {
              emoji: data.icon || "📝",
            },
          },
        },
        priority: SkillPriority.WORKSPACE, // Custom skills have highest priority
      },
    });

    console.log(
      `[SkillManager] Created custom skill '${data.slug}' for user ${userId}`,
    );
    return skill as InstalledSkillRecord;
  }

  /**
   * Update a custom skill
   * Only updates skills that are not from the hub (custom skills)
   */
  async updateCustomSkill(
    userId: string,
    skillSlug: string,
    data: {
      name?: string;
      description?: string;
      instructions?: string;
      category?: SkillCategory;
      tags?: string[];
      icon?: string;
      enabled?: boolean;
    },
  ): Promise<InstalledSkillRecord> {
    const skill = await this.getInstalledSkill(userId, skillSlug);

    if (!skill) {
      throw new Error(`Skill '${skillSlug}' not found.`);
    }

    // Check if it's a custom skill (no hubEntryId)
    if (skill.hubEntryId) {
      throw new Error(
        `Cannot modify '${skillSlug}' - it was installed from the hub. Use uninstall/reinstall instead.`,
      );
    }

    // Build updated values
    const updates: any = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      updates.name = data.name;
    }
    if (data.description !== undefined) {
      updates.description = data.description;
    }
    if (data.enabled !== undefined) {
      updates.enabled = data.enabled;
    }

    // Rebuild skill content if instructions changed
    if (
      data.instructions !== undefined ||
      data.name !== undefined ||
      data.description !== undefined
    ) {
      const name = data.name || skill.name;
      const description = data.description || skill.description;

      // If instructions provided, use them; otherwise try to extract from existing content
      let instructions = data.instructions;
      if (instructions === undefined && skill.skillMdContent) {
        try {
          const parsed = this.parseSkillMd(skill.skillMdContent);
          instructions = parsed.body;
        } catch {
          instructions = skill.skillMdContent;
        }
      }

      updates.skillMdContent = `---
name: ${name}
description: ${description}
---

${instructions || ""}`;
    }

    // Update frontmatter
    const currentFrontmatter = (skill.frontmatter as any) || {};
    const updatedFrontmatter = {
      ...currentFrontmatter,
      name: data.name || currentFrontmatter.name,
      description: data.description || currentFrontmatter.description,
    };

    if (data.icon) {
      updatedFrontmatter.metadata = updatedFrontmatter.metadata || {};
      updatedFrontmatter.metadata.moltbot =
        updatedFrontmatter.metadata.moltbot || {};
      updatedFrontmatter.metadata.moltbot.emoji = data.icon;
    }

    updates.frontmatter = updatedFrontmatter;

    const updated = await (prisma as any).installedSkill.update({
      where: { userId_skillSlug: { userId, skillSlug } },
      data: updates,
    });

    console.log(
      `[SkillManager] Updated custom skill '${skillSlug}' for user ${userId}`,
    );
    return updated as InstalledSkillRecord;
  }

  /**
   * Delete a custom skill
   * Custom skills are directly deleted, hub skills use uninstallSkill
   */
  async deleteCustomSkill(userId: string, skillSlug: string): Promise<void> {
    const skill = await this.getInstalledSkill(userId, skillSlug);

    if (!skill) {
      throw new Error(`Skill '${skillSlug}' not found.`);
    }

    // Check if it's a custom skill (no hubEntryId)
    if (skill.hubEntryId) {
      throw new Error(
        `Cannot delete '${skillSlug}' - it was installed from the hub. Use uninstall instead.`,
      );
    }

    await (prisma as any).installedSkill.delete({
      where: { userId_skillSlug: { userId, skillSlug } },
    });

    console.log(
      `[SkillManager] Deleted custom skill '${skillSlug}' for user ${userId}`,
    );
  }

  /**
   * Check if a skill is custom (not from hub)
   */
  async isCustomSkill(userId: string, skillSlug: string): Promise<boolean> {
    const skill = await this.getInstalledSkill(userId, skillSlug);
    return skill !== null && skill.hubEntryId === null;
  }

  /**
   * List all custom skills for a user
   */
  async listCustomSkills(userId: string): Promise<InstalledSkillRecord[]> {
    return (prisma as any).installedSkill.findMany({
      where: {
        userId,
        hubEntryId: null, // No hub entry = custom skill
      },
      orderBy: { name: "asc" },
    }) as Promise<InstalledSkillRecord[]>;
  }
}

// ==================== Export Singleton ====================

export const skillManager = new SkillManagerService();
export default skillManager;
