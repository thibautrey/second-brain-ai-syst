/**
 * useGoals Hook - Fetch and manage goals
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import type {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
  GoalStats,
  GoalStatus,
} from "../types/goals-achievements";

interface UseGoalsOptions {
  filters?: {
    status?: GoalStatus;
    category?: string;
    includeArchived?: boolean;
  };
}

export function useGoals(options: UseGoalsOptions = {}) {
  const { token } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState<GoalStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const fetchGoals = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options.filters?.status) params.append("status", options.filters.status);
      if (options.filters?.category) params.append("category", options.filters.category);
      if (options.filters?.includeArchived) params.append("includeArchived", "true");

      const response = await fetch(`${API_URL}/api/goals?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Failed to fetch goals: ${response.status}`);

      const data = await response.json();
      setGoals(data.goals || []);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching goals:", err);
      setGoals([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [token, options.filters?.status, options.filters?.category, options.filters?.includeArchived]);

  const fetchStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/goals/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Failed to fetch stats: ${response.status}`);

      const data = await response.json();
      setStats(data.stats);
    } catch (err: any) {
      console.error("Error fetching goal stats:", err);
      setStats(null); // Set null on error
    }
  }, [token]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/goals/categories`, {
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
      fetchGoals();
      fetchStats();
      fetchCategories();
    }
  }, [token]); // Only depend on token for initial load

  // Update goals when filters change
  useEffect(() => {
    if (token) {
      fetchGoals();
    }
  }, [JSON.stringify(options.filters)]); // Serialize filters to avoid reference changes

  const createGoal = async (data: CreateGoalInput) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/goals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create goal");

      await fetchGoals();
      await fetchStats();
      await fetchCategories();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateGoal = async (id: string, data: UpdateGoalInput) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/goals/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update goal");

      await fetchGoals();
      await fetchStats();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateProgress = async (id: string, progress: number) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/goals/${id}/progress`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ progress }),
      });

      if (!response.ok) throw new Error("Failed to update progress");

      await fetchGoals();
      await fetchStats();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const deleteGoal = async (id: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/goals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete goal");

      await fetchGoals();
      await fetchStats();
      await fetchCategories();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const addMilestone = async (id: string, milestone: { name: string; completed?: boolean; date?: string }) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/goals/${id}/milestones`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(milestone),
      });

      if (!response.ok) throw new Error("Failed to add milestone");

      await fetchGoals();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    goals,
    stats,
    categories,
    loading,
    error,
    createGoal,
    updateGoal,
    updateProgress,
    deleteGoal,
    addMilestone,
    refresh: fetchGoals,
  };
}
