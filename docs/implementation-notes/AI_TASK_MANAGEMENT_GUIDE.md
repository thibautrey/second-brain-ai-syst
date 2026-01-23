# Guide de Gestion des Tâches par l'IA

## 📋 Vue d'ensemble

L'IA a **accès complet** pour gérer les todos et les tâches planifiées :

- ✅ **Créer** de nouvelles tâches
- ✅ **Lister** les tâches existantes
- ✅ **Modifier** les tâches (titre, priorité, date limite, etc.)
- ✅ **Supprimer** les tâches
- ✅ **Planifier** des tâches pour plus tard

---

## 1️⃣ Gestion des Todos

### Actions disponibles pour les todos

```
create      - Créer une nouvelle tâche
get         - Récupérer une tâche par ID
list        - Lister les tâches avec filtres
update      - Modifier une tâche existante
complete    - Marquer une tâche comme terminée
delete      - Supprimer une tâche
stats       - Obtenir des statistiques (total, par priorité, etc.)
overdue     - Lister les tâches en retard
due_soon    - Lister les tâches à court terme
categories  - Lister les catégories utilisées
tags        - Lister les tags existants
```

### Exemple 1 : Créer une tâche

**L'IA utilise cet appel :**

```json
{
  "action": "create",
  "title": "Appeler le client",
  "description": "Appel de suivi pour le projet X",
  "priority": "HIGH",
  "category": "work",
  "tags": ["client", "urgent"],
  "dueDate": "2026-01-25T14:00:00Z"
}
```

### Exemple 2 : Modifier une tâche existante

**L'IA liste d'abord :**

```json
{
  "action": "list",
  "search": "appeler le client"
}
```

**Puis modifie la tâche :**

```json
{
  "action": "update",
  "todoId": "task-id-123",
  "priority": "URGENT",
  "dueDate": "2026-01-24T10:00:00Z"
}
```

### Exemple 3 : Supprimer une tâche

```json
{
  "action": "delete",
  "todoId": "task-id-123"
}
```

### Exemple 4 : Marquer comme terminée

```json
{
  "action": "complete",
  "todoId": "task-id-123"
}
```

### Champs modifiables dans une tâche

| Champ         | Type     | Description                                |
| ------------- | -------- | ------------------------------------------ |
| `title`       | string   | Titre de la tâche                          |
| `description` | string   | Description détaillée                      |
| `priority`    | enum     | LOW, MEDIUM, HIGH, URGENT                  |
| `status`      | enum     | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| `category`    | string   | Catégorie pour organiser                   |
| `tags`        | array    | Liste de tags                              |
| `dueDate`     | ISO date | Date limite                                |

---

## 2️⃣ Gestion des Tâches Planifiées (Scheduled Tasks)

### Actions disponibles

```
create      - Créer une nouvelle tâche planifiée
get         - Récupérer une tâche par ID
list        - Lister toutes les tâches planifiées
update      - Modifier une tâche existante
enable      - Activer une tâche désactivée
disable     - Désactiver temporairement
delete      - Supprimer une tâche
execute_now - Exécuter immédiatement
history     - Voir l'historique d'exécution
```

### Types de planification

#### 1. **ONE_TIME** - Exécution unique

```json
{
  "action": "create",
  "name": "Rappel réunion",
  "scheduleType": "ONE_TIME",
  "executeAt": "2026-01-24T15:00:00Z",
  "actionType": "SEND_NOTIFICATION",
  "actionPayload": {
    "title": "Réunion dans 15 minutes",
    "message": "N'oublie pas ta réunion avec l'équipe"
  }
}
```

#### 2. **CRON** - Exécution récurrente

```json
{
  "action": "create",
  "name": "Rapport quotidien",
  "scheduleType": "CRON",
  "cronExpression": "0 9 * * *",
  "actionType": "GENERATE_SUMMARY",
  "actionPayload": {
    "summaryType": "daily",
    "includeStats": true
  }
}
```

**Expressions cron courantes :**

```
0 9 * * *        → Chaque jour à 9h
0 9 * * MON      → Lundi à 9h
*/30 * * * *     → Toutes les 30 minutes
0 0 * * *        → Minuit chaque jour
0 9 * * 1-5      → Lun-Ven à 9h
```

#### 3. **INTERVAL** - Intervalle régulier

```json
{
  "action": "create",
  "name": "Vérifier les mails",
  "scheduleType": "INTERVAL",
  "interval": 30,
  "actionType": "SEND_NOTIFICATION",
  "actionPayload": {
    "title": "Rappel de vérifier les mails",
    "message": "Vous avez potentiellement de nouveaux messages"
  }
}
```

### Exemple : Modifier une tâche planifiée

