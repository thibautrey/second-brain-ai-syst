# 🐛 Debug Flow Visualization - Guide d'utilisation

## Vue d'ensemble

Le système de visualisation de flux permet de voir en temps réel comment les entrées (texte, audio, chat) sont traitées à travers le backend. C'est un outil essentiel pour le débogage et la compréhension du système.

## Accès au Dashboard

### Prérequis

- Le backend doit être en mode développement (`NODE_ENV != 'production'`)
- Le serveur backend doit être lancé

### URL d'accès

```
http://localhost:3000/api/debug/input-flow
```

## Fonctionnalités

### 📊 Statistiques en temps réel

- **Total Flux**: Nombre total de flux traités
- **Complétés**: Flux terminés avec succès
- **Échoués**: Flux avec erreurs
- **En cours**: Flux actuellement en traitement
- **Durée moyenne**: Temps moyen de traitement

### 🔄 Liste des flux récents

- Affiche les 20 derniers flux traités
- Actualisation automatique toutes les 3 secondes (configurable)
- Code couleur :
  - 🟢 Vert : Complété avec succès
  - 🔴 Rouge : Échoué
  - 🟠 Orange : En cours de traitement

### 🗺️ Diagramme d'architecture

Visualisation Mermaid du pipeline complet montrant :

- Points d'entrée (texte, audio, chat)
- Services de traitement (VAD, Speaker Recognition, Transcription)
- Classification d'intention
- Recherche mémoire
- Génération de réponse LLM
- Stockage en mémoire

## Types de flux suivis

### 1. **Flux Texte** (`text`)

```
Entrée texte → InputIngestionService → IntentRouter → [Stockage si pertinent]
```

### 2. **Flux Audio** (`audio_stream`)

```
Audio chunk → VAD → Speaker Recognition → Transcription →
IntentRouter → [Wake word / Memory storage]
```

### 3. **Flux Chat** (`chat`)

```
Message chat → IntentRouter → Memory Search → LLM Router →
LLM Response → [Memory storage]
```

## Événements suivis

Chaque flux passe par plusieurs étapes, chacune émettant des événements :

| Étape                    | Service               | Données capturées            |
| ------------------------ | --------------------- | ---------------------------- |
| `input_received`         | InputIngestionService | Longueur du contenu          |
| `vad_analysis`           | VoiceActivityDetector | Détection de parole, énergie |
| `speaker_identification` | SpeakerRecognition    | Confiance, ID locuteur       |
| `transcription`          | OpenAI/Whisper        | Texte, confiance, langue     |
| `intent_classification`  | IntentRouter          | Type, confiance, shouldStore |
| `memory_search`          | MemorySearchService   | Nombre de résultats          |
| `llm_provider_selected`  | LLMRouter             | Fournisseur, modèle          |
| `llm_response`           | OpenAI                | Longueur réponse             |
| `memory_storage`         | MemoryManager         | ID mémoire ou raison du skip |

## Statuts d'événements

- **`started`** 🔵 : Événement démarré
- **`success`** 🟢 : Terminé avec succès
- **`failed`** 🔴 : Échec avec erreur
- **`skipped`** ⚪ : Étape sautée (avec raison)

## API Endpoints

### GET `/api/debug/input-flow`

Interface HTML complète avec dashboard

### GET `/api/debug/flow-stats`

Retourne les statistiques JSON :

```json
{
  "totalFlows": 42,
  "completed": 38,
  "failed": 2,
  "inProgress": 2,
  "avgDuration": 1234,
  "stageStats": [...]
}
```

### GET `/api/debug/recent-flows?limit=20`

Liste des flux récents (JSON)

### GET `/api/debug/flow/:flowId`

Détails d'un flux spécifique (JSON)

## Configuration

### Activer/Désactiver les debug routes

Les routes debug sont automatiquement désactivées en production. Pour forcer l'activation :

```typescript
// backend/services/api-server.ts
if (process.env.NODE_ENV !== "production") {
  app.use("/api/debug", debugController);
}
```

### Modifier le nombre de flux conservés

```typescript
// backend/services/flow-tracker.ts
private maxFlows = 50; // Changez cette valeur
```

### Modifier l'intervalle d'actualisation

Dans le dashboard HTML, ligne `autoRefreshInterval` :

```javascript
autoRefreshInterval = setInterval(() => {
  loadStats();
  loadFlows();
}, 3000); // 3000ms = 3 secondes
```

## Cas d'usage

### 🔍 Déboguer un flux audio qui ne stocke pas en mémoire

1. Ouvrir le dashboard
2. Déclencher un enregistrement audio
3. Chercher le flux correspondant dans la liste
4. Cliquer pour voir les détails
5. Vérifier l'étape `intent_classification` → `shouldStore`
6. Si `skipped`, vérifier la raison dans `decision`

### ⏱️ Identifier les goulots d'étranglement

1. Ouvrir le dashboard
2. Observer les statistiques de durée par étape
3. Les étapes avec `duration` > 2000ms sont lentes
4. Exemples :
   - Transcription lente → Problème API ou réseau
   - Memory search lent → Weaviate en surcharge
   - LLM response lent → Modèle trop complexe

### 🐛 Comprendre pourquoi un texte est classé comme "bruit"

1. Trouver le flux dans la liste
2. Regarder `intent_classification`
3. Vérifier `confidence` et `inputType`
4. Si `inputType: "noise"`, vérifier le contenu original

## Architecture technique

### FlowTracker Service

Service singleton qui :

- Maintient une Map des 50 derniers flux en mémoire
- Émet des événements en temps réel
- Calcule des statistiques agrégées
- Notifie les listeners (WebSocket potentiel)

### Instrumentation

Chaque service majeur est instrumenté avec :

```typescript
import { flowTracker } from './flow-tracker.js';

const flowId = randomBytes(8).toString('hex');
flowTracker.startFlow(flowId, 'text');

flowTracker.trackEvent({
  flowId,
  stage: 'my_stage',
  service: 'MyService',
  status: 'success',
  duration: 123,
  data: { ... }
});

flowTracker.completeFlow(flowId, 'completed');
```

## Limitations actuelles

1. **Pas de persistance** : Les flux sont stockés en mémoire uniquement (max 50)
2. **Pas de WebSocket** : Actualisation par polling HTTP
3. **Pas d'authentification** : Routes publiques en dev (OK pour local)
4. **Pas de filtres** : Impossible de filtrer par type, statut, date

## Améliorations futures

- [ ] Persistance optionnelle en PostgreSQL
- [ ] WebSocket pour updates en temps réel
- [ ] Filtres et recherche
- [ ] Export des flux en JSON/CSV
- [ ] Graphiques de performance (Chart.js)
- [ ] Mode "replay" pour rejouer un flux
- [ ] Alertes sur erreurs répétées

## Dépannage

### "Debug routes not found"

→ Vérifier que `NODE_ENV !== 'production'`

### "No flows shown"

→ Déclencher des interactions (chat, audio, texte)
→ Attendre 3s pour l'actualisation

### "Flows but no events"

→ Vérifier que les services importent bien `flowTracker`
→ Vérifier les logs console du backend

## Sécurité

⚠️ **Important** : Ne jamais activer en production sans authentification !

Les flux peuvent contenir :

- Contenu des messages utilisateurs
- Clés API (si loggées par erreur)
- Informations personnelles

En production, ajouter :

- Authentification obligatoire
- Rate limiting
- Filtrage des données sensibles
- Audit logs

---

**Créé le**: 23 janvier 2026  
**Version**: 1.0.0  
**Auteur**: Second Brain AI System
