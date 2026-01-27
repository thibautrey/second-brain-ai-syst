# Guide Utilisateur - Gestion du Contexte Telegram

## 🎯 Qu'est-ce qui a été corrigé?

Le problème: Après avoir envoyé beaucoup de messages sur Telegram à l'agent, celui-ci commence à donner des réponses bizarres ou incohérentes.

**Cause**: L'agent essayait de garder en mémoire TOUS les messages de la conversation, ce qui dépasse rapidement la limite du modèle LLM.

**Solution**: Le système maintient maintenant un **contexte limité et intelligent** qui:

- ✅ Garde seulement les messages RÉCENTS (optimale pour répondre)
- ✅ Résume les anciens messages quand nécessaire
- ✅ Archive automatiquement les messages très vieux
- ✅ Reste toujours dans les limites du modèle LLM

## 📊 Exemple

### Avant (Problème)

```
Message 1: "Bonjour"
Message 2: "Comment vas-tu?"
...
Message 50: "Tu as des nouvelles de X?"

L'agent envoie TOUS les 50 messages à GPT-4
→ 20,000+ tokens 😱
→ Débordement
→ Réponses aléatoires ❌
```

### Après (Corrigé)

```
Message 50: "Tu as des nouvelles de X?"

L'agent envoie:
- System prompt
- Les 15-20 derniers messages (contexte récent)
- Message actuel

Total: ~5,000 tokens ✅
Réponses cohérentes ✅
```

## 🔧 Comment utiliser?

### Utilisation Normale (Automatique)

Il n'y a **RIEN à faire**! Le système fonctionne automatiquement:

1. Envoyer des messages comme d'habitude
2. L'agent garde le contexte récent intelligent
3. Les réponses restent cohérentes même après 100 messages

### Pour les Utilisateurs Avancés

Si vous voulez nettoyer manuellement votre historique:

#### 1. Voir l'historique récent

```bash
curl -X GET http://localhost:3000/api/telegram/conversation \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse** (exemple):

```json
{
  "success": true,
  "context": {
    "recentMessages": [
      {
        "role": "user",
        "content": "Quel est mon dernier objectif?",
        "createdAt": "2024-01-27T10:30:00Z"
      },
      {
        "role": "assistant",
        "content": "Ton dernier objectif est...",
        "createdAt": "2024-01-27T10:30:15Z"
      }
    ],
    "messageCount": 18,
    "contextTokens": 4532
  }
}
```

**Interprétation**:

- `messageCount`: 18 messages récents gardés
- `contextTokens`: ~4532 tokens utilisés pour le contexte

#### 2. Nettoyer les anciens messages (> 30 jours)

```bash
curl -X POST http://localhost:3000/api/telegram/conversation/cleanup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keepDays": 30}'
```

**Réponse**:

```json
{
  "success": true,
  "message": "Archived 127 messages older than 30 days",
  "archivedCount": 127
}
```

#### 3. Obtenir un résumé de l'historique

```bash
curl -X GET "http://localhost:3000/api/telegram/conversation/summary?daysBack=7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse**:

```json
{
  "success": true,
  "summary": "[Résumé conversation 7 jours]: \n- 42 messages utilisateur\n- 39 réponses assistant\n- Topics couverts: goals, projects, feedback",
  "daysBack": 7
}
```

## 🤔 Questions Fréquentes

### Q: Combien de messages anciens sont gardés?

**R**: Le système garde automatiquement les messages **récents qui rentrent dans le budget de tokens**. Typiquement:

- Derniers **15-25 messages** (selon leur longueur)
- Les très vieux messages (> 30 jours) sont archivés

### Q: Est-ce que l'agent oublie les anciennes conversations?

**R**: Non! Les anciennes conversations sont:

- ✅ Archivées mais conservées en base de données
- ✅ Retrouvables via la recherche sémantique
- ✅ Utilisables si vous en parlez explicitement

**Exemple**:

```
(Après 50 messages...)
Vous: "Tu te souviens quand je t'ai parlé du projet X?"
Agent: "Oui! Tu m'avais dit que..."
```

L'agent retrouve cette info via la recherche, pas via l'historique direct.

### Q: Pourquoi certains messages ne sont plus dans le contexte?

**R**: C'est volontaire! Pour rester efficace et éviter le débordement:

1. **Messages récents** = Priorité ✅
2. **Messages moyens** = Inclus si espace ⚠️
3. **Messages très vieux** = Archivés 📦

C'est comme dans une vraie conversation - vous gardez le contexte des 10 dernières minutes, mais vous souvenez des anciennes choses en cherchant vos notes.

### Q: Les tokens c'est quoi?

**R**: Les tokens sont des "unités de texte" qu'un modèle LLM peut traiter:

- **1 token** ≈ 4 caractères (environ)
- **GPT-4** limite: 8,000 à 128,000 tokens selon le modèle
- **Si vous dépassez la limite**: Erreur ou réponses bizarres

**Exemple**:

- "Bonjour" = ~2 tokens
- Un paragraphe = ~100 tokens
- Tous les 50 messages = ~20,000 tokens 😱

### Q: Comment je sais si j'approche la limite?

**R**: Vous recevrez un warning dans les logs (côté serveur):

```
[TelegramContextManager] Context limited to current message only
```

Ou:

```
[TelegramContextManager] Context is 92% of limit
```

C'est rare si vous utilisez le système normalement.

### Q: Je veux garder TOUTE ma conversation?

**R**: Techniquement possible, mais **NON RECOMMANDÉ** car:

- ❌ Risque de débordement
- ❌ Réponses plus lentes
- ❌ Coût API augmente
- ✅ Les anciennes conversa restent archivées de toute façon

**Mieux**: Laisser le système faire son travail!

## 🚀 Performance Améliorée

### Avant

```
50 messages → 20,000 tokens → Lent, débordement
↓
Réponse: "J'ai oublié le contexte..."
```

### Après

```
50 messages → 5,000 tokens (contexte intelligent)
↓
Réponse rapide et cohérente ✅
↓
"Bien sûr! Tu m'avais dit que..."
```

## 🛟 Besoin d'Aide?

Si vous rencontrez des problèmes:

1. **L'agent donne toujours des réponses bizarres?**
   - Exécutez un cleanup: `POST /api/telegram/conversation/cleanup`
   - Attendez 24h pour que les résumés se construisent

2. **Vous avez perdu une vieille conversation?**
   - Elle est archivée, pas supprimée!
   - Cherchez dans l'interface "Mémoires" si disponible
   - Ou demandez à l'agent directement: "Tu te souviens quand..."

3. **Les réponses sont lentes?**
   - Normal si vous avez 1000+ messages
   - Le cleanup automatique aide
   - Peut prendre quelques secondes de plus

4. **Vous voulez TOUT supprimer?**
   - Utilisez: `POST /api/telegram/conversation/expire` avec `olderThanDays: 0`
   - ⚠️ C'est permanent!

## 📈 Monitoring

Pour les utilisateurs techniques, vous pouvez monitorer:

```bash
# Voir les stats de votre conversation
curl -X GET http://localhost:3000/api/telegram/conversation \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.context.contextTokens'

# Output: 4532 (tokens utilisés)
```

## ✨ Améliorations à Venir

- [ ] Interface web pour nettoyer l'historique
- [ ] Résumés plus intelligents par LLM
- [ ] Détection automatique de "changement de sujet"
- [ ] Graphique du contexte utilisé

---

**Résumé Simple**: L'agent garde maintenant un contexte intelligent au lieu de tout mémoriser, comme un humain! Vous pouvez converser aussi longtemps que vous voulez. 🎉
