# Plan d'Amélioration - Patterns Moltbot

> **Date**: 29 janvier 2026
> **Objectif**: Améliorer la fiabilité et l'efficacité du système de chat en adoptant les patterns de moltbot

---

## 📊 Analyse Comparative: État Actuel vs Moltbot

### Ce que nous avons actuellement

| Aspect                       | Notre Système                                 | Moltbot                                                                  |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| **System Prompt**            | Statique (~150 lignes) dans `chat-context.ts` | Dynamique, assemblé par run avec métadonnées runtime                     |
| **Chargement Skills/Outils** | Tous les outils chargés dans le prompt        | Skills on-demand (métadonnées dans prompt, instructions via tool `read`) |
| **Sub-agents**               | Aucun                                         | Architecture de sub-agents avec contextes isolés                         |
| **Context Management**       | Basique via token estimation                  | Compaction sophistiquée + pruning adaptatif                              |
| **Gestion Erreurs Tools**    | Circuit breaker simple                        | Distinction recoverable vs fatal avec retry automatique                  |
| **Prompt Modes**             | Un seul mode                                  | 3 modes: full, minimal, none                                             |
| **Tool Call Style**          | Non spécifié                                  | Instructions explicites: narrate vs silent                               |
| **Workspace Files**          | Aucun                                         | AGENTS.md, SOUL.md, USER.md, MEMORY.md, etc.                             |

---

## 🎯 Plan d'Amélioration par Priorité

### Phase 1: Quick Wins (1-2 jours) 🔥

Ces améliorations ont un fort impact avec peu de changements de code.

#### 1.1 Instructions de Style Tool Call

**Fichier**: `backend/services/chat-context.ts`

Ajouter des instructions explicites sur quand narrer vs exécuter silencieusement:

```typescript
// Ajouter dans CHAT_SYSTEM_PROMPT
`
## TOOL CALL STYLE
Default: do not narrate routine, low-risk tool calls (just call the tool).
Narrate only when it helps:
- Multi-step work requiring coordination
- Complex or challenging problems
- Sensitive actions (deletions, modifications)
- When the user explicitly asks for explanation

Keep narration brief and value-dense; avoid repeating obvious steps.
Never say "Let me do X" or "I will now Y" - just do it.
`;
```

#### 1.2 Distinction Erreurs Recoverable vs Fatal

**Fichier**: `backend/services/chat-tools.ts` et `tool-executor.ts`

```typescript
// Nouveau fichier: backend/services/tool-error-classifier.ts

export interface ToolErrorClassification {
  isRecoverable: boolean;
  shouldRetry: boolean;
  surfaceToUser: boolean;
  retryStrategy?: "immediate" | "with_delay" | "with_modification";
  suggestedFix?: string;
}

export function classifyToolError(
  error: string,
  toolId: string,
): ToolErrorClassification {
  const errorLower = error.toLowerCase();

  // Erreurs recoverable - le modèle peut retenter
  const recoverablePatterns = [
    "required",
    "missing",
    "invalid",
    "must be",
    "expected",
    "parameter",
    "validation",
  ];

  const isRecoverable = recoverablePatterns.some((p) => errorLower.includes(p));

  // Erreurs qui nécessitent une intervention utilisateur
  const userInterventionPatterns = [
    "api key",
    "authentication",
    "permission denied",
    "quota exceeded",
    "rate limit",
  ];

  const needsUserIntervention = userInterventionPatterns.some((p) =>
    errorLower.includes(p),
  );

  return {
    isRecoverable: isRecoverable && !needsUserIntervention,
    shouldRetry: isRecoverable && !needsUserIntervention,
    surfaceToUser: needsUserIntervention || !isRecoverable,
    retryStrategy: isRecoverable ? "immediate" : undefined,
  };
}
```

#### 1.3 Ajout Métadonnées Runtime au Prompt

**Fichier**: `backend/services/chat-context.ts`

```typescript
export function buildRuntimeMetadata(): string {
  return `
## RUNTIME CONTEXT
- Date: ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
- Time: ${new Date().toLocaleTimeString("fr-FR")}
- Platform: Second Brain v${process.env.npm_package_version || "1.0.0"}
- Capabilities: Memory search, Task management, Notifications, HTTP requests, Code execution
`;
}
```

---

### Phase 2: Skills On-Demand (3-5 jours) 🔧

**Impact majeur**: Réduction significative des tokens utilisés par le system prompt.

#### 2.1 Architecture Skills

