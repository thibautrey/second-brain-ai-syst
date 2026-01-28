# Analyse : Compréhension Intelligente des Tâches Planifiées

## ✅ IMPLÉMENTATION COMPLÈTE

Les points suivants ont été implémentés :

### ✅ 2. Intent Pre-Processor (Nouveau Service)

**Fichier créé** : `backend/services/task-intent-analyzer.ts`

### ✅ 4. Clarification Intelligente

**Intégré dans** : `task-intent-analyzer.ts` et `chat-context.ts`

---

## 📋 Contexte du Problème

Quand un utilisateur dit quelque chose comme :

> "Let me know if the weather changes for Ax-les-thermes pour ce weekend"

L'utilisateur sous-entend plusieurs choses implicites :

1. **Tâche récurrente** - Vérifier régulièrement la météo
2. **Notification conditionnelle** - Notifier uniquement si changement
3. **Expiration automatique** - Supprimer la tâche après le weekend
4. **Localisation** - Ax-les-Thermes
5. **Période temporelle** - Ce weekend (samedi et dimanche prochains)

## 🔍 Analyse du Système Actuel

### Forces actuelles

1. **`WATCH_RESOURCE` existe** - Le système a déjà un mécanisme pour surveiller des ressources externes avec conditions
2. **`expiresAt` existe** - Les tâches planifiées peuvent avoir une date d'expiration
3. **Conditions supportées** - Le `ResourceWatcherService` supporte des conditions (json path, regex, comparaisons)

### Lacunes identifiées

1. **Pas d'extraction d'intentions temporelles implicites**
   - "ce weekend" → devrait calculer automatiquement les dates
   - "jusqu'à demain" → devrait définir `expiresAt`

2. **Pas de détection de pattern "changement"**
   - "si ça change" implique `dedupe.notifyOn = "crossing"`
   - L'IA doit comprendre que l'utilisateur veut des différences, pas des rapports constants

3. **Pas d'extraction de localisation intelligente**
   - "Ax-les-thermes" devrait être extrait et utilisé pour construire l'URL API météo

4. **Manque de templates pour cas courants**
   - Météo, prix, disponibilité tickets, etc.

## 🧠 Architecture Proposée : Intent Understanding Layer

### 1. Nouveau Service : `TaskIntentAnalyzer`

```typescript
// backend/services/task-intent-analyzer.ts

interface TaskIntent {
  // Type de tâche déduit
  taskType: "monitoring" | "reminder" | "recurring_action" | "one_time";

  // Paramètres temporels extraits
  temporal: {
    startDate?: Date; // Quand commencer
    endDate?: Date; // Quand terminer (expiresAt)
    frequency?: string; // 'hourly', 'every_30_min', etc.
    isRecurring: boolean;
  };

  // Conditions de notification
  notification: {
    triggerOn: "always" | "change" | "threshold" | "pattern";
    onlyOnChange: boolean; // dedupe.notifyOn = 'crossing'
    threshold?: {
      operator: "lt" | "gt" | "eq" | "contains";
      value: any;
    };
  };

  // Entités extraites
  entities: {
    location?: string;
    subject?: string; // "météo", "prix", "disponibilité"
    target?: string; // URL ou ressource cible
  };

  // Confiance dans l'analyse
  confidence: number; // 0-1

  // Ce qui nécessite clarification
  needsClarification: string[];
}
```

### 2. Patterns Linguistiques à Détecter

