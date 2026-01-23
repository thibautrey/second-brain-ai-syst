# FAQ - Gestion des Tâches par l'IA

## Questions fréquentes

### Q: L'IA peut-elle vraiment supprimer des tâches ?

**R:** Oui, l'IA a accès à l'action `delete` pour les todos. Elle peut :

- Lister les tâches
- Identifier la tâche à supprimer
- Appeler `action: "delete"` avec l'ID correct

Par exemple :

```
Utilisateur: "Supprime la tâche 'Appeler le client'"
L'IA: Liste les tâches → trouve l'ID → appelle delete
```

### Q: Comment l'IA modifie-t-elle une tâche existante ?

**R:** Avec l'action `update`. L'IA :

1. Récupère ou liste les tâches pour trouver l'ID
2. Appelle `action: "update"` avec le `todoId` et les champs à modifier

Exemple :

```json
{
  "action": "update",
  "todoId": "abc123",
  "priority": "URGENT",
  "dueDate": "2026-01-24T10:00:00Z"
}
```

Seuls les champs fournis sont modifiés - les autres restent inchangés.

### Q: Peut-on vraiment planifier des tâches automatiques ?

**R:** Oui ! L'IA peut créer des tâches planifiées qui s'exécutent automatiquement :

**Exemple 1 - Rappel ponctuel :**

```
Utilisateur: "Rappelle-moi à 15h"
→ Tâche ONE_TIME qui envoie une notification à 15h
```

**Exemple 2 - Tâche récurrente :**

```
Utilisateur: "Envoie-moi un résumé chaque lundi à 9h"
→ Tâche CRON (0 9 * * MON) qui génère un résumé
```

**Exemple 3 - Vérification régulière :**

```
Utilisateur: "Vérifie mes emails toutes les 30 min"
→ Tâche INTERVAL (30 minutes) qui envoie un rappel
```

### Q: Qu'arrive-t-il si l'IA supprime une tâche importante ?

**R:**

- Idealement l'IA demande confirmation
- Le système permet de récupérer les tâches via le contrôleur tools
- Les tâches sont traçables via les logs d'audit

### Q: Comment l'IA sait-elle quelle tâche modifier ?

**R:** Par le contexte de la conversation. L'IA :

1. Écoute l'utilisateur : "Change la priorité de ma tâche sur la réunion"
2. Liste les tâches existantes
3. Trouve celle qui correspond ("réunion")
4. Récupère l'ID
5. Appelle update avec les modifications

### Q: Peut-on annuler une suppression de tâche ?

**R:** Non, la suppression est permanente. Mais :

- Les tâches terminées peuvent être marquées CANCELLED au lieu d'être supprimées
- Les tâches planifiées peuvent être DISABLEd au lieu d'être supprimées

### Q: L'IA peut-elle modifier les tâches planifiées après les avoir créées ?

**R:** Oui ! Cas d'usage :

```
Utilisateur: "Change le rappel quotidien de 9h à 10h"
L'IA:
  1. Liste les tâches planifiées
  2. Trouve celle du "rappel quotidien"
  3. Appelle update avec cronExpression: "0 10 * * *"
```

### Q: Comment créer une tâche planifiée pour créer un todo automatiquement ?

**R:** Avec `actionType: "CREATE_TODO"` :

```json
{
  "action": "create",
  "name": "Créer tâche quotidienne",
  "scheduleType": "CRON",
  "cronExpression": "0 8 * * *",
  "actionType": "CREATE_TODO",
  "actionPayload": {
    "title": "Daily standup",
    "priority": "HIGH",
    "category": "work"
  }
}
```

### Q: L'IA peut-elle exécuter une tâche planifiée immédiatement ?

**R:** Oui, avec `execute_now` :

```json
{
  "action": "execute_now",
  "taskId": "task-123"
}
```

Utile pour tester ou exécuter avant la prochaine exécution planifiée.

### Q: Quels sont les limites de taux ?

**R:**

- **Todos** : 100 requêtes/minute
- **Scheduled tasks** : 20 requêtes/minute