```
backend/
├── skills/
│   ├── index.ts              # Registry des skills
│   ├── skill-loader.ts       # Chargement on-demand
│   └── definitions/
│       ├── WEATHER_SKILL.md
│       ├── TASK_SKILL.md
│       ├── NOTIFICATION_SKILL.md
│       ├── SCHEDULED_TASK_SKILL.md
│       └── SEARCH_SKILL.md
```

#### 2.2 Nouveau System Prompt avec Skills Metadata

```typescript
// backend/services/skill-system.ts

interface SkillMetadata {
  id: string;
  name: string;
  description: string; // Court, 1 ligne
  location: string; // Chemin vers SKILL.md
  tools: string[]; // Outils associés
}

const SKILLS_METADATA: SkillMetadata[] = [
  {
    id: "weather",
    name: "Weather Monitoring",
    description: "Monitor weather conditions and set up alerts",
    location: "skills/WEATHER_SKILL.md",
    tools: ["scheduled_task", "curl", "notification"],
  },
  {
    id: "task_management",
    name: "Task & Todo Management",
    description: "Create, update, and manage tasks and todos",
    location: "skills/TASK_SKILL.md",
    tools: ["todo", "notification"],
  },
  // ...
];

export function buildSkillsSection(
  readToolName: string = "read_skill",
): string {
  const skillsXml = SKILLS_METADATA.map(
    (s) =>
      `<skill id="${s.id}"><name>${s.name}</name><description>${s.description}</description><location>${s.location}</location></skill>`,
  ).join("\n");

  return `
## SKILLS (MANDATORY)
Before replying: scan <available_skills> descriptions.
- If exactly one skill clearly applies: read its SKILL.md at <location> with \`${readToolName}\`, then follow it.
- If multiple could apply: choose the most specific one, then read/follow it.
- If none clearly apply: do not read any SKILL.md.

Constraints: never read more than one skill up front; only read after selecting.

<available_skills>
${skillsXml}
</available_skills>
`;
}
```

#### 2.3 Tool `read_skill`

```typescript
// Ajouter dans tool-executor.ts

{
  id: "read_skill",
  name: "Read Skill Instructions",
  emoji: "📖",
  category: "builtin",
  enabled: true,
  rateLimit: 100,
  timeout: 1000,
  config: {
    description: "Read skill instructions for complex workflows",
    actions: ["read"]
  }
}

// Implémentation
private async executeReadSkillAction(params: { location: string }): Promise<any> {
  const skillPath = path.join(__dirname, '..', params.location);
  try {
    const content = await fs.readFile(skillPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: `Skill not found: ${params.location}` };
  }
}
```

---

### Phase 3: Sub-Agent Architecture (1-2 semaines) 🚀

**Impact majeur**: Permet de gérer des tâches complexes sans surcharger le contexte principal.

#### 3.1 Interface SubAgent

```typescript
// backend/services/subagent/types.ts

export interface SubAgentConfig {
  id: string;
  parentFlowId: string;
  task: string;
  taskDescription: string;
  tools: string[]; // Subset of tools for this task
  maxIterations: number; // Usually lower than main agent
  promptMode: "minimal" | "none";
  canSpawnSubagents: false; // Prevent recursive fan-out
}

export interface SubAgentResult {
  success: boolean;
  result: string;
  toolsUsed: string[];
  iterations: number;
  error?: string;
}
```

#### 3.2 SubAgent Runner

```typescript
// backend/services/subagent/runner.ts

export class SubAgentRunner {
  async spawn(
    userId: string,
    config: SubAgentConfig,
    parentContext: { systemPrompt: string; recentMessages: any[] },
  ): Promise<SubAgentResult> {
    // Build minimal system prompt for subagent
    const subagentPrompt = this.buildSubagentPrompt(config, parentContext);

    // Create isolated message history
    const messages = [
      { role: "system", content: subagentPrompt },
      { role: "user", content: config.task },
    ];

    // Run with limited tools and iterations
    const result = await this.runSubagentLoop(
      userId,
      messages,
      config.tools,
      config.maxIterations,
    );

    return {
      success: result.success,
      result: result.finalResponse,
      toolsUsed: result.toolsUsed,
      iterations: result.iterations,
    };
  }

  private buildSubagentPrompt(config: SubAgentConfig, parent: any): string {
    return `# Subagent Context

You are a **subagent** spawned by the main agent for a specific task.

## Your Role
- You were created to handle: ${config.taskDescription}
- Complete this task. That's your entire purpose.
- You are NOT the main agent. Don't try to be.

## Rules
1. **Stay focused** - Do your assigned task, nothing else
2. **Complete the task** - Your final message will be automatically reported to the main agent
3. **No spawning** - You cannot create other subagents
4. **Limited tools** - You only have access to: ${config.tools.join(", ")}

## Task
${config.task}

Complete this task and provide a clear result summary.`;
  }
}
```

#### 3.3 Intégration avec le Main Agent

```typescript
// Ajouter dans tool-executor.ts

