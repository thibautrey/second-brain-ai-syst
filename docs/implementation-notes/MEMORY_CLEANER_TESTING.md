# Guide de Tests - Memory Cleaner Agent

## Tests Manuels

### 1. Vérifier que le scheduler s'initialise correctement

```bash
# Dans les logs du backend au démarrage, vous devriez voir :
✓ Registered task: Clean Short-Term Memories
```

### 2. Créer des mémoires de test

Utilisez l'endpoint pour créer des mémoires :

```bash
curl -X POST http://localhost:3000/api/memories \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "DEBUG: System memory allocation at 2024-01-23 14:30:00",
    "type": "SHORT_TERM",
    "tags": ["debug", "technical"],
    "importanceScore": 0.1
  }'

# Créer plusieurs variations :
# - Information technique sans valeur
# - Fragments incomplets
# - Notes redondantes
# - Insights importants (score > 0.6)
```

### 3. Déclencher manuellement le nettoyage

```bash
curl -X POST http://localhost:3000/api/memories/cleaner/run \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json"
```

**Réponse attendue:**

```json
{
  "userId": "user123",
  "success": true,
  "memoriesAnalyzed": 42,
  "memoriesArchived": 5,
  "memoriesDeleted": 3,
  "createdAt": "2024-01-23T14:35:00Z"
}
```

### 4. Vérifier les statistiques

```bash
curl -X GET http://localhost:3000/api/memories/cleaner/stats \
  -H "Authorization: Bearer <your_token>"
```

**Réponse attendue:**

```json
{
  "totalShortTermMemories": 34,
  "totalLongTermMemories": 120,
  "archivedMemories": 8
}
```

## Tests d'intégration automatiques

### Test 1: Vérifier l'enregistrement de la tâche

```typescript
import { schedulerService } from "./scheduler";

// Vérifier que la tâche est bien enregistrée
const task = schedulerService["tasks"].get("memory-cleaner");
expect(task).toBeDefined();
expect(task.cronExpression).toBe("*/5 * * * *");
expect(task.name).toBe("Clean Short-Term Memories");
```

### Test 2: Exécution du Memory Cleaner

```typescript
import { memoryCleanerService } from "./memory-cleaner";
import prisma from "./prisma";

// Préparer les données de test
const userId = "test-user-123";
const memory = await prisma.memory.create({
  data: {
    userId,
    content: "DEBUG: Stack trace error",
    type: MemoryType.SHORT_TERM,
    importanceScore: 0.2,
    tags: ["debug"],
  },
});

// Exécuter le nettoyage
const result = await memoryCleanerService.runMemoryCleanup(userId);

// Vérifier le résultat
expect(result.success).toBe(true);
expect(result.memoriesAnalyzed).toBeGreaterThan(0);
expect(result.memoriesDeleted + result.memoriesArchived).toBeGreaterThan(0);
```

### Test 3: Vérifier que les mémoires importantes ne sont pas supprimées

```typescript
// Créer une mémoire importante
const importantMemory = await prisma.memory.create({
  data: {
    userId,
    content: "Important decision: Start learning TypeScript",
    type: MemoryType.SHORT_TERM,
    importanceScore: 0.85,
    tags: ["learning", "decision"],
  },
});

const result = await memoryCleanerService.runMemoryCleanup(userId);

// Vérifier que la mémoire existe toujours
const stillExists = await prisma.memory.findUnique({
  where: { id: importantMemory.id },
});

expect(stillExists).toBeDefined();
expect(stillExists.isArchived).toBe(false);
```

### Test 4: Archivage vs Suppression

```typescript
const result = await memoryCleanerService.runMemoryCleanup(userId);

// Vérifier que certaines sont archivées et d'autres supprimées
if (result.details?.archivedIds.length > 0) {
  for (const archivedId of result.details.archivedIds) {
    const archived = await prisma.memory.findUnique({
      where: { id: archivedId },
    });
    expect(archived.isArchived).toBe(true);
    expect(archived).toBeDefined(); // Pas supprimée de la BD
  }
}

if (result.details?.deletedIds.length > 0) {
  for (const deletedId of result.details.deletedIds) {
    const deleted = await prisma.memory.findUnique({
      where: { id: deletedId },
    });
    expect(deleted).toBeNull(); // Supprimée complètement
  }
}
```

## Tests d'exécution toutes les 5 minutes

### Test de vérification du scheduler

1. Démarrez le serveur
2. Attendez 5 minutes
3. Vérifiez les logs pour:

   ```
   ✓ Memory cleaner: archived X, deleted Y for user Z
   ```

4. Attendez 10 minutes au total
5. Vérifiez que le message s'affiche à nouveau (confirmation que c'est bien répété)

### Test avec logs détaillés

Modifier temporairement le code pour ajouter des logs:

```typescript
// Dans memory-cleaner.ts
console.log(`[Memory Cleaner] Starting cleanup for user ${userId}`);
console.log(
  `[Memory Cleaner] Found ${shortTermMemories.length} memories to analyze`,
);
console.log(`[Memory Cleaner] Analysis results:`, analysis);
console.log(
  `[Memory Cleaner] Cleaned ${cleanup.deleted} deleted, ${cleanup.archived} archived`,
);
```

## Checklist de validation

- [ ] Aucune erreur TypeScript
- [ ] La tâche est bien enregistrée au démarrage
- [ ] Le cron s'exécute à intervalle régulier (toutes les 5 min)
- [ ] Les mémoires non-utiles sont supprimées
- [ ] Les mémoires importantes restent conservées
- [ ] Les mémoires archivées sont marquées `isArchived = true`
- [ ] Les mémoires supprimées sont complètement effacées
- [ ] Les endpoints API fonctionnent
- [ ] Les statistiques sont correctes
- [ ] Pas de memory leak (vérifier après 1-2 heures d'exécution)
- [ ] Les logs sont clairs et informatifs

## Scénarios d'erreur

### Scénario 1: LLM non disponible

```typescript
// Qu'est-ce qui se passe ?
// → return { success: false, metadata: { error: error.message } }
// → Les mémoires ne sont pas modifiées
// → Le processus continue normalement
```

### Scénario 2: Basde données indisponible

```typescript
// Qu'est-ce qui se passe ?
// → Exception levée
// → Loggée comme warning
// → Pas de mémoires affectées
```

### Scénario 3: Aucune mémoire à analyser

```typescript
// Qu'est-ce qui se passe ?
// → Retourne success: true
// → memoriesAnalyzed: 0
// → memoriesDeleted: 0, archived: 0
```

## Monitoring et alertes

### Vérifier l'état du Memory Cleaner

```bash
# Récupérer les stats
curl http://localhost:3000/api/memories/cleaner/stats \
  -H "Authorization: Bearer token"

# Réponse :
{
  "totalShortTermMemories": 45,
  "totalLongTermMemories": 120,
  "archivedMemories": 32
}

# Si totalShortTermMemories augmente constamment → L'agent ne nettoie pas
# Si totalShortTermMemories diminue régulièrement → Fonctionne bien
```

### Alertes à mettre en place

1. **Accumulation anormale** : Plus de 1000 mémoires court terme
2. **Trop de suppressions** : Plus de 50% de suppressions en une exécution
3. **Échecs récurrents** : 3 échecs consécutifs

---

**Version:** 1.0.0  
**Date:** 24 Janvier 2026
