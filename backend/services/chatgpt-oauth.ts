/**
 * ChatGPT OAuth Service
 * Implements OAuth 2.0 PKCE flow for ChatGPT account integration
 * Allows users to use their ChatGPT subscription quota instead of API keys
 *
 * NOTE: This service now uses @mariozechner/pi-ai for OAuth operations
 * which provides a tested and maintained implementation of the OAuth flow.
 */

import crypto from "crypto";
import prisma from "./prisma.js";
import {
  loginOpenAICodex,
  refreshOAuthToken,
  type OAuthCredentials as PiAiOAuthCredentials,
} from "@mariozechner/pi-ai";

// ==================== Configuration ====================

// Pi-ai's OAuth redirect URI - MUST match exactly what's registered with OpenAI
// The client ID app_EMoamEEZ73f0CkXaXp7hrann is registered with this exact URI
const PI_AI_REDIRECT_URI = "http://localhost:1455/auth/callback";

const OAUTH_CONFIG = {
  // OpenAI OAuth endpoints - matches pi-ai implementation
  authorizeEndpoint: "https://auth.openai.com/oauth/authorize",
  tokenEndpoint: "https://auth.openai.com/oauth/token",
  // Client ID - official OpenAI Codex client ID from pi-ai
  // DO NOT CHANGE - this ID is registered with the specific redirect URI below
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  // Redirect URI - MUST be exactly http://localhost:1455/auth/callback
  // This is hardcoded because the client ID is registered with this exact URI
  redirectUri: PI_AI_REDIRECT_URI,
  // Scopes for ChatGPT access - matches pi-ai exactly
  scopes: ["openid", "profile", "email", "offline_access"],
  // JWT claim path for extracting account ID
  jwtClaimPath: "https://api.openai.com/auth",
  // API base URL for authenticated requests
  apiBaseUrl: "https://chatgpt.com/backend-api",
};

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

// ==================== Encryption Helpers ====================

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

// Store encrypted tokens as JSON with iv and authTag
function encryptToken(token: string): string {
  const { encrypted, iv, authTag } = encrypt(token);
  return JSON.stringify({ encrypted, iv, authTag });
}

function decryptToken(encryptedJson: string): string {
  const { encrypted, iv, authTag } = JSON.parse(encryptedJson);
  return decrypt(encrypted, iv, authTag);
}

// ==================== PKCE Helpers ====================

/**
 * Encode bytes as base64url string (EXACTLY matches pi-ai implementation)
 * Uses btoa() like pi-ai, not Buffer.toString()
 */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  // Use btoa() like pi-ai does, NOT Buffer.toString('base64')
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generate PKCE code verifier and challenge
 * EXACTLY matches pi-ai's pkce.js implementation using Web Crypto API patterns
 */
export async function generatePKCE(): Promise<{
  verifier: string;
  challenge: string;
}> {
  // Generate 32 random bytes (same as pi-ai)
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64urlEncode(verifierBytes);

  // Compute SHA-256 challenge using Web Crypto API like pi-ai
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const challenge = base64urlEncode(new Uint8Array(hashBuffer));

  return { verifier, challenge };
}

/**
 * Generate random state for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

// ==================== OAuth Flow ====================

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}

export interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  accountId?: string;
}

/**
 * Build the authorization URL for the OAuth flow
 * EXACTLY matches pi-ai's createAuthorizationFlow() function
 */
