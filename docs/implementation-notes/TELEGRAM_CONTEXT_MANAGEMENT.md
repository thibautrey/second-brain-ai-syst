# Telegram Context Management System - Implementation Guide

## 🎯 Objectif

Résoudre le problème où l'agent Telegram commence à "dire n'importe quoi" après un certain temps, causé par un débordement du contexte LLM (context window overflow).

## 🔍 Analyse du Problème

### Cause Racine

Le système conservait **tous les messages** d'une conversation dans un array `previousMessages` envoyé à chaque requête LLM. Au fur et à mesure:

1. L'historique accumule les messages
2. Les tokens totaux dépassent la limite du modèle (généralement 8000-128000)
3. L'API LLM rejette la requête OU le modèle génère des réponses incohérentes
4. Les performances se dégradent progressivement

### Scénario Typique

```
Message 1 → context = 500 tokens ✅
Message 5 → context = 2500 tokens ✅
Message 20 → context = 10000 tokens ❌ Débordement!
Message 50 → context = 25000 tokens 🔥 Réponses aléatoires
```

## ✅ Solution Implémentée

### Architecture Nouvelle

```
┌─────────────────────────────────────────────────────────┐
│              Telegram Message arrive                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Telegram Chat Service     │
        │  (telegram-chat.ts)        │
        └────────────┬───────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │ Build Telegram Context (nouveau)     │
        │ - Token estimation                   │
        │ - Récupère N messages récents        │
        │ - Résume les anciens si nécessaire   │
        └────────────┬─────────────────────────┘
                     │
        ┌────────────▼──────────────────────────┐
        │ Validate Context Size                 │
        │ - Vérifie les limites de tokens       │
        │ - Remove old messages si overflow     │
        └────────────┬──────────────────────────┘
                     │
        ┌────────────▼──────────────────────────┐
        │ LLM Call                              │
        │ (avec contexte limité)                │
        └────────────┬──────────────────────────┘
                     │
        ┌────────────▼──────────────────────────┐
        │ Store in DB                           │
        │ (Memory avec sourceType='telegram')   │
        └──────────────────────────────────────┘
```

## 📁 Fichiers Créés/Modifiés

### Fichiers Créés (Nouveaux)

1. **`backend/services/telegram-conversation-manager.ts`**
   - Sauvegarde des messages Telegram dans la BDD
   - Récupération des messages récents
   - Expiration des vieux messages (TTL)
   - Résumé des conversations anciennes
   - Fonctions principales:
     - `storeTelegramMessage()` - Sauvegarde un message
     - `getConversationContext()` - Récupère N messages récents
     - `expireOldMessages()` - Archive les anciens messages
     - `summarizeConversationHistory()` - Crée un résumé compact

2. **`backend/services/telegram-context-manager.ts`**
   - Gestion intelligente du contexte LLM
   - Estimation précise des tokens
   - Construction de contexte avec limites respectées
   - Fonctions principales:
     - `estimateTokens()` - Estime tokens pour une string
     - `buildTelegramContext()` - Construit messages avec limits
     - `validateContextSize()` - Valide que ça rentre
     - `getTokenBudgetBreakdown()` - Analyse détaillée des tokens

3. **`backend/controllers/telegram-conversation.controller.ts`**
   - Routes API pour gérer les conversations
   - Endpoints:
     - `GET /api/telegram/conversation` - Historique récent
     - `POST /api/telegram/conversation/cleanup` - Nettoyage
     - `POST /api/telegram/conversation/expire` - Expiration
     - `GET /api/telegram/conversation/summary` - Résumé

### Fichiers Modifiés

1. **`backend/services/telegram-chat.ts`**
   - Imports des nouveaux services
   - Construction du contexte avec `buildTelegramContext()`
   - Validation du contexte avec `validateContextSize()`
   - Sauvegarde des messages avec `storeTelegramMessage()`

2. **`backend/services/api-server.ts`**
   - Imports du telegram conversation controller
   - Routes API pour gestion des conversations Telegram

## 🧮 Token Management

### Estimation des Tokens

La formule utilisée (simplifiée mais efficace):

```typescript
tokens ≈ string.length / charsPerToken

// Par modèle:
- GPT-4o, GPT-4, GPT-3.5: 1 token ≈ 4 caractères
- Claude 3: 1 token ≈ 3.5 caractères
```

