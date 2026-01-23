/**
 * Noise Filter Service
 *
 * Intelligent filtering system to distinguish meaningful interactions from noise.
 * The system listens 24/7 to the user's life, so it needs sophisticated filtering
 * to avoid storing irrelevant content.
 *
 * Noise Categories:
 * - Background conversations (not involving the user)
 * - Random speech fragments
 * - Environmental sounds transcribed as words
 * - Media playback (TV, music, podcasts)
 * - Unaddressed utterances
 * - Filler words only (um, uh, euh, hmm)
 * - Repetitive/spam content
 */

import prisma from "./prisma.js";
import OpenAI from "openai";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type NoiseCategory =
  | "meaningful" // Worth processing and potentially storing
  | "background_conversation" // Other people talking, not involving user
  | "media_playback" // TV, music, podcasts, videos
  | "environmental_noise" // Random sounds transcribed as gibberish
  | "filler_words" // Just "um", "uh", "euh", "hmm"
  | "incomplete_fragment" // Too short/incomplete to be meaningful
  | "repetitive_spam" // Repeated same content
  | "self_talk_trivial" // Trivial self-talk like "okay", "alright", "where did I put..."
  | "wake_word_false_positive" // Detected wake word but nothing follows
  | "third_party_address"; // User talking TO someone else, not the system

export interface NoiseFilterResult {
  isMeaningful: boolean;
  confidence: number; // 0.0 - 1.0
  category: NoiseCategory;
  reason: string;
  suggestedAction: "process" | "discard" | "ask_user" | "store_minimal";
  contextualRelevance: number; // 0.0 - 1.0 - how relevant is this to the user's ongoing context
}

export interface NoiseFilterContext {
  // Recent conversation context
  recentTranscripts?: string[];
  recentTopics?: string[];

  // Speaker information
  speakerId?: string;
  isTargetUser?: boolean;
  speakerConfidence?: number;

  // Environmental context
  timeOfDay?: "morning" | "afternoon" | "evening" | "night";
  dayOfWeek?: string;
  locationHint?: string;

  // Audio characteristics
  audioDuration?: number;
  backgroundNoiseLevel?: number;
  multipleVoicesDetected?: boolean;

  // Wake word context
  wakeWordDetected?: boolean;
  timeSinceWakeWord?: number; // seconds

  userId?: string;

  // User preferences (loaded from UserSettings)
  userPreferences?: {
    noiseFilterEnabled?: boolean;
    noiseFilterSensitivity?: number;
    filterMediaPlayback?: boolean;
    filterBackgroundConvo?: boolean;
    filterTrivialSelfTalk?: boolean;
    filterThirdPartyAddress?: boolean;
    askConfirmationOnAmbiguous?: boolean;
  };
}

// ============================================================================
// Pattern Detection (Fast, Local)
// ============================================================================

/**
 * Fast local patterns for obvious noise - runs before LLM
 */
