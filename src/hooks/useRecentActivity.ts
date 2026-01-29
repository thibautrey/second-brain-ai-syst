import { useState, useEffect } from "react";

export interface RecentActivityItem {
  id: string;
  title: string;
  description: string;
  type: "memory" | "interaction" | "todo" | "summary";
  timestamp: Date;
  icon: string;
  metadata?: Record<string, any>;
}

export interface RecentActivityResponse {
  items: RecentActivityItem[];
  isLoading: boolean;
  error: string | null;
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

export function useRecentActivity(limit: number = 10): RecentActivityResponse {
  const [items, setItems] = useState<RecentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecentActivity = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiRequest<{ items: RecentActivityItem[] }>(
          `/activities/recent?limit=${limit}`,
        );
        setItems(data.items);
      } catch (err) {
        console.error("Failed to load recent activity:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load activities",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentActivity();
  }, [limit]);

  return {
    items,
    isLoading,
    error,
  };
}
