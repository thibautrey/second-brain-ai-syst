# Fact-Checking System - Documentation Complète

## 🎯 Vue d'Ensemble

Le système de fact-checking vérifie automatiquement les réponses de l'IA en arrière-plan et envoie des corrections si nécessaire.

**Flux de fonctionnement :**

1. L'utilisateur pose une question
2. L'IA répond **immédiatement** (UX rapide)
3. **En arrière-plan** : Le système vérifie les affirmations
4. Si des erreurs sont détectées → Notification de correction

---

## 📁 Fichiers Créés

### 1. Migration Base de Données

**Fichier** : `backend/prisma/migrations/20260126220000_add_fact_checking_system/migration.sql`

- ✅ Table `fact_check_results` : Stocke les vérifications
- ✅ Table `correction_notifications` : Corrections envoyées à l'utilisateur
- ✅ Enum `FactCheckStatus` : PENDING, IN_PROGRESS, COMPLETED, FAILED, PARTIAL
- ✅ Indexes optimisés pour les requêtes

### 2. Service Fact-Checker

**Fichier** : `backend/services/fact-checker.ts`

**Méthodes principales :**

- `scheduleFactCheck()` - Planifie une vérification (non-bloquant)
- `extractClaims()` - Extrait les affirmations vérifiables avec LLM
- `verifyClaim()` - Vérifie une affirmation via web search
- `sendCorrectionNotification()` - Envoie une notification si erreur détectée

**Fonctionnalités :**

- ✅ Extraction intelligente des claims (LLM)
- ✅ Vérification web (DuckDuckGo pour privacy)
- ✅ Analyse de précision (mostly_correct, partially_correct, etc.)
- ✅ Notifications automatiques
- ✅ Historique complet

### 3. Controller REST API

**Fichier** : `backend/controllers/fact-check.controller.ts`

**Endpoints :**

```
GET  /api/fact-check/results       - Liste des fact-checks
GET  /api/fact-check/corrections   - Corrections en attente
PUT  /api/fact-check/corrections/:id/read - Marquer comme lu
```

### 4. Intégration Chat Controller

**Modifications dans** : `backend/controllers/chat.controller.ts`

- ✅ Déclenchement automatique après réponse (si > 100 caractères)
- ✅ Exécution asynchrone (ne bloque pas l'utilisateur)
- ✅ Gestion d'erreurs robuste

### 5. Enregistrement Routes

**Modifications dans** : `backend/services/api-server.ts`

- ✅ Import du controller
- ✅ Route `/api/fact-check` enregistrée
- ✅ Log de confirmation

---

## 🚀 Déploiement

### Étape 1 : Appliquer la Migration

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### Étape 2 : Compiler le Backend

```bash
npm run build
```

### Étape 3 : Redémarrer les Services

```bash
# Depuis la racine du projet
docker compose down
docker compose up -d
```

### Étape 4 : Vérifier les Logs

```bash
docker compose logs backend | grep -i "fact-check"
```

Vous devriez voir :

```
✅ Fact-check routes enabled at /api/fact-check
```

---

## 🧪 Test du Système

### Test 1 : Poser une Question avec Fait Vérifiable

**Via Frontend ou API :**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Combien de temps faut-il pour cuire un potiron ?",
    "messages": []
  }'
```

**Résultat attendu :**

1. Réponse immédiate de l'IA
2. En arrière-plan : fact-check créé (status: PENDING)
3. Vérification des claims
4. Si erreur détectée → Notification envoyée

### Test 2 : Consulter les Fact-Checks

```bash
curl -X GET http://localhost:3000/api/fact-check/results \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Réponse :**

```json
{
  "success": true,
  "results": [
    {
      "id": "...",
      "conversationId": "...",
      "status": "COMPLETED",
      "claimsIdentified": ["Le potiron se cuit en 40 minutes"],
      "claimsAnalyzed": 1,
      "overallAccuracy": "mostly_correct",
      "confidenceScore": 0.85,
      "needsCorrection": false,
      "verifiedAt": "2026-01-26T..."
    }
  ]
}
```

### Test 3 : Consulter les Corrections Pending