{
  id: "spawn_subagent",
  name: "Spawn Subagent",
  emoji: "🤖",
  category: "builtin",
  enabled: true,
  rateLimit: 5,
  timeout: 120000, // 2 minutes max
  config: {
    description: "Spawn a focused subagent for complex subtasks. Use when a task requires isolated context or specialized focus.",
    actions: ["spawn"]
  }
}
```

---

### Phase 4: Context Compaction (1 semaine) 📦

**Impact**: Conversations longues restent performantes.

#### 4.1 Message Compaction Service

```typescript
// backend/services/context-compaction.ts

interface CompactionConfig {
  maxContextTokens: number;
  compactionThreshold: number; // % of max before compaction triggers
  minMessagesToKeep: number; // Always keep last N messages verbatim
  summaryMaxTokens: number;
}

export class ContextCompactionService {
  async compactHistory(
    messages: ChatMessage[],
    config: CompactionConfig,
  ): Promise<{ messages: ChatMessage[]; compacted: boolean }> {
    const currentTokens = this.estimateTokens(messages);

    if (currentTokens < config.maxContextTokens * config.compactionThreshold) {
      return { messages, compacted: false };
    }

    // Keep recent messages verbatim
    const recentMessages = messages.slice(-config.minMessagesToKeep);
    const oldMessages = messages.slice(0, -config.minMessagesToKeep);

    // Summarize old messages
    const summary = await this.summarizeMessages(
      oldMessages,
      config.summaryMaxTokens,
    );

    // Create summary message
    const summaryMessage: ChatMessage = {
      role: "system",
      content: `[Previous conversation summary: ${summary}]`,
    };

    return {
      messages: [summaryMessage, ...recentMessages],
      compacted: true,
    };
  }

  private async summarizeMessages(
    messages: ChatMessage[],
    maxTokens: number,
  ): Promise<string> {
    const prompt = `Summarize this conversation history concisely, preserving:
- Key decisions made
- Important information shared
- Current task context
- Any unresolved questions

Messages:
${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}`;

    return await llmRouterService.executeTask(
      "system",
      "summarization",
      prompt,
      undefined,
      { maxTokens },
    );
  }
}
```

#### 4.2 Tool Result Pruning

```typescript
// backend/services/tool-result-pruner.ts

export function pruneToolResults(
  messages: ChatMessage[],
  maxToolResultLength: number = 500,
): ChatMessage[] {
  return messages.map((msg) => {
    if (msg.role === "tool" && msg.content) {
      try {
        const parsed = JSON.parse(msg.content);
        if (
          parsed.data &&
          JSON.stringify(parsed.data).length > maxToolResultLength
        ) {
          // Truncate large tool results
          parsed.data = truncateData(parsed.data, maxToolResultLength);
          return { ...msg, content: JSON.stringify(parsed) };
        }
      } catch {
        // Not JSON, truncate directly if needed
        if (msg.content.length > maxToolResultLength) {
          return {
            ...msg,
            content:
              msg.content.slice(0, maxToolResultLength) + "...[truncated]",
          };
        }
      }
    }
    return msg;
  });
}
```

---

### Phase 5: Workspace Bootstrap Files (3 jours) 📁

**Impact**: Contexte persistant entre sessions.

#### 5.1 Structure des Fichiers Bootstrap

```
workspace/
├── AGENTS.md      # Instructions globales pour l'agent
├── USER.md        # Profil utilisateur détaillé (généré depuis user_profile)
├── MEMORY.md      # Mémoires curatées importantes
└── HEARTBEAT.md   # Tâches proactives en cours
```

#### 5.2 Service d'Injection Bootstrap

```typescript
// backend/services/workspace-bootstrap.ts

export class WorkspaceBootstrapService {
  private cache = new Map<string, { content: string; loadedAt: Date }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getBootstrapContext(userId: string): Promise<string> {
    const sections: string[] = [];

    // USER.md - from user profile
    const userProfile = await this.buildUserSection(userId);
    if (userProfile) sections.push(userProfile);

    // MEMORY.md - curated important memories
    const memories = await this.buildMemoriesSection(userId);
    if (memories) sections.push(memories);

    // HEARTBEAT.md - active background tasks
    const heartbeat = await this.buildHeartbeatSection(userId);
    if (heartbeat) sections.push(heartbeat);

    return sections.join("\n\n---\n\n");
  }