```typescript
const TEMPORAL_PATTERNS = {
  // Fin implicite
  "ce weekend": () => getNextWeekendEnd(),
  "cette semaine": () => getEndOfWeek(),
  "jusqu'à demain": () => addDays(new Date(), 1),
  "pour les prochains jours": () => addDays(new Date(), 3),

  // Fréquence implicite
  régulièrement: { interval: 60 }, // toutes les heures
  "keep me posted": { interval: 120 }, // toutes les 2h
  surveille: { interval: 30 }, // toutes les 30min
};

const CHANGE_INDICATORS = [
  "si ça change",
  "if it changes",
  "let me know if",
  "préviens-moi si",
  "alert me when",
  "notify if different",
  "en cas de changement",
];

const MONITORING_SUBJECTS = {
  weather: {
    keywords: ["météo", "weather", "temps", "pluie", "soleil", "température"],
    defaultApiTemplate:
      "https://api.openweathermap.org/data/2.5/weather?q={{location}}&appid={{API_KEY}}",
    defaultInterval: 120, // 2 heures
    defaultConditionPath: "weather.0.main",
  },
  price: {
    keywords: ["prix", "price", "coût", "tarif"],
    defaultInterval: 60,
    notifyOn: "crossing", // prix qui passe un seuil
  },
  availability: {
    keywords: ["disponible", "available", "stock", "places", "tickets"],
    defaultInterval: 30,
    notifyOn: "crossing", // dès que disponible
  },
};
```

### 3. Amélioration du System Prompt

Ajouter au `CHAT_SYSTEM_PROMPT` dans `chat-context.ts` :

```typescript
const ENHANCED_TASK_INSTRUCTIONS = `
🧠 INTELLIGENT TASK UNDERSTANDING:

When the user asks for monitoring/alerts, ANALYZE their implicit intent:

1. **TEMPORAL ANALYSIS**:
   - "ce weekend" → expiresAt = end of Sunday
   - "cette semaine" → expiresAt = end of week
   - "jusqu'à mon voyage" → ask for specific date if not in memory
   - "régulièrement" → INTERVAL with reasonable frequency

2. **CHANGE DETECTION PHRASES** (set dedupe.notifyOn = "crossing"):
   - "let me know if it changes"
   - "préviens-moi si ça change"
   - "alert me when different"
   - "notify only on change"

3. **AUTOMATIC EXPIRATION INFERENCE**:
   - Event-based requests ALWAYS need expiresAt
   - "pour le concert de vendredi" → expires after Friday
   - "for my trip next week" → expires after trip end

4. **MONITORING FREQUENCY DEFAULTS**:
   - Weather: every 2 hours (interval: 120)
   - Prices: every hour (interval: 60)
   - Availability/Tickets: every 30 min (interval: 30)
   - News/Updates: every 4 hours (interval: 240)

5. **WHEN CREATING WATCH_RESOURCE TASKS**:
   Always consider:
   - Is this time-bounded? → Set expiresAt
   - Does user want change alerts? → Set dedupe.notifyOn = "crossing"
   - What's the reasonable check frequency?
   - Store previous value to detect changes

EXAMPLE TRANSFORMATION:
User: "Let me know if the weather changes for Ax-les-thermes pour ce weekend"

Your analysis:
- Location: Ax-les-Thermes (extract for API)
- Subject: weather monitoring
- Change detection: "if changes" → notifyOn: crossing
- Expiration: "ce weekend" → Sunday 23:59
- Frequency: weather → every 2 hours

Creates:
{
  "action": "create",
  "name": "Météo Ax-les-Thermes",
  "scheduleType": "INTERVAL",
  "interval": 120,
  "expiresAt": "2026-02-01T23:59:59Z",  // Sunday end
  "actionType": "WATCH_RESOURCE",
  "actionPayload": {
    "fetch": {
      "url": "https://api.openweathermap.org/data/2.5/weather?q=Ax-les-Thermes,FR&appid={{OPENWEATHER_API_KEY}}"
    },
    "condition": {
      "type": "json",
      "path": "weather.0.main",
      "op": "neq",
      "value": "{{PREVIOUS_VALUE}}"
    },
    "notify": {
      "title": "🌤️ Changement météo Ax-les-Thermes",
      "messageTemplate": "Nouvelle condition: {{value}}"
    },
    "dedupe": {
      "notifyOn": "crossing"
    }
  }
}
`;
```

### 4. Nouveau Pre-processor : `IntentPreProcessor`

Ce service analyse le message AVANT de l'envoyer au LLM pour enrichir le contexte :

