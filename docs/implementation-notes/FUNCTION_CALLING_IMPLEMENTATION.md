# Function Calling & Multi-Tool Execution - Implementation

**Date**: 23 janvier 2026  
**Statut**: ✅ Implémenté  
**Architecture**: Streaming Hybride avec OpenAI Function Calling

---

## 📋 Vue d'ensemble

Implémentation du système d'appels d'outils automatiques permettant à l'IA de détecter quand elle a besoin d'outils et de les appeler automatiquement, y compris en parallèle.

### Exemple d'usage

**User**: "Quel temps fera-t-il demain ?"

**L'IA va automatiquement**:

1. Appeler `user_context` (get_location) pour récupérer la localisation
2. Appeler `curl` pour interroger une API météo
3. **Les 2 appels se font en parallèle** si possibles
4. Synthétiser les résultats dans une réponse naturelle

---

## 🏗️ Architecture Implémentée

### Mode Hybride Streaming

```
User Message
    ↓
Memory Search + Provider Config (parallèle)
    ↓
┌─────────────────────────────────────────┐
│ BOUCLE TOOL CALLING (max 3 itérations) │
└─────────────────────────────────────────┘
    ↓
LLM Call (non-streaming) avec tools schemas
    ↓
Tool calls détectés ?
├─ OUI
│  ├─ Exécution PARALLÈLE des outils
│  │  ├─ Timeout individuel: 7s par outil
│  │  └─ Timeout global: 60s pour tous
│  ├─ Injection résultats dans messages
│  └─ Retour à LLM Call (nouvelle itération)
│
└─ NON → Réponse finale
    ↓
STREAMING de la réponse finale à l'utilisateur
    ↓
Stockage mémoire (async) avec tool results
```

### Avantages

✅ **Simple & fiable**: Non-streaming pour tool detection  
✅ **UX fluide**: Streaming de la réponse finale  
✅ **Performance**: Exécution parallèle des outils  
✅ **Robustesse**: Timeouts individuels + global  
✅ **Traçabilité**: Tool results stockés en mémoire

---

## 🛠️ Modifications Effectuées

### 1. Tool Executor Service ([tool-executor.ts](../../backend/services/tool-executor.ts))

#### Nouvel outil: `user_context`

Permet à l'IA de récupérer des informations sur l'utilisateur depuis la mémoire.

**Actions**:

- `get_location`: Recherche la localisation de l'utilisateur
- `get_preferences`: Récupère les préférences (optionnel: sur un topic)
- `search_facts`: Recherche des faits spécifiques

**Exemple d'appel**:

```json
{
  "name": "user_context",
  "arguments": {
    "action": "get_location"
  }
}
```

**Réponse**:

```json
{
  "action": "get_location",
  "found": true,
  "results": [
    {
      "content": "J'habite à Paris, 75001",
      "score": 0.95,
      "date": "2026-01-20T10:30:00Z"
    }
  ]
}
```

#### Nouvelle méthode: `executeToolsInParallel()`

**Signature**:

```typescript
async executeToolsInParallel(
  userId: string,
  requests: ToolExecutionRequest[],
  individualTimeout: number = 7000,  // 7s par outil
  globalTimeout: number = 60000,     // 60s total
): Promise<ToolExecutionResult[]>
```

**Fonctionnalités**:

- Exécution parallèle avec `Promise.allSettled()`
- Timeout individuel par outil (7s default)
- Timeout global pour tous les outils (60s default)
- Fallback automatique: si un outil échoue, les autres continuent
- Gestion d'erreur individuelle sans blocage

**Exemple**:

```typescript
const results = await toolExecutorService.executeToolsInParallel(userId, [
  { toolId: "user_context", action: "get_location", params: {} },
  {
    toolId: "curl",
    action: "get",
    params: { url: "https://api.weather.com/..." },
  },
]);
// Les 2 outils s'exécutent en parallèle
```

#### Schéma OpenAI Function Calling

Ajout du schéma `user_context` pour OpenAI:

```typescript
{
  name: "user_context",
  description: "Retrieve user context information from memory...",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get_location", "get_preferences", "search_facts"]
      },
      topic: { type: "string" },      // Pour get_preferences
      query: { type: "string" },      // Pour search_facts
      limit: { type: "number" }       // Pour search_facts
    },
    required: ["action"]
  }
}
```

