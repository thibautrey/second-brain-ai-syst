// Intent Router Service
// Classifies incoming user inputs and determines system response
// ALL classification is done via LLM - no regex/pattern matching

import OpenAI from "openai";
import { injectDateIntoPrompt, llmRouterService } from "./llm-router.js";
import { parseJSONFromLLMResponse } from "../utils/json-parser.js";
import prisma from "./prisma.js";

// ============================================================================
// PROVIDER CACHE (Optimization 4)
// Cache LLM provider configs by userId with 5 minute TTL
// ============================================================================
interface CachedProvider {
  client: OpenAI;
  modelId: string;
  timestamp: number;
}

const providerCache = new Map<string, CachedProvider>();
const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedProvider(userId: string): CachedProvider | null {
  const cached = providerCache.get(userId);
  if (cached && Date.now() - cached.timestamp < PROVIDER_CACHE_TTL_MS) {
    return cached;
  }
  // Expired or not found
  if (cached) {
    providerCache.delete(userId);
  }
  return null;
}

function setCachedProvider(
  userId: string,
  client: OpenAI,
  modelId: string,
): void {
  providerCache.set(userId, {
    client,
    modelId,
    timestamp: Date.now(),
  });
}

// Export for use in chat.controller.ts
export { providerCache, PROVIDER_CACHE_TTL_MS };

export type InputType =
  | "question"
  | "command"
  | "reflection"
  | "observation"
  | "conversation"
  | "noise";

export type TimeBucket =
  | "today"
  | "past_week"
  | "past_month"
  | "past_year"
  | "all_time";

export interface ClassificationResult {
  inputType: InputType;
  confidence: number;
  topic?: string;
  temporalReference?: string;
  timeBucket?: TimeBucket;
  shouldStore: boolean;
  shouldCallTools: boolean;
  memoryScopes: string[]; // 'short_term', 'daily', 'weekly', 'monthly', etc.
  importanceScore: number; // 0.0 - 1.0
  entities: string[];
  sentiment: "positive" | "negative" | "neutral";
}

export interface ClassificationContext {
  hasWakeWord?: boolean;
  duration?: number;
  speakerConfidence?: number;
  previousContext?: string;
  userId?: string;
}

export interface ResponseValueAssessment {
  isValuable: boolean;
  reason: string;
  adjustedImportanceScore: number;
  shouldStore: boolean;
  isFactualDeclaration: boolean; // True if user is just sharing a fact (e.g., "My girlfriend is Blandine")
  factToStore?: string; // The clean fact to store (without AI acknowledgment)
}

// ============================================================================
// UNIFIED POST-RESPONSE ANALYSIS PROMPT (Optimization 5)
// Single LLM call after response that does BOTH classification AND value assessment
// ============================================================================
const UNIFIED_ANALYSIS_SYSTEM_PROMPT = `You are an analysis system for a personal AI assistant called "Second Brain".
Your job is to analyze a complete user-AI exchange and determine:
1. The type and importance of the user's input
2. Whether this exchange should be stored in memory

You must respond with a JSON object containing:
{
  "inputType": "question|command|reflection|observation|conversation|noise",
  "confidence": 0.0-1.0,
  "topic": "brief topic description or null",
  "entities": ["list", "of", "named", "entities"],
  "sentiment": "positive|negative|neutral",
  "temporalReference": "any time reference mentioned or null",
  "timeBucket": "today|past_week|past_month|past_year|all_time",
  "shouldStore": true|false,
  "importanceScore": 0.0-1.0,
  "isFactualDeclaration": true|false,
  "factToStore": "clean fact to store (only if isFactualDeclaration is true)",
  "reason": "brief explanation of storage decision"
}

Classification types:
- question: User asked for information
- command: User gave a direct instruction
- reflection: User was thinking out loud or journaling
- observation: User noted something about their environment
- conversation: Casual conversation
- noise: Random/unintelligible content

Importance scoring:
- 0.0-0.2: Trivial, noise, greetings
- 0.2-0.4: Low importance, casual exchanges
- 0.4-0.6: Moderate importance, useful observations
- 0.6-0.8: Important: decisions, commitments, insights, personal reflections
- 0.8-1.0: Critical: major life events, key decisions, deadlines

Time bucket (deterministic):
- today: The exchange is about the current day or has no time reference
- past_week: Refers to the last 7 days
- past_month: Refers to the last 30 days
- past_year: Refers to the last 365 days
- all_time: Long-term or timeless facts/insights

Storage guidelines:
- DO NOT STORE if:
  - The AI couldn't answer ("I don't know", disclaimers about AI limitations)
  - The exchange was meaningless or a test
  - It's noise or filler words

- DO STORE if:
  - User shared personal facts (FACTUAL DECLARATION) - set isFactualDeclaration=true and factToStore
  - AI provided useful information or insights
  - User expressed emotions, intentions, plans, or goals
  - Exchange contains actionable information, dates, or commitments

For FACTUAL DECLARATIONS (e.g., "My girlfriend is Blandine", "I work at Google"):
- Set isFactualDeclaration: true
- Set factToStore: reformulated fact WITHOUT the AI response (e.g., "L'utilisateur travaille chez Google")`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape special characters in text for safe insertion into JSON prompts
 * Prevents JSON parsing errors when text contains quotes or newlines
 */
