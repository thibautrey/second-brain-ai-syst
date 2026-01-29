/**
 * Chat Messages Hook
 *
 * Manages chat state and SSE streaming with tool call support
 * Supports both legacy and enhanced streaming modes
 */

import {
  ChatMessage,
  ChatState,
  ChatStreamEvent,
  ThinkingData,
  ToolCallData,
  ToolGenerationStepData,
} from "../types/chat";
import { useCallback, useRef, useState } from "react";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface UseChatMessagesOptions {
  /** Use enhanced streaming endpoint with detailed events */
  useEnhancedStreaming?: boolean;
  /** Use polling instead of SSE (recommended for Cloudflare/proxy timeouts) */
  usePolling?: boolean;
}

export function useChatMessages(options: UseChatMessagesOptions = {}) {
  const { useEnhancedStreaming = true, usePolling = true } = options;

  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    conversationId: null,
    currentToolCall: null,
    currentToolGeneration: null,
    activeToolCalls: [],
    thinkingPhase: null,
    thinkingContent: "",
    isEnhancedStreaming: useEnhancedStreaming,
    statusMessage: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  // Keep a ref to current messages for use in callbacks without re-creating them
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = state.messages;

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
        thinking: { isActive: false, content: "" },
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
        thinkingContent: "",
        statusMessage: null,
      }));

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const token = localStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        const payload = {
          message: content,
          messages: messagesRef.current.filter(
            (m) => m.role !== "assistant" || m.content,
          ),
        };

        if (usePolling) {
          const startResponse = await fetch(`${API_BASE}/chat/polling/start`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: abortControllerRef.current.signal,
          });

          if (!startResponse.ok) {
            throw new Error(`HTTP ${startResponse.status}`);
          }

          const startData = await startResponse.json();
          const flowId = startData.flowId as string;
          const initialDelay =
            typeof startData.pollAfterMs === "number"
              ? startData.pollAfterMs
              : 1200;

          let lastSeq = 0;
          let pollDelay = initialDelay;

          while (true) {
            await sleep(pollDelay, abortControllerRef.current.signal);
            const pollResponse = await fetch(
              `${API_BASE}/chat/polling/${flowId}?since=${lastSeq}`,
              {
                headers,
                signal: abortControllerRef.current.signal,
              },
            );

            if (!pollResponse.ok) {
              throw new Error(`HTTP ${pollResponse.status}`);
            }

            const pollData = await pollResponse.json();
            const events: ChatStreamEvent[] = pollData.events || [];

            for (const event of events) {
              handleStreamEvent(event, setState);
            }

            if (typeof pollData.lastSeq === "number") {
              lastSeq = pollData.lastSeq;
            }

            if (pollData.done) {
              if (
                !events.some((event) => event.type === "end") &&
                pollData.status !== "failed"
              ) {
                handleStreamEvent({ type: "end" }, setState);
              }
              if (pollData.status === "failed") {
                handleStreamEvent(
                  {
                    type: "error",
                    error: pollData.error || "Une erreur est survenue",
                  },
                  setState,
                );
              }
              break;
            }

            pollDelay = Math.min(pollDelay + 200, 2500);
          }

          return;
        }

        const endpoint = useEnhancedStreaming
          ? `${API_BASE}/chat/enhanced`
          : `${API_BASE}/chat`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
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
                const event: ChatStreamEvent = JSON.parse(line.slice(6));
                handleStreamEvent(event, setState);
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
          thinkingContent: "",
          statusMessage: null,
        }));
      }
    },
    [state.isLoading, useEnhancedStreaming, usePolling],
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
      thinkingContent: "",
      isEnhancedStreaming: useEnhancedStreaming,
      statusMessage: null,
    });
  }, [useEnhancedStreaming]);

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
        thinkingContent: "",
        statusMessage: null,
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
    thinkingContent: state.thinkingContent,
    statusMessage: state.statusMessage,
    isEnhancedStreaming: state.isEnhancedStreaming,
    sendMessage,
    clearMessages,
    cancelStream,
  };
}

function sleep(durationMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, durationMs);

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort);
  });
}

/**
 * Handle a single stream event and update state accordingly
 * Supports both legacy and enhanced event types
 */
