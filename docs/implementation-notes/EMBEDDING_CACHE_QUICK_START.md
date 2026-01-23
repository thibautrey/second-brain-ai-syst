# 🔧 Mise à Jour: Résolution des Erreurs de Chargement du Modèle d'Embedding

## ✅ Problème Résolu

Le service d'embedding rechargement du modèle à chaque redémarrage, causant des timeouts et erreurs de connexion à Hugging Face.

**Amélioration**: Le modèle est maintenant **stocké en cache** et **réutilisé** à chaque redémarrage - **démarrage en 1-2 secondes** au lieu de 2-3 minutes.

## 📊 Résultats

### Avant (Sans Cache)

```
❌ Timeout: Connection error, cannot find files in disk cache
❌ Service redémarre: ~2-3 minutes (téléchargement à chaque fois)
❌ Besoin internet obligatoire
```

### Après (Avec Cache)

```
✅ Démarrage: ~1-2 secondes
✅ Modèle réutilisé du cache
✅ Offline mode supporté
✅ Peut redémarrer sans internet
```

## 🚀 Comment Mettre à Jour

### Étape 1: Récupérer les nouvelles fichiers

```bash
cd /Users/thibaut/gitRepo/second-brain-ai-syst
git pull
```

### Étape 2: Reconstruire le service

```bash
docker compose build embedding-service
```

### Étape 3: Redémarrer

```bash
docker compose down
docker compose up
```

Le modèle sera téléchargé une première fois lors du démarrage (avec internet), puis mis en cache pour les redémarrages futurs.

## 📝 Fichiers Modifiés

### Services

- **[backend/services/embedding-service.py](../../backend/services/embedding-service.py)** - Ajout de logique de cache
- **[backend/services/download-model.py](../../backend/services/download-model.py)** - Nouveau script de pré-téléchargement

### Configuration

- **[docker/Dockerfile.embedding](../../docker/Dockerfile.embedding)** - Pré-téléchargement du modèle à la build
- **[docker-compose.yml](../../docker-compose.yml)** - Ajout de `HF_HUB_OFFLINE` variable

### Scripts

- **[scripts/download-embedding-model.sh](../../scripts/download-embedding-model.sh)** - Script pour pré-cacher le modèle

## 🔍 Vérifier le Cache

```bash
# Vérifier l'état du service
curl http://localhost:5001/health | jq .

# Résultat attendu:
{
  "status": "healthy",
  "model_loaded": true,
  "model_cached": true,        # ← Modèle en cache
  "device": "cpu",
  "model_name": "speechbrain/spkrec-ecapa-voxceleb",
  "offline_mode": false,
  "cache_dir": "/app/models"
}
```

## 🛠️ Mode Offline (Optionnel)

Pour utiliser le service en mode offline (sans internet):

```bash
export HF_HUB_OFFLINE=1
docker compose up embedding-service
```

> ⚠️ Le modèle doit être en cache avant d'activer ce mode

## 📂 Structure du Cache

Le modèle est stocké dans le volume Docker `embedding_models`:

```
/app/models/spkrec-ecapa-voxceleb/
├── hyperparams.yaml          # Configuration du modèle
├── embedding_model.ckpt      # Poids du modèle (83.3MB)
├── mean_var_norm_emb.ckpt    # Normalisation
├── classifier.ckpt           # Classificateur (5.53MB)
└── label_encoder.ckpt        # Encodeur de labels
```

## 🔐 Points Clés

1. **Cache Persistant**: Le volume `embedding_models` persiste même après `docker compose down`
2. **Téléchargement Unique**: Le modèle ne se télécharge qu'une seule fois (ou si cache supprimé)
3. **Offline Support**: Peut fonctionner sans internet si le modèle est en cache
4. **Gestion d'Erreurs**: Erreurs claires si modèle pas en cache et offline mode actif

## 🆘 Troubleshooting

### Le service prend toujours longtemps à démarrer

```bash
# Vérifier que le cache existe
docker exec second-brain-ai-syst-embedding-service-1 \
  ls -la /app/models/spkrec-ecapa-voxceleb/

# Doit afficher les fichiers du modèle
```

### Réinitialiser le cache

```bash
# Supprimer le volume du cache
docker volume rm second-brain-ai-syst_embedding_models

# Reconstruire et redémarrer
docker compose build embedding-service
docker compose up embedding-service
```

### Vérifier les logs

```bash
docker compose logs -f embedding-service
```

Cherchez:

- ✅ `Model cache status: ✓ Cached` - Cache trouvé
- ✅ `Using symlink found at` - Charge depuis cache
- ✅ `✓ Model pre-loaded successfully` - Prêt

## 📚 Documentation Complète

Voir [EMBEDDING_CACHE_IMPLEMENTATION.md](./EMBEDDING_CACHE_IMPLEMENTATION.md) pour plus de détails.