export function buildAuthorizationUrl(
  challenge: string,
  state: string,
  originator: string = "pi",
): string {
  // Use URL object with searchParams.set() like pi-ai does
  const url = new URL(OAUTH_CONFIG.authorizeEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", OAUTH_CONFIG.clientId);
  url.searchParams.set("redirect_uri", OAUTH_CONFIG.redirectUri);
  url.searchParams.set("scope", OAUTH_CONFIG.scopes.join(" "));
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", originator);

  const urlString = url.toString();

  // Debug logging
  console.log("🔐 OAuth Authorization URL generated:");
  console.log("  - client_id:", OAUTH_CONFIG.clientId);
  console.log("  - redirect_uri:", OAUTH_CONFIG.redirectUri);
  console.log("  - scope:", OAUTH_CONFIG.scopes.join(" "));
  console.log("  - Full URL:", urlString);

  return urlString;
}

/**
 * Extract account ID from JWT access token
 * Uses the JWT claim path from pi-ai: "https://api.openai.com/auth"
 */
function extractAccountId(accessToken: string): string | undefined {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return undefined;

    // Decode payload (second part)
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    );

    // Pi-ai uses this claim path for the account ID
    const auth = payload[OAUTH_CONFIG.jwtClaimPath];
    const chatgptAccountId = auth?.chatgpt_account_id;

    if (typeof chatgptAccountId === "string" && chatgptAccountId.length > 0) {
      return chatgptAccountId;
    }

    // Fallback to other fields
    return (
      payload.account_id ||
      payload.sub ||
      payload.user_id ||
      payload["https://api.openai.com/profile"]?.account_id
    );
  } catch (error) {
    console.error("Failed to extract account ID from token:", error);
    return undefined;
  }
}

/**
 * Exchange authorization code for tokens
 * EXACTLY matches pi-ai's exchangeAuthorizationCode() function
 */
