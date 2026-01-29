# Tool Error Logging System

## Overview

Le système de logging détaillé des erreurs de tool calls fournit une visibilité complète et détaillée lorsqu'un outil échoue. Cela inclut les stack traces, le contexte de la requête, les métriques de performance et des suggestions de récupération.

## ✨ Fonctionnalités

### 1. **Logging Détaillé Automatique**

- ✅ Stack traces complètes
- ✅ Paramètres de requête capturés
- ✅ Résultats partiels (si disponibles)
- ✅ Timing d'exécution précis
- ✅ Métadonnées contextuelles

### 2. **Catégorisation Intelligente des Erreurs**

Les erreurs sont automatiquement classifiées en:

- **validation** - Erreurs de schéma et paramètres invalides
- **execution** - Erreurs à l'exécution du code
- **timeout** - Dépassement du délai d'attente
- **system** - Erreurs système (mémoire, fichiers, etc.)
- **permission** - Authentification et autorisations
- **unknown** - Autres erreurs

### 3. **Niveaux de Sévérité**

- 🔴 **critical** - Problème grave nécessitant une intervention immédiate
- 🟠 **high** - Erreur importante affectant la fonctionnalité
- 🟡 **medium** - Erreur modérée avec workaround possible
- 🟢 **low** - Erreur mineure sans impact majeur

### 4. **Récupération Intelligente**

- Détection automatique si l'erreur est récupérable
- Suggestions de solutions
- Points d'entrée pour le système de "healing" des outils

## 📊 Où Vont les Logs

### Console (Sortie Immédiate)

```
════════════════════════════════════════════════════════════════════════════
⚠️  TOOL EXECUTION ERROR - 2026-01-29T15:30:45.123Z
════════════════════════════════════════════════════════════════════════════

📋 TOOL INFORMATION:
  Tool ID:        get_weather
  User ID:        user_123
  Action:         execute
  Flow ID:        flow_abc123

❌ ERROR DETAILS:
  Type:           api_error
  Severity:       high [🟠]
  Category:       execution
  Recoverable:    ✓ YES
  Message:        HTTP error 429: Too many requests

⏱️  TIMING:
  Started:        2026-01-29T15:30:45.100Z
  Ended:          2026-01-29T15:30:45.850Z
  Duration:       750ms

📥 REQUEST CONTEXT:
  Parameters:     {
                    "city": "Paris",
                    "units": "metric"
                  }

📍 STACK TRACE:
  Error: HTTP error 429: Too many requests
    at executeApiCall (tool-executor.ts:450)
    at ToolExecutorService.executeTool (tool-executor.ts:580)
    ...

💡 SUGGESTED RECOVERY:
  Check API endpoint and credentials, verify network connectivity, review API rate limits

════════════════════════════════════════════════════════════════════════════
```

### Base de Données (Stockage Persistant)

Table `tool_error_logs`:

```sql
- id (unique)
- toolId
- userId
- action
- errorMessage (texte complet)
- errorStack (stack trace)
- errorType (classification)
- category
- severity
- isRecoverable
- requestParams (JSON)
- startedAt / endedAt
- executionTimeMs
- flowId
- metadata
```

## 🔌 API Endpoints

### 1. Requêtes avec Filtres

```bash
GET /debug/tool-errors?toolId=get_weather&category=execution&severity=high&limit=20
```

Réponse:

```json
{
  "success": true,
  "count": 5,
  "logs": [
    {
      "id": "error_123",
      "toolId": "get_weather",
      "errorMessage": "HTTP error 429: Too many requests",
      "category": "execution",
      "severity": "high",
      "isRecoverable": true,
      "executionTimeMs": 750,
      "createdAt": "2026-01-29T15:30:45.123Z"
    }
  ]
}
```

### 2. Historique Détaillé d'un Outil

```bash
GET /debug/tool-errors/get_weather?limit=20
```

Réponse:

```json
{
  "success": true,
  "toolId": "get_weather",
  "statistics": {
    "totalErrors": 15,
    "byCategory": {
      "execution": 10,
      "timeout": 3,
      "validation": 2
    },
    "bySeverity": {
      "high": 8,
      "medium": 7
    },
    "recoveryRate": 0.87
  },
  "errorLogs": [...]
}
```

### 3. Statistiques Globales

```bash
GET /debug/tool-errors/stats
```

### 4. Erreurs par Catégorie

```bash
GET /debug/tool-errors/category/execution?limit=50
```

### 5. Dashboard Résumé

```bash
GET /debug/tool-errors/summary
```