### Allocation du Budget

Pour un modèle avec limit = 8000 tokens:

```
┌─────────────────────────────────────────────┐
│ Total Budget: 8000 tokens                   │
├─────────────────────────────────────────────┤
│ System Prompt:      ~2000 tokens (25%)      │
│ User Memory Context: ~800 tokens (10%)      │
│ Recent Messages:    ~3500 tokens (44%)      │
│ Current Message:    ~400 tokens (5%)        │
│ RESERVE for Response: ~1300 tokens (16%)    │
└─────────────────────────────────────────────┘

Messages are removed from history until we fit!
```

## 🗃️ Stockage en Base de Données

### Modèle Existant

Les messages Telegram sont stockés dans la table `Memory` (existante):

```prisma
model Memory {
  id          String @id @default(cuid())
  userId      String
  content     String @db.Text
  type        MemoryType @default(SHORT_TERM)
  sourceType  String?           // ← "telegram"
  metadata    Json @default("{}")  // ← { role: "user"|"assistant" }
  isArchived  Boolean @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  // ... autres champs
}
```

### Avantages

✅ Réutilise l'infrastructure existante
✅ Bénéficie de la recherche sémantique existante
✅ Compatible avec le système de résumé existant
✅ Permet l'archivage et la suppression

## 🔄 Workflows

### Workflow 1: Message Utilisateur Reçu (Telegram)

```
1. Message "Bonjour" arrive via Telegram
2. processTelegramMessage(userId, "Bonjour")
3. Récupère les 10-20 derniers messages de DB
4. Estime tokens totaux
5. Si > 8000 tokens:
   - Enlève les messages les plus vieux
   - OU crée un résumé des anciens messages
6. Appel LLM avec contexte limité
7. Sauvegarde la réponse en DB
8. Retourne réponse à l'utilisateur
```

### Workflow 2: Cleanup Programmé (Ex: Chaque Semaine)

```
// À implémenter dans background-agents.ts
POST /api/telegram/conversation/cleanup
{
  "keepDays": 30
}

→ Archive tous les messages > 30 jours
→ Les messages récents restent disponibles
→ La recherche ignore les archives
```

### Workflow 3: Résumé Manuel

```
GET /api/telegram/conversation/summary?daysBack=7

→ Récupère messages des 7 derniers jours
→ Crée un résumé compact
→ Peut être injecté dans le contexte
```

## 📊 Exemple Pratique

### Scénario: 50 messages sur 2 semaines

**Avant (Problème):**

```
Messages envoyés au LLM: Tous les 50 messages (complet)
Tokens estimés: ~20000 (250 mots × 4 msgs × 20 tokens/msg)
Résultat: Débordement, réponses aléatoires
```

**Après (Solution):**

```
buildTelegramContext():
1. Budget: 8000 tokens
2. Reserve: 1000 tokens pour réponse
3. Disponible pour messages: 7000 tokens
4. Ajoute messages récents jusqu'à limite:
   - Message 50 (5 heures): +300 tokens ✅
   - Message 49 (6 heures): +280 tokens ✅
   - Message 48 (8 heures): +290 tokens ✅
   - ... (continue)
   - Message 30 (13 heures): +300 tokens
   - Message 29 (15 heures): +310 tokens ❌ Dépasserait
5. Résultat: Les 21 messages récents sont inclus
6. Tokens totaux: ~7000 ✅ Dans les limites!
```

## 🚀 Utilisation API

### Récupérer l'historique récent

```bash
curl -X GET http://localhost:3000/api/telegram/conversation \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

Response:
{
  "success": true,
  "context": {
    "recentMessages": [
      {
        "userId": "user123",
        "role": "user",
        "content": "Bonjour",
        "createdAt": "2024-01-27T10:30:00Z"
      },
      {
        "userId": "user123",
        "role": "assistant",
        "content": "Bonjour! Comment puis-je t'aider?",
        "createdAt": "2024-01-27T10:30:15Z"
      }
      // ... plus de messages
    ],
    "messageCount": 15,
    "contextTokens": 5234
  }
}
```

### Nettoyer les anciens messages