---

### 2. Chat Controller ([chat.controller.ts](../../backend/controllers/chat.controller.ts))

#### Boucle de Tool Calling

**Structure**:

```typescript
let messages: ChatMessage[] = [
  { role: "system", content: systemPrompt },
  { role: "user", content: message }
];

let allToolResults: any[] = [];
let iterationCount = 0;
const MAX_ITERATIONS = 3;

while (iterationCount < MAX_ITERATIONS) {
  iterationCount++;

  // LLM call avec tools
  const response = await openai.chat.completions.create({
    model: modelId,
    messages: messages,
    tools: toolSchemas.map(s => ({ type: "function", function: s })),
    tool_choice: "auto",
    stream: false  // Non-streaming pour détecter tool_calls
  });

  const assistantMessage = response.choices[0]?.message;

  // Check for tool calls
  if (assistantMessage.tool_calls?.length > 0) {
    // Add assistant message to history
    messages.push({
      role: "assistant",
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls
    });

    // Execute tools in parallel
    const toolResults = await toolExecutorService.executeToolsInParallel(...);

    // Add results to messages
    toolResults.forEach((result, index) => {
      messages.push({
        role: "tool",
        tool_call_id: toolCalls[index].id,
        name: toolCalls[index].function.name,
        content: JSON.stringify(result)
      });
    });

    // Continue loop
    continue;
  }

  // No tool calls - final response
  fullResponse = assistantMessage.content;
  break;
}
```

#### Streaming de la réponse finale

Après la boucle, streaming simulé pour cohérence UX:

```typescript
// Send tool usage info
if (allToolResults.length > 0) {
  res.write(
    `data: ${JSON.stringify({
      type: "tools",
      data: {
        count: allToolResults.length,
        tools: allToolResults.map((r) => ({
          tool: r.toolUsed,
          success: r.success,
          duration: r.executionTime,
        })),
      },
    })}\n\n`,
  );
}

// Stream response in chunks
const chunkSize = 5;
for (let i = 0; i < fullResponse.length; i += chunkSize) {
  const chunk = fullResponse.slice(i, i + chunkSize);
  res.write(`data: ${JSON.stringify({ type: "token", data: chunk })}\n\n`);
  await new Promise((resolve) => setTimeout(resolve, 10));
}
```

#### Stockage mémoire enrichi

Les tool results sont inclus dans le contenu de la mémoire:

```typescript
// Add tool results to content
if (allToolResults.length > 0) {
  const toolsSummary = allToolResults
    .filter((r) => r.success)
    .map((r) => `- ${r.toolUsed}: ${JSON.stringify(r.data).substring(0, 100)}`)
    .join("\n");

  contentToStore += `\n\nOutils utilisés:\n${toolsSummary}`;
}

await prisma.memory.create({
  data: {
    userId,
    content: contentToStore,
    type: "SHORT_TERM",
    sourceType: "chat",
    importanceScore: valueAssessment.adjustedImportanceScore,
    tags: classification.topic ? [classification.topic] : [],
    entities: classification.entities,
    metadata: {
      toolsUsed: allToolResults.map((r) => r.toolUsed),
      toolResultsCount: allToolResults.length,
    },
  },
});
```

---

## 📊 Événements SSE pour le Frontend

Le système envoie maintenant des événements enrichis:

### `type: "start"`

```json
{ "type": "start", "messageId": "msg_123" }
```

### `type: "tools"` (nouveau)

```json
{
  "type": "tools",
  "data": {
    "count": 2,
    "tools": [
      { "tool": "user_context", "success": true, "duration": 234 },
      { "tool": "curl", "success": true, "duration": 1523 }
    ]
  }
}
```

### `type: "token"`

```json
{ "type": "token", "data": "chunk" }
```

### `type: "end"`

```json
{ "type": "end", "messageId": "msg_123" }
```

---

## 🔍 Flow Tracking

Nouveaux événements de tracking:

```typescript
// Iteration tracking
flowTracker.trackEvent({
  flowId,
  stage: `llm_call_iteration_${iterationCount}`,
  service: "OpenAI",
  status: "started",
  data: { messagesCount: messages.length },
});

// Tool detection
flowTracker.trackEvent({
  flowId,
  stage: `tool_calls_detected_iteration_${iterationCount}`,
  service: "ToolExecutor",
  data: {
    toolCallsCount: assistantMessage.tool_calls.length,
    tools: assistantMessage.tool_calls.map((tc) => tc.function.name),
  },
});

// Tool execution
flowTracker.trackEvent({
  flowId,
  stage: `tools_executed_iteration_${iterationCount}`,
  service: "ToolExecutor",
  status: "success",
  duration: executionTime,
  data: {
    toolsExecuted: toolResults.length,
    successCount: toolResults.filter((r) => r.success).length,
    failureCount: toolResults.filter((r) => !r.success).length,
  },
});
```

---

## 🎯 Exemples de Scénarios

### Scénario 1: Simple question (pas d'outils)

**User**: "Comment vas-tu ?"

**Flow**:

1. LLM call → Pas de tool_calls détectés
2. Réponse directe: "Je vais bien, merci !"
3. 1 itération seulement

### Scénario 2: Météo avec localisation

**User**: "Quel temps fera-t-il demain ?"

**Flow**:

1. **Iteration 1**: LLM détecte besoin de 2 outils
   - `user_context` (get_location)
   - `curl` (API météo)
2. Exécution parallèle (< 2s total car parallèle)
3. **Iteration 2**: LLM reçoit les résultats
   - Location: "Paris, France"
   - Météo: { temp: 15, condition: "cloudy" }
4. LLM génère réponse: "Demain à Paris, il fera 15°C avec un temps nuageux"
5. Streaming de la réponse finale

**SSE Events**:

```
type: start
type: tools → count: 2, tools: [user_context, curl]
type: token → "Demain"
type: token → " à Pa"
type: token → "ris, "
...
type: end
```

### Scénario 3: Recherche complexe (chaîne d'outils)

**User**: "Quelle est la température à l'endroit où j'ai vécu l'année dernière ?"

**Flow**:

1. **Iteration 1**: `user_context` (search_facts: "vécu l'année dernière")
2. **Iteration 2**: `curl` (API météo pour la ville trouvée)
3. **Iteration 3**: Réponse finale avec synthèse

---

## ⚙️ Configuration

### Timeouts

```typescript
// Dans executeToolsInParallel()
const INDIVIDUAL_TIMEOUT = 7000; // 7s par outil
const GLOBAL_TIMEOUT = 60000; // 60s total

// Dans chat.controller.ts
await toolExecutorService.executeToolsInParallel(
  userId,
  toolRequests,
  7000, // Timeout individuel
  60000, // Timeout global
);
```

### Limite d'itérations

```typescript
const MAX_ITERATIONS = 3; // Évite les boucles infinies
```

---

## 🧪 Tests Recommandés

### Test 1: Simple tool call

```
User: "Quelle est ma localisation ?"
Expected: Appel user_context → Réponse avec localisation
```

### Test 2: Parallel tools

```
User: "Quel temps fera-t-il demain ?"
Expected: user_context + curl en parallèle → Réponse météo
```

### Test 3: Tool chain

```
User: "Crée une tâche pour me rappeler la météo demain"
Expected: curl (météo) → todo (créer tâche)
```

### Test 4: Timeout handling

```
User: "Appelle une API très lente"
Expected: Timeout après 7s → Erreur gracieuse
```

### Test 5: No tools needed

```
User: "Bonjour !"
Expected: Réponse directe sans outils (1 itération)
```

---

## 🚀 Prochaines Étapes

1. ✅ **Implémenté**: Function calling avec mode hybride
2. ✅ **Implémenté**: Exécution parallèle avec timeouts
3. ✅ **Implémenté**: Outil user_context
4. ✅ **Implémenté**: Stockage mémoire enrichi
5. 🔄 **À tester**: Vérifier le système avec exemples réels
6. 📝 **À venir**: Frontend UI pour afficher les tool calls
7. 📝 **À venir**: Analytics sur l'usage des outils
8. 📝 **À venir**: Optimisations de performance

---

## 📚 Références

- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [chat.controller.ts](../../backend/controllers/chat.controller.ts)
- [tool-executor.ts](../../backend/services/tool-executor.ts)
- [memory-search.ts](../../backend/services/memory-search.ts)

---

**Dernière mise à jour**: 23 janvier 2026  
**Implémenté par**: GitHub Copilot  
**Statut**: ✅ Prêt pour tests