L'IA respecte ces limites automatiquement.

### Q: Comment les tags et catégories aident-ils à organiser ?

**R:** L'IA peut filtrer par :

```json
{
  "action": "list",
  "category": "work",
  "tags": ["urgent"]
}
```

Ou récupérer les valeurs existantes :

```json
{
  "action": "categories"
}
{
  "action": "tags"
}
```

### Q: Peut-on créer des tâches avec récurrence intégrée ?

**R:** Oui, pour les todos :

```json
{
  "action": "create",
  "title": "Appeler maman",
  "isRecurring": true,
  "recurrenceRule": "FREQ=WEEKLY;BYDAY=SUN",
  "priority": "MEDIUM"
}
```

Quand une tâche récurrente est marquée COMPLETED, une nouvelle est automatiquement créée selon la règle.

### Q: Comment l'IA obtient des statistiques ?

**R:** Avec `action: "stats"` :

```json
{
  "action": "stats"
}
```

Retourne : total, par priorité, par statut, par catégorie, etc.

### Q: Les tâches planifiées consomment-elles des ressources ?

**R:** Très peu ! Les tâches planifiées :

- S'exécutent selon le schedule défini
- Utilisent des cron jobs en arrière-plan
- Ne consomment des ressources que lors de l'exécution

---

## Exemples de scénarios complets

### Scénario 1 : Workflow de productivité quotidien

```
Utilisateur: "Crée une routine matinale"

L'IA créerait :
1. Une tâche planifiée CRON (0 7 * * *)
   → Action: CREATE_TODO avec {title: "Standup", priority: "HIGH"}

2. Une seconde tâche CRON (0 8 * * *)
   → Action: SEND_NOTIFICATION {title: "Check emails"}

3. Une tâche INTERVAL (60 minutes) lors du travail
   → Action: SEND_NOTIFICATION {message: "Break time?"}
```

### Scénario 2 : Gestion dynamique de la charge

```
Utilisateur: "J'ai trop de tâches, quelle est l'urgence ?"

L'IA:
1. Appelle stats → obtient le nombre par priorité
2. Appelle list avec status: IN_PROGRESS
3. Recommande de DISABLE les tâches CRON moins importantes
4. Ou COMPLETE les tâches rapides
```

### Scénario 3 : Modification intelligent de priorités

```
Utilisateur: "Cette réunion est dans 2 jours, augmente la priorité"

L'IA:
1. List les tâches avec search: "réunion"
2. Trouve l'ID de la réunion
3. Update avec priority: "URGENT"
4. Optionnel: Crée une notification 1 jour avant
```

### Scénario 4 : Archivage automatique

```
Utilisateur: "Archive les tâches de plus de 3 mois terminées"

L'IA:
1. List avec status: COMPLETED, dueBefore: "date 3 mois ago"
2. Pour chaque tâche: update avec status: "CANCELLED"
   (ou supprimer directement avec delete)
```

---

## Conseils d'utilisation

### ✅ À FAIRE

- **Lister d'abord** : Toujours lister avant de modifier/supprimer
- **Confirmer** : Demander confirmation avant suppression importante
- **Utiliser les filtres** : Rechercher efficacement par titre, catégorie, tags
- **Planifier à l'avance** : Créer des tâches planifiées pour les routines
- **Archiver régulièrement** : Supprimer ou compléter les tâches anciennes

### ❌ À ÉVITER

- **Modifier sans vérifier** : Ne pas update sans être certain de l'ID
- **Supprimer sans confirmation** : Toujours demander l'OK de l'utilisateur
- **Créer trop de tâches** : Privilégier les tâches planifiées aux tâches ponctuelles
- **Oublier les métadonnées** : Utiliser catégories/tags pour organiser
- **Ignorer les limites de taux** : Respecter les quotas (100 todos/min, 20 scheduled/min)

---

**Document créé** : 23 janvier 2026
**Statut** : Documentation complète des capacités de gestion des tâches par l'IA
