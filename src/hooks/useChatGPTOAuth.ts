/**
 * Hook for ChatGPT OAuth integration
 * Handles OAuth flow initiation, status checking, and connection management
 */

import { useState, useCallback, useEffect } from "react";
import { ChatGPTOAuthStatus } from "../types/ai-settings";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || error.message || "Request failed");
  }

  return response.json();
}

export interface ChatGPTOAuthHookResult {
  // Status
  status: ChatGPTOAuthStatus | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initiateOAuth: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleEnabled: (enabled: boolean) => Promise<void>;
  checkUsage: () => Promise<{
    usageAvailable: boolean;
    remainingQuota?: number;
    resetAt?: string;
  } | null>;
  testConnection: () => Promise<{
    success: boolean;
    message: string;
    accountId?: string;
  }>;
  refreshStatus: () => Promise<void>;
}

export function useChatGPTOAuth(): ChatGPTOAuthHookResult {
  const [status, setStatus] = useState<ChatGPTOAuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current status
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ChatGPTOAuthStatus>("/auth/chatgpt/status");
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch ChatGPT OAuth status:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch status");
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initiate OAuth flow
  const initiateOAuth = useCallback(async () => {
    setError(null);
    try {
      const result = await apiRequest<{ authUrl: string; state: string }>(
        "/auth/chatgpt/initiate",
        { method: "POST" },
      );
      
      // Redirect to OpenAI authorization page
      window.location.href = result.authUrl;
    } catch (err) {
      console.error("Failed to initiate OAuth:", err);
      setError(err instanceof Error ? err.message : "Failed to initiate OAuth");
      throw err;
    }
  }, []);

  // Disconnect OAuth
  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await apiRequest("/auth/chatgpt/disconnect", { method: "POST" });
      setStatus({
        isConnected: false,
        isEnabled: false,
      });
    } catch (err) {
      console.error("Failed to disconnect OAuth:", err);
      setError(err instanceof Error ? err.message : "Failed to disconnect");
      throw err;
    }
  }, []);

  // Toggle enabled/disabled
  const toggleEnabled = useCallback(async (enabled: boolean) => {
    setError(null);
    try {
      await apiRequest("/auth/chatgpt/toggle", {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
      setStatus((prev) =>
        prev ? { ...prev, isEnabled: enabled } : null,
      );
    } catch (err) {
      console.error("Failed to toggle OAuth enabled:", err);
      setError(err instanceof Error ? err.message : "Failed to toggle");
      throw err;
    }
  }, []);

  // Check usage
  const checkUsage = useCallback(async () => {
    setError(null);
    try {
      const result = await apiRequest<{
        usageAvailable: boolean;
        remainingQuota?: number;
        resetAt?: string;
        error?: string;
      }>("/auth/chatgpt/usage");
      
      if (result.error) {
        setError(result.error);
        return null;
      }
      
      return result;
    } catch (err) {
      console.error("Failed to check usage:", err);
      setError(err instanceof Error ? err.message : "Failed to check usage");
      return null;
    }
  }, []);

  // Test connection
  const testConnection = useCallback(async () => {
    setError(null);
    try {
      const result = await apiRequest<{
        success: boolean;
        message: string;
        accountId?: string;
      }>("/auth/chatgpt/test");
      return result;
    } catch (err) {
      console.error("Failed to test connection:", err);
      const message = err instanceof Error ? err.message : "Connection test failed";
      setError(message);
      return {
        success: false,
        message,
      };
    }
  }, []);

  // Load status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Handle OAuth callback result from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthResult = urlParams.get("chatgpt_oauth");
    const message = urlParams.get("message");

    if (oauthResult) {
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("chatgpt_oauth");
      newUrl.searchParams.delete("message");
      window.history.replaceState({}, "", newUrl.toString());

      if (oauthResult === "success") {
        // Refresh status after successful OAuth
        refreshStatus();
      } else if (oauthResult === "error") {
        setError(message || "OAuth connection failed");
      }
    }
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    error,
    initiateOAuth,
    disconnect,
    toggleEnabled,
    checkUsage,
    testConnection,
    refreshStatus,
  };
}

export default useChatGPTOAuth;
