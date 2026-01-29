/**
 * Pi-AI Provider Service
 *
 * Unified LLM provider using @mariozechner/pi-ai library
 * Supports:
 * - OpenAI API (standard API key)
 * - OpenAI Codex (ChatGPT Plus/Pro OAuth)
 * - Anthropic
 * - Google
 * - GitHub Copilot
 * - And more...
 *
 * This service is the SINGLE entry point for all LLM calls in the application.
 * It provides:
 * - Multi-provider support via unified API
 * - Automatic cost tracking
 * - Token usage tracking
 * - Error classification and handling
 * - Fallback support
 */

import {
  getModel,
  getModels,
  getProviders,
  stream,
  complete,
  loginOpenAICodex,
  refreshOAuthToken,
  type Model,
  type Context,
  type Tool,
  type AssistantMessage,
  type OAuthProvider,
  type OAuthCredentials,
} from "@mariozechner/pi-ai";
import prisma from "./prisma.js";
import * as crypto from "crypto";

// ==================== Types ====================

export interface PiAiProviderConfig {
  provider: string;
  modelId: string;
  apiKey?: string;
  oauthCredentials?: OAuthCredentials;
  baseUrl?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * OpenAI-compatible tool schema format
 * This is what the existing codebase uses
 */
export interface OpenAIToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  /** Tool schemas in OpenAI function format */
  tools?: OpenAIToolSchema[];
  /** Tool schemas in pi-ai native format */
  piAiTools?: Tool[];
  stream?: boolean;
  signal?: AbortSignal;
  /** Response format for structured output */
  responseFormat?: "text" | "json";
  /** Tool choice behavior */
  toolChoice?: "auto" | "none" | "required";
}

export interface ChatCompletionResult {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
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
  stopReason: string;
  /** Raw response for debugging */
  raw?: AssistantMessage;
}

/**
 * Error information for LLM calls
 */
export interface LLMErrorInfo {
  type:
    | "timeout"
    | "model-incompatible"
    | "auth"
    | "rate-limit"
    | "network"
    | "unknown";
  status?: number;
  message: string;
  isRetryable: boolean;
  isTransient: boolean;
}

// ==================== Encryption Helpers ====================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn(
      "⚠️ ENCRYPTION_KEY not set - using derived key from JWT_SECRET",
    );
    const jwtSecret = process.env.JWT_SECRET || "default-fallback-secret";
    return crypto.pbkdf2Sync(jwtSecret, "oauth-salt", 100000, 32, "sha256");
  }

  if (key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }

  return Buffer.from(key, "hex");
}

