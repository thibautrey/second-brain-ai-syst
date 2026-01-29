import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface HasUsersResponse {
  hasUsers: boolean;
  totalUsers: number;
}

export function useHasUsers() {
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/has-users`);
        if (!response.ok) {
          const payload = await response
            .json()
            .catch(() => ({ error: "Request failed" }));
          throw new Error(payload.error || `HTTP ${response.status}`);
        }
        const data: HasUsersResponse = await response.json();
        if (isActive) {
          setHasUsers(data.hasUsers);
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      isActive = false;
    };
  }, []);

  return { hasUsers, isLoading, error };
}
