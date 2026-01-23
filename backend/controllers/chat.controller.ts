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
import { toolExecutorService } from "../services/tool-executor.js";
import {
  sanitizeToolResult,
  generateToolExecutionSummary,
  createToolMetadata,
} from "../services/sanitize-tool-results.js";

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

OUTILS DISPONIBLES:
Tu as accès à des outils que tu DOIS utiliser via le mécanisme de function calling (tool_calls).
NE GÉNÈRE JAMAIS de commandes curl, http ou json en texte brut - utilise TOUJOURS les outils fournis.

- curl: Pour faire des requêtes HTTP (météo, APIs web, etc.). Utilise-le quand l'utilisateur demande des informations du web.
- todo: Pour gérer la liste de tâches de l'utilisateur (créer, lister, compléter des tâches).
- notification: Pour envoyer des rappels et notifications.
- scheduled_task: Pour planifier des tâches récurrentes.
- user_context: Pour chercher des informations sur l'utilisateur dans sa mémoire.

QUAND UTILISER LES OUTILS:
- Questions météo → curl vers une API météo ou site météo
- Gestion de tâches → todo
- Rappels → notification ou scheduled_task
- Questions sur l'utilisateur → user_context

INSTRUCTIONS IMPORTANTES:
- Réponds de manière TRÈS CONCISE et utile
- Pour les simples déclarations factuelles (partages d'information sur sa vie), réponds juste "Compris" ou avec un très court acquiescement
- N'ajoute PAS de questions à la fin de chaque réponse - c'est lourd et inutile
- Pose une question SEULEMENT si c'est vraiment pertinent ou si tu as besoin de clarification
- Utilise le contexte des mémoires quand c'est pertinent, mais de manière discrète
- Si l'utilisateur demande quelque chose, réponds directement sans étapes superflues
- Sois naturel: un ami ne pose pas une question à chaque fois qu'on lui dit quelque chose
- NE JAMAIS afficher de code JSON ou curl à l'utilisateur - utilise les outils puis donne une réponse naturelle`;

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

  const { message, messages: previousMessages } = req.body;
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

    // 6. Get tool schemas for function calling
    const toolSchemas = toolExecutorService.getToolSchemas();

    // 7. HYBRID STREAMING MODE: Initial call to detect tool usage
    const llmStart = Date.now();
    type ChatMessage = {
      role: "system" | "user" | "assistant" | "tool";
      content: string | null;
      tool_calls?: any[];
      tool_call_id?: string;
      name?: string;
    };

    // Build message history from previous messages + current message
    let messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    // Add previous conversation messages (if any)
    if (Array.isArray(previousMessages) && previousMessages.length > 0) {
      for (const prevMsg of previousMessages) {
        if (prevMsg.role === "user" && prevMsg.content) {
          messages.push({
            role: "user",
            content: prevMsg.content,
          });
        } else if (prevMsg.role === "assistant" && prevMsg.content) {
          messages.push({
            role: "assistant",
            content: prevMsg.content,
          });
        }
      }
    }

    // Add current user message
    messages.push({ role: "user", content: message });

    let fullResponse = "";
    let allToolResults: any[] = [];
    let sanitizationResults = new Map<string, any>();
    let iterationCount = 0;
    const MAX_ITERATIONS = 3;

    // Tool calling loop (max 3 iterations to prevent infinite loops)
    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      flowTracker.trackEvent({
        flowId,
        stage: `llm_call_iteration_${iterationCount}`,
        service: "OpenAI",
        status: "started",
        duration: 0,
        data: { messagesCount: messages.length },
      });

      // Non-streaming call to detect tool usage
      const response = await openai.chat.completions.create({
        model: modelId,
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 4096, // Explicit max_tokens to avoid provider auto-calculation issues
        tools: toolSchemas.map((schema) => ({
          type: "function",
          function: schema,
        })),
        tool_choice: "auto",
        stream: false,
      });

      const assistantMessage = response.choices[0]?.message;

      if (!assistantMessage) {
        break;
      }

      // Detect if the model generated a tool call as text instead of using function calling
      // This can happen with some models/providers that don't support function calling well
      const textToolCallPattern =
        /^(curl|todo|notification|scheduled_task|user_context)\s*\{/i;
      const jsonToolCallPattern = /^\{[\s\S]*"action"\s*:\s*"[^"]+"/;

      let parsedTextToolCall: {
        toolId: string;
        params: Record<string, any>;
      } | null = null;

      if (
        assistantMessage.content &&
        (!assistantMessage.tool_calls ||
          assistantMessage.tool_calls.length === 0)
      ) {
        const content = assistantMessage.content.trim();

        // Check for "toolName{json}" format (e.g., "curl{...}")
        const toolNameMatch = content.match(
          /^(curl|todo|notification|scheduled_task|user_context)\s*(\{[\s\S]*\})\s*$/i,
        );
        if (toolNameMatch) {
          try {
            const toolId = toolNameMatch[1].toLowerCase();
            const params = JSON.parse(toolNameMatch[2]);
            parsedTextToolCall = { toolId, params };

            flowTracker.trackEvent({
              flowId,
              stage: `text_tool_call_parsed_iteration_${iterationCount}`,
              service: "ChatController",
              status: "started",
              duration: 0,
              data: { toolId, detectedFormat: "toolName{json}" },
              decision: `Modèle a généré un appel d'outil en texte au lieu d'utiliser function calling. Outil détecté: ${toolId}`,
            });
          } catch (e) {
            // JSON parse failed, not a valid tool call
          }
        }

        // Check for raw JSON with action field
        if (!parsedTextToolCall && jsonToolCallPattern.test(content)) {
          try {
            const params = JSON.parse(content);
            if (params.action && typeof params.action === "string") {
              // Try to determine tool from action or url
              let toolId = "curl"; // Default to curl for HTTP-like actions
              if (
                [
                  "create",
                  "get",
                  "list",
                  "update",
                  "complete",
                  "delete",
                  "stats",
                  "overdue",
                  "due_soon",
                ].includes(params.action) &&
                !params.url
              ) {
                toolId = "todo";
              } else if (
                [
                  "send",
                  "schedule",
                  "mark_read",
                  "dismiss",
                  "unread_count",
                ].includes(params.action) &&
                !params.url
              ) {
                toolId = "notification";
              } else if (
                params.url ||
                ["request", "get", "post", "put", "delete", "patch"].includes(
                  params.action,
                )
              ) {
                toolId = "curl";
              } else if (
                ["get_location", "get_preferences", "search_facts"].includes(
                  params.action,
                )
              ) {
                toolId = "user_context";
              }

              parsedTextToolCall = { toolId, params };

              flowTracker.trackEvent({
                flowId,
                stage: `text_tool_call_parsed_iteration_${iterationCount}`,
                service: "ChatController",
                status: "started",
                duration: 0,
                data: { toolId, detectedFormat: "rawJson" },
                decision: `Modèle a généré un JSON d'appel d'outil en texte. Outil détecté: ${toolId}`,
              });
            }
          } catch (e) {
            // JSON parse failed
          }
        }
      }

      // If we detected a text-based tool call, execute it
      if (parsedTextToolCall) {
        const { toolId, params } = parsedTextToolCall;

        flowTracker.trackEvent({
          flowId,
          stage: `text_tool_execution_iteration_${iterationCount}`,
          service: "ToolExecutor",
          status: "started",
          duration: 0,
          data: { toolId, action: params.action },
        });

        // Execute the tool
        const toolExecutionStart = Date.now();
        const toolRequest = {
          toolId,
          action: params.action || "request",
          params,
        };

        const toolResult = await toolExecutorService.executeTool(
          userId,
          toolRequest,
        );

        flowTracker.trackEvent({
          flowId,
          stage: `text_tool_executed_iteration_${iterationCount}`,
          service: "ToolExecutor",
          status: toolResult.success ? "success" : "failed",
          duration: Date.now() - toolExecutionStart,
          data: { toolId, success: toolResult.success },
        });

        // Sanitize the tool result before storing
        const sanitizationResult = sanitizeToolResult(toolResult.data);
        sanitizationResults.set(toolId, sanitizationResult);

        // Store sanitized version of tool result
        const sanitizedToolResult = {
          ...toolResult,
          data: sanitizationResult.cleaned,
          _sanitized: sanitizationResult.hasSensitiveData,
          _redactionCount: sanitizationResult.redactedCount,
        };

        allToolResults.push(sanitizedToolResult);

        // Add the assistant message and tool result to history, then continue
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: `text_tool_${Date.now()}`,
              type: "function",
              function: { name: toolId, arguments: JSON.stringify(params) },
            },
          ],
        });

        messages.push({
          role: "tool",
          tool_call_id: `text_tool_${Date.now()}`,
          name: toolId,
          content: JSON.stringify({
            success: toolResult.success,
            data: toolResult.data,
            error: toolResult.error,
          }),
        });

        // Continue to let AI process tool results
        continue;
      }

      // Check if AI wants to use tools via proper function calling
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        flowTracker.trackEvent({
          flowId,
          stage: `tool_calls_detected_iteration_${iterationCount}`,
          service: "ToolExecutor",
          status: "started",
          duration: 0,
          data: {
            toolCallsCount: assistantMessage.tool_calls.length,
            tools: assistantMessage.tool_calls.map((tc) => tc.function.name),
          },
        });

        // Add assistant message with tool calls to history
        messages.push({
          role: "assistant",
          content: assistantMessage.content,
          tool_calls: assistantMessage.tool_calls,
        });

        // Execute tools in parallel
        const toolExecutionStart = Date.now();
        const toolRequests = assistantMessage.tool_calls.map((toolCall) => {
          const args = JSON.parse(toolCall.function.arguments);
          return {
            toolId: toolCall.function.name,
            action: args.action,
            params: args,
            _toolCallId: toolCall.id, // Store for response mapping
          };
        });

        const toolResults = await toolExecutorService.executeToolsInParallel(
          userId,
          toolRequests,
          7000, // 7s per tool
          60000, // 60s global
        );

        flowTracker.trackEvent({
          flowId,
          stage: `tools_executed_iteration_${iterationCount}`,
          service: "ToolExecutor",
          status: "success",
          duration: Date.now() - toolExecutionStart,
          data: {
            toolsExecuted: toolResults.length,
            successCount: toolResults.filter((r) => r.success).length,
            failureCount: toolResults.filter((r) => !r.success).length,
          },
        });

        // Sanitize tool results before storing
        const sanitizedToolResults = toolResults.map((result) => {
          const sanitizationResult = sanitizeToolResult(result.data);
          sanitizationResults.set(result.toolUsed, sanitizationResult);

          return {
            ...result,
            data: sanitizationResult.cleaned,
            _sanitized: sanitizationResult.hasSensitiveData,
            _redactionCount: sanitizationResult.redactedCount,
          };
        });

        // Store sanitized tool results for memory
        allToolResults.push(...sanitizedToolResults);

        // Add tool results to messages
        toolRequests.forEach((req, index) => {
          const result = toolResults[index];
          messages.push({
            role: "tool",
            tool_call_id: (req as any)._toolCallId,
            name: req.toolId,
            content: JSON.stringify({
              success: result.success,
              data: result.data,
              error: result.error,
            }),
          });
        });

        // Continue loop to let AI process tool results
        continue;
      }

      // No tool calls - this is the final response
      fullResponse = assistantMessage.content || "";
      break;
    }

    flowTracker.trackEvent({
      flowId,
      stage: "llm_response",
      service: "OpenAI",
      status: "success",
      duration: Date.now() - llmStart,
      data: {
        responseLength: fullResponse.length,
        iterations: iterationCount,
        toolsUsed: allToolResults.length,
      },
    });

    // 8. Stream the final response to user
    if (fullResponse) {
      // Send start event
      res.write(`data: ${JSON.stringify({ type: "start", messageId })}\n\n`);

      // Send tool usage info if any
      if (allToolResults.length > 0) {
        res.write(
          `data: ${JSON.stringify({
            type: "tools",
            data: {
              count: allToolResults.length,
              tools: allToolResults.map((r) => ({
                tool: r.toolUsed,
                success: r.success,
                duration: r.executionTime,
              })),
            },
          })}\n\n`,
        );
      }

      // Stream response in chunks (simulate streaming for consistency)
      const chunkSize = 5;
      for (let i = 0; i < fullResponse.length; i += chunkSize) {
        const chunk = fullResponse.slice(i, i + chunkSize);
        res.write(
          `data: ${JSON.stringify({ type: "token", data: chunk })}\n\n`,
        );
        // Small delay to simulate streaming
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

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

          // Add tool execution summary if tools were used
          let toolMetadata: any = {};
          if (allToolResults.length > 0) {
            // Generate summary and enriched metadata (Option B approach)
            const executionSummary = generateToolExecutionSummary(
              allToolResults.map((r) => ({
                toolUsed: r.toolUsed,
                success: r.success,
                error: r.error,
                executionTime: r.executionTime,
              })),
              sanitizationResults,
            );

            contentToStore += `\n\n${executionSummary}`;

            // Create enriched metadata with success/failure counts
            toolMetadata = createToolMetadata(
              allToolResults.map((r) => ({
                toolUsed: r.toolUsed,
                success: r.success,
                error: r.error,
                executionTime: r.executionTime,
              })),
              executionSummary,
            );

            // Add sanitization info to metadata
            const sanitizationSummary = Array.from(sanitizationResults.values())
              .filter((r) => r.hasSensitiveData)
              .map((r) => ({
                redactedCount: r.redactedCount,
                redactionTypes: r.redactionSummary,
              }));

            if (sanitizationSummary.length > 0) {
              toolMetadata.sanitization = sanitizationSummary;
            }
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
              metadata: toolMetadata.toolsUsed ? toolMetadata : undefined,
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
