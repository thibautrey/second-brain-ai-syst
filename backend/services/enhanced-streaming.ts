/**
 * Enhanced Streaming Service
 *
 * Provides detailed streaming events for improved UX during LLM interactions.
 * Leverages pi-ai's rich event system to provide:
 * - Thinking/reasoning progress (for compatible models)
 * - Tool call argument preview (real-time)
 * - Status updates throughout the response
 * - Cost tracking per stream
 *
 * This service wraps pi-ai streaming to emit SSE-compatible events.
 */

import { Response } from "express";
import {
  piAiProviderService,
  type ChatMessage,
  type PiAiProviderConfig,
  type ChatCompletionOptions,
  type ChatCompletionResult,
  type OpenAIToolSchema,
} from "./pi-ai-provider.js";

// ==================== Types ====================

/**
 * Enhanced streaming event types for the frontend
 */
export type EnhancedStreamEventType =
  | "start" // Stream started
  | "status" // Status message (e.g., "Analyzing request...")
  | "thinking_start" // Reasoning started (for reasoning models)
  | "thinking_delta" // Reasoning content chunk
  | "thinking_end" // Reasoning complete
  | "text_start" // Text generation started
  | "text_delta" // Text content chunk (replaces "token")
  | "text_end" // Text generation complete
  | "tool_start" // Tool call started
  | "tool_args_delta" // Tool arguments being generated (partial JSON)
  | "tool_ready" // Tool call arguments complete, ready to execute
  | "tool_executing" // Tool is being executed
  | "tool_result" // Tool execution complete
  | "tool_error" // Tool execution failed
  | "usage" // Token usage and cost info
  | "error" // Error occurred
  | "end"; // Stream ended

/**
 * Base event structure
 */
export interface EnhancedStreamEvent {
  type: EnhancedStreamEventType;
  timestamp: number;
  messageId: string;
}

/**
 * Status event - general status updates
 */
export interface StatusEvent extends EnhancedStreamEvent {
  type: "status";
  message: string;
  phase?:
    | "analyzing"
    | "retrieving"
    | "generating"
    | "executing"
    | "completing";
}

/**
 * Thinking events - for reasoning models (Claude, GPT-5, etc.)
 */
export interface ThinkingStartEvent extends EnhancedStreamEvent {
  type: "thinking_start";
}

export interface ThinkingDeltaEvent extends EnhancedStreamEvent {
  type: "thinking_delta";
  content: string;
}

export interface ThinkingEndEvent extends EnhancedStreamEvent {
  type: "thinking_end";
  fullContent: string;
}

/**
 * Text events - main response content
 */
export interface TextStartEvent extends EnhancedStreamEvent {
  type: "text_start";
}

export interface TextDeltaEvent extends EnhancedStreamEvent {
  type: "text_delta";
  content: string;
}

export interface TextEndEvent extends EnhancedStreamEvent {
  type: "text_end";
  fullContent: string;
}

/**
 * Tool events - detailed tool call tracking
 */
export interface ToolStartEvent extends EnhancedStreamEvent {
  type: "tool_start";
  toolId: string;
  toolName: string;
}

export interface ToolArgsDeltaEvent extends EnhancedStreamEvent {
  type: "tool_args_delta";
  toolId: string;
  toolName: string;
  partialArgs: string; // Partial JSON string
  parsedPreview?: Record<string, unknown>; // Best-effort parsed preview
}

export interface ToolReadyEvent extends EnhancedStreamEvent {
  type: "tool_ready";
  toolId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutingEvent extends EnhancedStreamEvent {
  type: "tool_executing";
  toolId: string;
  toolName: string;
}

export interface ToolResultEvent extends EnhancedStreamEvent {
  type: "tool_result";
  toolId: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  duration: number;
}

export interface ToolErrorEvent extends EnhancedStreamEvent {
  type: "tool_error";
  toolId: string;
  toolName: string;
  error: string;
}

/**
 * Usage event - token and cost tracking
 */
export interface UsageEvent extends EnhancedStreamEvent {
  type: "usage";
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    cost: number;
    costBreakdown: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
    };
  };
}

/**
 * Error event
 */
export interface ErrorEvent extends EnhancedStreamEvent {
  type: "error";
  error: string;
  code?: string;
  isRetryable: boolean;
}

/**
 * Union type of all events
 */
export type StreamEvent =
  | EnhancedStreamEvent
  | StatusEvent
  | ThinkingStartEvent
  | ThinkingDeltaEvent
  | ThinkingEndEvent
  | TextStartEvent
  | TextDeltaEvent
  | TextEndEvent
  | ToolStartEvent
  | ToolArgsDeltaEvent
  | ToolReadyEvent
  | ToolExecutingEvent
  | ToolResultEvent
  | ToolErrorEvent
  | UsageEvent
  | ErrorEvent;

