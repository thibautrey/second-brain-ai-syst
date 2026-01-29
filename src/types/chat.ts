/**
 * Chat Types
 *
 * Type definitions for the chat feature
 */

export type ChatMessageRole = "user" | "assistant" | "system";

// Tool call status
export type ToolCallStatus = "pending" | "executing" | "success" | "error";

// Tool call data
export interface ToolCallData {
  id: string;
  toolName: string;
  action?: string;
  status: ToolCallStatus;
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
  /** Partial arguments being streamed (for preview) */
  partialArgs?: string;
  /** Parsed preview of partial args (best-effort) */
  parsedPreview?: Record<string, unknown>;
}

// Tool generation step (for dynamic tool creation)
export interface ToolGenerationStepData {
  phase:
    | "starting"
    | "checking"
    | "generating"
    | "executing"
    | "fixing"
    | "schema"
    | "saving"
    | "completed"
    | "error";
  message: string;
  iteration?: number;
  maxIterations?: number;
  details?: Record<string, any>;
  toolCallId?: string;
}

// Thinking/Reasoning data (for models that support it)
export interface ThinkingData {
  isActive: boolean;
  content: string;
  startTime?: number;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  // Tool calls associated with this assistant message
  toolCalls?: ToolCallData[];
  // Tool generation steps for this message
  toolGenerationSteps?: ToolGenerationStepData[];
  // Thinking/reasoning content (for reasoning models)
  thinking?: ThinkingData;
  // Usage/cost info for this message
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
}

export interface ChatRequest {
  message: string;
  messages?: ChatMessage[];
  conversationId?: string;
}

// Enhanced streaming event types
export type EnhancedStreamEventType =
  | "start"
  | "status"
  | "thinking_start"
  | "thinking_delta"
  | "thinking_end"
  | "text_start"
  | "text_delta"
  | "text_end"
  | "tool_start"
  | "tool_args_delta"
  | "tool_ready"
  | "tool_executing"
  | "tool_result"
  | "tool_error"
  | "usage"
  | "error"
  | "end"
  // Legacy event types for backwards compatibility
  | "token"
  | "tool_call"
  | "tool_generation"
  | "thinking"
  | "tools";

export interface ChatStreamEvent {
  type: EnhancedStreamEventType;
  data?: string | ToolCallData | ToolGenerationStepData | any;
  messageId?: string;
  timestamp?: number;
  // Enhanced event specific fields
  content?: string;
  message?: string;
  phase?: string;
  toolId?: string;
  toolName?: string;
  partialArgs?: string;
  parsedPreview?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  success?: boolean;
  result?: unknown;
  error?: string;
  duration?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    costBreakdown?: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
    };
  };
  isRetryable?: boolean;
  fullContent?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  currentToolCall: ToolCallData | null;
  currentToolGeneration: ToolGenerationStepData | null;
  // Track all active tool calls for the current response
  activeToolCalls: ToolCallData[];
  // Current thinking/processing phase
  thinkingPhase: string | null;
  // Thinking/reasoning content being streamed
  thinkingContent: string;
  // Whether we're using enhanced streaming
  isEnhancedStreaming: boolean;
  // Current status message
  statusMessage: string | null;
}
