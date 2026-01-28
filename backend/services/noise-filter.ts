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

import OpenAI from "openai";
import { injectDateIntoPrompt, llmRouterService } from "./llm-router.js";
import { parseJSONFromLLMResponse } from "../utils/json-parser.js";
import prisma from "./prisma.js";

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

  // ============================================================================
  // Continuous Audio Context (NEW)
  // ============================================================================
  
  /** Full context including all recent chunks */
  fullChunkContext?: string;
  /** Summary of older context that was rotated out */
  olderContextSummary?: string;
  /** Is this chunk a continuation of the previous one? */
  isChunkContinuation?: boolean;
  /** Number of chunks in current context window */
  chunkCount?: number;
  /** Total conversation duration in seconds */
  conversationDuration?: number;
  /** Text from the immediately previous chunk */
  previousChunkText?: string;

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
  /**
   * Use LLM for detailed noise analysis
   * Uses centralized LLM Router for endpoint compatibility handling
   */
  async analyzeWithLLM(
    text: string,
    context?: NoiseFilterContext,
  ): Promise<NoiseFilterResult> {
    try {
      const contextInfo = this.buildContextInfo(context);

      // Determine if we have continuous audio context
      const hasContinuousContext = context?.fullChunkContext || context?.chunkCount && context.chunkCount > 1;

      const systemPrompt = `You are a filtering system for a personal assistant that listens 24/7.
Your task is to determine whether an audio transcription should be processed or treated as "noise".

${hasContinuousContext ? `⚠️ IMPORTANT - CONTINUOUS AUDIO CONTEXT:
This text comes from a live audio stream split into chunks.
Chunks arrive as the user speaks.
An isolated chunk may seem incomplete, but it is part of a continuous speech.
Use the context from previous chunks to understand the overall meaning.
If the current chunk appears to continue the previous ones logically, treat it as "meaningful".
Never label such chunks as "incomplete_fragment".
` : ''}
You must respond with a JSON object:
{
  "isMeaningful": true|false,
  "confidence": 0.0-1.0,
  "category": "meaningful|background_conversation|media_playback|environmental_noise|filler_words|incomplete_fragment|repetitive_spam|self_talk_trivial|wake_word_false_positive|third_party_address",
  "reason": "short explanation",
  "suggestedAction": "process|discard|ask_user|store_minimal",
  "contextualRelevance": 0.0-1.0
}

Categories:
- meaningful: Valuable content, a question, a command, a personal reflection, or important information
- background_conversation: Background talk that is not the primary user
- media_playback: TV, radio, podcast, YouTube video, or music with lyrics
- environmental_noise: Noise transcribed by mistake or unintelligible words
- filler_words: Only "uh", "um", "hmm", etc.
- incomplete_fragment: Only when the chunk is truly isolated and lacks context. With continuous audio, partial chunks are normal—avoid this label when "isChunkContinuation" is true or chunkCount > 1.
- repetitive_spam: Repeated or looping content
- self_talk_trivial: "Where are my keys", "Alright then", "Come on"—trivial self-directed thoughts
- wake_word_false_positive: Wake word detected but no useful content follows
- third_party_address: The user is speaking to someone else (partner, children, etc.)

Suggested actions (choose deterministically):
- process: Handle and potentially store
- discard: Only when confidence < 0.3 OR explicit noise evidence
- ask_user: Use when 0.3 ≤ confidence < 0.6 or ambiguity remains
- store_minimal: Low-signal but potentially relevant (e.g., brief but on-topic)

Confidence rubric:
- 0.9-1.0: Clear evidence
- 0.7-0.89: Likely correct, minor ambiguity
- 0.5-0.69: Some evidence, noticeable ambiguity
- <0.5: Uncertain — prefer ask_user or store_minimal

Contextual relevance rubric (0-1):
- 0.8-1.0: Directly continues recent topic/chunk
- 0.5-0.79: Related topic or same speaker context
- 0.2-0.49: Weakly related
- 0.0-0.19: No relation

IMPORTANT:
- When in doubt (confidence < 0.6), do NOT discard—prefer "ask_user" or "store_minimal".
- TV/podcast conversations typically show scripted language or mention "subscribe", etc.
`;

      const userPrompt = `Analyze this transcription:

"${text}"

${contextInfo}

Is this meaningful content or noise?`;

      // Use centralized LLM Router which handles endpoint compatibility
      const content = await llmRouterService.executeTask(
        context?.userId || "system",
        "routing",
        userPrompt,
        injectDateIntoPrompt(systemPrompt),
        {
          maxTokens: 256,
          temperature: 0.1,
          responseFormat: "json",
        },
      );

      if (!content) {
        throw new Error("Empty LLM response");
      }

      const result = parseJSONFromLLMResponse(content);

      return {
        isMeaningful: result.isMeaningful ?? false,
        confidence: result.confidence ?? 0.5,
        category: result.category || "environmental_noise",
        reason: result.reason || "LLM analysis",
        suggestedAction: result.suggestedAction || "discard",
        contextualRelevance: result.contextualRelevance ?? 0,
      };
    } catch (error) {
      // LLM Router already handles endpoint compatibility and fallbacks
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

    // ============================================================================
    // Continuous Audio Context (Priority - show first)
    // ============================================================================
    
    if (context.fullChunkContext) {
      info.push(`\n📜 CONTEXTE AUDIO CONTINU:\n${context.fullChunkContext}`);
    }

    if (context.olderContextSummary) {
      info.push(`\n📋 Résumé contexte antérieur: ${context.olderContextSummary}`);
    }

    if (context.isChunkContinuation !== undefined) {
      info.push(context.isChunkContinuation 
        ? "⚡ Ce chunk est une CONTINUATION directe du précédent"
        : "Ce chunk commence un nouveau segment de parole"
      );
    }

    if (context.chunkCount !== undefined && context.chunkCount > 1) {
      info.push(`Nombre de chunks dans le contexte: ${context.chunkCount}`);
    }

    if (context.conversationDuration !== undefined && context.conversationDuration > 0) {
      info.push(`Durée conversation: ${context.conversationDuration.toFixed(1)}s`);
    }

    if (context.previousChunkText) {
      info.push(`Chunk précédent: "${context.previousChunkText.slice(0, 100)}${context.previousChunkText.length > 100 ? '...' : ''}"`);
    }

    // ============================================================================
    // Original Context Info
    // ============================================================================

    if (context.recentTranscripts && context.recentTranscripts.length > 0 && !context.fullChunkContext) {
      // Only show recentTranscripts if we don't have fullChunkContext (avoid duplication)
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

    if (!taskConfig || !taskConfig.provider) {
      throw new Error(
        "No AI provider configured for ROUTING task. Please configure a provider and model for the ROUTING task type in AI Settings. This is a required configuration.",
      );
    }

    const client = new OpenAI({
      apiKey: taskConfig.provider.apiKey,
      baseURL: taskConfig.provider.baseUrl || "https://api.openai.com/v1",
    });

    const modelId = taskConfig.model?.modelId;

    if (!modelId) {
      throw new Error(
        "No model ID found for ROUTING task configuration. Please ensure the ROUTING task config has a valid model selected.",
      );
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
