# Système de Notifications

Le système de notifications du Second Brain AI est maintenant complètement implémenté avec support des notifications du navigateur, WebSocket temps réel, et Service Worker pour les notifications hors ligne.

## ✨ Fonctionnalités

- ✅ **Notifications en temps réel** via WebSocket
- ✅ **Notifications du navigateur** avec l'API Notifications
- ✅ **Service Worker** pour notifications hors ligne
- ✅ **Persistance en base de données** (PostgreSQL)
- ✅ **Canaux multiples** : IN_APP, PUSH, EMAIL, WEBHOOK, **PUSHOVER**
- ✅ **Types de notifications** : INFO, SUCCESS, WARNING, ERROR, REMINDER, ACHIEVEMENT
- ✅ **Notifications programmées** (pour le futur)
- ✅ **API REST** pour que l'IA puisse envoyer des notifications
- ✅ **Intégration Pushover** pour notifications mobiles multi-plateformes
- ✅ **Routage automatique** : Quand Pushover est configuré, les notifications sont automatiquement envoyées via Pushover au lieu du navigateur (transparent pour l'IA)

## 🚀 Démarrage rapide

### 1. Accéder à la page de test

Allez sur : `http://localhost:5173/notifications`

### 2. Activer les permissions

1. Cliquez sur "Activer les notifications"
2. Acceptez la demande de permission du navigateur
3. Vérifiez que la connexion WebSocket est active (indicateur vert)

### 3. Tester une notification

1. Remplissez le formulaire de test
2. Cliquez sur "Envoyer la notification"
3. Vous devriez recevoir une notification du navigateur

## 📡 API pour l'IA

L'IA peut envoyer des notifications en utilisant l'endpoint suivant :

### POST `/api/notifications`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "title": "Titre de la notification",
  "message": "Contenu du message",
  "type": "INFO",
  "channels": ["IN_APP", "PUSH"],
  "actionUrl": "/dashboard",
  "metadata": {
    "custom": "data"
  }
}
```

**Paramètres:**

- `title` (string, requis) : Titre de la notification
- `message` (string, requis) : Contenu du message
- `type` (string, optionnel) : Type de notification (INFO, SUCCESS, WARNING, ERROR, REMINDER, ACHIEVEMENT)
- `channels` (array, optionnel) : Canaux de diffusion (IN_APP, PUSH, EMAIL, WEBHOOK, PUSHOVER)
- `scheduledFor` (datetime, optionnel) : Date/heure pour notification programmée
- `sourceType` (string, optionnel) : Type de source (todo, memory, agent, etc.)
- `sourceId` (string, optionnel) : ID de la source
- `actionUrl` (string, optionnel) : URL de redirection au clic
- `actionLabel` (string, optionnel) : Libellé du bouton d'action
- `metadata` (object, optionnel) : Données personnalisées

**Réponse:**

```json
{
  "success": true,
  "notification": {
    "id": "clxx...",
    "userId": "user123",
    "title": "Titre de la notification",
    "message": "Contenu du message",
    "type": "INFO",
    "channels": ["IN_APP", "PUSH"],
    "isRead": false,
    "createdAt": "2026-01-23T10:30:00Z"
  }
}
```

## 🔧 Autres endpoints

### GET `/api/notifications`

Liste les notifications de l'utilisateur

**Query params:**

- `limit` (number, défaut: 50) : Nombre de résultats
- `offset` (number, défaut: 0) : Pagination
- `unreadOnly` (boolean, défaut: false) : Filtrer les non lues uniquement

### PATCH `/api/notifications/:id/read`

Marquer une notification comme lue

## 🔔 Configuration Pushover

Le système supporte maintenant [Pushover](https://pushover.net) pour envoyer des notifications sur vos appareils mobiles (iOS, Android) et desktop.

### Configuration

1. **Créer un compte Pushover**
   - Allez sur [pushover.net](https://pushover.net)
   - Créez un compte gratuit
   - Installez l'application mobile Pushover

2. **Obtenir votre User Key**
   - Connectez-vous au tableau de bord Pushover
   - Votre User Key est affichée en haut de la page (30 caractères)

3. **Configurer dans Second Brain**
   - Allez dans **Paramètres > Notifications**
   - Entrez votre **Pushover User Key**
   - (Optionnel) Entrez un **API Token personnalisé** si vous avez créé une application Pushover
   - Cliquez sur **Enregistrer**
   - Testez la configuration avec le bouton **Tester**

### Utilisation avec l'IA

**Routage automatique des notifications** 🎯

Lorsque Pushover est configuré pour un utilisateur, le système **route automatiquement** les notifications vers Pushover au lieu du navigateur. Ce comportement est **transparent pour l'IA** - l'IA envoie simplement les paramètres de notification, et le système décide du canal optimal.

**Comportement automatique :**
- Si `pushoverUserKey` est configuré, le système :
  1. Remplace automatiquement `PUSH` par `PUSHOVER` pour de meilleures notifications mobiles
  2. Ajoute automatiquement `PUSHOVER` aux canaux si non présent
  3. Préserve les autres canaux comme `IN_APP`, `EMAIL`, etc.

**Exemple - L'IA envoie simplement :**
```typescript
await notificationService.createNotification({
  userId: "user123",
  title: "Alerte importante",
  message: "Une action est requise",
  type: "WARNING",
  // Aucun canal spécifié - le système utilise IN_APP par défaut
});
// Résultat si Pushover est configuré : ["IN_APP", "PUSHOVER"]
// Résultat si Pushover n'est pas configuré : ["IN_APP"]
```

**Exemple avec canaux explicites :**
```typescript
await notificationService.createNotification({
  userId: "user123",
  title: "Alerte importante",
  message: "Une action est requise",
  type: "WARNING",
  channels: ["IN_APP", "PUSH"], // L'IA demande PUSH
});
// Résultat si Pushover est configuré : ["IN_APP", "PUSHOVER"] (PUSH → PUSHOVER)
// Résultat si Pushover n'est pas configuré : ["IN_APP", "PUSH"]
```

**Avantages :**
- ✅ Transparent pour l'IA - pas besoin de vérifier la configuration
- ✅ Meilleure expérience utilisateur - notifications mobiles fiables
- ✅ Backward compatible - fonctionne avec ou sans Pushover
- ✅ Flexible - l'IA peut toujours spécifier des canaux si nécessaire

### Priorités et sons

Le système configure automatiquement la priorité et le son en fonction du type de notification :

- **ERROR** : Priorité haute (1), son "siren"
- **WARNING** : Priorité normale (0), son "pushover"
- **SUCCESS** : Priorité basse (-1), son "magic"
- **Autres** : Priorité normale (0), son par défaut

### Configuration avancée

Variables d'environnement (backend) :
- `PUSHOVER_APP_TOKEN` : Token API par défaut pour l'application (optionnel)

Si vous ne spécifiez pas de token API personnalisé dans les paramètres utilisateur, le système utilisera `PUSHOVER_APP_TOKEN` s'il est défini.

### Endpoints API

**GET `/api/settings/notifications`**
Récupère les paramètres de notification incluant la configuration Pushover

**PUT `/api/settings/notifications`**
Met à jour les paramètres de notification

```json
{
  "pushoverUserKey": "votre-user-key-30-caracteres",
  "pushoverApiToken": "votre-api-token-optionnel"
}
```

**POST `/api/settings/notifications/test-pushover`**
Envoie une notification de test via Pushover pour vérifier la configuration

## 🛠️ Architecture

### Frontend

- **Service Worker** : `frontend/public/service-worker.js`
  - Gère les notifications push
  - Cache les assets pour l'offline
  - Intercepte les clics sur les notifications

- **WebSocket Client** : `frontend/services/notification-client.ts`
  - Connexion WebSocket avec reconnexion automatique
  - Gestion des callbacks de notifications
  - Affichage des notifications du navigateur

- **Hook React** : `frontend/hooks/useNotificationListener.ts`
  - Enregistre le Service Worker
  - Connecte au WebSocket
  - Demande les permissions
  - Gère les callbacks

- **Composant UI** : `frontend/components/NotificationSettings.tsx`
  - Affiche l'état de la connexion
  - Bouton pour activer les permissions
  - Indicateurs visuels

### Backend

- **Service** : `backend/services/notification.ts`
  - Crée et envoie les notifications
  - Gère les canaux multiples (IN_APP, PUSH, EMAIL, WEBHOOK, PUSHOVER)
  - Traite les notifications programmées
  - Intégration Pushover avec gestion des priorités et sons

- **Controller** : `backend/controllers/notification.controller.ts`
  - Endpoints REST
  - Validation des données
  - Gestion des erreurs

- **WebSocket Broadcast** : `backend/services/websocket-broadcast.ts`
  - Diffusion temps réel via WebSocket
  - Méthode `sendNotification(userId, notification)`

- **Base de données** : Modèle `Notification` dans Prisma
  - Persistance des notifications
  - Historique des lectures
  - Métadonnées personnalisées

## 📋 Exemples d'utilisation par l'IA

### Notification simple

```typescript
await notificationService.createNotification({
  userId: "user123",
  title: "Tâche terminée",
  message: "Votre analyse quotidienne est prête",
  type: "SUCCESS",
});
```

### Notification avec action

```typescript
await notificationService.createNotification({
  userId: "user123",
  title: "Nouveau résumé disponible",
  message: "Votre résumé hebdomadaire a été généré",
  type: "INFO",
  actionUrl: "/dashboard/summaries",
  actionLabel: "Voir le résumé",
  sourceType: "summary",
  sourceId: "summary-id-123",
});
```

### Notification programmée

```typescript
await notificationService.createNotification({
  userId: "user123",
  title: "Rappel",
  message: "N'oubliez pas votre réunion dans 1 heure",
  type: "REMINDER",
  scheduledFor: new Date(Date.now() + 3600000), // +1 heure
});
```

### Notification avec métadonnées

```typescript
await notificationService.createNotification({
  userId: "user123",
  title: "Objectif atteint 🎉",
  message: "Vous avez atteint votre objectif mensuel !",
  type: "ACHIEVEMENT",
  metadata: {
    goalId: "goal-123",
    progress: 100,
    reward: "badge-super-user",
  },
});
```

## 🔒 Sécurité

- Authentification JWT requise pour tous les endpoints
- Notifications isolées par utilisateur (userId)
- Service Worker en HTTPS uniquement en production
- Validation des données côté backend

## 🐛 Debugging

Pour déboguer les notifications :

1. **Console du navigateur** : Messages préfixés par `[NotificationClient]` ou `[Service Worker]`
2. **Network tab** : Vérifier la connexion WebSocket
3. **Application tab > Service Workers** : État du Service Worker
4. **Application tab > Notifications** : Permissions actuelles

## 📝 TODO / Améliorations futures

- [x] **Intégration Pushover pour notifications mobiles** ✅
- [ ] Intégration Firebase Cloud Messaging (FCM) pour notifications mobiles
- [ ] Envoi d'emails via SendGrid/SES
- [ ] Support des webhooks personnalisés
- [ ] Historique complet des notifications dans l'UI
- [ ] Préférences utilisateur (désactiver certains types)
- [ ] Notifications groupées
- [ ] Sons personnalisés
- [ ] Vibrations personnalisées

---

**Date de création** : 23 janvier 2026
**Dernière mise à jour** : 24 janvier 2026 (Ajout Pushover)
**Version** : 1.1.0
**Statut** : ✅ Opérationnel
