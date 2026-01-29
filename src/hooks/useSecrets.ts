import { useState, useEffect, useCallback } from "react";

export interface Secret {
  id: string;
  key: string;
  displayName: string;
  category: string;
  description: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecretInput {
  key: string;
  value: string;
  displayName: string;
  category?: string;
  description?: string;
  expiresAt?: string;
}

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
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export function useSecrets() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load secrets from API on mount
  useEffect(() => {
    loadSecrets();
  }, []);

  const loadSecrets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; secrets: Secret[] }>(
        "/secrets",
      );
      setSecrets(data.secrets || []);
    } catch (err) {
      console.error("Failed to load secrets:", err);
      const message =
        err instanceof Error ? err.message : "Failed to load secrets";
      setError(message);
      setSecrets([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new secret
  const createSecret = useCallback(async (input: SecretInput) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiRequest<{ success: boolean; secret: Secret }>(
        "/secrets",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );

      setSecrets((prev) => [...prev, response.secret]);
      return response.secret;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create secret";
      setError(message);
      throw new Error(message);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Update a secret
  const updateSecret = useCallback(
    async (key: string, input: Partial<SecretInput>) => {
      setIsSaving(true);
      setError(null);
      try {
        const response = await apiRequest<{ success: boolean; secret: Secret }>(
          `/secrets/${key}`,
          {
            method: "PUT",
            body: JSON.stringify(input),
          },
        );

        setSecrets((prev) =>
          prev.map((s) => (s.key === key ? response.secret : s)),
        );
        return response.secret;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update secret";
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  // Delete a secret
  const deleteSecret = useCallback(async (key: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await apiRequest<{ success: boolean; message: string }>(
        `/secrets/${key}`,
        {
          method: "DELETE",
        },
      );

      setSecrets((prev) => prev.filter((s) => s.key !== key));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete secret";
      setError(message);
      throw new Error(message);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Check if secrets exist
  const checkSecretsExist = useCallback(
    async (
      keys: string[],
    ): Promise<{ exists: string[]; missing: string[] }> => {
      try {
        const response = await apiRequest<{
          success: boolean;
          exists: string[];
          missing: string[];
        }>("/secrets/check", {
          method: "POST",
          body: JSON.stringify({ keys }),
        });

        return {
          exists: response.exists || [],
          missing: response.missing || [],
        };
      } catch (err) {
        console.error("Failed to check secrets:", err);
        throw err;
      }
    },
    [],
  );

  // Filter secrets by category
  const getSecretsByCategory = useCallback(
    (category: string) => {
      return secrets.filter((s) => s.category === category);
    },
    [secrets],
  );

  return {
    secrets,
    isLoading,
    isSaving,
    error,
    loadSecrets,
    createSecret,
    updateSecret,
    deleteSecret,
    checkSecretsExist,
    getSecretsByCategory,
  };
}
