# Détection et Gestion des Personnes Externes

## 📋 Objectif

Implémenter un système de détection et de gestion des personnes externes (autres que l'utilisateur principal) lors des interactions vocales. Le système doit :

1. **Détecter** automatiquement quand quelqu'un d'autre parle
2. **Créer des embeddings vocaux** pour chaque personne détectée
3. **Identifier** les personnes déjà rencontrées par comparaison d'embeddings
4. **Permettre à l'utilisateur** de nommer et gérer ces profils via une interface intuitive
5. **Enrichir les interactions** avec l'identité du locuteur

---

## 📊 État Actuel du Système

### Ce qui existe déjà

#### 1. Speaker Recognition Service (`backend/services/speaker-recognition.ts`)

- ✅ Extraction d'embeddings vocaux (ECAPA-TDNN, 192 dimensions)
- ✅ Calcul de similarité cosinus entre embeddings
- ✅ Enrollment de profils avec centroïde
- ✅ Identification avec seuils de confiance (`threshold_high: 0.85`, `threshold_low: 0.70`)
- ⚠️ **Limité à un seul utilisateur cible** - les "autres" sont simplement ignorés

#### 2. Continuous Listening Service (`backend/services/continuous-listening.ts`)

```typescript
// Actuellement : binaire user/other
private async identifySpeaker(audioData: Buffer): Promise<SpeakerIdentificationResult> {
  // ...
  const isTargetUser = similarity >= this.config.speakerConfidenceThreshold;
  return {
    isTargetUser,
    confidence: similarity,
    speakerId: isTargetUser ? "user" : "other", // ← Tous les autres = "other"
  };
}
```

#### 3. Base de données Prisma (existant)

- `SpeakerProfile` - Profils vocaux (actuellement uniquement pour l'utilisateur)
- `VoiceSample` - Échantillons audio
- `Memory` - Stockage des interactions (pas de lien vers locuteur externe)

#### 4. Frontend

- Page Training (`src/pages/TrainingPage.tsx`) - Pour l'utilisateur uniquement
- Pas de page "Interactions" avec historique des conversations

---

## 🎯 Architecture Cible

### Flux de Traitement

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Audio Détecté (VAD = true)                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Extraction Embedding (ECAPA-TDNN 192d)                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│ Comparer avec   │  │ Comparer avec   │  │ Aucune correspondance   │
│ User Centroid   │  │ External Persons│  │ → Nouvelle personne     │
│ (seuil: 0.85)   │  │ (seuil: 0.75)   │  │                         │
└────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘
         │                    │                        │
    ≥ 0.85               ≥ 0.75                   < 0.75
         │                    │                        │
         ▼                    ▼                        ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│ SPEAKER: USER   │  │ SPEAKER: KNOWN  │  │ SPEAKER: UNKNOWN        │
│ → Process normal│  │ Match: Person X │  │ → Créer VoiceSegment    │
└─────────────────┘  │ Confidence: 87% │  │   status: PENDING       │
                     └────────┬────────┘  │ → Créer ExternalPerson  │
                              │           │   name: null            │
                              ▼           └────────────┬────────────┘
                     ┌─────────────────┐               │
                     │ Confiance ≥ 90%?│               │
                     └────────┬────────┘               │
                              │                        │
                    ┌────Yes──┴──No────┐               │
                    ▼                  ▼               ▼
           ┌─────────────────┐  ┌─────────────────┐    │
           │ AUTO_MATCHED    │  │ PENDING         │    │
           │ (pas de review) │  │ (review requis) │    │
           └─────────────────┘  └─────────────────┘    │
                    │                  │               │
                    └──────────┬───────┴───────────────┘
                               ▼
                    ┌─────────────────────────┐
                    │ Créer Interaction       │
                    │ avec speakerType        │
                    └─────────────────────────┘
```

---

## 🗄️ Modèle de Données

### Nouveaux Modèles Prisma

```prisma
// Nouveau modèle pour les personnes externes
model ExternalPerson {
  id              String   @id @default(uuid())
  userId          String   // Propriétaire du système
  user            User     @relation(fields: [userId], references: [id])

  name            String?  // Nom assigné par l'utilisateur (nullable au début)
  nickname        String?  // Surnom optionnel
  relationship    String?  // "colleague", "friend", "family", "unknown"
  notes           String?  // Notes libres

  // Embedding vocal (centroïde)
  centroidEmbedding Float[]
  embeddingCount    Int     @default(0)

  // Métadonnées
  firstSeenAt     DateTime @default(now())
  lastSeenAt      DateTime @default(now())
  interactionCount Int     @default(0)

  // Relations
  voiceSegments   VoiceSegment[]
  interactions    Interaction[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@index([lastSeenAt])
}

// Segments vocaux non identifiés ou en attente de confirmation
model VoiceSegment {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  // Audio
  storagePath     String
  durationSeconds Float

  // Embedding extrait
  embedding       Float[]

  // Attribution
  externalPersonId String?
  externalPerson   ExternalPerson? @relation(fields: [externalPersonId], references: [id])

  // Statut
  status          VoiceSegmentStatus @default(PENDING)
  suggestedPersonId String?  // Suggestion automatique du système
  suggestedConfidence Float?

  // Contexte
  interactionId   String?
  interaction     Interaction? @relation(fields: [interactionId], references: [id])

  transcription   String?
  detectedAt      DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId, status])
  @@index([externalPersonId])
}

enum VoiceSegmentStatus {
  PENDING      // En attente d'identification
  AUTO_MATCHED // Correspondance automatique (haute confiance)
  USER_CONFIRMED // Confirmé par l'utilisateur
  USER_REJECTED  // Rejeté par l'utilisateur (nouvelle personne)
}

// Interactions (conversations capturées)
model Interaction {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  // Locuteur
  speakerType     SpeakerType
  speakerProfileId String?  // Si c'est l'utilisateur
  externalPersonId String?  // Si c'est une personne externe
  externalPerson   ExternalPerson? @relation(fields: [externalPersonId], references: [id])

  // Contenu
  transcription   String
  audioPath       String?
  durationSeconds Float?

  // Classification
  classification  String?  // question, statement, etc.
  importance      Float    @default(0.5)

  // Contexte temporel
  sessionId       String?  // Groupe de conversation
  timestamp       DateTime @default(now())

  // Relations
  voiceSegments   VoiceSegment[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId, timestamp])
  @@index([externalPersonId])
  @@index([sessionId])
}

