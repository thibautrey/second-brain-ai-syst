# Memory Cleaner Agent - Documentation

## Vue d'ensemble

L'agent **Memory Cleaner** est un processus autonome qui s'exécute toutes les **5 minutes** pour analyser et nettoyer les mémoires court terme. Son rôle principal est de :

- **Identifier** les mémoires non-utiles, redundantes ou obsolètes
- **Archiver** ou **supprimer** les mémoires considérées comme du bruit
- **Optimiser** l'espace de stockage et la pertinence des mémoires court terme

## Critères de suppression

L'agent utilise une IA pour analyser chaque mémoire et déterminer si elle doit être supprimée, archivée ou conservée.

### 🗑️ Supprimées (REMOVE)

Les mémoires suivantes sont candidates à la suppression :

1. **Informations techniques sans valeur**
   - Logs de débogage
   - Stack traces d'erreurs
   - Informations système temporaires
   - Fragments incomplets

2. **Données redondantes**
   - Doublons ou très similaires à d'autres mémoires
   - Informations déjà capturées ailleurs

3. **Bruit et contenus temporaires**
   - Pensées fragmentaires
   - Contexte transitoire
   - Informations de moins de 24 heures avec score de faible importance

4. **Contenu non pertinent**
   - Sans rapport avec les objectifs de l'utilisateur
   - Informations système inutiles

### 📦 Archivées (ARCHIVE)

Les mémoires archivées restent accessibles mais ne s'affichent pas par défaut :

- Anciennes mémoires court terme avec une certaine valeur
- Informations historiques éventuellement utiles
- Contenus de faible importance mais pas nuls

### ✅ Conservées (KEEP)

Les mémoires conservées incluent :

1. **Insights personnels et réflexions**
2. **Notes d'apprentissage et connaissances**
3. **Décisions et engagements**
4. **Événements importants**
5. **Tâches actionnables et rappels**
6. **Observations uniques**
7. **Mémoires avec score d'importance > 0.6**
8. **Mémoires récentes (< 24 heures) avec potentiel de pertinence**

## Configuration

### Fréquence d'exécution

```
Tous les 5 minutes (pattern cron: */5 * * * *)
```

### Paramètres

- **Fenêtre d'analyse** : Dernières 6 heures
- **Limite de mémoires par exécution** : 100 mémoires
- **Seuil de confiance minimum** : 0.7 (pour appliquer une décision)

## API Endpoints

### 1. Obtenir les statistiques du Memory Cleaner

```http
GET /api/memories/cleaner/stats
Authorization: Bearer <token>
```

**Réponse:**

```json
{
  "totalShortTermMemories": 45,
  "totalLongTermMemories": 120,
  "archivedMemories": 32,
  "lastCleanupDate": "2024-01-23T14:30:00Z"
}
```

### 2. Déclencher manuellement le nettoyage

```http
POST /api/memories/cleaner/run
Authorization: Bearer <token>
```

**Réponse:**

```json
{
  "userId": "user123",
  "success": true,
  "memoriesAnalyzed": 87,
  "memoriesArchived": 12,
  "memoriesDeleted": 8,
  "details": {
    "archivedIds": ["mem_001", "mem_002", ...],
    "deletedIds": ["mem_003", "mem_004", ...],
    "reasons": {
      "archived": [
        "mem_001: Information technique obsolète",
        "mem_002: Contenu temporaire sans valeur"
      ],
      "deleted": [
        "mem_003: Fragment de pensée incomplète",
        "mem_004: Redondance avec mem_099"
      ]
    }
  },
  "createdAt": "2024-01-23T14:35:00Z"
}
```

## Processus d'exécution

```
1. Récupérer les mémoires court terme des 6 dernières heures
2. Formater les mémoires pour l'analyse LLM
3. Appeler le LLM (via llmRouterService) avec le prompt MEMORY_CLEANUP_PROMPT
4. Recevoir les recommandations d'analyse (KEEP/REMOVE/ARCHIVE)
5. Appliquer les décisions avec confiance > 0.7
6. Logger les statistiques
```

## Architecture

### Fichiers principaux

- **`backend/services/memory-cleaner.ts`** : Service principal avec la logique de nettoyage
- **`backend/services/background-agents.ts`** : Intégration dans la méthode `runMemoryCleaner()`
- **`backend/services/scheduler.ts`** : Tâche planifiée toutes les 5 minutes
- **`backend/services/api-server.ts`** : Endpoints API pour accéder au service

### Classes et méthodes

#### MemoryCleanerService

```typescript
class MemoryCleanerService {
  // Exécute le nettoyage des mémoires court terme
  async runMemoryCleanup(userId: string): Promise<CleanupResult>;

  // Applique les recommandations du LLM
  private applyCleanupDecisions(userId, memories, decisions);

  // Formate les mémoires pour l'analyse
  private formatMemoriesForAnalysis(memories): string;

  // Récupère les statistiques de nettoyage
  async getCleanupStats(userId): Promise<Stats>;
}
```

## Sécurité et Garanties

✅ **Garanties de l'agent :**

- Seules les décisions avec confiance > 0.7 sont appliquées
- Les mémoires archivées restent accessibles et peuvent être restaurées
- Les suppressions sont irréversibles (à utiliser avec prudence)
- Chaque action est loggée avec les raisons
- Pas d'analyse en-dehors des 6 dernières heures par défaut

⚠️ **À noter :**

- Le LLM peut faire des erreurs de classification
- Une validation humaine est recommandée pour les suppressions critiques
- Les utilisateurs peuvent récupérer les archives via l'API

## Monitoring

### Logs

L'agent génère des logs à chaque exécution :

```
✓ Memory cleaner: archived 12, deleted 8 for user user123
```

### Statistiques

Via l'endpoint `/api/memories/cleaner/stats`, vous pouvez suivre :

- Nombre de mémoires court terme
- Nombre de mémoires long terme
- Nombre total d'archives
- Dernière date de nettoyage

## Flux de travail complet

```
┌─────────────────────────────────────────┐
│  Scheduler (toutes les 5 minutes)      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  backgroundAgentService.runMemoryCleaner│
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  memoryCleanerService.runMemoryCleanup  │
│                                          │
│  1. Récupérer mémoires récentes        │
│  2. Formater pour LLM                  │
│  3. Analyser avec LLM                  │
│  4. Appliquer décisions (conf > 0.7)   │
│  5. Retourner résultats                │
└────────────────┬────────────────────────┘
                 │
                 ▼
        ┌────────┴──────────┐
        │                   │
    Archiver            Supprimer
    (12 mémoires)       (8 mémoires)
```

## Améliorations futures

- [ ] Interface web pour visualiser les mémoires marquées pour suppression
- [ ] Approuver/rejeter les suppression proposées manuellement
- [ ] Statistiques historiques du nettoyage
- [ ] Configuration de la sensibilité du filtrage par utilisateur
- [ ] Patterns d'apprentissage pour améliorer la classification
- [ ] Intégration avec les notifications pour alerter en cas de suppression importante
- [ ] Exportation des mémoires supprimées pour archivage externe

## Dépannage

### L'agent n'exécute rien

```bash
# Vérifier que le scheduler est démarré
# Vérifier les logs du backend
# Vérifier que l'utilisateur a des mémoires récentes
```

### Trop de mémoires supprimées

Diminuer le seuil de confiance dans le code (actuellement: 0.7)

### Pas assez de mémoires supprimées

Augmenter le seuil de confiance ou vérifier les critères d'analyse

---

**Créé:** 24 Janvier 2026
**Statut:** Production
**Version:** 1.0.0
