/**
 * ChatGPT OAuth Controller
 * Handles OAuth 2.0 PKCE flow endpoints for ChatGPT account integration
 *
 * NOTE: The pi-ai based OAuth flow (startPiAiOAuthFlow) is recommended
 * as it uses the proven implementation from @mariozechner/pi-ai
 */

import { chatGPTOAuthService } from "../services/chatgpt-oauth.js";

// Store active OAuth flows for the local server approach
const activeOAuthFlows = new Map<
  string,
  {
    waitForCallback: () => Promise<{ success: boolean; error?: string }>;
    state: string;
  }
>();

// ==================== OAuth Flow Endpoints ====================

/**
 * Initiate OAuth flow - generates auth URL and session
 * Returns the authorization URL to redirect the user to
 */
export async function initiateOAuthFlow(userId: string): Promise<{
  authUrl: string;
  state: string;
}> {
  const { state, authUrl } =
    await chatGPTOAuthService.createOAuthSession(userId);
  return { authUrl, state };
}

/**
 * Initiate OAuth flow with local callback server
 * This starts a local server to capture the OAuth callback
 * Returns the authorization URL and starts waiting for callback
 */
export async function initiateOAuthFlowWithLocalServer(
  userId: string,
): Promise<{
  authUrl: string;
  state: string;
  callbackUrl: string;
}> {
  // Clean up any existing flow for this user
  activeOAuthFlows.delete(userId);

  const { authUrl, state, waitForCallback } =
    await chatGPTOAuthService.startOAuthFlowWithLocalServer(userId);

  // Store the callback waiter
  activeOAuthFlows.set(userId, { waitForCallback, state });

  // Start waiting for callback in background (don't await)
  // The client will poll for completion
  waitForCallback()
    .then((result) => {
      console.log(
        `OAuth flow for user ${userId} completed:`,
        result.success ? "success" : result.error,
      );
      // Clean up after completion
      setTimeout(() => activeOAuthFlows.delete(userId), 5000);
    })
    .catch((err) => {
      console.error(`OAuth flow error for user ${userId}:`, err);
      activeOAuthFlows.delete(userId);
    });

  return {
    authUrl,
    state,
    callbackUrl: chatGPTOAuthService.config.redirectUri,
  };
}

/**
 * Initiate OAuth flow using pi-ai library (RECOMMENDED)
 * This uses the proven implementation from @mariozechner/pi-ai
 * which handles all OAuth complexity correctly.
 *
 * The flow works as follows:
 * 1. Call this endpoint to get the auth URL
 * 2. Frontend opens the URL in a new window/tab
 * 3. User authenticates with OpenAI
 * 4. Callback is captured by pi-ai's local server on port 1455
 * 5. Tokens are exchanged and stored automatically
 */
export async function initiatePiAiOAuthFlow(
  userId: string,
  callbacks: {
    onAuth: (event: { url: string }) => Promise<void>;
    onPrompt: (prompt: {
      message: string;
      placeholder?: string;
    }) => Promise<string>;
    onProgress?: (message: string) => void;
  },
): Promise<{ success: boolean; error?: string }> {
  return chatGPTOAuthService.startPiAiOAuthFlow(userId, callbacks);
}

/**
 * Check if an OAuth flow is pending for a user
 */
export async function checkOAuthFlowStatus(userId: string): Promise<{
  pending: boolean;
  state?: string;
}> {
  const flow = activeOAuthFlows.get(userId);
  return {
    pending: !!flow,
    state: flow?.state,
  };
}

/**
 * Handle OAuth callback - exchange code for tokens
 */
export async function handleOAuthCallback(
  state: string,
  code: string,
): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  // Validate the state and get the session
  const session = await chatGPTOAuthService.validateOAuthCallback(state);

  if (!session) {
    return {
      success: false,
      error: "Invalid or expired OAuth session",
    };
  }

  try {
    // Exchange the authorization code for tokens
    const credentials = await chatGPTOAuthService.exchangeCodeForTokens(
      code,
      session.codeVerifier,
    );

    // Store the credentials
    await chatGPTOAuthService.storeOAuthCredentials(
      session.userId,
      credentials,
    );

    return {
      success: true,
      userId: session.userId,
    };
  } catch (error) {
    console.error("OAuth callback error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to exchange code for tokens",
    };
  }
}

// ==================== Status & Management Endpoints ====================

/**
 * Get OAuth connection status for a user
 */
export async function getOAuthStatus(userId: string): Promise<{
  isConnected: boolean;
  isEnabled: boolean;
  accountId?: string;
  expiresAt?: string;
  lastUsedAt?: string;
}> {
  const status = await chatGPTOAuthService.getOAuthStatus(userId);

  return {
    isConnected: status.isConnected,
    isEnabled: status.isEnabled,
    accountId: status.accountId,
    expiresAt: status.expiresAt instanceof Date ? status.expiresAt.toISOString() : status.expiresAt,
    lastUsedAt: status.lastUsedAt,
  };
}