```json
{
  "action": "update",
  "taskId": "scheduled-task-123",
  "cronExpression": "0 10 * * *",
  "actionPayload": {
    "summaryType": "weekly"
  }
}
```

### Exemple : Désactiver temporairement

```json
{
  "action": "disable",
  "taskId": "scheduled-task-123"
}
```

### Exemple : Supprimer

```json
{
  "action": "delete",
  "taskId": "scheduled-task-123"
}
```

---

## 🎯 Cas d'usage courants

### Cas 1 : L'utilisateur dit "Rappelle-moi dans une heure"

L'IA va :

1. Calculer l'heure (+1h)
2. Créer une tâche planifiée ONE_TIME
3. Action : SEND_NOTIFICATION

```json
{
  "action": "create",
  "name": "Rappel utilisateur",
  "scheduleType": "ONE_TIME",
  "executeAt": "2026-01-23T15:30:00Z",
  "actionType": "SEND_NOTIFICATION",
  "actionPayload": {
    "title": "Rappel",
    "message": "[message spécifique de l'utilisateur]"
  }
}
```

### Cas 2 : L'utilisateur dit "Supprime cette tâche"

L'IA va :

1. Lister les tâches récentes ou en contexte
2. Identifier la bonne tâche
3. Appeler delete avec le bon ID

```json
{
  "action": "delete",
  "todoId": "identified-todo-id"
}
```

### Cas 3 : L'utilisateur dit "Envoie-moi un rapport chaque lundi"

L'IA va :

1. Créer une tâche planifiée CRON
2. Expression cron : `0 9 * * MON` (ou une autre heure)
3. Action : GENERATE_SUMMARY

```json
{
  "action": "create",
  "name": "Rapport hebdomadaire",
  "scheduleType": "CRON",
  "cronExpression": "0 9 * * MON",
  "actionType": "GENERATE_SUMMARY",
  "actionPayload": {
    "summaryType": "weekly",
    "detailed": true
  }
}
```

### Cas 4 : "Augmente la priorité de ma tâche importante"

L'IA va :

1. Chercher la tâche dans la liste
2. Mettre à jour avec update

```json
{
  "action": "update",
  "todoId": "task-id",
  "priority": "URGENT"
}
```

---

## 🔍 Flux de travail recommandé

### Pour créer une tâche :

```
1. Utiliser "create" directement
2. Spécifier tous les champs pertinents
```

### Pour modifier une tâche :

```
1. D'abord "list" pour trouver la tâche (par titre, recherche, filtres)
2. Obtenir l'ID
3. Puis "update" avec les nouveaux paramètres
```

### Pour supprimer une tâche :

```
1. Confirmer avec l'utilisateur si possible
2. Utiliser "delete" avec l'ID correct
```

### Pour planifier quelque chose :

```
1. Déterminer le type de planification (ONE_TIME, CRON, INTERVAL)
2. Créer la tâche avec "create"
3. Spécifier l'action à exécuter (notification, todo, etc.)
```

---

## ⚙️ Actions disponibles pour les tâches planifiées

Quand une tâche planifiée s'exécute, elle peut faire :

| Action              | Description                   | Exemple payload               |
| ------------------- | ----------------------------- | ----------------------------- |
| `SEND_NOTIFICATION` | Envoyer une notification      | `{title, message, type}`      |
| `CREATE_TODO`       | Créer automatiquement un todo | `{title, priority, category}` |
| `GENERATE_SUMMARY`  | Générer un résumé             | `{summaryType: daily/weekly}` |
| `RUN_AGENT`         | Exécuter un agent             | `{agentName, context}`        |
| `WEBHOOK`           | Appeler une URL externe       | `{url, method, headers}`      |
| `CUSTOM`            | Action personnalisée          | `{...custom}`                 |

---

## 📝 Notes importantes

### Authentification

- Toutes les opérations sont authentifiées via `userId`
- L'IA ne peut accéder qu'aux tâches de l'utilisateur courant

### Limites

- **Todos** : Limite de taux = 100 req/min
- **Scheduled tasks** : Limite de taux = 20 req/min

### Bonnes pratiques

1. **Toujours lister d'abord** avant de modifier/supprimer
2. **Confirmer avec l'utilisateur** avant suppression
3. **Utiliser des catégories/tags** pour mieux organiser
4. **Mettre à jour plutôt que créer** si une tâche similaire existe
5. **Utiliser CRON** plutôt que INTERVAL pour les tâches régulières

---

## 🔗 Schémas mis à jour

Les schémas LLM ont été améliorés pour mieux documenter les capacités :

- `todo` : Clarifications sur UPDATE et DELETE
- `scheduled_task` : Clarifications sur la modification, désactivation et suppression

Cela aide l'IA à mieux comprendre ses capacités sans avoir à demander confirmation.

---

**Dernière mise à jour** : 23 janvier 2026