function handleStreamEvent(
  event: ChatStreamEvent,
  setState: React.Dispatch<React.SetStateAction<ChatState>>,
) {
  switch (event.type) {
    // ==================== Legacy Events ====================
    case "start":
      setState((prev) => ({
        ...prev,
        thinkingPhase: "Génération de la réponse...",
        statusMessage: event.message || null,
      }));
      break;

    case "token":
      // Legacy text token event
      setState((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content += event.data as string;
        }
        return { ...prev, messages, thinkingPhase: null };
      });
      break;

    case "tool_call":
      // Legacy tool call event
      handleLegacyToolCall(event.data as ToolCallData, setState);
      break;

    case "tool_generation":
      // Legacy tool generation event
      handleToolGeneration(event.data as ToolGenerationStepData, setState);
      break;

    // ==================== Enhanced Events ====================
    case "status":
      setState((prev) => ({
        ...prev,
        statusMessage: event.message || null,
        thinkingPhase: event.message || prev.thinkingPhase,
      }));
      break;

    case "thinking_start":
      setState((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.thinking = {
            isActive: true,
            content: "",
            startTime: Date.now(),
          };
        }
        return {
          ...prev,
          messages,
          thinkingPhase: "Réflexion en cours...",
          thinkingContent: "",
        };
      });
      break;

    case "thinking_delta":
      setState((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        const newContent = prev.thinkingContent + (event.content || "");
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.thinking) {
          lastMsg.thinking.content = newContent;
        }
        return {
          ...prev,
          messages,
          thinkingContent: newContent,
        };
      });
      break;

    case "thinking_end":
      setState((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.thinking) {
          lastMsg.thinking.isActive = false;
          lastMsg.thinking.content = event.fullContent || prev.thinkingContent;
        }
        return {
          ...prev,
          messages,
          thinkingPhase: null,
        };
      });
      break;

    case "text_start":
      setState((prev) => ({
        ...prev,
        thinkingPhase: null,
        statusMessage: null,
      }));
      break;

    case "text_delta":
      setState((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content += event.content || "";
        }
        return { ...prev, messages };
      });
      break;

    case "text_end":
      // Text generation complete, nothing special needed
      break;

    case "tool_start":
      handleToolStart(event, setState);
      break;

    case "tool_args_delta":
      handleToolArgsDelta(event, setState);
      break;

    case "tool_ready":
      handleToolReady(event, setState);
      break;

    case "tool_executing":
      handleToolExecuting(event, setState);
      break;

    case "tool_result":
      handleToolResult(event, setState);
      break;

    case "tool_error":
      handleToolError(event, setState);
      break;

    case "usage":
      setState((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && event.usage) {
          lastMsg.usage = {
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            totalTokens: event.usage.totalTokens,
            cost: event.usage.cost,
          };
        }
        return { ...prev, messages };
      });
      break;

    case "error":
      setState((prev) => ({
        ...prev,
        error:
          event.error || (event.data as string) || "Une erreur est survenue",
        isLoading: false,
        currentToolCall: null,
        currentToolGeneration: null,
        activeToolCalls: [],
        thinkingPhase: null,
        thinkingContent: "",
        statusMessage: null,
      }));
      break;

    case "end":
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
          thinkingContent: "",
          statusMessage: null,
        };
      });
      break;
  }
}

// ==================== Tool Event Handlers ====================

function handleLegacyToolCall(
  toolCallData: ToolCallData,
  setState: React.Dispatch<React.SetStateAction<ChatState>>,
) {
  setState((prev) => {
    const messages = [...prev.messages];
    const lastMsg = messages[messages.length - 1];

    if (lastMsg && lastMsg.role === "assistant") {
      const existingIndex = lastMsg.toolCalls?.findIndex(
        (tc) => tc.id === toolCallData.id,
      );

      if (
        existingIndex !== undefined &&
        existingIndex >= 0 &&
        lastMsg.toolCalls
      ) {
        lastMsg.toolCalls[existingIndex] = toolCallData;
      } else {
        lastMsg.toolCalls = [...(lastMsg.toolCalls || []), toolCallData];
      }
    }

    const existingActiveIndex = prev.activeToolCalls.findIndex(
      (tc) => tc.id === toolCallData.id,
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
      thinkingPhase:
        toolCallData.status === "executing"
          ? `Exécution de ${toolCallData.toolName}...`
          : prev.thinkingPhase,
    };
  });
}