```typescript
// backend/services/intent-preprocessor.ts

export class IntentPreProcessor {
  /**
   * Analyse un message utilisateur et extrait les intentions implicites
   */
  async analyzeIntent(
    message: string,
    userContext: any,
  ): Promise<IntentAnalysis> {
    const analysis: IntentAnalysis = {
      originalMessage: message,
      extractedEntities: {},
      temporalInfo: {},
      suggestedTaskParams: {},
      confidenceScore: 0,
    };

    // 1. Détecter si c'est une demande de monitoring
    if (this.isMonitoringRequest(message)) {
      analysis.taskType = "monitoring";

      // 2. Extraire la localisation
      analysis.extractedEntities.location = this.extractLocation(message);

      // 3. Extraire les infos temporelles
      analysis.temporalInfo = this.extractTemporalInfo(message);

      // 4. Détecter si notification sur changement
      analysis.notifyOnChange = this.detectChangeIntent(message);

      // 5. Identifier le sujet (météo, prix, etc.)
      analysis.subject = this.identifySubject(message);

      // 6. Construire les paramètres suggérés
      analysis.suggestedTaskParams = this.buildSuggestedParams(analysis);
    }

    return analysis;
  }

  private isMonitoringRequest(message: string): boolean {
    const monitoringPatterns = [
      /let me know|préviens[- ]?moi|alert|notify|surveille|watch|monitor/i,
      /if.*(change|different|available|drops|increases)/i,
      /keep.*(posted|updated|informed)/i,
    ];
    return monitoringPatterns.some((p) => p.test(message));
  }

  private extractTemporalInfo(message: string): TemporalInfo {
    const now = new Date();

    // Patterns de fin
    if (/ce\s+week[- ]?end|this\s+weekend/i.test(message)) {
      return {
        expiresAt: this.getNextSundayEnd(),
        inferred: true,
        reason: "Weekend detected",
      };
    }

    if (/cette\s+semaine|this\s+week/i.test(message)) {
      return {
        expiresAt: this.getEndOfWeek(),
        inferred: true,
        reason: "This week detected",
      };
    }

    if (/jusqu'?à\s+demain|until\s+tomorrow/i.test(message)) {
      return {
        expiresAt: addDays(now, 1),
        inferred: true,
        reason: "Tomorrow detected",
      };
    }

    // Pattern: "pour le/la [date/event]"
    const eventMatch = message.match(/pour\s+(le|la|l'|mon|ma)\s+(\w+)/i);
    if (eventMatch) {
      return {
        needsDateClarification: true,
        eventName: eventMatch[2],
        reason: `Event "${eventMatch[2]}" needs specific end date`,
      };
    }

    return {};
  }

  private detectChangeIntent(message: string): boolean {
    const changePatterns = [
      /if.*(change|changes|changed)/i,
      /si\s+(ça|cela)\s+change/i,
      /when.*(different|varies)/i,
      /en\s+cas\s+de\s+changement/i,
      /only\s+(if|when).*(new|different)/i,
    ];
    return changePatterns.some((p) => p.test(message));
  }

  private identifySubject(message: string): MonitoringSubject {
    for (const [subject, config] of Object.entries(MONITORING_SUBJECTS)) {
      if (config.keywords.some((kw) => message.toLowerCase().includes(kw))) {
        return { type: subject, ...config };
      }
    }
    return { type: "generic" };
  }
}
```

### 5. Intégration dans le Flow de Chat

```typescript
// Dans chat.controller.ts ou chat-service.ts

async processMessage(userId: string, message: string) {
  // 1. Pré-analyse de l'intention
  const intentAnalysis = await intentPreProcessor.analyzeIntent(message, userContext);

  // 2. Si monitoring détecté, enrichir le contexte pour le LLM
  let enrichedContext = baseContext;
  if (intentAnalysis.taskType === 'monitoring') {
    enrichedContext += `

