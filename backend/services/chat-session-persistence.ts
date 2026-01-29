/**
 * Chat Session Persistence
 *
 * Handles saving chat exchanges into pi-ai context sessions.
 */

import {
  contextSerializationService,
  type SerializedMessage,
} from "./context-serialization.js";

interface SessionPersistenceParams {
  userId: string;
  message: string;
  response: string;
  previousMessages: Array<{ role: string; content: string }>;
  activeSessionId?: string;
  sessionTitle?: string;
  modelId: string;
  provider: string;
}

export async function handleSessionPersistence(
  params: SessionPersistenceParams,
): Promise<void> {
  const {
    userId,
    message,
    response,
    previousMessages,
    activeSessionId,
    sessionTitle,
    modelId,
    provider,
  } = params;

  setImmediate(async () => {
    try {
      const userMessage: SerializedMessage = {
        role: "user",
        content: message,
        timestamp: Date.now() - 1000,
      };

      const assistantMessage: SerializedMessage = {
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };

      const providerInfo = {
        provider,
        modelId,
      };

      if (activeSessionId) {
        await contextSerializationService.appendMessageToSession(
          activeSessionId,
          userId,
          userMessage,
          providerInfo,
        );
        await contextSerializationService.appendMessageToSession(
          activeSessionId,
          userId,
          assistantMessage,
          providerInfo,
        );
        console.log(`[ChatController] Updated session ${activeSessionId}`);
      } else {
        const allMessages: SerializedMessage[] = [];

        for (let i = 0; i < previousMessages.length; i++) {
          const prevMsg = previousMessages[i];
          if (prevMsg.role === "user" || prevMsg.role === "assistant") {
            allMessages.push({
              role: prevMsg.role as "user" | "assistant",
              content: prevMsg.content || "",
              timestamp: Date.now() - (previousMessages.length - i + 2) * 1000,
            });
          }
        }

        allMessages.push(userMessage);
        allMessages.push(assistantMessage);

        console.log(
          `[ChatController] Session creation skipped - ${allMessages.length} messages would be saved`,
        );
      }
    } catch (error) {
      console.error("[ChatController] Session persistence failed:", error);
    }
  });
}
