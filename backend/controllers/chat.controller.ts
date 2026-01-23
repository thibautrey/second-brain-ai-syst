/**
 * Chat Controller
 *
 * Handles chat requests with SSE streaming responses
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { IntentRouterService } from "../services/intent-router.js";
import { memorySearchService } from "../services/memory-search.js";
import prisma from "../services/prisma.js";
import OpenAI from "openai";
import { flowTracker } from "../services/flow-tracker.js";
import { randomBytes } from "crypto";

const intentRouter = new IntentRouterService();

const CHAT_SYSTEM_PROMPT = `Tu es Second Brain, un assistant personnel intelligent.
Tu aides l'utilisateur à organiser ses pensées, retrouver ses souvenirs et répondre à ses questions.
Tu as accès aux mémoires de l'utilisateur pour personnaliser tes réponses.
Réponds de manière concise et utile. Utilise le contexte des mémoires quand c'est pertinent.`;

/**
 * POST /api/chat
 * Stream chat response using SSE
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

    // 1. Classify intent (integrates with global system)
    const classifyStart = Date.now();
    const classification = await intentRouter.classifyInput(message, {
      userId,
    });

    const classificationDecision = `Type détecté: ${classification.inputType} (confiance: ${(classification.confidence * 100).toFixed(1)}%). ` +
      `Importance: ${(classification.importanceScore * 100).toFixed(1)}%. ` +
      `Stocker: ${classification.shouldStore ? 'OUI' : 'NON'}. ` +
      `Exécuter outils: ${classification.shouldCallTools ? 'OUI' : 'NON'}. ` +
      `Sentiment: ${classification.sentiment}.`;

    flowTracker.trackEvent({
      flowId,
      stage: "intent_classification",
      service: "IntentRouter",
      status: "success",
      duration: Date.now() - classifyStart,
      data: {
        inputType: classification.inputType,
        confidence: classification.confidence,
        shouldStore: classification.shouldStore,
        shouldCallTools: classification.shouldCallTools,
        importanceScore: classification.importanceScore,
        sentiment: classification.sentiment,
        topic: classification.topic,
        entities: classification.entities,
      },
      decision: classificationDecision,
    });

    // 2. Get relevant memories for context
    let memoryContext: string[] = [];
    try {
      const searchStart = Date.now();
      const searchResponse = await memorySearchService.semanticSearch(
        userId,
        message,
        5,
      );
      memoryContext = searchResponse.results.map(
        (r) =>
          `[Mémoire du ${new Date(r.memory.createdAt).toLocaleDateString()}]: ${r.memory.content}`,
      );

      const memoryDecision = `${searchResponse.results.length} mémoire(s) pertinente(s) trouvée(s). ` +
        `Score moyen: ${(searchResponse.results.reduce((sum, r) => sum + (r.score || 0), 0) / searchResponse.results.length * 100).toFixed(1)}%.`;

      flowTracker.trackEvent({
        flowId,
        stage: "memory_search",
        service: "MemorySearchService",
        status: "success",
        duration: Date.now() - searchStart,
        data: { 
          resultsFound: searchResponse.results.length,
          query: message,
          topResults: searchResponse.results.slice(0, 3).map((r, i) => ({
            rank: i + 1,
            score: r.score,
            distance: r.distance,
            dateCreated: r.memory.createdAt,
          })),
        },
        decision: memoryDecision,
      });
    } catch (error) {
      console.warn("Memory search failed, continuing without context:", error);
      flowTracker.trackEvent({
        flowId,
        stage: "memory_search",
        service: "MemorySearchService",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        decision: "Recherche mémoire échouée. Continuation sans contexte mémoire.",
      });
    }

    // 3. Get user's configured LLM provider
    const taskConfig = await prisma.aITaskConfig.findFirst({
      where: {
        userId,
        taskType: "REFLECTION",
      },
      include: {
        provider: true,
        model: true,
      },
    });

    // Try to get provider from task config or fallback to any available
    let provider = taskConfig?.provider;
    let modelId = taskConfig?.model?.modelId || "gpt-3.5-turbo";

    if (!provider) {
      // Fallback: try to find any available provider
      provider = await prisma.aIProvider.findFirst({
        where: { userId },
      });

      if (!provider) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            data: "Aucun fournisseur LLM configuré. Allez dans Paramètres > IA pour en ajouter un.",
          })}\n\n`,
        );
        res.write(`data: ${JSON.stringify({ type: "end", messageId })}\n\n`);
        return res.end();
      }
    }

    // 4. Create OpenAI client
    const openai = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl || "https://api.openai.com/v1",
    });

    flowTracker.trackEvent({
      flowId,
      stage: "llm_provider_selected",
      service: "LLMRouter",
      status: "success",
      data: {
        providerName: provider.name,
        modelId,
      },
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

    // 7. Assess if the response is valuable enough to store
    // Use LLM to evaluate the question-response pair, not just the input classification
    if (classification.shouldStore) {
      try {
        const assessmentStart = Date.now();
        const valueAssessment = await intentRouter.assessResponseValue(
          message,
          fullResponse,
          classification,
          userId,
        );

        flowTracker.trackEvent({
          flowId,
          stage: "response_value_assessment",
          service: "IntentRouter",
          status: "success",
          duration: Date.now() - assessmentStart,
          data: {
            isValuable: valueAssessment.isValuable,
            reason: valueAssessment.reason,
            adjustedImportanceScore: valueAssessment.adjustedImportanceScore,
            shouldStore: valueAssessment.shouldStore,
          },
          decision: `Évaluation de la réponse: ${valueAssessment.isValuable ? 'VALUABLE' : 'NOT VALUABLE'}. Raison: ${valueAssessment.reason}`,
        });

        // Only store if the response was assessed as valuable
        if (valueAssessment.shouldStore && valueAssessment.adjustedImportanceScore >= 0.3) {
          const memoryStart = Date.now();
          await prisma.memory.create({
            data: {
              userId,
              content: `Question: ${message}\nRéponse: ${fullResponse}`,
              type: "SHORT_TERM",
              sourceType: "chat",
              importanceScore: valueAssessment.adjustedImportanceScore,
              tags: classification.topic ? [classification.topic] : [],
              entities: classification.entities,
            },
          });

          const memoryStorageDecision = `Mémoire stockée avec score d'importance ajusté: ${(valueAssessment.adjustedImportanceScore * 100).toFixed(1)}%. ` +
            `Tags: ${classification.topic ? classification.topic : 'Aucun'}. Raison: ${valueAssessment.reason}`;

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
              responseLength: fullResponse.length,
              valueReason: valueAssessment.reason,
            },
            decision: memoryStorageDecision,
          });
        } else {
          const skipReason = !valueAssessment.shouldStore
            ? `Réponse non valuable: ${valueAssessment.reason}`
            : `Score d'importance ajusté trop bas (${(valueAssessment.adjustedImportanceScore * 100).toFixed(1)}% < 30%)`;
          
          flowTracker.trackEvent({
            flowId,
            stage: "memory_storage",
            service: "MemoryManager",
            status: "skipped",
            decision: skipReason,
          });
        }
      } catch (error) {
        console.warn("Failed to assess or store chat in memory:", error);
        flowTracker.trackEvent({
          flowId,
          stage: "memory_storage",
          service: "MemoryManager",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          decision: `Erreur lors de l'évaluation/stockage mémoire: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    } else {
      flowTracker.trackEvent({
        flowId,
        stage: "memory_storage",
        service: "MemoryManager",
        status: "skipped",
        decision: "Entrée non stockable (shouldStore=false dès la classification)",
      });
    }

    // Complete flow
    flowTracker.completeFlow(flowId, "completed");
    flowTracker.trackEvent({
      flowId,
      stage: "chat_complete",
      service: "ChatController",
      status: "success",
      duration: Date.now() - startTime,
    });

    // Send end event
    res.write(`data: ${JSON.stringify({ type: "end", messageId })}\n\n`);
    res.end();
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
