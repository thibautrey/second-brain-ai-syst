import { useState, useEffect } from "react";

const API_BASE = "http://localhost:3000/api";

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

export interface DashboardStats {
  totalMemories: number;
  totalInteractions: number;
  dailySummaries: number;
  isLoading: boolean;
  error: string | null;
}

export function useDashboardStats(): DashboardStats {
  const [totalMemories, setTotalMemories] = useState(0);
  const [totalInteractions, setTotalInteractions] = useState(0);
  const [dailySummaries, setDailySummaries] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Load all dashboard stats from single endpoint
        const response = await apiRequest<{
          totalMemories: number;
          totalInteractions: number;
          dailySummaries: number;
        }>("/dashboard/stats");

        setTotalMemories(response.totalMemories);
        setTotalInteractions(response.totalInteractions);
        setDailySummaries(response.dailySummaries);
      } catch (err) {
        console.error("Failed to load dashboard stats:", err);
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  return {
    totalMemories,
    totalInteractions,
    dailySummaries,
    isLoading,
    error,
  };
}
