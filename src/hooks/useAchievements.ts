/**
 * useAchievements Hook - Fetch and manage achievements
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import type {
  Achievement,
  CreateAchievementInput,
  UpdateAchievementInput,
  AchievementStats,
} from "../types/goals-achievements";

interface UseAchievementsOptions {
  filters?: {
    category?: string;
    unlockedOnly?: boolean;
    includeHidden?: boolean;
  };
}

export function useAchievements(options: UseAchievementsOptions = {}) {
  const { token } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const fetchAchievements = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options.filters?.category) params.append("category", options.filters.category);
      if (options.filters?.unlockedOnly) params.append("unlockedOnly", "true");
      if (options.filters?.includeHidden) params.append("includeHidden", "true");

      const response = await fetch(`${API_URL}/api/achievements?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Failed to fetch achievements: ${response.status}`);

      const data = await response.json();
      setAchievements(data.achievements || []);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching achievements:", err);
      setAchievements([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [token, options.filters?.category, options.filters?.unlockedOnly, options.filters?.includeHidden]);

  const fetchStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/achievements/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Failed to fetch stats: ${response.status}`);

      const data = await response.json();
      setStats(data.stats);
    } catch (err: any) {
      console.error("Error fetching achievement stats:", err);
      setStats(null); // Set null on error
    }
  }, [token]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/achievements/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Failed to fetch categories: ${response.status}`);

      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err: any) {
      console.error("Error fetching categories:", err);
      setCategories([]); // Set empty array on error
    }
  }, [token]);

  // Initial load when token becomes available
  useEffect(() => {
    if (token) {
      fetchAchievements();
      fetchStats();
      fetchCategories();
    }
  }, [token]); // Only depend on token for initial load

  // Update achievements when filters change
  useEffect(() => {
    if (token) {
      fetchAchievements();
    }
  }, [JSON.stringify(options.filters)]); // Serialize filters to avoid reference changes

  const createAchievement = async (data: CreateAchievementInput) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/achievements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create achievement");

      await fetchAchievements();
      await fetchStats();
      await fetchCategories();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateAchievement = async (id: string, data: UpdateAchievementInput) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/achievements/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update achievement");

      await fetchAchievements();
      await fetchStats();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const unlockAchievement = async (id: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/achievements/${id}/unlock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to unlock achievement");

      await fetchAchievements();
      await fetchStats();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const deleteAchievement = async (id: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/achievements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete achievement");

      await fetchAchievements();
      await fetchStats();
      await fetchCategories();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    achievements,
    stats,
    categories,
    loading,
    error,
    createAchievement,
    updateAchievement,
    unlockAchievement,
    deleteAchievement,
    refresh: fetchAchievements,
  };
}