enum SpeakerType {
  USER           // L'utilisateur propriétaire
  EXTERNAL_KNOWN // Personne externe identifiée
  EXTERNAL_UNKNOWN // Personne externe non identifiée
}
```

---

## 🔧 Backend Services

### 1. ExternalPersonService (nouveau)

**Fichier**: `backend/services/external-person.ts`

```typescript
interface ExternalPersonMatch {
  personId: string | null;
  confidence: number;
  isNewPerson: boolean;
  suggestedName?: string;
}

class ExternalPersonService {
  // Trouver ou créer une personne externe basée sur l'embedding
  async matchOrCreatePerson(
    userId: string,
    embedding: number[],
    audioPath: string,
    transcription?: string,
  ): Promise<ExternalPersonMatch>;

  // Confirmer l'identité d'un segment vocal
  async confirmSegmentIdentity(
    segmentId: string,
    personId: string,
  ): Promise<void>;

  // Créer une nouvelle personne à partir d'un segment
  async createPersonFromSegment(
    segmentId: string,
    name: string,
    relationship?: string,
  ): Promise<ExternalPerson>;

  // Fusionner deux profils (erreur de détection)
  async mergePersons(
    keepPersonId: string,
    mergePersonId: string,
  ): Promise<void>;

  // Mettre à jour le centroïde avec un nouveau sample
  async updatePersonCentroid(
    personId: string,
    newEmbedding: number[],
  ): Promise<void>;

  // Lister les segments en attente d'identification
  async getPendingSegments(userId: string): Promise<VoiceSegment[]>;
}
```

### 2. Modification de ContinuousListeningService

**Fichier**: `backend/services/continuous-listening.ts`

```typescript
// Modifier identifySpeaker() pour identifier les externes