function encrypt(plaintext: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decrypt(encrypted: string, iv: string, authTag: string): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

function encryptToken(token: string): string {
  const { encrypted, iv, authTag } = encrypt(token);
  return JSON.stringify({ encrypted, iv, authTag });
}

function decryptToken(encryptedJson: string): string {
  const { encrypted, iv, authTag } = JSON.parse(encryptedJson);
  return decrypt(encrypted, iv, authTag);
}

// ==================== OAuth Management ====================

/**
 * Store OAuth credentials for a user
 */
export async function storeOAuthCredentials(
  userId: string,
  provider: OAuthProvider,
  credentials: OAuthCredentials,
): Promise<void> {
  const encryptedAccess = encryptToken(credentials.access);
  const encryptedRefresh = encryptToken(credentials.refresh);

  // Extract accountId safely (it's an optional unknown field)
  const accountId =
    typeof credentials.accountId === "string" ? credentials.accountId : null;

  await prisma.chatGPTOAuthCredentials.upsert({
    where: { userId },
    update: {
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      expiresAt: new Date(credentials.expires),
      accountId,
      isEnabled: true,
      lastRefreshedAt: new Date(),
    },
    create: {
      userId,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      expiresAt: new Date(credentials.expires),
      accountId,
      isEnabled: true,
    },
  });

  console.log(
    `✅ Stored OAuth credentials for user ${userId}, provider: ${provider}`,
  );
}

/**
 * Get OAuth credentials for a user (decrypted)
 */
export async function getOAuthCredentialsForUser(
  userId: string,
): Promise<OAuthCredentials | null> {
  const stored = await prisma.chatGPTOAuthCredentials.findUnique({
    where: { userId },
  });

  if (!stored || !stored.isEnabled) {
    return null;
  }

  try {
    const credentials: OAuthCredentials = {
      access: decryptToken(stored.accessToken),
      refresh: decryptToken(stored.refreshToken),
      expires: stored.expiresAt.getTime(),
    };

    // Add accountId if present (optional field)
    if (stored.accountId) {
      credentials.accountId = stored.accountId;
    }

    return credentials;
  } catch (error) {
    console.error("Failed to decrypt OAuth credentials:", error);
    return null;
  }
}

/**
 * Get a valid API key for OAuth provider, refreshing if needed
 */
export async function getValidOAuthApiKey(
  userId: string,
  provider: OAuthProvider = "openai-codex",
): Promise<string | null> {
  const credentials = await getOAuthCredentialsForUser(userId);
  if (!credentials) {
    return null;
  }

  // Check if token is expired or about to expire (5 min buffer)
  const expiresIn = credentials.expires - Date.now();
  const needsRefresh = expiresIn < 5 * 60 * 1000;

  if (needsRefresh) {
    console.log(`🔄 Refreshing OAuth token for user ${userId}...`);
    try {
      const newCredentials = await refreshOAuthToken(provider, credentials);
      await storeOAuthCredentials(userId, provider, newCredentials);
      return newCredentials.access;
    } catch (error) {
      console.error("Failed to refresh OAuth token:", error);
      // Try to use the existing token anyway
      return credentials.access;
    }
  }

  return credentials.access;
}

// ==================== OAuth Login Flow ====================

export interface OAuthLoginCallbacks {
  onAuth: (event: { url: string }) => Promise<void>;
  onPrompt: (prompt: {
    message: string;
    placeholder?: string;
  }) => Promise<string>;
  onProgress?: (message: string) => void;
}

/**
 * Initiate OpenAI Codex (ChatGPT) OAuth login flow
 */
export async function loginChatGPTOAuth(
  userId: string,
  callbacks: OAuthLoginCallbacks,
): Promise<OAuthCredentials> {
  console.log(`🔐 Starting OpenAI Codex OAuth flow for user ${userId}...`);

  const credentials = await loginOpenAICodex({
    onAuth: callbacks.onAuth,
    onPrompt: callbacks.onPrompt,
    onProgress: callbacks.onProgress,
  });

  // Store the credentials
  await storeOAuthCredentials(userId, "openai-codex", credentials);

  console.log(`✅ OpenAI Codex OAuth completed for user ${userId}`);
  return credentials;
}

// ==================== Chat Completion ====================

/**
 * Build messages for pi-ai Context from our ChatMessage format
 * pi-ai expects messages with role "user" | "assistant" structure and timestamp
 */
function buildPiAiMessages(messages: ChatMessage[]): Context["messages"] {
  // Filter out system messages as they go in systemPrompt
  // pi-ai's Context.messages expects a specific format with timestamps
  const result: Context["messages"] = [];
  const now = Date.now();

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "system") continue; // handled separately as systemPrompt

    const timestamp = now - (messages.length - i) * 1000; // Increasing timestamps

    if (m.role === "user") {
      result.push({
        role: "user" as const,
        content: m.content,
        timestamp,
      });
    } else if (m.role === "assistant") {
      // Assistant messages need the full AssistantMessage structure
      result.push({
        role: "assistant" as const,
        content: [{ type: "text" as const, text: m.content }],
        api: "openai-completions" as const,
        provider: "openai",
        model: "gpt-4",
        stopReason: "stop" as const,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        timestamp,
      });
    }
  }

  return result;
}

/**
 * Convert OpenAI-style tool schemas to pi-ai Tool format
 */
function convertOpenAIToolsToPiAi(tools: OpenAIToolSchema[]): Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as any, // JSON Schema is compatible
  }));
}

/**
 * Classify an LLM error for proper handling
 */
export function classifyLLMError(error: any): LLMErrorInfo {
  const message = error?.message || String(error);
  const status = error?.status;

  // Model incompatibility errors
  if (status === 404 && message.includes("model")) {
    return {
      type: "model-incompatible",
      status,
      message,
      isRetryable: false,
      isTransient: false,
    };
  }

  // Timeout/network errors
  if (
    message.includes("timeout") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("aborted")
  ) {
    return {
      type: "timeout",
      status,
      message,
      isRetryable: true,
      isTransient: true,
    };
  }

  // Authentication errors
  if (status === 401 || (status === 403 && message.includes("permission"))) {
    return {
      type: "auth",
      status,
      message,
      isRetryable: false,
      isTransient: false,
    };
  }

  // Rate limiting
  if (status === 429 || message.includes("rate")) {
    return {
      type: "rate-limit",
      status,
      message,
      isRetryable: true,
      isTransient: true,
    };
  }

  // 503 Service unavailable or similar
  if (status === 503 || status === 502 || message.includes("upstream")) {
    return {
      type: "network",
      status,
      message,
      isRetryable: true,
      isTransient: true,
    };
  }

  return {
    type: "unknown",
    status,
    message,
    isRetryable: false,
    isTransient: false,
  };
}