function escapeTextForJSON(text: string): string {
  return text
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, "\\n") // Escape newlines
    .replace(/\r/g, "\\r") // Escape carriage returns
    .replace(/\t/g, "\\t"); // Escape tabs
}

// Legacy prompt for pre-response classification (kept for compatibility)
const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classification system for a personal AI assistant called "Second Brain".
Your job is to analyze user speech/text and classify it accurately.

Classification types:
- question: User is asking for information or clarification
- command: User is giving a direct instruction or request to the AI
- reflection: User is thinking out loud, journaling, or reflecting on something
- observation: User is noting something about their environment or situation
- conversation: User is having a casual conversation (not necessarily with the AI)
- noise: Random speech, background noise transcription, unintelligible content, filler words only (um, uh, euh), or text that is too short/fragmented to be meaningful

You must respond with a JSON object containing:
{
  "inputType": "question|command|reflection|observation|conversation|noise",
  "confidence": 0.0-1.0,
  "topic": "brief topic description or null",
  "shouldStore": true|false (should this be stored in memory?),
  "shouldCallTools": true|false (does this require tool execution?),
  "importanceScore": 0.0-1.0 (how important is this for long-term memory?),
  "entities": ["list", "of", "named", "entities"],
  "sentiment": "positive|negative|neutral",
  "temporalReference": "any time reference mentioned or null",
  "timeBucket": "today|past_week|past_month|past_year|all_time"
}

Guidelines for importance scoring:
- 0.0-0.2: Trivial, noise, or very mundane (filler words, incomplete sentences, greetings)
- 0.2-0.4: Low importance, casual conversation, simple exchanges
- 0.4-0.6: Moderate importance, useful observations, general questions
- 0.6-0.8: Important, decisions, commitments, insights, personal reflections
- 0.8-1.0: Critical, major life events, key decisions, important deadlines

Guidelines for shouldStore:
- false: Noise, filler words, unintelligible content, content too short to be meaningful, very short inputs (<5 chars)
- true: Any meaningful content that could be valuable to recall later

Time bucket (deterministic):
- today: Current day or no explicit time reference
- past_week: Mentions within last 7 days
- past_month: Mentions within last 30 days
- past_year: Mentions within last 365 days
- all_time: Long-term facts, timeless knowledge, or goals without time bounds`;

const RESPONSE_VALUE_SYSTEM_PROMPT = `You are a memory quality assessor for a personal AI assistant called "Second Brain".
Your job is to evaluate if a question-response pair contains valuable information worth storing in long-term memory.

You must respond with a JSON object containing:
{
  "isValuable": true|false,
  "reason": "brief explanation of why this is or isn't valuable",
  "adjustedImportanceScore": 0.0-1.0,
  "shouldStore": true|false,
  "isFactualDeclaration": true|false,
  "factToStore": "the clean fact to store (only if isFactualDeclaration is true)"
}

IMPORTANT - Factual Declarations:
When the user simply shares personal information or facts (e.g., "My girlfriend is Blandine", "I work at Google", "My birthday is March 15th"), this is a FACTUAL DECLARATION.
For factual declarations:
- Set isFactualDeclaration: true
- Set factToStore: a clean reformulation of the fact (e.g., "La copine de l'utilisateur s'appelle Blandine")
- Do NOT include the AI's response (like "Compris") in factToStore
- These ARE valuable and should be stored

