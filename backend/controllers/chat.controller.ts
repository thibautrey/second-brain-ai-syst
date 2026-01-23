/**
 * Chat Controller
 *
 * Handles chat requests with SSE streaming responses
 *
 * OPTIMIZATIONS IMPLEMENTED:
 * - Opt 4: Provider cache with 5-minute TTL
 * - Opt 5: Single LLM call for classification+assessment AFTER response
 * - Opt 7: Parallel fetch of provider + memory search
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import {
  IntentRouterService,
  providerCache,
  PROVIDER_CACHE_TTL_MS,
} from "../services/intent-router.js";
import { memorySearchService } from "../services/memory-search.js";
import prisma from "../services/prisma.js";
import OpenAI from "openai";
import { flowTracker } from "../services/flow-tracker.js";
import { randomBytes } from "crypto";

const intentRouter = new IntentRouterService();

// ============================================================================
// PROVIDER CACHE FOR CHAT (Optimization 4)
// Uses same cache structure as intent-router
// ============================================================================
interface CachedChatProvider {
  provider: {
    id: string;
    name: string;
    apiKey: string;
    baseUrl: string | null;
  };
  modelId: string;
  timestamp: number;
}

const chatProviderCache = new Map<string, CachedChatProvider>();

async function getChatProvider(
  userId: string,
): Promise<{ provider: any; modelId: string } | null> {
  // Check cache first
  const cached = chatProviderCache.get(userId);
  if (cached && Date.now() - cached.timestamp < PROVIDER_CACHE_TTL_MS) {
    return { provider: cached.provider, modelId: cached.modelId };
  }

  // Fetch from DB
  const taskConfig = await prisma.aITaskConfig.findFirst({
    where: { userId, taskType: "REFLECTION" },
    include: { provider: true, model: true },
  });

  let provider = taskConfig?.provider;
  let modelId = taskConfig?.model?.modelId || "gpt-3.5-turbo";

  if (!provider) {
    provider = await prisma.aIProvider.findFirst({ where: { userId } });
    if (!provider) return null;
  }

  // Cache it
  chatProviderCache.set(userId, {
    provider: {
      id: provider.id,
      name: provider.name,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
    },
    modelId,
    timestamp: Date.now(),
  });

  return { provider, modelId };
}

const CHAT_SYSTEM_PROMPT = `Tu es Second Brain, un assistant personnel intelligent et concis.
Tu aides l'utilisateur à organiser ses pensées, retrouver ses souvenirs et répondre à ses questions.
Tu as accès aux mémoires de l'utilisateur pour personnaliser tes réponses.

INSTRUCTIONS IMPORTANTES:
- Réponds de manière TRÈS CONCISE et utile
- Pour les simples déclarations factuelles (partages d'information sur sa vie), réponds juste "Compris" ou avec un très court acquiescement
- N'ajoute PAS de questions à la fin de chaque réponse - c'est lourd et inutile
- Pose une question SEULEMENT si c'est vraiment pertinent ou si tu as besoin de clarification
- Utilise le contexte des mémoires quand c'est pertinent, mais de manière discrète
- Si l'utilisateur demande quelque chose, réponds directement sans étapes superflues
- Sois naturel: un ami ne pose pas une question à chaque fois qu'on lui dit quelque chose`;

/**
 * POST /api/chat
 * Stream chat response using SSE
 *
 * OPTIMIZED FLOW:
 * 1. PARALLEL: Memory search + Provider fetch (no pre-classification!)
 * 2. Stream LLM response to user
 * 3. ASYNC (after response): Unified analysis (classification + value assessment)
 */
