/**
 * Chat Messages Hook
 *
 * Manages chat state and SSE streaming with tool call support
 */

import { useState, useCallback, useRef } from "react";
import {
  ChatMessage,
  ChatState,
  ToolCallData,
  ToolGenerationStepData,
} from "../types/chat";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useChatMessages() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    conversationId: null,
    currentToolCall: null,
    currentToolGeneration: null,
    activeToolCalls: [],
    thinkingPhase: null,
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

      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
        toolCalls: [],
        toolGenerationSteps: [],
      };

      // Add user message and empty assistant message
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage, assistantMessage],
        isLoading: true,
        error: null,
        currentToolCall: null,
        currentToolGeneration: null,
        activeToolCalls: [],
        thinkingPhase: "Analyse de la requête...",
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

                if (event.type === "start") {
                  setState((prev) => ({
                    ...prev,
                    thinkingPhase: "Génération de la réponse...",
                  }));
                } else if (event.type === "token") {
                  setState((prev) => {
                    const messages = [...prev.messages];
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.role === "assistant") {
                      lastMsg.content += event.data;
                    }
                    return { ...prev, messages, thinkingPhase: null };
                  });
                } else if (event.type === "tool_call") {
                  // Handle tool call events
                  const toolCallData = event.data as ToolCallData;
                  
                  setState((prev) => {
                    const messages = [...prev.messages];
                    const lastMsg = messages[messages.length - 1];
                    
                    // Update or add tool call to the assistant message
                    if (lastMsg && lastMsg.role === "assistant") {
                      const existingIndex = lastMsg.toolCalls?.findIndex(
                        (tc) => tc.id === toolCallData.id
                      );
                      
                      if (existingIndex !== undefined && existingIndex >= 0 && lastMsg.toolCalls) {
                        // Update existing tool call
                        lastMsg.toolCalls[existingIndex] = toolCallData;
                      } else {
                        // Add new tool call
                        lastMsg.toolCalls = [...(lastMsg.toolCalls || []), toolCallData];
                      }
                    }
                    
                    // Also update activeToolCalls for current display
                    const existingActiveIndex = prev.activeToolCalls.findIndex(
                      (tc) => tc.id === toolCallData.id
                    );
                    
                    let newActiveToolCalls = [...prev.activeToolCalls];
                    if (existingActiveIndex >= 0) {
                      newActiveToolCalls[existingActiveIndex] = toolCallData;
                    } else {
                      newActiveToolCalls.push(toolCallData);
                    }
                    
                    return {
                      ...prev,
                      messages,
                      currentToolCall: toolCallData,
                      currentToolGeneration: null,
                      activeToolCalls: newActiveToolCalls,
                      thinkingPhase: toolCallData.status === "executing" 
                        ? `Exécution de ${toolCallData.toolName}...`
                        : prev.thinkingPhase,
                    };
                  });
                } else if (event.type === "tool_generation") {
                  // Handle tool generation step events
                  const generationData = event.data as ToolGenerationStepData;
                  
                  setState((prev) => {
                    const messages = [...prev.messages];
                    const lastMsg = messages[messages.length - 1];
                    
                    // Add to generation steps history
                    if (lastMsg && lastMsg.role === "assistant") {
                      lastMsg.toolGenerationSteps = [
                        ...(lastMsg.toolGenerationSteps || []),
                        generationData,
                      ];
                    }
                    
                    return {
                      ...prev,
                      messages,
                      currentToolGeneration: generationData,
                      currentToolCall: null,
                      thinkingPhase: generationData.message,
                    };
                  });
                } else if (event.type === "error") {
                  setState((prev) => ({
                    ...prev,
                    error: event.data as string,
                    isLoading: false,
                    currentToolCall: null,
                    currentToolGeneration: null,
                    activeToolCalls: [],
                    thinkingPhase: null,
                  }));
                } else if (event.type === "end") {
                  setState((prev) => {
                    const messages = [...prev.messages];
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.role === "assistant") {
                      lastMsg.isStreaming = false;
                    }
                    return {
                      ...prev,
                      messages,
                      isLoading: false,
                      currentToolCall: null,
                      currentToolGeneration: null,
                      activeToolCalls: [],
                      thinkingPhase: null,
                    };
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
          activeToolCalls: [],
          thinkingPhase: null,
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
      currentToolCall: null,
      currentToolGeneration: null,
      activeToolCalls: [],
      thinkingPhase: null,
    });
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState((prev) => ({
        ...prev,
        isLoading: false,
        currentToolCall: null,
        currentToolGeneration: null,
        activeToolCalls: [],
        thinkingPhase: null,
      }));
    }
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    currentToolCall: state.currentToolCall,
    currentToolGeneration: state.currentToolGeneration,
    activeToolCalls: state.activeToolCalls,
    thinkingPhase: state.thinkingPhase,
    sendMessage,
    clearMessages,
    cancelStream,
  };
}