/**
 * Create a chat completion using pi-ai
 *
 * This is the main entry point for all LLM calls.
 * Supports both OpenAI-style tool schemas and native pi-ai tools.
 *
 * Includes retry logic for empty responses which can occur with certain models.
 * According to pi-ai docs, stopReason indicates why generation ended:
 * - "stop" = normal completion
 * - "length" = hit token limit
 * - "toolUse" = model wants to call tools
 * - "error" = error occurred
 * - "aborted" = request cancelled
 */
export async function createChatCompletion(
  config: PiAiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
  _retryCount: number = 0,
): Promise<ChatCompletionResult> {
  const MAX_RETRIES = 2;

  // Get the model
  const model = resolveModel(config.provider, config.modelId, config.baseUrl);

  // Extract system prompt if present
  const systemMessage = messages.find((m) => m.role === "system");

  // Convert tools if needed
  let piAiTools: Tool[] | undefined;
  if (options.piAiTools) {
    piAiTools = options.piAiTools;
  } else if (options.tools && options.tools.length > 0) {
    piAiTools = convertOpenAIToolsToPiAi(options.tools);
  }

  // Build context
  const context: Context = {
    systemPrompt: systemMessage?.content,
    messages: buildPiAiMessages(messages),
    tools: piAiTools,
  };

  // Determine API key
  let apiKey = config.apiKey;
  if (config.oauthCredentials) {
    apiKey = config.oauthCredentials.access;
  }

  if (options.stream) {
    throw new Error(
      "Streaming not yet implemented in this wrapper - use createStreamingChatCompletion",
    );
  }

  try {
    // Non-streaming mode
    const response = await complete(model, context, {
      apiKey,
      temperature: options.temperature,
      signal: options.signal,
    });

    const result = formatResponse(response);

    // Check if we should retry due to empty response
    // Don't retry if stopReason is "toolUse" (empty content is expected when calling tools)
    const hasContent = result.content && result.content.trim().length > 0;
    const hasToolCalls = result.toolCalls && result.toolCalls.length > 0;
    const isToolUseStop = result.stopReason === "toolUse";
    const isErrorStop =
      result.stopReason === "error" || result.stopReason === "aborted";

    if (!hasContent && !hasToolCalls && !isToolUseStop) {
      if (_retryCount < MAX_RETRIES) {
        console.warn(
          `[PiAiProvider] Model "${config.modelId}" returned empty response (stopReason: ${result.stopReason}), retrying (${_retryCount + 1}/${MAX_RETRIES})`,
        );

        // Add delay before retry
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (_retryCount + 1)),
        );

        return createChatCompletion(config, messages, options, _retryCount + 1);
      } else {
        console.warn(
          `[PiAiProvider] Model "${config.modelId}" returned empty response after ${MAX_RETRIES} retries`,
          {
            stopReason: result.stopReason,
            isErrorStop,
          },
        );
      }
    }

    return result;
  } catch (error) {
    // Enhance error with classification
    const errorInfo = classifyLLMError(error);
    const enhancedError = error as any;
    enhancedError.errorInfo = errorInfo;
    enhancedError.providerDebugInfo = {
      provider: config.provider,
      modelId: config.modelId,
      baseUrl: config.baseUrl,
    };
    throw enhancedError;
  }
}

/**
 * Create a chat completion with automatic fallback support
 *
 * If primary provider fails, automatically tries fallback if provided.
 */
