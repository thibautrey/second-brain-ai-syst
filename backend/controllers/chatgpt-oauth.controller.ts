/**
 * ChatGPT OAuth Controller
 * Handles OAuth 2.0 PKCE flow endpoints for ChatGPT account integration
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
    expiresAt: status.expiresAt?.toISOString(),
    lastUsedAt: status.lastUsedAt?.toISOString(),
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

// Export controller functions
export const chatGPTOAuthController = {
  initiateOAuthFlow,
  initiateOAuthFlowWithLocalServer,
  checkOAuthFlowStatus,
  handleOAuthCallback,
  getOAuthStatus,
  disconnectOAuth,
  setOAuthEnabled,
  checkUsage,
  testConnection,
  getOAuthConfig,
};

export default chatGPTOAuthController;