Guidelines for assessing value:
- NOT VALUABLE (shouldStore: false):
  - The AI couldn't answer and said "I don't know", "I don't have access to", "I cannot remember", etc.
  - The response is a generic disclaimer about AI limitations
  - The question was about personal info the AI doesn't have (user's name, personal details not in context)
  - The response provides no new information or insight
  - The interaction was just a test or meaningless exchange
  - The AI admits it lacks information about the user or the topic

- VALUABLE (shouldStore: true):
  - The AI provided useful information, advice, or insights
  - The user shared personal reflections, decisions, or goals
  - The user shared personal facts or information (FACTUAL DECLARATION)
  - The exchange contains actionable information
  - The response includes specific facts, dates, or commitments
  - The user expressed emotions, intentions, or plans worth remembering`;

export class IntentRouterService {
  /**
   * Initialize or get OpenAI client for a user
   * Uses cache with 5-minute TTL (Optimization 4)
   */
  private async getOpenAIClient(
    userId?: string,
  ): Promise<{ client: OpenAI; modelId: string }> {
    // Check cache first (Optimization 4)
    if (userId) {
      const cached = getCachedProvider(userId);
      if (cached) {
        return { client: cached.client, modelId: cached.modelId };
      }
    }

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
      // ROUTING task config is required
      throw new Error(
        "No AI provider configured for ROUTING task. Please configure a provider and model for the ROUTING task type in AI Settings. This is a required configuration.",
      );
    }

    const modelIdValue = taskConfig.model?.modelId;

    if (!modelIdValue) {
      throw new Error(
        "No model ID found for ROUTING task configuration. Please ensure the ROUTING task config has a valid model selected.",
      );
    }

    // Validate that modelId looks like a real model identifier (not just a numeric ID)
    if (/^\d+$/.test(modelIdValue)) {
      console.error(
        `[CRITICAL] ROUTING task model ID appears to be a database ID instead of model identifier: ${modelIdValue}. This suggests the AIModel.modelId field wasn't populated correctly.`,
      );
      throw new Error(
        `Invalid model identifier for ROUTING task: "${modelIdValue}". The model configuration may be corrupted. Please reconfigure your AI settings.`,
      );
    }

    modelId = modelIdValue;

    client = new OpenAI({
      apiKey: taskConfig.provider.apiKey,
      baseURL: taskConfig.provider.baseUrl || "https://api.openai.com/v1",
    });

    // Cache the provider (Optimization 4)
    if (userId) {
      setCachedProvider(userId, client, modelId);
    }

    return { client, modelId };
  }

  /**
   * UNIFIED: Analyze complete exchange AFTER response (Optimization 5)
   * Single LLM call that does classification + value assessment
   * This replaces the need for separate classifyInput + assessResponseValue calls
   * Uses centralized LLM Router for endpoint compatibility handling
   */
  async analyzeExchangePostResponse(
    userMessage: string,
    aiResponse: string,
    userId?: string,
  ): Promise<{
    classification: ClassificationResult;
    valueAssessment: ResponseValueAssessment;
  }> {
    try {
      // Escape special characters to prevent JSON parsing errors
      const escapedUserMessage = escapeTextForJSON(userMessage);
      const escapedAiResponse = escapeTextForJSON(aiResponse);

      const userPrompt = `Analyze this complete user-AI exchange:

USER MESSAGE: "${escapedUserMessage}"

AI RESPONSE: "${escapedAiResponse}"

Provide a complete analysis including classification and storage decision.`;

      // Use centralized LLM Router which handles endpoint compatibility
      const content = await llmRouterService.executeTask(
        userId || "system",
        "routing",
        userPrompt,
        injectDateIntoPrompt(UNIFIED_ANALYSIS_SYSTEM_PROMPT),
        {
          maxTokens: 1024,
          temperature: 0.1,
          responseFormat: "json",
        },
      );

      if (!content) {
        throw new Error("Empty LLM response");
      }

      let result;
      try {
        result = parseJSONFromLLMResponse(content);
      } catch (parseError) {
        console.error(
          "[IntentRouter] JSON parse error in analyzeExchangePostResponse:",
          parseError,
        );
        console.error(
          "[IntentRouter] Response content:",
          content.substring(0, 500),
        );
        throw parseError;
      }

      // Build classification result
      const classification: ClassificationResult = {
        inputType: result.inputType || "observation",
        confidence: result.confidence || 0.7,
        topic: result.topic || undefined,
        temporalReference: result.temporalReference || undefined,
        timeBucket: result.timeBucket || "today",
        shouldStore: result.shouldStore ?? false,
        shouldCallTools: false, // Post-response, tools already executed if needed
        memoryScopes: this.determineMemoryScopes(result),
        importanceScore: result.importanceScore || 0,
        entities: result.entities || [],
        sentiment: result.sentiment || "neutral",
      };

      // Build value assessment result
      const valueAssessment: ResponseValueAssessment = {
        isValuable: result.shouldStore && result.importanceScore >= 0.3,
        reason: result.reason || "No reason provided",
        adjustedImportanceScore: result.importanceScore || 0,
        shouldStore: result.shouldStore ?? false,
        isFactualDeclaration: result.isFactualDeclaration ?? false,
        factToStore: result.factToStore || undefined,
      };

      return { classification, valueAssessment };
    } catch (error) {
      // LLM Router already handles endpoint compatibility and fallbacks
      console.error("Unified exchange analysis failed:", error);
      // Return safe defaults
      return {
        classification: this.createNoiseResult("Analysis failed"),
        valueAssessment: {
          isValuable: false,
          reason: "Analysis failed - defaulting to not store",
          adjustedImportanceScore: 0,
          shouldStore: false,
          isFactualDeclaration: false,
          factToStore: undefined,
        },
      };
    }
  }

  /**
   * Analyze user input and classify intent using LLM
   * ALL classification is done via LLM - no regex/pattern matching
   */
  async classifyInput(
    text: string,
    context?: ClassificationContext,
  ): Promise<ClassificationResult> {
    // Only filter completely empty inputs
    if (!text || text.trim().length === 0) {
      return this.createNoiseResult("Empty input");
    }

    // Use LLM for ALL classification - no heuristic fallback
    try {
      return await this.llmClassify(text, context);
    } catch (error) {
      console.error("LLM classification failed:", error);
      // Return a safe default that won't store anything if LLM fails
      // Do NOT fall back to heuristics - if LLM fails, we don't classify
      return {
        inputType: "noise",
        confidence: 0.5,
        shouldStore: false,
        shouldCallTools: false,
        memoryScopes: [],
        importanceScore: 0,
        entities: [],
        sentiment: "neutral",
        topic: "LLM classification unavailable",
        temporalReference: undefined,
        timeBucket: "today",
      };
    }
  }

  /**
   * Use LLM for classification
   * Uses centralized LLM Router for endpoint compatibility handling
   */
  private async llmClassify(
    text: string,
    context?: ClassificationContext,
  ): Promise<ClassificationResult> {
    const contextInfo = [];
    if (context?.hasWakeWord) {
      contextInfo.push(
        "Note: This input was preceded by a wake word, indicating direct address to the AI.",
      );
    }
    if (context?.duration) {
      contextInfo.push(`Audio duration: ${context.duration.toFixed(1)}s`);
    }
    if (context?.speakerConfidence !== undefined) {
      contextInfo.push(
        `Speaker identification confidence: ${(context.speakerConfidence * 100).toFixed(0)}%`,
      );
    }
    if (context?.previousContext) {
      contextInfo.push(`Previous context: ${context.previousContext}`);
    }

    const userPrompt = `Classify the following input:
"${text}"

${contextInfo.length > 0 ? contextInfo.join("\n") : "No additional context."}`;

    // Use centralized LLM Router which handles endpoint compatibility
    const content = await llmRouterService.executeTask(
      context?.userId || "system",
      "routing",
      userPrompt,
      injectDateIntoPrompt(CLASSIFICATION_SYSTEM_PROMPT),
      {
        maxTokens: 512,
        temperature: 0.1,
        responseFormat: "json",
      },
    );

    if (!content) {
      throw new Error("Empty LLM response");
    }

    const result = parseJSONFromLLMResponse(content);

    return {
      inputType: result.inputType || "observation",
      confidence: result.confidence || 0.7,
      topic: result.topic || undefined,
      temporalReference: result.temporalReference || undefined,
      timeBucket: result.timeBucket || "today",
      shouldStore: result.shouldStore ?? false, // Default to NOT storing
      shouldCallTools: result.shouldCallTools ?? false,
      memoryScopes: this.determineMemoryScopes(result),
      importanceScore: result.importanceScore || 0,
      entities: result.entities || [],
      sentiment: result.sentiment || "neutral",
    };
  }

  /**
   * Assess if a question-response pair is valuable enough to store
   * This should be called AFTER getting the LLM response to evaluate if the exchange is worth remembering
   * Uses centralized LLM Router for endpoint compatibility handling
   */
  async assessResponseValue(
    question: string,
    response: string,
    originalClassification: ClassificationResult,
    userId?: string,
  ): Promise<ResponseValueAssessment> {
    try {
      const userPrompt = `Evaluate if this question-response pair should be stored in memory:

QUESTION: "${question}"

RESPONSE: "${response}"

ORIGINAL CLASSIFICATION:
- Type: ${originalClassification.inputType}
- Initial importance score: ${originalClassification.importanceScore}
- Topic: ${originalClassification.topic || "none"}

Should this exchange be stored in the user's memory? Consider:
1. Does the response actually provide useful information?
2. Is this just a "I don't know" or disclaimer response?
3. Would recalling this later be valuable to the user?`;

      // Use centralized LLM Router which handles endpoint compatibility
      const content = await llmRouterService.executeTask(
        userId || "system",
        "routing",
        userPrompt,
        injectDateIntoPrompt(RESPONSE_VALUE_SYSTEM_PROMPT),
        {
          maxTokens: 512,
          temperature: 0.1,
          responseFormat: "json",
        },
      );

      if (!content) {
        throw new Error("Empty LLM response for value assessment");
      }

      const result = parseJSONFromLLMResponse(content);

      return {
        isValuable: result.isValuable ?? false,
        reason: result.reason || "No reason provided",
        adjustedImportanceScore: result.adjustedImportanceScore ?? 0,
        shouldStore: result.shouldStore ?? false,
        isFactualDeclaration: result.isFactualDeclaration ?? false,
        factToStore: result.factToStore || undefined,
      };
    } catch (error) {
      // LLM Router already handles endpoint compatibility and fallbacks
      console.error("Response value assessment failed:", error);
      // If assessment fails, default to not storing to avoid low-quality memories
      return {
        isValuable: false,
        reason: "Assessment failed - defaulting to not store",
        adjustedImportanceScore: 0,
        shouldStore: false,
        isFactualDeclaration: false,
        factToStore: undefined,
      };
    }
  }

  /**
   * Create a noise classification result
   */
  private createNoiseResult(reason?: string): ClassificationResult {
    return {
      inputType: "noise",
      confidence: 1.0,
      shouldStore: false,
      shouldCallTools: false,
      memoryScopes: [],
      importanceScore: 0,
      entities: [],
      sentiment: "neutral",
      topic: reason,
    };
  }

  /**
   * Determine memory scopes based on classification
   */
  private determineMemoryScopes(result: any): string[] {
    if (!result.shouldStore) {
      return [];
    }

    const scopes = ["short_term"];

    const bucket: TimeBucket | undefined = result.timeBucket;
    switch (bucket) {
      case "today":
        scopes.push("daily");
        break;
      case "past_week":
        scopes.push("daily", "weekly");
        break;
      case "past_month":
        scopes.push("daily", "weekly", "monthly");
        break;
      case "past_year":
        scopes.push("daily", "weekly", "monthly", "yearly");
        break;
      case "all_time":
        scopes.push("daily", "weekly", "monthly", "quarterly", "yearly", "multi_year");
        break;
      default:
        // Fall back to importance-based heuristics if bucket is missing
        if (result.importanceScore >= 0.6) {
          scopes.push("daily");
        }
        if (result.importanceScore >= 0.8) {
          scopes.push("weekly");
        }
        break;
    }

    return Array.from(new Set(scopes));
  }
}