export async function createChatCompletionWithFallback(
  primaryConfig: PiAiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
  fallbackConfig?: PiAiProviderConfig,
): Promise<ChatCompletionResult & { usedFallback: boolean }> {
  try {
    const result = await createChatCompletion(primaryConfig, messages, options);
    return { ...result, usedFallback: false };
  } catch (primaryError: any) {
    const errorInfo = primaryError.errorInfo || classifyLLMError(primaryError);

    console.warn(
      `[PiAiProvider] Primary provider "${primaryConfig.provider}" (${primaryConfig.modelId}) failed:`,
      {
        type: errorInfo.type,
        message: errorInfo.message,
        isRetryable: errorInfo.isRetryable,
      },
    );

    // Try fallback if available
    if (fallbackConfig) {
      console.log(
        `[PiAiProvider] Attempting fallback to "${fallbackConfig.provider}" (${fallbackConfig.modelId})`,
      );

      try {
        const result = await createChatCompletion(
          fallbackConfig,
          messages,
          options,
        );
        return { ...result, usedFallback: true };
      } catch (fallbackError: any) {
        const fallbackErrorInfo =
          fallbackError.errorInfo || classifyLLMError(fallbackError);

        console.error(
          `[PiAiProvider] Both primary and fallback providers failed:`,
          {
            primary: {
              provider: primaryConfig.provider,
              model: primaryConfig.modelId,
              error: errorInfo.message,
            },
            fallback: {
              provider: fallbackConfig.provider,
              model: fallbackConfig.modelId,
              error: fallbackErrorInfo.message,
            },
          },
        );

        // Throw with combined error info
        const combinedError = new Error(
          `Both providers failed. Primary: ${errorInfo.message}. Fallback: ${fallbackErrorInfo.message}`,
        );
        (combinedError as any).primaryErrorInfo = errorInfo;
        (combinedError as any).fallbackErrorInfo = fallbackErrorInfo;
        throw combinedError;
      }
    }

    // No fallback, rethrow
    throw primaryError;
  }
}

/**
 * Create a streaming chat completion
 */
export async function* createStreamingChatCompletion(
  config: PiAiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<{
  type:
    | "text"
    | "tool_call"
    | "tool_call_start"
    | "tool_call_delta"
    | "done"
    | "error"
    | "thinking_start"
    | "thinking_delta"
    | "thinking_end";
  content?: string;
  toolCall?: { id: string; name: string; arguments: Record<string, unknown> };
  toolCallPartial?: { id?: string; name?: string; argumentsPartial?: string };
  error?: string;
  result?: ChatCompletionResult;
}> {
  const model = resolveModel(config.provider, config.modelId, config.baseUrl);

  // Extract system prompt if present
  const systemMessage = messages.find((m) => m.role === "system");

  // Convert tools if needed
  let piAiTools: Tool[] | undefined;
  if (options.piAiTools) {
    piAiTools = options.piAiTools;
  } else if (options.tools && options.tools.length > 0) {
    piAiTools = convertOpenAIToolsToPiAi(options.tools);
  }

  const context: Context = {
    systemPrompt: systemMessage?.content,
    messages: buildPiAiMessages(messages),
    tools: piAiTools,
  };

  let apiKey = config.apiKey;
  if (config.oauthCredentials) {
    apiKey = config.oauthCredentials.access;
  }

  try {
    const s = stream(model, context, {
      apiKey,
      temperature: options.temperature,
      signal: options.signal,
    });

    for await (const event of s) {
      switch (event.type) {
        case "text_delta":
          yield { type: "text", content: event.delta };
          break;
        case "thinking_start":
          yield { type: "thinking_start" };
          break;
        case "thinking_delta":
          yield { type: "thinking_delta", content: event.delta };
          break;
        case "thinking_end":
          yield { type: "thinking_end", content: event.content };
          break;
        case "toolcall_start":
          yield {
            type: "tool_call_start",
            toolCallPartial: { id: undefined, name: undefined },
          };
          break;
        case "toolcall_delta":
          yield {
            type: "tool_call_delta",
            toolCallPartial: { argumentsPartial: event.delta },
          };
          break;
        case "toolcall_end":
          yield {
            type: "tool_call",
            toolCall: {
              id: event.toolCall.id,
              name: event.toolCall.name,
              arguments: event.toolCall.arguments as Record<string, unknown>,
            },
          };
          break;
        case "done":
          yield { type: "done", result: formatResponse(event.message) };
          break;
        case "error":
          yield { type: "error", error: event.error.errorMessage };
          break;
      }
    }
  } catch (error) {
    const errorInfo = classifyLLMError(error);
    yield {
      type: "error",
      error: errorInfo.message,
    };
  }
}

// ==================== Helper Functions ====================

/**
 * Resolve a model from provider and model ID
 * Creates a custom model definition for unknown providers (like local/custom endpoints)
 */
function resolveModel(
  provider: string,
  modelId: string,
  baseUrl?: string,
): Model<any> {
  // Try to get from built-in models first
  // Note: getModel returns undefined (not throws) if model not found
  const builtInModel = getModel(provider as any, modelId as any);
  if (builtInModel) {
    return builtInModel;
  }

  // Create a custom model for unknown providers (local LLMs, custom endpoints)
  // This handles providers like GpuStack, Ollama, LM Studio, etc.
  const customModel: Model<"openai-completions"> = {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: provider,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 16384,
    baseUrl: baseUrl || "https://api.openai.com/v1",
  };

  return customModel;
}

/**
 * Format pi-ai response to our standard format
 *
 * According to pi-ai documentation:
 * - stopReason can be: "stop", "length", "toolUse", "error", "aborted"
 * - When stopReason is "error" or "aborted", errorMessage contains details
 * - content is an array of blocks (text, toolCall, thinking)
 */
function formatResponse(response: AssistantMessage): ChatCompletionResult {
  let content = "";
  const toolCalls: ChatCompletionResult["toolCalls"] = [];

  // Check for error responses first
  if (response?.stopReason === "error" || response?.stopReason === "aborted") {
    console.warn("[PiAiProvider] Response ended with error/abort", {
      stopReason: response.stopReason,
      errorMessage: response.errorMessage,
      hasPartialContent: response.content?.length > 0,
    });
    // We still process partial content below
  }

  // Handle empty or undefined content
  if (!response || !response.content) {
    console.warn("[PiAiProvider] Empty response content received from model", {
      hasResponse: !!response,
      hasContent: !!response?.content,
      contentLength: response?.content?.length,
      stopReason: response?.stopReason,
      errorMessage: response?.errorMessage,
    });
    content = "";
  } else {
    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        content += block.text;
      } else if (block.type === "toolCall") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.arguments as Record<string, unknown>,
        });
      }
      // Note: "thinking" blocks are available for reasoning models
      // Can be exposed later for UI display
    }
  }

  // Validate we got at least some content or tool calls
  // Empty content is OK if stopReason is "toolUse" (model wants to call tools)
  if (!content && toolCalls.length === 0) {
    const isToolUseStop = response?.stopReason === "toolUse";
    if (!isToolUseStop) {
      console.warn(
        "[PiAiProvider] Empty content and no tool calls in response - model may not have responded correctly",
        {
          stopReason: response?.stopReason ?? "unknown",
          errorMessage: response?.errorMessage,
          responseKeys: response ? Object.keys(response) : "null",
        },
      );
    }
  }

  return {
    content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      inputTokens: response?.usage?.input ?? 0,
      outputTokens: response?.usage?.output ?? 0,
      totalTokens: response?.usage?.totalTokens ?? 0,
      cacheReadTokens: response?.usage?.cacheRead ?? 0,
      cacheWriteTokens: response?.usage?.cacheWrite ?? 0,
      cost: response?.usage?.cost?.total ?? 0,
      costBreakdown: {
        input: response?.usage?.cost?.input ?? 0,
        output: response?.usage?.cost?.output ?? 0,
        cacheRead: response?.usage?.cost?.cacheRead ?? 0,
        cacheWrite: response?.usage?.cost?.cacheWrite ?? 0,
      },
    },
    stopReason: response?.stopReason ?? "unknown",
    raw: response,
  };
}

