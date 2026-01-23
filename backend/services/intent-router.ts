// Intent Router Service
// Classifies incoming user inputs and determines system response

import prisma from "./prisma.js";
import OpenAI from "openai";

export type InputType =
  | "question"
  | "command"
  | "reflection"
  | "observation"
  | "conversation"
  | "noise";

export interface ClassificationResult {
  inputType: InputType;
  confidence: number;
  topic?: string;
  temporalReference?: string;
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

// Classification prompts for LLM
const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classification system for a personal AI assistant called "Second Brain".
Your job is to analyze user speech/text and classify it accurately.

Classification types:
- question: User is asking for information or clarification
- command: User is giving a direct instruction or request to the AI
- reflection: User is thinking out loud, journaling, or reflecting on something
- observation: User is noting something about their environment or situation
- conversation: User is having a casual conversation (not necessarily with the AI)
- noise: Random speech, background noise transcription, or unintelligible content

Important indicators:
- Commands typically start with action verbs or the wake word
- Questions contain interrogative words or question marks
- Reflections often use "I think", "I feel", "I wonder"
- Observations note facts about the present situation
- Conversations involve dialogue or social exchanges
- Noise is fragmented, incomplete, or doesn't form coherent thoughts

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
  "temporalReference": "any time reference mentioned or null"
}

Guidelines for importance scoring:
- 0.0-0.2: Trivial, noise, or very mundane
- 0.2-0.4: Low importance, casual conversation
- 0.4-0.6: Moderate importance, useful observations
- 0.6-0.8: Important, decisions, commitments, insights
- 0.8-1.0: Critical, major life events, key decisions`;

export class IntentRouterService {
  /**
   * Analyze user input and classify intent
   */
  async classifyInput(
    text: string,
    context?: ClassificationContext,
  ): Promise<ClassificationResult> {
    // Quick noise filter for very short or empty inputs
    if (!text || text.trim().length < 3) {
      return this.createNoiseResult();
    }

    // Check for obvious noise patterns
    if (this.isLikelyNoise(text)) {
      return this.createNoiseResult();
    }

    // If we have a wake word, it's likely a command
    if (context?.hasWakeWord) {
      return this.classifyAsCommand(text, context);
    }

    // Try LLM classification if available
    try {
      return await this.llmClassify(text, context);
    } catch (error) {
      console.warn("LLM classification failed, using heuristics:", error);
      return this.heuristicClassify(text, context);
    }
  }

  /**
   * Use LLM for classification
   */
  private async llmClassify(
    text: string,
    context?: ClassificationContext,
  ): Promise<ClassificationResult> {
    // Get user's configured routing model
    const whereClause: any = { taskType: "ROUTING" };
    if (context?.userId) {
      whereClause.userId = context.userId;
    }

    const taskConfig = await prisma.aITaskConfig.findFirst({
      where: whereClause,
      include: {
        provider: true,
        model: true,
      },
    });

    if (!taskConfig || !taskConfig.provider) {
      throw new Error("No routing model configured");
    }

    const openai = new OpenAI({
      apiKey: taskConfig.provider.apiKey,
      baseURL: taskConfig.provider.baseUrl || "https://api.openai.com/v1",
    });

    const userPrompt = `Classify the following input:
"${text}"