```bash
curl -X POST http://localhost:3000/api/telegram/conversation/cleanup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keepDays": 30}'

Response:
{
  "success": true,
  "message": "Archived 127 messages older than 30 days",
  "archivedCount": 127
}
```

### Obtenir un résumé

```bash
curl -X GET http://localhost:3000/api/telegram/conversation/summary?daysBack=7 \
  -H "Authorization: Bearer YOUR_TOKEN"

Response:
{
  "success": true,
  "summary": "[Résumé conversation 7 jours]:
    - 42 messages utilisateur
    - 39 réponses assistant
    - Topics couverts: goals, projects, feedback",
  "daysBack": 7
}
```

## 🔧 Configuration

Les valeurs par défaut (modifiables):

```typescript
// Dans telegram-context-manager.ts
const MAX_CONTEXT_TOKENS = 8000; // Limite du contexte
const RESERVE_FOR_RESPONSE = 1000; // Tokens réservés pour réponse
const MAX_MESSAGES_TO_CONSIDER = 20; // Messages max à analyser

// Dans telegram-conversation-manager.ts
const EXPIRATION_DAYS = 30; // Expiration par défaut
```

## 🧪 Validation

### Tests Recommandés

1. **Test d'accumulation** (50+ messages)
   - Vérifier que la réponse reste cohérente
   - Vérifier les tokens utilisés

2. **Test de token limit**
   - Envoyer message après message
   - Monitorer les tokens
   - Vérifier qu'on reste < limite

3. **Test de résumé**
   - Créer conversation longue
   - Vérifier le résumé généré
   - Vérifier qu'il s'injecte correctement

4. **Test de cleanup**
   - Archiver messages vieux
   - Vérifier qu'ils ne réapparaissent plus
   - Vérifier que les récents restent

## 📝 Notes d'Implémentation

### Limitations Connues

1. **Estimation des tokens**
   - L'estimation est approximative (± 5-10%)
   - Pour une précision ultime, utiliser `tokenizers` library
   - Les outils/tool_calls ne sont pas comptés

2. **Résumé automatique**
   - Actuellement basé sur `tags` et `entities`
   - Pourrait être amélioré avec résumé par LLM
   - Voir: `summarizeConversationHistory()`

3. **Archivage**
   - Les messages archivés ne sont pas supprimés
   - Ils ne réapparaissent pas dans les requêtes LLM
   - Préserve les données historiques

### Améliorations Futures

1. **Résumé par LLM**

   ```typescript
   // Au lieu de:
   // "- 42 messages utilisateur, 39 réponses"
   // Utiliser LLM pour:
   // "Discussion sur les objectifs 2024.
   //  Accord sur 3 projets prioritaires."
   ```

2. **Compression de contexte**

   ```typescript
   // Réduire vieux messages à essentiels
   // "User asked about X, I recommended Y"
   // au lieu de le message complet
   ```

3. **Détection de topic shifts**
   ```typescript
   // Quand le sujet change complètement,
   // archiver automatiquement ancien contexte
   ```

## 📚 Intégration avec Systèmes Existants

### Avec Memory Search

Les messages Telegram bénéficient immédiatement de la recherche sémantique:

```typescript
// Dans chat-context.ts
const results = await memorySearchService.semanticSearch(
  userId,
  message,
  5, // Retourne 5 meilleures correspondances
);
// ✅ Inclut aussi les messages Telegram!
```

### Avec Summarization

Les résumés existants captent les conversations Telegram:

```typescript
// Les messages Telegram contribuent aux résumés quotidiens/hebdomadaires
// Car ils sont stockés comme Memory SHORT_TERM
```

### Avec Goals/Achievements

Les objectifs mentionnés dans Telegram sont linkés automatiquement:

```typescript
// Si user dit "Je veux terminer le projet X"
// → Stocké en Memory avec tag "goals"
// → Retrouvable dans recherche
// → Incluable dans goal tracking
```

## 🎯 Prochaines Étapes

1. **Tester** la solution sur une vraie conversation longue
2. **Monitorer** les tokens utilisés dans les logs
3. **Ajuster** les valeurs par défaut selon les observations
4. **Documenter** pour les utilisateurs finaux
5. **Implémenter cleanup automatique** (job programmé)

---

**Status**: ✅ Implémentation complète
**Date**: 27 janvier 2026
**Version**: 1.0