function handleToolGeneration(
  generationData: ToolGenerationStepData,
  setState: React.Dispatch<React.SetStateAction<ChatState>>,
) {
  setState((prev) => {
    const messages = [...prev.messages];
    const lastMsg = messages[messages.length - 1];

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
}

function handleToolStart(
  event: ChatStreamEvent,
  setState: React.Dispatch<React.SetStateAction<ChatState>>,
) {
  const toolCallData: ToolCallData = {
    id: event.toolId || generateId(),
    toolName: event.toolName || "unknown",
    status: "pending",
    startTime: Date.now(),
    partialArgs: "",
  };

  setState((prev) => {
    const messages = [...prev.messages];
    const lastMsg = messages[messages.length - 1];

    if (lastMsg && lastMsg.role === "assistant") {
      lastMsg.toolCalls = [...(lastMsg.toolCalls || []), toolCallData];
    }

    return {
      ...prev,
      messages,
      currentToolCall: toolCallData,
      activeToolCalls: [...prev.activeToolCalls, toolCallData],
      thinkingPhase: `Préparation de ${event.toolName}...`,
    };
  });
}

function handleToolArgsDelta(
  event: ChatStreamEvent,
  setState: React.Dispatch<React.SetStateAction<ChatState>>,
) {
  setState((prev) => {
    const messages = [...prev.messages];
    const lastMsg = messages[messages.length - 1];
    const toolId = event.toolId || prev.currentToolCall?.id;

    if (lastMsg && lastMsg.role === "assistant" && toolId) {
      const toolCall = lastMsg.toolCalls?.find((tc) => tc.id === toolId);
      if (toolCall) {
        toolCall.partialArgs =
          (toolCall.partialArgs || "") + (event.partialArgs || "");
        toolCall.parsedPreview = event.parsedPreview;
      }
    }

    // Also update activeToolCalls
    const newActiveToolCalls = prev.activeToolCalls.map((tc) => {
      if (tc.id === toolId) {
        return {
          ...tc,
          partialArgs: (tc.partialArgs || "") + (event.partialArgs || ""),
          parsedPreview: event.parsedPreview,
        };
      }
      return tc;
    });

    return {
      ...prev,
      messages,
      activeToolCalls: newActiveToolCalls,
    };
  });
}

function handleToolReady(
  event: ChatStreamEvent,
  setState: React.Dispatch<React.SetStateAction<ChatState>>,
) {
  setState((prev) => {
    const messages = [...prev.messages];
    const lastMsg = messages[messages.length - 1];
    const toolId = event.toolId;

    if (lastMsg && lastMsg.role === "assistant" && toolId) {
      const toolCall = lastMsg.toolCalls?.find((tc) => tc.id === toolId);
      if (toolCall) {
        toolCall.status = "pending";
        toolCall.result = event.arguments;
      }
    }

    return {
      ...prev,
      messages,
      thinkingPhase: `${event.toolName} prêt...`,
    };
  });
}

function handleToolExecuting(
  event: ChatStreamEvent,
  setState: React.Dispatch<React.SetStateAction<ChatState>>,
) {
  setState((prev) => {
    const messages = [...prev.messages];
    const lastMsg = messages[messages.length - 1];
    const toolId = event.toolId;

    if (lastMsg && lastMsg.role === "assistant" && toolId) {
      const toolCall = lastMsg.toolCalls?.find((tc) => tc.id === toolId);
      if (toolCall) {
        toolCall.status = "executing";
      }
    }

    const newActiveToolCalls = prev.activeToolCalls.map((tc) => {
      if (tc.id === toolId) {
        return { ...tc, status: "executing" as const };
      }
      return tc;
    });

    return {
      ...prev,
      messages,
      activeToolCalls: newActiveToolCalls,
      thinkingPhase: `Exécution de ${event.toolName}...`,
    };
  });
}

function handleToolResult(
  event: ChatStreamEvent,
  setState: React.Dispatch<React.SetStateAction<ChatState>>,
) {
  setState((prev) => {
    const messages = [...prev.messages];
    const lastMsg = messages[messages.length - 1];
    const toolId = event.toolId;

    if (lastMsg && lastMsg.role === "assistant" && toolId) {
      const toolCall = lastMsg.toolCalls?.find((tc) => tc.id === toolId);
      if (toolCall) {
        toolCall.status = event.success ? "success" : "error";
        toolCall.result = event.result;
        toolCall.endTime = Date.now();
      }
    }

    const newActiveToolCalls = prev.activeToolCalls.map((tc) => {
      if (tc.id === toolId) {
        return {
          ...tc,
          status: (event.success
            ? "success"
            : "error") as ToolCallData["status"],
          result: event.result,
          endTime: Date.now(),
        };
      }
      return tc;
    });

    return {
      ...prev,
      messages,
      activeToolCalls: newActiveToolCalls,
      thinkingPhase: null,
    };
  });
}

function handleToolError(
  event: ChatStreamEvent,
  setState: React.Dispatch<React.SetStateAction<ChatState>>,
) {
  setState((prev) => {
    const messages = [...prev.messages];
    const lastMsg = messages[messages.length - 1];
    const toolId = event.toolId;

    if (lastMsg && lastMsg.role === "assistant" && toolId) {
      const toolCall = lastMsg.toolCalls?.find((tc) => tc.id === toolId);
      if (toolCall) {
        toolCall.status = "error";
        toolCall.error = event.error;
        toolCall.endTime = Date.now();
      }
    }

    const newActiveToolCalls = prev.activeToolCalls.map((tc) => {
      if (tc.id === toolId) {
        return {
          ...tc,
          status: "error" as const,
          error: event.error,
          endTime: Date.now(),
        };
      }
      return tc;
    });

    return {
      ...prev,
      messages,
      activeToolCalls: newActiveToolCalls,
      thinkingPhase: null,
    };
  });
}