// ==================== Provider Discovery ====================

/**
 * Get all available providers from pi-ai
 */
export function getAvailableProviders(): string[] {
  return getProviders();
}

/**
 * Get all models for a provider
 */
export function getModelsForProvider(provider: string): Array<{
  id: string;
  name: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsReasoning: boolean;
}> {
  try {
    const models = getModels(provider as any);
    return models.map((m) => ({
      id: m.id,
      name: m.name,
      contextWindow: m.contextWindow,
      supportsVision: m.input.includes("image"),
      supportsReasoning: m.reasoning,
    }));
  } catch {
    return [];
  }
}

/**
 * Check if a provider supports OAuth
 */
export function isOAuthProvider(provider: string): boolean {
  const oauthProviders = [
    "anthropic",
    "openai-codex",
    "github-copilot",
    "google-gemini-cli",
    "google-antigravity",
  ];
  return oauthProviders.includes(provider);
}

// ==================== Service Export ====================

export const piAiProviderService = {
  // OAuth management
  storeOAuthCredentials,
  getOAuthCredentialsForUser,
  getValidOAuthApiKey,
  loginChatGPTOAuth,

  // Chat completion
  createChatCompletion,
  createChatCompletionWithFallback,
  createStreamingChatCompletion,

  // Error handling
  classifyLLMError,

  // Discovery
  getAvailableProviders,
  getModelsForProvider,
  isOAuthProvider,
};

export default piAiProviderService;