export async function chatStream(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const flowId = randomBytes(8).toString("hex");
  const startTime = Date.now();

  // Start flow tracking
  flowTracker.startFlow(flowId, "chat");
  flowTracker.trackEvent({
    flowId,
    stage: "chat_received",
    service: "ChatController",
    status: "started",
    data: { messageLength: message.length },
  });

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const messageId = `msg_${Date.now()}`;

  try {
    // Send start event
    res.write(`data: ${JSON.stringify({ type: "start", messageId })}\n\n`);

    // 1. PARALLEL: Memory search + Provider fetch (Optimization 7)
    // NO pre-classification - we'll do unified analysis AFTER response (Optimization 5)
    const parallelStart = Date.now();

    const [memorySearchResult, providerResult] = await Promise.all([
      // Memory search (wrapped to handle errors gracefully)
      memorySearchService.semanticSearch(userId, message, 5).catch((error) => {
        console.warn(
          "Memory search failed, continuing without context:",
          error,
        );
        return { results: [], error };
      }),
      // Provider fetch (using cache - Optimization 4 & 7)
      getChatProvider(userId),
    ]);

    const parallelDuration = Date.now() - parallelStart;

    // 2. Process memory search results (already fetched in parallel)
    let memoryContext: string[] = [];
    if ("error" in memorySearchResult) {
      flowTracker.trackEvent({
        flowId,
        stage: "memory_search",
        service: "MemorySearchService",
        status: "failed",
        duration: parallelDuration,
        error:
          memorySearchResult.error instanceof Error
            ? memorySearchResult.error.message
            : "Unknown error",
        decision:
          "Recherche mémoire échouée. Continuation sans contexte mémoire.",
      });
    } else {
      memoryContext = memorySearchResult.results.map(
        (r) =>
          `[Mémoire du ${new Date(r.memory.createdAt).toLocaleDateString()}]: ${r.memory.content}`,
      );

      const memoryDecision =
        `${memorySearchResult.results.length} mémoire(s) pertinente(s) trouvée(s). ` +
        `Score moyen: ${((memorySearchResult.results.reduce((sum, r) => sum + (r.score || 0), 0) / memorySearchResult.results.length) * 100).toFixed(1)}%.`;

      flowTracker.trackEvent({
        flowId,
        stage: "memory_search",
        service: "MemorySearchService",
        status: "success",
        duration: parallelDuration,
        data: {
          resultsFound: memorySearchResult.results.length,
          query: message,
          topResults: memorySearchResult.results.slice(0, 3).map((r, i) => ({
            rank: i + 1,
            score: r.score,
            distance: r.distance,
            dateCreated: r.memory.createdAt,
          })),
          parallelExecution: true,
        },
        decision: memoryDecision,
      });
    }

    // 3. Check provider (already fetched in parallel - Optimization 4 & 7)
    if (!providerResult) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          data: "Aucun fournisseur LLM configuré. Allez dans Paramètres > IA pour en ajouter un.",
        })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({ type: "end", messageId })}\n\n`);
      flowTracker.completeFlow(flowId, "failed");
      return res.end();
    }

    const { provider, modelId } = providerResult;

    flowTracker.trackEvent({
      flowId,
      stage: "parallel_fetch_complete",
      service: "ChatController",
      status: "success",
      duration: parallelDuration,
      data: {
        providerName: provider.name,
        modelId,
        memoriesFound:
          "error" in memorySearchResult ? 0 : memorySearchResult.results.length,
        fromCache: parallelDuration < 50, // If very fast, likely from cache
      },
      decision: `Parallel fetch: Provider=${provider.name}, Model=${modelId}, Mémoires=${"error" in memorySearchResult ? 0 : memorySearchResult.results.length}`,
    });

    // 4. Create OpenAI client
    const openai = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl || "https://api.openai.com/v1",
    });

    // 5. Build messages with memory context
    const systemPrompt =
      memoryContext.length > 0
        ? `${CHAT_SYSTEM_PROMPT}\n\nContexte des mémoires pertinentes:\n${memoryContext.join("\n")}`
        : CHAT_SYSTEM_PROMPT;

    // 6. Stream response
    const llmStart = Date.now();
    const stream = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        res.write(
          `data: ${JSON.stringify({ type: "token", data: content })}\n\n`,
        );
      }
    }

    flowTracker.trackEvent({
      flowId,
      stage: "llm_response",
      service: "OpenAI",
      status: "success",
      duration: Date.now() - llmStart,
      data: { responseLength: fullResponse.length },
    });

    // Complete flow and send response to user IMMEDIATELY
    const userResponseDuration = Date.now() - startTime;

    flowTracker.trackEvent({
      flowId,
      stage: "chat_complete",
      service: "ChatController",
      status: "success",
      duration: userResponseDuration,
      data: { asyncMemoryProcessing: true },
    });

    // Send end event to user - RESPONSE IS NOW COMPLETE
    res.write(`data: ${JSON.stringify({ type: "end", messageId })}\n\n`);
    res.end();

    // 7. ASYNC: Unified analysis AFTER response (Optimization 5)
    // Single LLM call that does BOTH classification AND value assessment
    setImmediate(async () => {
      try {
        const analysisStart = Date.now();

        // Use the new unified analysis method
        const { classification, valueAssessment } =
          await intentRouter.analyzeExchangePostResponse(
            message,
            fullResponse,
            userId,
          );

        flowTracker.trackEvent({
          flowId,
          stage: "unified_analysis",
          service: "IntentRouter",
          status: "success",
          duration: Date.now() - analysisStart,
          data: {
            inputType: classification.inputType,
            confidence: classification.confidence,
            importanceScore: classification.importanceScore,
            sentiment: classification.sentiment,
            topic: classification.topic,
            entities: classification.entities,
            isValuable: valueAssessment.isValuable,
            shouldStore: valueAssessment.shouldStore,
            isFactualDeclaration: valueAssessment.isFactualDeclaration,
            asyncProcessing: true,
            singleLLMCall: true,
          },
          decision: `[ASYNC] Analyse unifiée: Type=${classification.inputType}, Importance=${(classification.importanceScore * 100).toFixed(1)}%, Stocker=${valueAssessment.shouldStore ? "OUI" : "NON"}. Raison: ${valueAssessment.reason}`,
        });

        // Only store if valuable
        if (
          valueAssessment.shouldStore &&
          valueAssessment.adjustedImportanceScore >= 0.3
        ) {
          const memoryStart = Date.now();

          // Determine what content to store
          let contentToStore: string;
          if (
            valueAssessment.isFactualDeclaration &&
            valueAssessment.factToStore
          ) {
            contentToStore = valueAssessment.factToStore;
          } else {
            contentToStore = `Question: ${message}\nRéponse: ${fullResponse}`;
          }

          await prisma.memory.create({
            data: {
              userId,
              content: contentToStore,
              type: "SHORT_TERM",
              sourceType: "chat",
              importanceScore: valueAssessment.adjustedImportanceScore,
              tags: classification.topic ? [classification.topic] : [],
              entities: classification.entities,
            },
          });

          flowTracker.trackEvent({
            flowId,
            stage: "memory_storage",
            service: "MemoryManager",
            status: "success",
            duration: Date.now() - memoryStart,
            data: {
              importanceScore: valueAssessment.adjustedImportanceScore,
              topic: classification.topic,
              entities: classification.entities,
              isFactualDeclaration: valueAssessment.isFactualDeclaration,
              contentStored: valueAssessment.isFactualDeclaration
                ? "fact_only"
                : "full_exchange",
              asyncProcessing: true,
            },
            decision: `[ASYNC] Mémoire stockée: Importance=${(valueAssessment.adjustedImportanceScore * 100).toFixed(1)}%, Type=${valueAssessment.isFactualDeclaration ? "FAIT" : "ÉCHANGE"}`,
          });
        } else {
          flowTracker.trackEvent({
            flowId,
            stage: "memory_storage",
            service: "MemoryManager",
            status: "skipped",
            data: { asyncProcessing: true },
            decision: `[ASYNC] Non stocké: ${valueAssessment.reason}`,
          });
        }

        flowTracker.completeFlow(flowId, "completed");
      } catch (error) {
        console.warn("[ASYNC] Failed to analyze or store chat:", error);
        flowTracker.trackEvent({
          flowId,
          stage: "unified_analysis",
          service: "IntentRouter",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          data: { asyncProcessing: true },
          decision: `[ASYNC] Erreur: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
        flowTracker.completeFlow(flowId, "partial");
      }
    });
  } catch (error) {
    console.error("Chat error:", error);

    flowTracker.trackEvent({
      flowId,
      stage: "chat_error",
      service: "ChatController",
      status: "failed",
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    flowTracker.completeFlow(flowId, "failed");

    // Check if headers already sent (response may have started)
    if (!res.headersSent) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          data:
            error instanceof Error ? error.message : "Une erreur est survenue",
        })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({ type: "end", messageId })}\n\n`);
      res.end();
    }
  }
}