const NOISE_PATTERNS = {
  // Filler words only (must be the entire content or nearly)
  fillerOnly:
    /^[\s]*(euh|uh|um|hmm|hm|ah|oh|ben|bah|hein|quoi|genre|enfin|donc|voilà|bon|ouais|okay|ok|alright|right|yeah|yep|nope|nah|mhm|uh-huh|uh huh)[\s.,!?]*$/i,

  // Very short fragments (less than 3 meaningful characters)
  tooShort: /^[\s\W]*[\w]{0,2}[\s\W]*$/,

  // Repetitive patterns (same word 3+ times)
  repetitive: /\b(\w+)\b(?:\s+\1\b){2,}/i,

  // Common media/TV phrases that indicate playback
  mediaPatterns:
    /\b(breaking news|coming up next|stay tuned|subscribe|like and subscribe|don't forget to|brought to you by|sponsored by|advertisement|commercial break|episode \d+|season \d+|chapter \d+)\b/i,

  // Numbers only (often transcription errors)
  numbersOnly: /^[\s\d.,\-:]+$/,

  // Single punctuation or symbols
  symbolsOnly: /^[\s\W]*$/,

  // Common self-talk phrases that are usually meaningless
  trivialSelfTalk:
    /^[\s]*(où (est|sont|ai-je)|c'est où|attend|attends|voyons|voyons voir|let me see|let's see|where is|where are|where did I|hmm voyons|bon alors|allez|come on|damn|merde|putain|zut|oups|oops|woops)[\s.,!?]*$/i,

  // Questions to other people (not the system)
  thirdPartyAddress:
    /\b(maman|papa|chéri|chérie|mon cœur|mon amour|babe|honey|darling|sweetheart|dude|bro|man|les gars|les filles)\b.*\?$/i,
};

/**
 * Patterns indicating meaningful content
 */
const MEANINGFUL_PATTERNS = {
  // Direct questions
  directQuestion:
    /^(que|quoi|qui|où|quand|comment|pourquoi|combien|est-ce que|what|who|where|when|how|why|can you|could you|would you|will you|do you|did you|is there|are there)\b/i,

  // Commands/requests
  command:
    /^(fais|fait|montre|affiche|cherche|trouve|rappelle|note|ajoute|crée|envoie|ouvre|ferme|arrête|lance|démarre|do|make|show|find|search|remind|note|add|create|send|open|close|stop|start|please|s'il te plaît|stp)\b/i,

  // Personal statements
  personalStatement:
    /\b(je (pense|crois|veux|dois|vais|suis|ai|me sens)|I (think|believe|want|need|will|am|have|feel)|my |ma |mon |mes |aujourd'hui|demain|hier|this morning|ce matin|ce soir|tonight)\b/i,

  // Named entities (likely important)
  namedEntities: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/,

  // Dates and times mentioned
  dateTime:
    /\b(\d{1,2}[\/\-]\d{1,2}|\d{1,2}h\d{0,2}|\d{1,2}:\d{2}|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,

  // Numbers with context (not just numbers)
  numbersWithContext:
    /\b\d+\s*(euros?|dollars?|€|\$|%|minutes?|heures?|hours?|jours?|days?|semaines?|weeks?|mois|months?|ans?|years?|km|miles?|kg|lbs?|calories?)\b/i,

  // Email/phone/URL patterns (important info)
  contactInfo:
    /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}|https?:\/\/\S+)\b/i,
};

// ============================================================================
// Noise Filter Service
// ============================================================================

export class NoiseFilterService {
  // Cache for recent transcripts to detect repetition
  private recentTranscripts: Map<string, { timestamp: number; count: number }> =
    new Map();
  private readonly RECENT_CACHE_TTL_MS = 60 * 1000; // 1 minute
  private readonly REPETITION_THRESHOLD = 3;

  /**
   * Fast local filtering (no LLM call)
   * Returns result if confident, null if needs LLM analysis
   */
  quickFilter(
    text: string,
    context?: NoiseFilterContext,
  ): NoiseFilterResult | null {
    const trimmed = text.trim();
    const normalized = trimmed.toLowerCase();
    const prefs = context?.userPreferences;

    // If noise filtering is disabled, consider everything meaningful
    if (prefs?.noiseFilterEnabled === false) {
      return {
        isMeaningful: true,
        confidence: 1.0,
        category: "meaningful",
        reason: "Noise filtering disabled by user",
        suggestedAction: "process",
        contextualRelevance: 0.5,
      };
    }

    // Sensitivity adjustment: lower = more permissive, higher = stricter
    const sensitivity = prefs?.noiseFilterSensitivity ?? 0.7;
    const confidenceThreshold = 0.5 + sensitivity * 0.4; // Range: 0.5 - 0.9

    // 1. Empty or whitespace only
    if (!trimmed || trimmed.length === 0) {
      return {
        isMeaningful: false,
        confidence: 1.0,
        category: "environmental_noise",
        reason: "Empty or whitespace only",
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }

    // 2. Too short (less than 3 characters)
    if (trimmed.length < 3) {
      return {
        isMeaningful: false,
        confidence: 0.95,
        category: "incomplete_fragment",
        reason: `Too short (${trimmed.length} chars)`,
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }

    // 3. Filler words only
    if (NOISE_PATTERNS.fillerOnly.test(trimmed)) {
      return {
        isMeaningful: false,
        confidence: 0.95,
        category: "filler_words",
        reason: "Contains only filler words",
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }

    // 4. Symbols/punctuation only
    if (NOISE_PATTERNS.symbolsOnly.test(trimmed)) {
      return {
        isMeaningful: false,
        confidence: 0.98,
        category: "environmental_noise",
        reason: "Contains only symbols/punctuation",
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }

    // 5. Numbers only (likely transcription error)
    if (NOISE_PATTERNS.numbersOnly.test(trimmed) && trimmed.length < 10) {
      return {
        isMeaningful: false,
        confidence: 0.85,
        category: "environmental_noise",
        reason: "Numbers only without context",
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }

    // 6. Repetitive content detection
    const repetitionResult = this.checkRepetition(trimmed);
    if (repetitionResult) {
      return repetitionResult;
    }

    // 7. Wake word detected but nothing meaningful follows
    if (context?.wakeWordDetected && trimmed.length < 10) {
      // Just wake word or very short after wake word
      return {
        isMeaningful: false,
        confidence: 0.8,
        category: "wake_word_false_positive",
        reason: "Wake word detected but no meaningful content follows",
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }

    // 8. Check for obvious meaningful patterns (high confidence)
    for (const [patternName, pattern] of Object.entries(MEANINGFUL_PATTERNS)) {
      if (pattern.test(trimmed)) {
        return {
          isMeaningful: true,
          confidence: 0.85,
          category: "meaningful",
          reason: `Matches meaningful pattern: ${patternName}`,
          suggestedAction: "process",
          contextualRelevance: 0.7,
        };
      }
    }

    // 9. Media playback detection (respect user preference)
    if (
      prefs?.filterMediaPlayback !== false &&
      NOISE_PATTERNS.mediaPatterns.test(trimmed)
    ) {
      return {
        isMeaningful: false,
        confidence: 0.9,
        category: "media_playback",
        reason: "Contains media/TV/podcast phrases",
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }

    // 10. Trivial self-talk (respect user preference)
    if (
      prefs?.filterTrivialSelfTalk !== false &&
      NOISE_PATTERNS.trivialSelfTalk.test(trimmed)
    ) {
      return {
        isMeaningful: false,
        confidence: 0.75,
        category: "self_talk_trivial",
        reason: "Common trivial self-talk phrase",
        suggestedAction: "discard",
        contextualRelevance: 0.1,
      };
    }

    // 11. Third party address (talking to someone else) - respect user preference
    if (
      prefs?.filterThirdPartyAddress !== false &&
      NOISE_PATTERNS.thirdPartyAddress.test(trimmed)
    ) {
      return {
        isMeaningful: false,
        confidence: 0.7,
        category: "third_party_address",
        reason: "User appears to be talking to another person",
        suggestedAction: prefs?.askConfirmationOnAmbiguous
          ? "ask_user"
          : "discard",
        contextualRelevance: 0.2,
      };
    }

    // 12. Speaker not identified as target user (respect user preference)
    if (
      prefs?.filterBackgroundConvo !== false &&
      context?.isTargetUser === false &&
      context.speakerConfidence &&
      context.speakerConfidence > 0.7
    ) {
      return {
        isMeaningful: false,
        confidence: context.speakerConfidence,
        category: "background_conversation",
        reason: "Speaker identified as not the target user",
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }

    // Not confident enough for quick filter - needs LLM analysis
    return null;
  }

  /**
   * Check for repetitive content in recent history
   */
  private checkRepetition(text: string): NoiseFilterResult | null {
    const normalized = text.toLowerCase().trim();
    const now = Date.now();

    // Clean up old entries
    for (const [key, value] of this.recentTranscripts) {
      if (now - value.timestamp > this.RECENT_CACHE_TTL_MS) {
        this.recentTranscripts.delete(key);
      }
    }

    // Check if this is a repetition
    const existing = this.recentTranscripts.get(normalized);
    if (existing) {
      existing.count++;
      existing.timestamp = now;

      if (existing.count >= this.REPETITION_THRESHOLD) {
        return {
          isMeaningful: false,
          confidence: 0.9,
          category: "repetitive_spam",
          reason: `Same content repeated ${existing.count} times in the last minute`,
          suggestedAction: "discard",
          contextualRelevance: 0,
        };
      }
    } else {
      this.recentTranscripts.set(normalized, { timestamp: now, count: 1 });
    }

    // Also check for repetitive words within the text itself
    if (NOISE_PATTERNS.repetitive.test(text)) {
      return {
        isMeaningful: false,
        confidence: 0.8,
        category: "repetitive_spam",
        reason: "Contains repetitive word pattern",
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }

    return null;
  }

  /**
   * Full LLM-based noise analysis for ambiguous cases
   */
  async analyzeWithLLM(
    text: string,
    context?: NoiseFilterContext,
  ): Promise<NoiseFilterResult> {
    try {
      const { client, modelId } = await this.getOpenAIClient(context?.userId);

      const contextInfo = this.buildContextInfo(context);

      const systemPrompt = `Tu es un système de filtrage pour un assistant personnel qui écoute 24/7.
Ta tâche est de déterminer si une transcription audio mérite d'être traitée ou si c'est du "bruit".

Tu dois répondre avec un objet JSON:
{
  "isMeaningful": true|false,
  "confidence": 0.0-1.0,
  "category": "meaningful|background_conversation|media_playback|environmental_noise|filler_words|incomplete_fragment|repetitive_spam|self_talk_trivial|wake_word_false_positive|third_party_address",
  "reason": "explication courte",
  "suggestedAction": "process|discard|ask_user|store_minimal",
  "contextualRelevance": 0.0-1.0
}

Catégories:
- meaningful: Contenu utile, question, commande, réflexion personnelle, information importante
- background_conversation: Conversation en arrière-plan, pas l'utilisateur principal
- media_playback: Télé, radio, podcast, vidéo YouTube, musique avec paroles
- environmental_noise: Bruits transcrits par erreur, mots incompréhensibles
- filler_words: Seulement des "euh", "um", "hmm", etc.
- incomplete_fragment: Phrase coupée, trop courte pour avoir du sens
- repetitive_spam: Même contenu répété, boucle
- self_talk_trivial: "Où sont mes clés", "Bon alors", "Allez" - pensée à voix haute triviale
- wake_word_false_positive: Mot d'activation détecté mais rien d'utile après
- third_party_address: L'utilisateur parle à quelqu'un d'autre (son partenaire, ses enfants)

Actions suggérées:
- process: Traiter et potentiellement stocker
- discard: Ignorer complètement
- ask_user: Demander confirmation à l'utilisateur (cas ambigu important)
- store_minimal: Stocker une trace minimale mais ne pas traiter

IMPORTANT: En cas de doute, préfère "discard" pour éviter de polluer la mémoire.
Une conversation télé/podcast se reconnaît par:
- Langage trop formel/scripté
- Mentions de "abonnez-vous", "restez connectés", "après la pause"
- Voix multiples qui ne semblent pas être une conversation naturelle`;

      const userPrompt = `Analyse cette transcription:

"${text}"

${contextInfo}

Est-ce du contenu significatif ou du bruit?`;

      const response = await client.chat.completions.create({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 256,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty LLM response");
      }

      const result = JSON.parse(content);

      return {
        isMeaningful: result.isMeaningful ?? false,
        confidence: result.confidence ?? 0.5,
        category: result.category || "environmental_noise",
        reason: result.reason || "LLM analysis",
        suggestedAction: result.suggestedAction || "discard",
        contextualRelevance: result.contextualRelevance ?? 0,
      };
    } catch (error) {
      console.error("Noise filter LLM analysis failed:", error);
      // Default to discarding on error to avoid noise pollution
      return {
        isMeaningful: false,
        confidence: 0.5,
        category: "environmental_noise",
        reason: "Analysis failed - defaulting to discard",
        suggestedAction: "discard",
        contextualRelevance: 0,
      };
    }
  }

  /**
   * Main filter method - combines quick filter + LLM analysis if needed
   */
  async filter(
    text: string,
    context?: NoiseFilterContext,
  ): Promise<NoiseFilterResult> {
    // Try quick filter first
    const quickResult = this.quickFilter(text, context);

    if (quickResult) {
      // Log quick filter decision for debugging
      console.log(
        `[NoiseFilter] Quick filter: ${quickResult.category} (${quickResult.confidence.toFixed(2)}) - ${quickResult.reason}`,
      );
      return quickResult;
    }

    // Need LLM analysis for ambiguous cases
    console.log(
      `[NoiseFilter] Needs LLM analysis: "${text.substring(0, 50)}..."`,
    );
    const llmResult = await this.analyzeWithLLM(text, context);

    console.log(
      `[NoiseFilter] LLM result: ${llmResult.category} (${llmResult.confidence.toFixed(2)}) - ${llmResult.reason}`,
    );

    return llmResult;
  }

  /**
   * Batch filter multiple texts (e.g., recent transcripts)
   */
  async filterBatch(
    texts: string[],
    context?: NoiseFilterContext,
  ): Promise<Map<string, NoiseFilterResult>> {
    const results = new Map<string, NoiseFilterResult>();

    for (const text of texts) {
      results.set(text, await this.filter(text, context));
    }

    return results;
  }

  /**
   * Build context info string for LLM
   */
  private buildContextInfo(context?: NoiseFilterContext): string {
    if (!context) return "Pas de contexte additionnel.";

    const info: string[] = [];

    if (context.recentTranscripts && context.recentTranscripts.length > 0) {
      info.push(
        `Transcriptions récentes: "${context.recentTranscripts.slice(-3).join('", "')}"`,
      );
    }

    if (context.recentTopics && context.recentTopics.length > 0) {
      info.push(`Sujets récents: ${context.recentTopics.join(", ")}`);
    }

    if (context.isTargetUser !== undefined) {
      info.push(
        context.isTargetUser
          ? "L'utilisateur principal parle"
          : "Ce n'est PAS l'utilisateur principal",
      );
    }

    if (context.speakerConfidence !== undefined) {
      info.push(
        `Confiance identification: ${(context.speakerConfidence * 100).toFixed(0)}%`,
      );
    }

    if (context.multipleVoicesDetected) {
      info.push("Plusieurs voix détectées dans l'audio");
    }

    if (context.audioDuration !== undefined) {
      info.push(`Durée audio: ${context.audioDuration.toFixed(1)}s`);
    }

    if (context.wakeWordDetected) {
      info.push("Mot d'activation détecté");
      if (context.timeSinceWakeWord !== undefined) {
        info.push(`${context.timeSinceWakeWord}s après le wake word`);
      }
    }

    if (context.timeOfDay) {
      info.push(`Moment de la journée: ${context.timeOfDay}`);
    }

    return info.length > 0
      ? `Contexte:\n- ${info.join("\n- ")}`
      : "Pas de contexte additionnel.";
  }

  /**
   * Get OpenAI client for user
   */
  private async getOpenAIClient(
    userId?: string,
  ): Promise<{ client: OpenAI; modelId: string }> {
    const whereClause: any = { taskType: "ROUTING" };
    if (userId) {
      whereClause.userId = userId;
    }

    const taskConfig = await prisma.aITaskConfig.findFirst({
      where: whereClause,
      include: {
        provider: true,
        model: true,
      },
    });

    let client: OpenAI;
    let modelId: string;

    if (!taskConfig || !taskConfig.provider) {
      const provider = await prisma.aIProvider.findFirst({
        where: userId ? { userId } : undefined,
      });

      if (!provider) {
        throw new Error("No AI provider configured");
      }

      client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl || "https://api.openai.com/v1",
      });
      modelId = "gpt-3.5-turbo";
    } else {
      client = new OpenAI({
        apiKey: taskConfig.provider.apiKey,
        baseURL: taskConfig.provider.baseUrl || "https://api.openai.com/v1",
      });
      modelId = taskConfig.model?.modelId || "gpt-3.5-turbo";
    }

    return { client, modelId };
  }

  /**
   * Get statistics about recent filtering
   */
  getStats(): {
    recentCacheSize: number;
    recentCategories: Record<NoiseCategory, number>;
  } {
    return {
      recentCacheSize: this.recentTranscripts.size,
      recentCategories: {
        meaningful: 0,
        background_conversation: 0,
        media_playback: 0,
        environmental_noise: 0,
        filler_words: 0,
        incomplete_fragment: 0,
        repetitive_spam: 0,
        self_talk_trivial: 0,
        wake_word_false_positive: 0,
        third_party_address: 0,
      },
    };
  }
}

// Export singleton instance
export const noiseFilterService = new NoiseFilterService();
