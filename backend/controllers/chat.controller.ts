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
    const classification = await intentRouter.classifyInput(message, {
      userId,
    });

    // 2. Get relevant memories for context
    let memoryContext: string[] = [];
    try {
      const searchResponse = await memorySearchService.semanticSearch(
        userId,
        message,
        5,
      );
      memoryContext = searchResponse.results.map(
        (r) =>
          `[Mémoire du ${new Date(r.memory.createdAt).toLocaleDateString()}]: ${r.memory.content}`,
      );
    } catch (error) {
      console.warn("Memory search failed, continuing without context:", error);
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

    // 5. Build messages with memory context
    const systemPrompt =
      memoryContext.length > 0
        ? `${CHAT_SYSTEM_PROMPT}\n\nContexte des mémoires pertinentes:\n${memoryContext.join("\n")}`
        : CHAT_SYSTEM_PROMPT;

    // 6. Stream response
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

    // 7. Store in memory if important (integrates with global system)
    if (classification.shouldStore && classification.importanceScore >= 0.3) {
      try {
        await prisma.memory.create({
          data: {
            userId,
            content: `Question: ${message}\nRéponse: ${fullResponse}`,
            type: "SHORT_TERM",
            sourceType: "chat",
            importanceScore: classification.importanceScore,
            tags: classification.topic ? [classification.topic] : [],
            entities: classification.entities,
          },
        });
      } catch (error) {
        console.warn("Failed to store chat in memory:", error);
      }
    }

    // Send end event
    res.write(`data: ${JSON.stringify({ type: "end", messageId })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat error:", error);
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