  private async buildUserSection(userId: string): Promise<string | null> {
    const profile = await userProfileService.getProfile(userId);
    if (!profile) return null;

    return `## USER CONTEXT
${formatProfileForPrompt(profile)}`;
  }

  private async buildMemoriesSection(userId: string): Promise<string | null> {
    const pinnedMemories = await prisma.memory.findMany({
      where: { userId, isPinned: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (pinnedMemories.length === 0) return null;

    return `## IMPORTANT MEMORIES (PINNED)
${pinnedMemories.map((m) => `- [${m.createdAt.toLocaleDateString()}] ${m.content}`).join("\n")}`;
  }

  private async buildHeartbeatSection(userId: string): Promise<string | null> {
    const activeTasks = await scheduledTaskService.list(userId, {
      enabled: true,
    });
    if (activeTasks.length === 0) return null;

    return `## ACTIVE BACKGROUND TASKS
${activeTasks.map((t) => `- ${t.name}: ${t.description || "No description"}`).join("\n")}`;
  }
}
```

---

## 📋 Checklist d'Implémentation

### Phase 1: Quick Wins ✅ COMPLÉTÉE

- [x] Ajouter instructions Tool Call Style dans `chat-context.ts`
- [x] Créer `tool-error-classifier.ts`
- [x] Intégrer classification d'erreurs dans `chat-tools.ts`
- [x] Ajouter métadonnées runtime dans system prompt
- [x] Exporter `buildCompleteSystemPrompt()` pour utilisation
- [x] Mettre à jour `chat.controller.ts` et `chat-response.ts`
- [ ] Tests unitaires pour error classifier (optionnel)

### Phase 2: Skills On-Demand 🔧

- [ ] Créer dossier `backend/skills/` avec fichiers SKILL.md
- [ ] Implémenter `skill-system.ts`
- [ ] Ajouter tool `read_skill`
- [ ] Refactorer system prompt pour utiliser skills metadata
- [ ] Migrer instructions détaillées vers SKILL.md files
- [ ] Tests d'intégration

### Phase 3: Sub-Agent Architecture 🚀

- [ ] Créer `backend/services/subagent/types.ts`
- [ ] Implémenter `SubAgentRunner`
- [ ] Ajouter tool `spawn_subagent`
- [ ] Intégrer dans `chat.controller.ts`
- [ ] Limiter outils et itérations pour subagents
- [ ] Tests E2E avec tâches complexes

### Phase 4: Context Compaction 📦

- [ ] Créer `context-compaction.ts`
- [ ] Créer `tool-result-pruner.ts`
- [ ] Intégrer compaction dans chat loop
- [ ] Configurer thresholds
- [ ] Tests de performance avec longues conversations

### Phase 5: Workspace Bootstrap 📁

- [ ] Créer `workspace-bootstrap.ts`
- [ ] Intégrer dans `chat-context.ts`
- [ ] Ajouter cache avec TTL
- [ ] Tests d'intégration

---

## 🎯 Métriques de Succès

| Métrique                            | Actuel               | Cible                   |
| ----------------------------------- | -------------------- | ----------------------- |
| **Tokens par requête**              | ~2000+               | <1000 (sans skill load) |
| **Taux de succès tool calls**       | ~70%                 | >90%                    |
| **Tâches complexes réussies**       | ~50%                 | >85%                    |
| **Latence premier token**           | ~800ms               | <500ms                  |
| **Conversations longues (>20 msg)** | Performance dégradée | Stable                  |

---

## 📝 Notes d'Implémentation

### Ordre Recommandé

1. **Commencer par Phase 1** - Quick wins avec impact immédiat
2. **Phase 4 en parallèle** - Context compaction ne dépend pas des autres
3. **Phase 2 avant Phase 3** - Skills simplifient le contexte pour subagents
4. **Phase 5 en dernier** - Bénéficie de toutes les autres améliorations

### Points d'Attention

- **Compatibilité**: Toutes les modifications doivent être rétrocompatibles
- **Tests**: Chaque phase doit avoir des tests avant merge
- **Monitoring**: Ajouter logs pour mesurer l'impact de chaque amélioration
- **Rollback**: Prévoir des feature flags pour désactiver si problèmes

---

**Estimation Totale**: 3-4 semaines pour l'implémentation complète

**Prochaine Action**: Commencer par Phase 1.1 (Tool Call Style Instructions)