/**
 * Disconnect OAuth (delete credentials)
 */
export async function disconnectOAuth(userId: string): Promise<{
  success: boolean;
}> {
  await chatGPTOAuthService.deleteOAuthCredentials(userId);
  return { success: true };
}

/**
 * Toggle OAuth enabled/disabled
 */
export async function setOAuthEnabled(
  userId: string,
  enabled: boolean,
): Promise<{
  success: boolean;
}> {
  try {
    await chatGPTOAuthService.setOAuthEnabled(userId, enabled);
    return { success: true };
  } catch (error) {
    console.error("Failed to set OAuth enabled status:", error);
    throw new Error("Failed to update OAuth status");
  }
}

/**
 * Check ChatGPT usage limits
 */
export async function checkUsage(userId: string): Promise<{
  usageAvailable: boolean;
  remainingQuota?: number;
  resetAt?: string;
  error?: string;
}> {
  const usage = await chatGPTOAuthService.checkChatGPTUsage(userId);

  if (!usage) {
    return {
      usageAvailable: false,
      error: "Failed to check usage or no OAuth credentials",
    };
  }

  return {
    usageAvailable: usage.usageAvailable,
    remainingQuota: usage.remainingQuota,
    resetAt: usage.resetAt?.toISOString(),
  };
}

/**
 * Test OAuth connection by making a simple API call
 */
export async function testConnection(userId: string): Promise<{
  success: boolean;
  message: string;
  accountId?: string;
}> {
  const status = await chatGPTOAuthService.getOAuthStatus(userId);

  if (!status.isConnected) {
    return {
      success: false,
      message: "No OAuth credentials found",
    };
  }

  if (!status.isEnabled) {
    return {
      success: false,
      message: "OAuth is disabled",
    };
  }

  try {
    // Try to get valid credentials (this will refresh if needed)
    const credentials =
      await chatGPTOAuthService.getValidOAuthCredentials(userId);

    if (!credentials) {
      return {
        success: false,
        message: "OAuth credentials are invalid or expired",
      };
    }

    return {
      success: true,
      message: "OAuth connection is working",
      accountId: credentials.accountId,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Connection test failed",
    };
  }
}

/**
 * Get OAuth configuration info (for debugging)
 */
export async function getOAuthConfig(): Promise<{
  authorizeEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scopes: string[];
  clientId: string;
}> {
  return chatGPTOAuthService.getOAuthConfig();
}

/**
 * Submit OAuth code manually (fallback when callback doesn't work)
 * User can paste the authorization code or full redirect URL
 */
export async function submitOAuthCodeManually(
  userId: string,
  input: string,
): Promise<{
  success: boolean;
  error?: string;
}> {
  // Parse the input - can be just the code, or a full URL
  let code: string | undefined;
  let state: string | undefined;

  const trimmedInput = input.trim();

  // Try to parse as URL first
  try {
    const url = new URL(trimmedInput);
    code = url.searchParams.get("code") ?? undefined;
    state = url.searchParams.get("state") ?? undefined;
  } catch {
    // Not a URL - check if it contains code= format
    if (trimmedInput.includes("code=")) {
      const params = new URLSearchParams(trimmedInput);
      code = params.get("code") ?? undefined;
      state = params.get("state") ?? undefined;
    } else if (trimmedInput.includes("#")) {
      // Format: code#state
      const [c, s] = trimmedInput.split("#", 2);
      code = c;
      state = s;
    } else {
      // Assume it's just the code
      code = trimmedInput;
    }
  }

  if (!code) {
    return {
      success: false,
      error: "Could not extract authorization code from input",
    };
  }

  // If we have a state, use handleOAuthCallback
  if (state) {
    return handleOAuthCallback(state, code);
  }

  // Without state, we need to find the active session for this user
  // This is a fallback - try to get the most recent session
  const session = await chatGPTOAuthService.getActiveSessionForUser(userId);

  if (!session) {
    return {
      success: false,
      error:
        "No active OAuth session found. Please start the OAuth flow again.",
    };
  }

  try {
    const credentials = await chatGPTOAuthService.exchangeCodeForTokens(
      code,
      session.codeVerifier,
    );

    await chatGPTOAuthService.storeOAuthCredentials(userId, credentials);

    // Clean up the session
    await chatGPTOAuthService.deleteSession(session.state);

    return { success: true };
  } catch (error) {
    console.error("Manual OAuth code submission error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to exchange code for tokens",
    };
  }
}

// Export controller functions
export const chatGPTOAuthController = {
  initiateOAuthFlow,
  initiateOAuthFlowWithLocalServer,
  initiatePiAiOAuthFlow, // RECOMMENDED: Uses pi-ai library
  checkOAuthFlowStatus,
  handleOAuthCallback,
  submitOAuthCodeManually,
  getOAuthStatus,
  disconnectOAuth,
  setOAuthEnabled,
  checkUsage,
  testConnection,
  getOAuthConfig,
};

export default chatGPTOAuthController;