Réponse:

```json
{
  "statistics": {
    "totalErrors": 127,
    "byCategory": {...},
    "recoveryRate": 0.82
  },
  "topErrorTools": [
    {"toolId": "get_weather", "count": 25},
    {"toolId": "api_call", "count": 18}
  ],
  "recentCriticalErrors": [...]
}
```

## 🔧 Utilisation Programmatique

### Logger une Erreur Manuellement

```typescript
import { toolErrorLogger } from "./services/tool-error-logger.js";

await toolErrorLogger.logError({
  toolId: "my_tool",
  userId: "user_123",
  errorMessage: "Connection timeout",
  errorStack: error.stack,
  requestParams: { url: "https://api.example.com" },
  startedAt: new Date(),
  endedAt: new Date(),
  executionTimeMs: 5000,
  metadata: {
    retries: 3,
    endpoint: "https://api.example.com/data",
  },
});
```

### Requêter les Logs

```typescript
const logs = await toolErrorLogger.queryErrorLogs({
  toolId: "get_weather",
  category: "execution",
  severity: "high",
  isRecoverable: true,
  limit: 20,
});
```

### Obtenir les Statistiques

```typescript
const stats = await toolErrorLogger.getErrorStatistics("get_weather");
console.log(stats);
// {
//   totalErrors: 15,
//   byCategory: { execution: 10, timeout: 3, validation: 2 },
//   bySeverity: { high: 8, medium: 7 },
//   recoveryRate: 0.87
// }
```

## 🏗️ Architecture

### Flux d'Erreur

```
Tool Execution Failure
        ↓
Exception Caught
        ↓
ToolErrorLogger.logError()
        ├── Console Output (Immediate Debug Info)
        ├── Error Categorization
        │   └── Pattern Matching
        ├── Suggested Recovery
        └── Database Persistence
            └── toolErrorLog table
```

### Services Intégrés

1. **ToolExecutorService** (`tool-executor.ts`)
   - Logs automatiquement les erreurs d'exécution
   - Capture params de requête et stack traces

2. **DynamicToolGeneratorService** (`dynamic-tool-generator.ts`)
   - Logs les erreurs des outils générés
   - Inclut metadata sur l'exécution

3. **ToolErrorLogger** (`tool-error-logger.ts`)
   - Service central de logging
   - Catégorisation intelligente
   - Stockage et requêtes

## 📈 Patterns d'Erreurs Détectés

Le système détecte automatiquement:

```
Validation Errors
├── schema_validation_error
└── type_mismatch

Execution Errors
├── undefined_reference
├── runtime_error
└── api_error

Timeout Errors
└── timeout_error

Permission Errors
├── permission_denied
└── authentication_error

System Errors
├── out_of_memory
└── resource_not_found
```

## 🎯 Cas d'Usage

### 1. Débogage Rapide

```bash
# Trouver toutes les erreurs d'une tool en dernier jour
GET /debug/tool-errors?toolId=get_weather&since=2026-01-28T15:30:00Z
```

### 2. Monitoring d'Outils Instables

```bash
# Obtenir les statistiques de récupérabilité
GET /debug/tool-errors/get_weather

# Response montre le recovery rate pour évaluer la stabilité
```

### 3. Diagnostic d'Erreurs Critiques

```bash
# Toutes les erreurs critiques non-récupérables
GET /debug/tool-errors?severity=critical&isRecoverable=false
```

### 4. Optimisation de Performance

```bash
# Erreurs de timeout pour identifier les goulots d'étranglement
GET /debug/tool-errors/category/timeout
```

## 🔐 Sécurité

- Les paramètres sensitifs ne sont **pas** stockés avant sanitization
- Les secrets ne sont jamais loggés
- Accès filtré par userId pour la confidentialité
- Les données de log sont auditées

## 📝 Migration de la Base de Données

```bash
# Créer la nouvelle table toolErrorLog
npx prisma migrate dev --name add_tool_error_logs

# La table sera automatiquement créée avec les index appropriés
```

## 🚀 Prochaines Étapes

1. **Replay d'Erreurs** - Ré-exécuter des outils avec les paramètres originaux
2. **Auto-Healing** - Utiliser les logs pour corriger automatiquement les outils
3. **Alerting** - Notifier l'utilisateur des patterns d'erreurs critiques
4. **Dashboard UI** - Interface visuelle pour visualiser les erreurs
5. **Export** - Exporter les logs pour analyse externe

---

**Version**: 1.0.0
**Créé**: 29 janvier 2026
**Statut**: Production Ready