```bash
curl -X GET http://localhost:3000/api/fact-check/corrections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🔧 Configuration Avancée

### Modifier le Seuil de Fact-Checking

Dans `backend/controllers/chat.controller.ts` :

```typescript
// Ligne ~1165
if (fullResponse && fullResponse.length > 100) {
  // Changer 100 en 50 pour fact-checker plus de réponses
```

### Intégrer une API de Fact-Checking

Dans `backend/services/fact-checker.ts`, méthode `verifyClaim()` :

```typescript
// Remplacer DuckDuckGo par Serper API, Google Custom Search, etc.
const searchUrl = `https://api.serper.dev/search?q=${encodeURIComponent(claim)}`;
const result = await curlService.post(
  searchUrl,
  {},
  {
    "X-API-KEY": process.env.SERPER_API_KEY,
  },
);
```

### Désactiver les Notifications Automatiques

Dans `backend/services/fact-checker.ts`, ligne ~195 :

```typescript
// Commenter cette section pour désactiver les notifications
// if (correctionNeeded && analysis.correction) {
//   await this.sendCorrectionNotification(...);
// }
```

---

## 📊 Monitoring

### Statistiques Fact-Checks

Créer un endpoint analytics :

```typescript
// backend/controllers/fact-check.controller.ts
router.get("/stats", async (req: AuthRequest, res: Response) => {
  const stats = await prisma.factCheckResult.groupBy({
    by: ["overallAccuracy"],
    where: { userId: req.userId! },
    _count: true,
  });
  return res.json({ success: true, stats });
});
```

### Dashboard Frontend

Ajouter une page `/fact-checks` dans le frontend pour afficher :

- Nombre de vérifications effectuées
- Taux de précision moyen
- Corrections récentes

---

## 🛡️ Sécurité & Privacy

### Protection des Données

- ✅ **Isolation utilisateur** : Chaque user voit uniquement ses fact-checks
- ✅ **Pas de stockage des requêtes** : Seules les claims sont stockées
- ✅ **Web search anonyme** : Utilise DuckDuckGo (privacy-friendly)

### Rate Limiting

Ajouter dans `backend/services/fact-checker.ts` :

```typescript
private requestCount = new Map<string, number>();

async scheduleFactCheck(request: FactCheckRequest) {
  const count = this.requestCount.get(request.userId) || 0;
  if (count > 10) {
    console.warn(`[FactChecker] Rate limit for user ${request.userId}`);
    return;
  }
  this.requestCount.set(request.userId, count + 1);

  // ... reste du code
}
```

---

## 🐛 Dépannage

### Erreur : "No provider configured"

**Solution** : Configurer un provider AI pour la tâche REFLECTION

```bash
# Via l'interface /settings/ai ou API
curl -X POST http://localhost:3000/api/ai-settings/task-configs \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "taskType": "REFLECTION",
    "providerId": "...",
    "modelId": "..."
  }'
```

### Les Fact-Checks ne se Lancent Pas

**Vérifier :**

1. Migration appliquée : `npx prisma db execute --stdin < verify.sql`
2. Service compilé sans erreurs : `npm run build`
3. Logs backend : `docker compose logs backend | grep FactChecker`

### Notifications non Reçues

**Vérifier** dans la table `correction_notifications` :

```sql
SELECT * FROM correction_notifications
WHERE "userId" = 'YOUR_USER_ID'
ORDER BY "createdAt" DESC;
```

---

## 📈 Améliorations Futures

### Phase 2 : IA Multi-Sources

- Intégrer Serper API pour recherches web avancées
- Utiliser Wikipedia API pour faits encyclopédiques
- Vérifier dates via Wolfram Alpha

### Phase 3 : Machine Learning

- Entraîner un modèle de détection de claims
- Classifier la fiabilité des sources
- Prédire la probabilité d'erreur

### Phase 4 : Real-Time

- WebSocket pour notifications instantanées
- Streaming des résultats de vérification
- Indicateur "vérification en cours" dans l'UI

---

## ✅ Checklist d'Implémentation

- [x] Schéma Prisma modifié
- [x] Migration SQL créée
- [x] Service fact-checker implémenté
- [x] Controller REST API créé
- [x] Intégration chat controller
- [x] Routes enregistrées
- [ ] Migration appliquée (`npx prisma migrate deploy`)
- [ ] Backend compilé (`npm run build`)
- [ ] Services redémarrés (`docker compose restart`)
- [ ] Tests fonctionnels effectués
- [ ] Frontend mis à jour (optionnel)

---

**Version** : 1.0.0
**Date** : 26 janvier 2026
**Status** : ✅ Implémentation complète - Prêt pour déploiement