📊 INTENT ANALYSIS (detected monitoring request):
- Subject: ${intentAnalysis.subject?.type || 'unknown'}
- Location: ${intentAnalysis.extractedEntities.location || 'not specified'}
- Notify on change: ${intentAnalysis.notifyOnChange}
- Suggested expiration: ${intentAnalysis.temporalInfo.expiresAt || 'not determined'}
- Suggested interval: ${intentAnalysis.subject?.defaultInterval || 60} minutes

Use these inferred parameters when creating the scheduled task.
If expiration date unclear, ASK the user for clarification.
`;
  }

  // 3. Envoyer au LLM avec contexte enrichi
  const response = await llmService.chat(enrichedContext, message);

  return response;
}
```

## 🎯 Priorités d'Implémentation

### Phase 1 : Amélioration du Prompt (Quick Win)

1. Enrichir `CHAT_SYSTEM_PROMPT` avec les instructions détaillées
2. Ajouter des exemples de transformation dans le guide
3. Tester avec des cas courants

### Phase 2 : Intent Pre-Processor

1. Créer le service `IntentPreProcessor`
2. Implémenter extraction temporelle
3. Implémenter détection de "changement"
4. Intégrer dans le flow de chat

### Phase 3 : Templates de Monitoring

1. Créer des templates pour météo, prix, disponibilité
2. Auto-configurer les URLs API basées sur le contexte
3. Gérer les clés API automatiquement

### Phase 4 : Clarification Intelligente

1. Quand l'intention est ambiguë, poser des questions ciblées
2. Proposer des options plutôt que des questions ouvertes
3. Mémoriser les préférences utilisateur

## 📝 Exemples de Transformations

| Input Utilisateur                                                               | Analyse                                                                 | Tâche Créée                                                       |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| "Let me know if the weather changes for Ax-les-thermes pour ce weekend"         | location=Ax-les-Thermes, subject=weather, onChange=true, expires=Sunday | INTERVAL 2h, WATCH_RESOURCE, expiresAt=dim 23:59, dedupe=crossing |
| "Surveille le prix des billets de train Paris-Lyon jusqu'à mon voyage vendredi" | subject=price, expires=Friday, onChange=true                            | INTERVAL 30min, WATCH_RESOURCE, expiresAt=vendredi                |
| "Préviens-moi si des places se libèrent pour le concert"                        | subject=availability, onChange=true, expires=?                          | Demander: "Quand est le concert?"                                 |
| "Check the news about AI every day"                                             | subject=news, recurring=daily, onChange=false                           | CRON "0 9 \* \* \*", no expiration                                |

## 🔧 Fichiers Modifiés/Créés

### Nouveaux fichiers

1. ✅ `backend/services/task-intent-analyzer.ts` - Service d'analyse d'intention avec :
   - Détection des requêtes de monitoring
   - Extraction de localisation
   - Extraction d'informations temporelles
   - Détection d'intention de changement
   - Génération de clarifications intelligentes
   - Paramètres suggérés pour la création de tâches

2. ✅ `backend/services/__tests__/task-intent-analyzer.test.ts` - Tests unitaires complets

### Fichiers modifiés

3. ✅ `backend/services/chat-context.ts` :
   - Import du TaskIntentAnalyzer
   - Nouvelles fonctions : `analyzeTaskIntent()`, `buildSystemPromptWithIntent()`, `getSmartClarification()`
   - Instructions enrichies dans le CHAT_SYSTEM_PROMPT

4. ✅ `backend/controllers/chat.controller.ts` :
   - Intégration de l'analyse d'intention dans le flux de chat
   - Tracking de l'analyse via flowTracker

5. ✅ `backend/services/telegram-chat.ts` :
   - Intégration de l'analyse d'intention pour Telegram

## ✅ Critères de Succès

1. L'utilisateur peut créer une tâche de monitoring en langage naturel
2. Les dates d'expiration sont correctement inférées
3. Les notifications "sur changement" sont automatiquement configurées
4. L'IA demande des clarifications uniquement quand nécessaire
5. Les fréquences de vérification sont raisonnables par défaut

---

**Date**: 28 janvier 2026
**Status**: Analyse complète - Prêt pour implémentation