export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
): Promise<OAuthCredentials> {
  const response = await fetch(OAUTH_CONFIG.tokenEndpoint, {
    method: "POST",
    // Note: pi-ai only sets Content-Type, no Accept header
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      // Exact same parameter order as pi-ai
      grant_type: "authorization_code",
      client_id: OAUTH_CONFIG.clientId,
      code: code,
      code_verifier: verifier,
      redirect_uri: OAUTH_CONFIG.redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token exchange failed:", response.status, errorText);

    // Better error handling - parse JSON error if available
    let errorMessage = `Token exchange failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error_description) {
        errorMessage = errorJson.error_description;
      } else if (errorJson.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as OAuthTokenResponse;
  const accountId = extractAccountId(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    accountId,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<OAuthCredentials> {
  const response = await fetch(OAUTH_CONFIG.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: OAUTH_CONFIG.clientId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as OAuthTokenResponse;
  const accountId = extractAccountId(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    accountId,
  };
}

// ==================== Session Management ====================

/**
 * Create OAuth session for PKCE flow (temporary storage)
 */
export async function createOAuthSession(
  userId: string,
): Promise<{ state: string; authUrl: string }> {
  // Clean up any existing sessions for this user
  await prisma.chatGPTOAuthSession.deleteMany({
    where: { userId },
  });

  // Also clean up expired sessions
  await prisma.chatGPTOAuthSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  // Generate PKCE values
  const { verifier, challenge } = await generatePKCE();
  const state = generateState();

  // Store session (expires in 10 minutes)
  await prisma.chatGPTOAuthSession.create({
    data: {
      userId,
      state,
      codeVerifier: verifier,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  // Build authorization URL
  const authUrl = buildAuthorizationUrl(challenge, state);

  return { state, authUrl };
}

/**
 * Validate OAuth callback and retrieve session
 */
export async function validateOAuthCallback(
  state: string,
): Promise<{ userId: string; codeVerifier: string } | null> {
  const session = await prisma.chatGPTOAuthSession.findUnique({
    where: { state },
  });

  if (!session) {
    return null;
  }

  // Check if session expired
  if (session.expiresAt < new Date()) {
    await prisma.chatGPTOAuthSession.delete({ where: { id: session.id } });
    return null;
  }

  // Delete session after use (one-time use)
  await prisma.chatGPTOAuthSession.delete({ where: { id: session.id } });

  return {
    userId: session.userId,
    codeVerifier: session.codeVerifier,
  };
}

/**
 * Get active OAuth session for a user (for manual code submission)
 * Returns the most recent non-expired session
 */
export async function getActiveSessionForUser(
  userId: string,
): Promise<{ state: string; codeVerifier: string } | null> {
  const session = await prisma.chatGPTOAuthSession.findFirst({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    return null;
  }

  return {
    state: session.state,
    codeVerifier: session.codeVerifier,
  };
}

/**
 * Delete an OAuth session by state
 */
export async function deleteSession(state: string): Promise<void> {
  await prisma.chatGPTOAuthSession.deleteMany({
    where: { state },
  });
}

// ==================== Credentials Storage ====================

/**
 * Store OAuth credentials for a user
 */
export async function storeOAuthCredentials(
  userId: string,
  credentials: OAuthCredentials,
): Promise<void> {
  const encryptedAccess = encryptToken(credentials.accessToken);
  const encryptedRefresh = encryptToken(credentials.refreshToken);

  await prisma.chatGPTOAuthCredentials.upsert({
    where: { userId },
    update: {
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      expiresAt: credentials.expiresAt,
      accountId: credentials.accountId,
      isEnabled: true,
      lastRefreshedAt: new Date(),
    },
    create: {
      userId,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      expiresAt: credentials.expiresAt,
      accountId: credentials.accountId,
      isEnabled: true,
    },
  });
}

/**
 * Get OAuth credentials for a user (decrypted)
 */
export async function getOAuthCredentials(
  userId: string,
): Promise<OAuthCredentials | null> {
  const stored = await prisma.chatGPTOAuthCredentials.findUnique({
    where: { userId },
  });

  if (!stored || !stored.isEnabled) {
    return null;
  }

  try {
    const accessToken = decryptToken(stored.accessToken);
    const refreshToken = decryptToken(stored.refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresAt: stored.expiresAt,
      accountId: stored.accountId || undefined,
    };
  } catch (error) {
    console.error("Failed to decrypt OAuth credentials:", error);
    return null;
  }
}

/**
 * Get valid OAuth credentials (refreshing if needed)
 */
export async function getValidOAuthCredentials(
  userId: string,
): Promise<OAuthCredentials | null> {
  const credentials = await getOAuthCredentials(userId);
  if (!credentials) {
    return null;
  }

  // Check if token is expired or about to expire (5 minute buffer)
  const bufferMs = 5 * 60 * 1000;
  if (credentials.expiresAt.getTime() - bufferMs <= Date.now()) {
    try {
      // Refresh the token
      const newCredentials = await refreshAccessToken(credentials.refreshToken);
      await storeOAuthCredentials(userId, newCredentials);

      // Update last used timestamp
      await prisma.chatGPTOAuthCredentials.update({
        where: { userId },
        data: { lastUsedAt: new Date() },
      });

      return newCredentials;
    } catch (error) {
      console.error("Failed to refresh OAuth token:", error);
      // Token refresh failed - credentials may be invalid
      // Disable them so user can re-authenticate
      await prisma.chatGPTOAuthCredentials.update({
        where: { userId },
        data: { isEnabled: false },
      });
      return null;
    }
  }

  // Update last used timestamp
  await prisma.chatGPTOAuthCredentials.update({
    where: { userId },
    data: { lastUsedAt: new Date() },
  });

  return credentials;
}

/**
 * Delete OAuth credentials for a user
 */
export async function deleteOAuthCredentials(userId: string): Promise<void> {
  await prisma.chatGPTOAuthCredentials.deleteMany({
    where: { userId },
  });
}

/**
 * Check if user has OAuth credentials configured
 */
export async function hasOAuthCredentials(userId: string): Promise<boolean> {
  const count = await prisma.chatGPTOAuthCredentials.count({
    where: { userId, isEnabled: true },
  });
  return count > 0;
}

/**
 * Get OAuth status for a user
 */
export async function getOAuthStatus(userId: string): Promise<{
  isConnected: boolean;
  isEnabled: boolean;
  accountId?: string;
  expiresAt?: Date;
  lastUsedAt?: Date;
}> {
  const stored = await prisma.chatGPTOAuthCredentials.findUnique({
    where: { userId },
  });

  if (!stored) {
    return {
      isConnected: false,
      isEnabled: false,
    };
  }

  return {
    isConnected: true,
    isEnabled: stored.isEnabled,
    accountId: stored.accountId || undefined,
    expiresAt: stored.expiresAt,
    lastUsedAt: stored.lastUsedAt || undefined,
  };
}

/**
 * Toggle OAuth enabled status
 */
export async function setOAuthEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await prisma.chatGPTOAuthCredentials.update({
    where: { userId },
    data: { isEnabled: enabled },
  });
}

// ==================== API Request Helper ====================

/**
 * Make an authenticated request to the ChatGPT API
 */
export async function makeAuthenticatedRequest(
  userId: string,
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const credentials = await getValidOAuthCredentials(userId);
  if (!credentials) {
    throw new Error("No valid OAuth credentials available");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${credentials.accessToken}`,
    Accept: "application/json",
    "User-Agent": "SecondBrainAI/1.0",
    ...(options.headers as Record<string, string>),
  };

  // Add account ID header if available
  if (credentials.accountId) {
    headers["ChatGPT-Account-Id"] = credentials.accountId;
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${OAUTH_CONFIG.apiBaseUrl}${endpoint}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Check ChatGPT usage limits for a user
 */
export async function checkChatGPTUsage(userId: string): Promise<{
  usageAvailable: boolean;
  remainingQuota?: number;
  resetAt?: Date;
} | null> {
  try {
    const response = await makeAuthenticatedRequest(userId, "/wham/usage");

    if (!response.ok) {
      console.error("Failed to check ChatGPT usage:", response.status);
      return null;
    }

    const data = (await response.json()) as {
      remaining?: number;
      reset_at?: string;
    };
    return {
      usageAvailable: true,
      remainingQuota: data.remaining,
      resetAt: data.reset_at ? new Date(data.reset_at) : undefined,
    };
  } catch (error) {
    console.error("Error checking ChatGPT usage:", error);
    return null;
  }
}

// ==================== Local Callback Server Integration ====================

/**
 * Start a complete OAuth flow with local callback server
 * This function:
 * 1. Creates an OAuth session
 * 2. Starts a local callback server
 * 3. Returns the auth URL for the user to open
 * 4. Waits for the callback and exchanges the code for tokens
 *
 * @param userId The user ID to associate credentials with
 * @returns Promise with the auth URL and a promise that resolves when auth completes
 */
export async function startOAuthFlowWithLocalServer(userId: string): Promise<{
  authUrl: string;
  state: string;
  waitForCallback: () => Promise<{ success: boolean; error?: string }>;
}> {
  // Import callback server dynamically to avoid circular deps
  const { startOAuthCallbackServer } =
    await import("./oauth-callback-server.js");

  // Generate PKCE values
  const { verifier, challenge } = await generatePKCE();
  const state = generateState();

  // Clean up any existing sessions for this user
  await prisma.chatGPTOAuthSession.deleteMany({
    where: { userId },
  });

  // Store session (expires in 10 minutes)
  await prisma.chatGPTOAuthSession.create({
    data: {
      userId,
      state,
      codeVerifier: verifier,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  // Build authorization URL
  const authUrl = buildAuthorizationUrl(challenge, state);

  // Create a function that starts the callback server and waits for result
  const waitForCallback = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      // Start callback server on port 1455
      const callbackResult = await startOAuthCallbackServer({
        port: 1455,
        timeoutMs: 5 * 60 * 1000, // 5 minutes
      });

      // Verify state matches
      if (callbackResult.state !== state) {
        return {
          success: false,
          error: "State mismatch - possible CSRF attack",
        };
      }

      // Exchange code for tokens
      const credentials = await exchangeCodeForTokens(
        callbackResult.code,
        verifier,
      );

      // Store credentials
      await storeOAuthCredentials(userId, credentials);

      // Clean up session
      await prisma.chatGPTOAuthSession.deleteMany({
        where: { state },
      });

      return { success: true };
    } catch (error) {
      console.error("OAuth flow error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "OAuth flow failed",
      };
    }
  };

  return { authUrl, state, waitForCallback };
}

// ==================== Pi-AI OAuth Integration ====================

/**
 * Start OAuth flow using pi-ai library (recommended method)
 * This uses the proven implementation from @mariozechner/pi-ai
 * which handles all the OAuth complexity correctly.
 *
 * @param userId The user ID to associate credentials with
 * @param callbacks Callbacks for the OAuth flow (auth URL, prompts, progress)
 */
export async function startPiAiOAuthFlow(
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
  try {
    console.log(`🔐 Starting pi-ai OAuth flow for user ${userId}...`);

    // Use pi-ai's loginOpenAICodex which handles all the OAuth complexity
    const credentials = await loginOpenAICodex({
      onAuth: callbacks.onAuth,
      onPrompt: callbacks.onPrompt,
      onProgress: callbacks.onProgress,
    });

    // Convert pi-ai credentials to our format and store
    // accountId is optional and typed as unknown in pi-ai
    const accountId =
      typeof credentials.accountId === "string"
        ? credentials.accountId
        : undefined;

    const ourCredentials: OAuthCredentials = {
      accessToken: credentials.access,
      refreshToken: credentials.refresh,
      expiresAt: new Date(credentials.expires),
      accountId,
    };

    await storeOAuthCredentials(userId, ourCredentials);

    console.log(`✅ Pi-ai OAuth completed for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error("Pi-ai OAuth flow error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "OAuth flow failed",
    };
  }
}

/**
 * Refresh access token using pi-ai library
 */
export async function refreshAccessTokenWithPiAi(
  refreshToken: string,
): Promise<OAuthCredentials> {
  try {
    const piAiCredentials: PiAiOAuthCredentials = {
      access: "", // Will be replaced
      refresh: refreshToken,
      expires: 0,
    };

    const newCredentials = await refreshOAuthToken(
      "openai-codex",
      piAiCredentials,
    );

    // accountId is optional and typed as unknown in pi-ai
    const accountId =
      typeof newCredentials.accountId === "string"
        ? newCredentials.accountId
        : undefined;

    return {
      accessToken: newCredentials.access,
      refreshToken: newCredentials.refresh,
      expiresAt: new Date(newCredentials.expires),
      accountId,
    };
  } catch (error) {
    console.error("Failed to refresh token with pi-ai:", error);
    throw error;
  }
}

/**
 * Get the OAuth configuration (for debugging/display purposes)
 */
export function getOAuthConfig() {
  return {
    authorizeEndpoint: OAUTH_CONFIG.authorizeEndpoint,
    tokenEndpoint: OAUTH_CONFIG.tokenEndpoint,
    redirectUri: OAUTH_CONFIG.redirectUri,
    scopes: OAUTH_CONFIG.scopes,
    clientId: OAUTH_CONFIG.clientId.substring(0, 8) + "...", // Partially mask
  };
}

// Export service instance
export const chatGPTOAuthService = {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  createOAuthSession,
  validateOAuthCallback,
  getActiveSessionForUser,
  deleteSession,
  storeOAuthCredentials,
  getOAuthCredentials,
  getValidOAuthCredentials,
  deleteOAuthCredentials,
  hasOAuthCredentials,
  getOAuthStatus,
  setOAuthEnabled,
  makeAuthenticatedRequest,
  checkChatGPTUsage,
  startOAuthFlowWithLocalServer,
  startPiAiOAuthFlow, // New pi-ai based OAuth flow
  refreshAccessTokenWithPiAi, // New pi-ai based token refresh
  getOAuthConfig,
  config: OAUTH_CONFIG,
};

export default chatGPTOAuthService;
