/**
 * Chat Messages Hook
 *
 * Manages chat state and SSE streaming
 */

import { useState, useCallback, useRef } from "react";
import { ChatMessage, ChatState } from "../types/chat";

const API_BASE = "http://localhost:3000/api";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useChatMessages() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    conversationId: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || state.isLoading) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      // Add user message and empty assistant message
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage, assistantMessage],
        isLoading: true,
        error: null,
      }));

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: content,
            messages: state.messages.filter(
              (m) => m.role !== "assistant" || m.content,
            ),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6));

                if (event.type === "token") {
                  setState((prev) => {
                    const messages = [...prev.messages];
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.role === "assistant") {
                      lastMsg.content += event.data;
                    }
                    return { ...prev, messages };
                  });
                } else if (event.type === "error") {
                  setState((prev) => ({
                    ...prev,
                    error: event.data,
                    isLoading: false,
                  }));
                } else if (event.type === "end") {
                  setState((prev) => {
                    const messages = [...prev.messages];
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.role === "assistant") {
                      lastMsg.isStreaming = false;
                    }
                    return { ...prev, messages, isLoading: false };
                  });
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Une erreur est survenue",
          messages: prev.messages.slice(0, -1), // Remove empty assistant message
        }));
      }
    },
    [state.isLoading],
  );

  const clearMessages = useCallback(() => {
    setState({
      messages: [],
      isLoading: false,
      error: null,
      conversationId: null,
    });
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
    clearMessages,
    cancelStream,
  };
}