private async identifySpeaker(audioData: Buffer): Promise<SpeakerIdentificationResult> {
  const embedding = await embeddingService.extractEmbedding(tempPath);

  // 1. Vérifier si c'est l'utilisateur cible
  if (this.config.centroidEmbedding) {
    const userSimilarity = await embeddingService.computeSimilarity(
      embedding,
      this.config.centroidEmbedding
    );

    if (userSimilarity >= this.config.speakerConfidenceThreshold) {
      return {
        isTargetUser: true,
        confidence: userSimilarity,
        speakerId: this.config.speakerProfileId || "user",
        speakerType: "USER"
      };
    }
  }

  // 2. NOUVEAU: Chercher parmi les personnes externes connues
  const externalMatch = await externalPersonService.matchOrCreatePerson(
    this.config.userId,
    embedding,
    tempPath,
    undefined // transcription ajoutée après
  );

  return {
    isTargetUser: false,
    confidence: externalMatch.confidence,
    speakerId: externalMatch.personId || "unknown",
    speakerType: externalMatch.isNewPerson ? "EXTERNAL_UNKNOWN" : "EXTERNAL_KNOWN",
    isNewPerson: externalMatch.isNewPerson,
    embedding // Garder pour stockage
  };
}
```

---

## 🌐 API Endpoints

### Nouveau Controller: `backend/controllers/external-person.controller.ts`

| Méthode  | Endpoint                          | Description                                  |
| -------- | --------------------------------- | -------------------------------------------- |
| `GET`    | `/api/external-persons`           | Liste toutes les personnes externes          |
| `GET`    | `/api/external-persons/:id`       | Détails d'une personne avec ses interactions |
| `PATCH`  | `/api/external-persons/:id`       | Mettre à jour nom, relationship, notes       |
| `DELETE` | `/api/external-persons/:id`       | Supprimer une personne                       |
| `POST`   | `/api/external-persons/merge`     | Fusionner deux profils                       |
| `GET`    | `/api/voice-segments/pending`     | Segments en attente d'identification         |
| `POST`   | `/api/voice-segments/:id/confirm` | Confirmer l'identité d'un segment            |
| `POST`   | `/api/voice-segments/:id/reject`  | Rejeter la suggestion                        |
| `GET`    | `/api/voice-segments/:id/audio`   | Télécharger l'audio d'un segment             |
| `GET`    | `/api/interactions`               | Liste des interactions avec filtres          |
| `GET`    | `/api/interactions/sessions`      | Grouper par session                          |

---

## 🖥️ Frontend

### Page Interactions (nouvelle)

**Structure**: `src/pages/InteractionsPage.tsx`

```
InteractionsPage
├── Tabs: [Timeline] [Personnes] [En attente]
│
├── Tab Timeline
│   ├── Filtres (date, personne, type)
│   ├── Liste chronologique des interactions
│   │   ├── Avatar/Icône du locuteur
│   │   ├── Nom (ou "Inconnu #3")
│   │   ├── Transcription
│   │   ├── Timestamp
│   │   └── Bouton écouter audio
│   └── Regroupement par session
│
├── Tab Personnes
│   ├── Liste des ExternalPerson
│   │   ├── Avatar placeholder
│   │   ├── Nom (éditable)
│   │   ├── Relationship badge
│   │   ├── Stats (interactions, dernière vue)
│   │   └── Actions (éditer, fusionner, supprimer)
│   └── Détail personne (modal/drawer)
│       ├── Infos éditables
│       ├── Historique des interactions
│       └── Échantillons vocaux
│
└── Tab En attente (🔴 badge count)
    ├── Liste des VoiceSegment PENDING
    │   ├── Player audio
    │   ├── Transcription
    │   ├── Suggestion du système + confiance
    │   ├── Sélecteur de personne (dropdown + "Nouvelle personne")
    │   └── Boutons [Confirmer] [Rejeter]
    └── Batch actions
