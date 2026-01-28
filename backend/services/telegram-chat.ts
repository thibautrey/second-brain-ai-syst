/**
 * Telegram Chat Service
 *
 * Handles message processing for Telegram integration
 * - Delegates LLM/tool handling to shared ChatResponseService
 * - Telegram-specific conversation history management
 * - Intelligent context management to prevent token overflow
 *
 * Refactored to avoid code duplication with chat-response.ts
 */

import {
  getConversationContext,
  storeTelegramMessage,
} from "./telegram-conversation-manager.js";

import { flowTracker } from "./flow-tracker.js";
import { getChatResponse } from "./chat-response.js";
import { randomBytes } from "crypto";

/**
 * Process a message from Telegram and return the AI response
 *
 * Uses the shared ChatResponseService for LLM/tool handling,
 * while managing Telegram-specific conversation history.
 */
export async function processTelegramMessage(
  userId: string,
  message: string,
): Promise<string> {
  const startTime = Date.now();
  const flowId = randomBytes(8).toString("hex");

  try {
    console.log(
      `[Telegram] Processing message for user ${userId}: ${message.substring(0, 50)}...`,
    );

    flowTracker.startFlow(flowId, "chat");
    flowTracker.trackEvent({
      flowId,
      stage: "telegram_received",
      service: "Telegram",
      status: "started",
      data: { messageLength: message.length },
    });

    // Get conversation history for context
    const conversationContext = await getConversationContext(
      userId,
      10, // Last 10 messages for context
      4000, // Max tokens for history
    );

    // Convert conversation history to previous messages format
    const previousMessages = conversationContext.recentMessages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Use the shared chat response service
    const result = await getChatResponse(userId, message, {
      maxIterations: 10,
      maxTokens: 1000,
      includeMemorySearch: true,
      memoryCount: 5,
      previousMessages,
      onToolCall: (toolName, iteration) => {
        console.log(`[Telegram] Tool call ${iteration}: ${toolName}`);
      },
    });

    let finalResponse: string;

    if (!result.success) {
      console.error(`[Telegram] AI response failed: ${result.error}`);

      // Telegram-specific error messages in French
      if (result.error?.includes("No LLM provider configured")) {
        finalResponse =
          "❌ Fournisseur IA non configuré. Configure tes paramètres IA dans l'interface web.";
      } else if (result.error?.includes("Invalid model")) {
        finalResponse =
          "❌ La configuration du modèle IA semble corrompue. Reconfigure tes paramètres IA.";
      } else {
        finalResponse = `❌ Désolé, je n'ai pas pu traiter ton message: ${result.error}`;
      }
    } else if (!result.response) {
      finalResponse = "❌ Je n'ai pas pu générer de réponse pour le moment.";
    } else {
      finalResponse = result.response;
    }

    console.log(`[Telegram] Response generated in ${Date.now() - startTime}ms`);
    console.log(
      `[Telegram] Tools used: ${result.toolsUsed.length}, Iterations: ${result.totalIterations}`,
    );

    // Store messages in conversation history (Telegram-specific)
    try {
      await storeTelegramMessage(userId, "user", message);
      if (finalResponse && !finalResponse.startsWith("❌")) {
        await storeTelegramMessage(userId, "assistant", finalResponse);
      }
    } catch (storageError) {
      console.warn(
        "[Telegram] Failed to store message in history:",
        storageError,
      );
    }

    flowTracker.trackEvent({
      flowId,
      stage: "telegram_response",
      service: "Telegram",
      status: result.success ? "success" : "failed",
      duration: Date.now() - startTime,
      data: {
        iterations: result.totalIterations,
        toolsUsed: result.toolsUsed.length,
        responseLength: finalResponse.length,
      },
    });
    flowTracker.completeFlow(flowId, result.success ? "completed" : "failed");

    return finalResponse;
  } catch (error: any) {
    console.error("[Telegram] Error processing message:", error);

    flowTracker.trackEvent({
      flowId,
      stage: "telegram_response",
      service: "Telegram",
      status: "failed",
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    });
    flowTracker.completeFlow(flowId, "failed");

    return `❌ Désolé, je n'ai pas pu traiter ton message: ${error.message}`;
  }
}