// ==================== SSE Writer ====================

/**
 * Helper class to write SSE events to an Express Response
 */
export interface StreamWriter {
  write(event: Partial<StreamEvent> & { type: EnhancedStreamEventType }): void;
  status(message: string, phase?: StatusEvent["phase"]): void;
  textDelta(content: string): void;
  thinkingDelta(content: string): void;
  toolArgsPreview(
    toolId: string,
    toolName: string,
    partialArgs: string,
    parsedPreview?: Record<string, unknown>,
  ): void;
  error(error: string, code?: string, isRetryable?: boolean): void;
  end(): void;
  isOpen(): boolean;
}

export class SSEWriter implements StreamWriter {
  private res: Response;
  private messageId: string;
  private isClosed: boolean = false;

  constructor(res: Response, messageId: string) {
    this.res = res;
    this.messageId = messageId;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Handle client disconnect
    res.on("close", () => {
      this.isClosed = true;
    });
  }

  /**
   * Write an event to the stream
   */
  write(event: Partial<StreamEvent> & { type: EnhancedStreamEventType }): void {
    if (this.isClosed) return;

    const fullEvent: StreamEvent = {
      ...event,
      timestamp: Date.now(),
      messageId: this.messageId,
    } as StreamEvent;

    try {
      this.res.write(`data: ${JSON.stringify(fullEvent)}\n\n`);
    } catch (error) {
      console.error("[SSEWriter] Failed to write event:", error);
      this.isClosed = true;
    }
  }

  /**
   * Write a status update
   */
  status(message: string, phase?: StatusEvent["phase"]): void {
    this.write({ type: "status", message, phase } as StatusEvent);
  }

  /**
   * Write a text delta (main response content)
   */
  textDelta(content: string): void {
    this.write({ type: "text_delta", content } as TextDeltaEvent);
  }

  /**
   * Write thinking/reasoning delta
   */
  thinkingDelta(content: string): void {
    this.write({ type: "thinking_delta", content } as ThinkingDeltaEvent);
  }

  /**
   * Write tool argument preview
   */
  toolArgsPreview(
    toolId: string,
    toolName: string,
    partialArgs: string,
    parsedPreview?: Record<string, unknown>,
  ): void {
    this.write({
      type: "tool_args_delta",
      toolId,
      toolName,
      partialArgs,
      parsedPreview,
    } as ToolArgsDeltaEvent);
  }

  /**
   * Write an error event
   */
  error(error: string, code?: string, isRetryable = false): void {
    this.write({ type: "error", error, code, isRetryable } as ErrorEvent);
  }

  /**
   * End the stream
   */
  end(): void {
    if (this.isClosed) return;
    this.write({ type: "end" });
    this.res.end();
    this.isClosed = true;
  }

  /**
   * Check if stream is still open
   */
  isOpen(): boolean {
    return !this.isClosed;
  }
}

// ==================== Enhanced Streaming Service ====================

export interface EnhancedStreamOptions extends ChatCompletionOptions {
  /** Callback when tool needs execution */
  onToolCall?: (toolCall: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }) => Promise<{ success: boolean; result?: unknown; error?: string }>;
  /** Whether to emit detailed thinking events (default: true) */
  emitThinking?: boolean;
  /** Whether to emit tool argument previews (default: true) */
  emitToolPreview?: boolean;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Create an enhanced streaming chat completion
 *
 * This function handles the streaming from pi-ai and emits detailed events
 * to the SSE writer for rich frontend display.
 */