```

### Composants UI

**Répertoire**: `src/components/interactions/`

| Fichier                   | Description                          |
| ------------------------- | ------------------------------------ |
| `InteractionTimeline.tsx` | Liste chronologique des interactions |
| `InteractionCard.tsx`     | Carte d'une interaction individuelle |
| `PersonList.tsx`          | Liste des personnes externes         |
| `PersonCard.tsx`          | Carte d'une personne                 |
| `PersonDetailDrawer.tsx`  | Drawer avec détails d'une personne   |
| `PendingSegmentList.tsx`  | Liste des segments à identifier      |
| `PendingSegmentCard.tsx`  | Carte segment avec player audio      |
| `AudioPlayer.tsx`         | Mini player audio réutilisable       |
| `PersonSelector.tsx`      | Dropdown de sélection de personne    |
| `MergePersonsDialog.tsx`  | Dialog pour fusionner des profils    |

---

## ⚙️ Configuration

### Seuils de Confiance

| Seuil          | Valeur   | Usage                                    |
| -------------- | -------- | ---------------------------------------- |
| User match     | `≥ 0.85` | Strict - identification de l'utilisateur |
| External match | `≥ 0.75` | Plus souple - permet l'apprentissage     |
| Auto-confirm   | `≥ 0.90` | Très haute confiance - pas de review     |

### Politiques de Rétention

- Segments PENDING non confirmés : supprimer après **30 jours**
- Audio des segments confirmés : garder **90 jours** puis supprimer (garder embedding)
- Interactions : conservation permanente

---

## 💡 Points d'Attention

1. **Stockage Audio** : Les segments vocaux des autres personnes doivent être stockés pour permettre l'écoute. Prévoir une politique de rétention.

2. **Privacy** : Les données vocales des autres personnes sont sensibles. Ajouter option pour désactiver le stockage audio et ne garder que les transcriptions.

3. **UX d'identification** : Interface intuitive avec raccourcis clavier pour traiter rapidement les segments en attente.

4. **Performance** : Caching des embeddings des personnes externes pour éviter des requêtes DB répétées.

---

## ✅ Liste des Tâches

### Phase 1: Modèle de Données (1-2 jours)

- [ ] **1.1** Ajouter le modèle `ExternalPerson` dans `backend/prisma/schema.prisma`
- [ ] **1.2** Ajouter le modèle `VoiceSegment` dans `backend/prisma/schema.prisma`
- [ ] **1.3** Ajouter le modèle `Interaction` dans `backend/prisma/schema.prisma`
- [ ] **1.4** Ajouter les enums `VoiceSegmentStatus` et `SpeakerType`
- [ ] **1.5** Ajouter les relations avec `User` existant
- [ ] **1.6** Créer et exécuter la migration Prisma
- [ ] **1.7** Créer les types TypeScript correspondants dans `backend/models/`

### Phase 2: Backend - ExternalPersonService (2-3 jours)

- [ ] **2.1** Créer `backend/services/external-person.ts`
- [ ] **2.2** Implémenter `matchOrCreatePerson()` - logique de matching par embedding
- [ ] **2.3** Implémenter `confirmSegmentIdentity()` - confirmation utilisateur
- [ ] **2.4** Implémenter `createPersonFromSegment()` - création nouvelle personne
- [ ] **2.5** Implémenter `mergePersons()` - fusion de profils
- [ ] **2.6** Implémenter `updatePersonCentroid()` - mise à jour du centroïde
- [ ] **2.7** Implémenter `getPendingSegments()` - liste des segments en attente
- [ ] **2.8** Ajouter les tests unitaires

### Phase 3: Backend - Modification Continuous Listening (1-2 jours)

- [ ] **3.1** Modifier `identifySpeaker()` pour identifier les personnes externes
- [ ] **3.2** Stocker les segments audio des personnes externes
- [ ] **3.3** Créer les interactions avec le bon `speakerType`
- [ ] **3.4** Émettre les événements WebSocket pour les nouvelles personnes
- [ ] **3.5** Gérer le cas "nouvelle personne détectée" vs "personne connue"

### Phase 4: Backend - API Endpoints (1-2 jours)

- [ ] **4.1** Créer `backend/controllers/external-person.controller.ts`
- [ ] **4.2** `GET /api/external-persons` - Liste des personnes
- [ ] **4.3** `GET /api/external-persons/:id` - Détails d'une personne
- [ ] **4.4** `PATCH /api/external-persons/:id` - Mise à jour
- [ ] **4.5** `DELETE /api/external-persons/:id` - Suppression
- [ ] **4.6** `POST /api/external-persons/merge` - Fusion
- [ ] **4.7** Créer `backend/controllers/voice-segment.controller.ts`
- [ ] **4.8** `GET /api/voice-segments/pending` - Segments en attente
- [ ] **4.9** `POST /api/voice-segments/:id/confirm` - Confirmation
- [ ] **4.10** `POST /api/voice-segments/:id/reject` - Rejet
- [ ] **4.11** `GET /api/voice-segments/:id/audio` - Stream audio
- [ ] **4.12** Créer `backend/controllers/interaction.controller.ts`
- [ ] **4.13** `GET /api/interactions` - Liste avec filtres
- [ ] **4.14** `GET /api/interactions/sessions` - Groupement par session
- [ ] **4.15** Enregistrer les routes dans `api-server.ts`

### Phase 5: Frontend - Hooks et Services (1 jour)

- [ ] **5.1** Créer `src/hooks/useExternalPersons.ts`
- [ ] **5.2** Créer `src/hooks/useVoiceSegments.ts`
- [ ] **5.3** Créer `src/hooks/useInteractions.ts`
- [ ] **5.4** Créer les types TypeScript dans `src/types/`

### Phase 6: Frontend - Page Interactions Base (2-3 jours)

- [ ] **6.1** Créer `src/pages/InteractionsPage.tsx` avec structure de tabs
- [ ] **6.2** Ajouter la route dans le router
- [ ] **6.3** Ajouter le lien dans la navigation
- [ ] **6.4** Créer `src/components/interactions/InteractionTimeline.tsx`
- [ ] **6.5** Créer `src/components/interactions/InteractionCard.tsx`
- [ ] **6.6** Créer `src/components/interactions/AudioPlayer.tsx`
- [ ] **6.7** Implémenter les filtres (date, personne, type)
- [ ] **6.8** Implémenter le regroupement par session

### Phase 7: Frontend - Tab Personnes (2 jours)

- [ ] **7.1** Créer `src/components/interactions/PersonList.tsx`
- [ ] **7.2** Créer `src/components/interactions/PersonCard.tsx`
- [ ] **7.3** Créer `src/components/interactions/PersonDetailDrawer.tsx`
- [ ] **7.4** Implémenter l'édition des profils (nom, relationship, notes)
- [ ] **7.5** Créer `src/components/interactions/MergePersonsDialog.tsx`
- [ ] **7.6** Implémenter la suppression avec confirmation

### Phase 8: Frontend - Tab Identification (2-3 jours)

- [ ] **8.1** Créer `src/components/interactions/PendingSegmentList.tsx`
- [ ] **8.2** Créer `src/components/interactions/PendingSegmentCard.tsx`
- [ ] **8.3** Créer `src/components/interactions/PersonSelector.tsx`
- [ ] **8.4** Implémenter l'écoute audio avec player
- [ ] **8.5** Implémenter la confirmation d'identité
- [ ] **8.6** Implémenter le rejet et création nouvelle personne
- [ ] **8.7** Ajouter le badge de compteur sur le tab
- [ ] **8.8** Ajouter les raccourcis clavier (optionnel)

### Phase 9: Optimisations et Polish (1-2 jours)

- [ ] **9.1** Caching des embeddings des personnes externes en mémoire
- [ ] **9.2** Implémenter le batch processing des confirmations
- [ ] **9.3** Ajouter les notifications temps réel (WebSocket) pour nouvelles personnes
- [ ] **9.4** Implémenter le nettoyage automatique des segments anciens (cron job)
- [ ] **9.5** Ajouter l'option privacy (désactiver stockage audio)
- [ ] **9.6** Tests E2E du flux complet
- [ ] **9.7** Documentation utilisateur

---

## 📅 Estimation Totale

| Phase                                      | Durée estimée   |
| ------------------------------------------ | --------------- |
| Phase 1: Modèle de données                 | 1-2 jours       |
| Phase 2: ExternalPersonService             | 2-3 jours       |
| Phase 3: Modification Continuous Listening | 1-2 jours       |
| Phase 4: API Endpoints                     | 1-2 jours       |
| Phase 5: Frontend Hooks                    | 1 jour          |
| Phase 6: Page Interactions Base            | 2-3 jours       |
| Phase 7: Tab Personnes                     | 2 jours         |
| Phase 8: Tab Identification                | 2-3 jours       |
| Phase 9: Optimisations                     | 1-2 jours       |
| **TOTAL**                                  | **13-20 jours** |

---

## 📚 Ressources

- [ECAPA-TDNN Speaker Embeddings](https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb)
- [Cosine Similarity for Speaker Verification](https://en.wikipedia.org/wiki/Cosine_similarity)
- Documentation existante: `docs/implementation-notes/AUDIO_TRAINING_IMPLEMENTATION.md`

---

**Dernière mise à jour**: 23 janvier 2026
**Statut**: En planification