${context?.hasWakeWord ? "Note: This input was preceded by a wake word." : ""}
${context?.duration ? `Audio duration: ${context.duration.toFixed(1)}s` : ""}`;

    const response = await openai.chat.completions.create({
      model: taskConfig.model?.modelId || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty LLM response");
    }

    const result = JSON.parse(content);

    return {
      inputType: result.inputType || "observation",
      confidence: result.confidence || 0.7,
      topic: result.topic,
      temporalReference: result.temporalReference,
      shouldStore: result.shouldStore ?? true,
      shouldCallTools: result.shouldCallTools ?? false,
      memoryScopes: this.determineMemoryScopes(result),
      importanceScore: result.importanceScore || 0.5,
      entities: result.entities || [],
      sentiment: result.sentiment || "neutral",
    };
  }

  /**
   * Heuristic-based classification (fallback)
   */
  private heuristicClassify(
    text: string,
    context?: ClassificationContext,
  ): ClassificationResult {
    const normalizedText = text.toLowerCase().trim();

    // Check for questions
    const questionPatterns = [
      /^(what|who|where|when|why|how|is|are|do|does|can|could|would|should|will)/i,
      /\?$/,
      /^(est-ce que|qu'est-ce|comment|pourquoi|quand|où|qui|quel)/i,
    ];

    for (const pattern of questionPatterns) {
      if (pattern.test(normalizedText)) {
        return {
          inputType: "question",
          confidence: 0.8,
          shouldStore: true,
          shouldCallTools: false,
          memoryScopes: ["short_term"],
          importanceScore: 0.5,
          entities: this.extractBasicEntities(text),
          sentiment: "neutral",
        };
      }
    }

    // Check for commands
    const commandPatterns = [
      /^(do|make|create|send|find|search|add|remove|delete|update|set|get|show|tell|remind|schedule)/i,
      /^(fais|crée|envoie|trouve|cherche|ajoute|supprime|met|montre|dis|rappelle)/i,
    ];

    for (const pattern of commandPatterns) {
      if (pattern.test(normalizedText)) {
        return {
          inputType: "command",
          confidence: 0.75,
          shouldStore: true,
          shouldCallTools: true,
          memoryScopes: ["short_term"],
          importanceScore: 0.6,
          entities: this.extractBasicEntities(text),
          sentiment: "neutral",
        };
      }
    }

    // Check for reflections
    const reflectionPatterns = [
      /^(i think|i feel|i believe|i wonder|maybe|perhaps)/i,
      /^(je pense|je crois|je me demande|peut-être)/i,
    ];

    for (const pattern of reflectionPatterns) {
      if (pattern.test(normalizedText)) {
        return {
          inputType: "reflection",
          confidence: 0.7,
          shouldStore: true,
          shouldCallTools: false,
          memoryScopes: ["short_term", "daily"],
          importanceScore: 0.6,
          entities: this.extractBasicEntities(text),
          sentiment: this.detectBasicSentiment(text),
        };
      }
    }

    // Default to observation
    return {
      inputType: "observation",
      confidence: 0.6,
      shouldStore: text.length > 20,
      shouldCallTools: false,
      memoryScopes: ["short_term"],
      importanceScore: this.assessMeaningfulness(text) * 0.6,
      entities: this.extractBasicEntities(text),
      sentiment: this.detectBasicSentiment(text),
    };
  }

  /**
   * Classify as command (when wake word detected)
   */
  private classifyAsCommand(
    text: string,
    context?: ClassificationContext,
  ): ClassificationResult {
    return {
      inputType: "command",
      confidence: 0.9,
      shouldStore: true,
      shouldCallTools: true,
      memoryScopes: ["short_term"],
      importanceScore: 0.7,
      entities: this.extractBasicEntities(text),
      sentiment: "neutral",
    };
  }

  /**
   * Create a noise classification result
   */
  private createNoiseResult(): ClassificationResult {
    return {
      inputType: "noise",
      confidence: 0.9,
      shouldStore: false,
      shouldCallTools: false,
      memoryScopes: [],
      importanceScore: 0,
      entities: [],
      sentiment: "neutral",
    };
  }

  /**
   * Check if input is likely noise
   */
  private isLikelyNoise(text: string): boolean {
    const normalized = text.toLowerCase().trim();

    // Very short
    if (normalized.length < 5) return true;

    // Only non-word characters
    if (!/\w{2,}/.test(normalized)) return true;

    // Common filler words only
    const fillerOnly =
      /^(um+|uh+|ah+|oh+|hmm+|euh+|ben+|bah+|hein+)+[.,!?\s]*$/i;
    if (fillerOnly.test(normalized)) return true;

    // Repetitive characters
    if (/(.)\1{4,}/.test(normalized)) return true;

    return false;
  }

  /**
   * Assess how meaningful the text is (0-1)
   */
  private assessMeaningfulness(text: string): number {
    let score = 0.5;

    // Length contributes to meaningfulness
    if (text.length > 50) score += 0.1;
    if (text.length > 100) score += 0.1;
    if (text.length > 200) score += 0.1;

    // Presence of proper nouns (capitalized words)
    const properNouns = text.match(/\b[A-Z][a-z]+\b/g);
    if (properNouns && properNouns.length > 0) {
      score += Math.min(0.2, properNouns.length * 0.05);
    }

    // Presence of numbers (dates, times, amounts)
    if (/\d+/.test(text)) score += 0.1;

    // Presence of important keywords
    const importantKeywords = [
      "important",
      "urgent",
      "remember",
      "don't forget",
      "meeting",
      "deadline",
      "decision",
      "goal",
      "plan",
      "idea",
      "project",
      "problem",
      "solution",
      "important",
      "urgent",
      "rappel",
      "n'oublie pas",
      "réunion",
      "échéance",
      "décision",
      "objectif",
      "plan",
      "idée",
      "projet",
      "problème",
      "solution",
    ];

    const normalizedText = text.toLowerCase();
    for (const keyword of importantKeywords) {
      if (normalizedText.includes(keyword)) {
        score += 0.1;
        break;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Extract basic entities from text
   */
  private extractBasicEntities(text: string): string[] {
    const entities: string[] = [];

    // Capitalized words (potential proper nouns)
    const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g);
    if (properNouns) {
      entities.push(...properNouns);
    }

    // Dates
    const dates = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g);
    if (dates) {
      entities.push(...dates);
    }

    // Times
    const times = text.match(/\b\d{1,2}[h:]\d{2}\b/g);
    if (times) {
      entities.push(...times);
    }

    // Email addresses
    const emails = text.match(/\b[\w.-]+@[\w.-]+\.\w+\b/g);
    if (emails) {
      entities.push(...emails);
    }

    return [...new Set(entities)].slice(0, 10);
  }

  /**
   * Detect basic sentiment
   */
  private detectBasicSentiment(
    text: string,
  ): "positive" | "negative" | "neutral" {
    const normalizedText = text.toLowerCase();

    const positiveWords = [
      "happy",
      "great",
      "good",
      "excellent",
      "wonderful",
      "amazing",
      "love",
      "enjoy",
      "content",
      "bien",
      "super",
      "génial",
      "excellent",
      "merveilleux",
      "incroyable",
      "aime",
      "adore",
    ];

    const negativeWords = [
      "sad",
      "bad",
      "terrible",
      "awful",
      "hate",
      "angry",
      "frustrated",
      "worried",
      "anxious",
      "triste",
      "mauvais",
      "terrible",
      "horrible",
      "déteste",
      "énervé",
      "frustré",
      "inquiet",
      "anxieux",
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (normalizedText.includes(word)) positiveCount++;
    }

    for (const word of negativeWords) {
      if (normalizedText.includes(word)) negativeCount++;
    }

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  /**
   * Determine memory scopes based on classification
   */
  private determineMemoryScopes(result: any): string[] {
    const scopes = ["short_term"];

    if (result.importanceScore >= 0.6) {
      scopes.push("daily");
    }

    if (result.importanceScore >= 0.8) {
      scopes.push("weekly");
    }

    return scopes;
  }

  /**
   * Extract temporal references from input
   */
  extractTemporalReferences(text: string): string | undefined {
    const patterns = [
      // English
      /\b(today|tomorrow|yesterday|next week|last week|this week)\b/i,
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
      /\b(in \d+ (days?|weeks?|months?|years?))\b/i,
      // French
      /\b(aujourd'hui|demain|hier|la semaine prochaine|la semaine dernière|cette semaine)\b/i,
      /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i,
      /\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i,
      /\b(dans \d+ (jours?|semaines?|mois|ans?))\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }
}