export async function createEnhancedStream(
  config: PiAiProviderConfig,
  messages: ChatMessage[],
  writer: StreamWriter,
  options: EnhancedStreamOptions = {},
): Promise<ChatCompletionResult | null> {
  const {
    onToolCall,
    emitThinking = true,
    emitToolPreview = true,
    signal,
    ...chatOptions
  } = options;

  writer.write({ type: "start" });
  writer.status("Génération de la réponse...", "generating");

  let fullTextContent = "";
  let fullThinkingContent = "";
  let finalResult: ChatCompletionResult | null = null;

  // Track current tool call being built
  let currentToolId: string | undefined;
  let currentToolName: string | undefined;
  let currentToolArgs = "";

  try {
    const stream = piAiProviderService.createStreamingChatCompletion(
      config,
      messages,
      { ...chatOptions, signal },
    );

    for await (const event of stream) {
      // Check for abort
      if (signal?.aborted) {
        writer.error("Request cancelled", "ABORTED", false);
        break;
      }

      switch (event.type) {
        case "text":
          if (fullTextContent === "") {
            writer.write({ type: "text_start" });
          }
          fullTextContent += event.content || "";
          writer.textDelta(event.content || "");
          break;

        case "thinking_start":
          if (emitThinking) {
            writer.write({ type: "thinking_start" });
            writer.status("Réflexion en cours...", "analyzing");
          }
          break;

        case "thinking_delta":
          if (emitThinking && event.content) {
            fullThinkingContent += event.content;
            writer.thinkingDelta(event.content);
          }
          break;

        case "thinking_end":
          if (emitThinking) {
            writer.write({
              type: "thinking_end",
              fullContent: event.content || fullThinkingContent,
            } as ThinkingEndEvent);
          }
          break;

        case "tool_call_start":
          currentToolArgs = "";
          writer.status("Préparation d'un outil...", "executing");
          break;

        case "tool_call_delta":
          if (emitToolPreview && event.toolCallPartial) {
            currentToolArgs += event.toolCallPartial.argumentsPartial || "";

            // Try to parse partial JSON for preview
            let parsedPreview: Record<string, unknown> | undefined;
            try {
              // Attempt to parse, adding closing braces if needed
              const attemptParse =
                currentToolArgs +
                "}".repeat(
                  (currentToolArgs.match(/{/g) || []).length -
                    (currentToolArgs.match(/}/g) || []).length,
                );
              parsedPreview = JSON.parse(attemptParse);
            } catch {
              // Can't parse yet, that's fine
            }

            if (currentToolId && currentToolName) {
              writer.toolArgsPreview(
                currentToolId,
                currentToolName,
                currentToolArgs,
                parsedPreview,
              );
            }
          }
          break;

        case "tool_call":
          if (event.toolCall) {
            const { id, name, arguments: args } = event.toolCall;
            currentToolId = id;
            currentToolName = name;

            // Emit tool ready event
            writer.write({
              type: "tool_ready",
              toolId: id,
              toolName: name,
              arguments: args,
            } as ToolReadyEvent);

            // Execute tool if callback provided
            if (onToolCall) {
              writer.write({
                type: "tool_executing",
                toolId: id,
                toolName: name,
              } as ToolExecutingEvent);

              writer.status(`Exécution de ${name}...`, "executing");

              const startTime = Date.now();
              try {
                const result = await onToolCall({ id, name, arguments: args });
                const duration = Date.now() - startTime;

                if (result.success) {
                  writer.write({
                    type: "tool_result",
                    toolId: id,
                    toolName: name,
                    success: true,
                    result: result.result,
                    duration,
                  } as Omit<ToolResultEvent, "timestamp" | "messageId">);
                } else {
                  writer.write({
                    type: "tool_error",
                    toolId: id,
                    toolName: name,
                    error: result.error || "Unknown error",
                  } as Omit<ToolErrorEvent, "timestamp" | "messageId">);
                }
              } catch (error) {
                writer.write({
                  type: "tool_error",
                  toolId: id,
                  toolName: name,
                  error: error instanceof Error ? error.message : String(error),
                } as Omit<ToolErrorEvent, "timestamp" | "messageId">);
              }
            }

            // Reset for next tool
            currentToolArgs = "";
          }
          break;

        case "done":
          if (event.result) {
            finalResult = event.result;

            // Emit text end if we had text content
            if (fullTextContent) {
              writer.write({
                type: "text_end",
                fullContent: fullTextContent,
              } as TextEndEvent);
            }

            // Emit usage stats
            writer.write({
              type: "usage",
              usage: event.result.usage,
            } as UsageEvent);
          }
          break;

        case "error":
          writer.error(event.error || "Unknown error", undefined, true);
          break;
      }
    }

    return finalResult;
  } catch (error) {
    const errorInfo = piAiProviderService.classifyLLMError(error);
    writer.error(errorInfo.message, errorInfo.type, errorInfo.isRetryable);
    return null;
  }
}

/**
 * Stream a simple text response (no tool support)
 * Useful for quick responses that don't need tool execution
 */
export async function streamSimpleResponse(
  config: PiAiProviderConfig,
  messages: ChatMessage[],
  writer: StreamWriter,
  options: Omit<EnhancedStreamOptions, "tools" | "onToolCall"> = {},
): Promise<string> {
  const result = await createEnhancedStream(config, messages, writer, {
    ...options,
    tools: undefined,
  });

  return result?.content || "";
}

// ==================== Export ====================

export const enhancedStreamingService = {
  SSEWriter,
  createEnhancedStream,
  streamSimpleResponse,
};

export default enhancedStreamingService;
