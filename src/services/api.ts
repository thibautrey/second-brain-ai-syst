/**
 * API Service - Base HTTP client for backend communication
 */

const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

function getAuthToken(): string | null {
  return localStorage.getItem("authToken");
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function apiGet<T>(
  endpoint: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
  });

  return handleResponse<T>(response);
}

export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiPatch<T>(
  endpoint: string,
  data?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiPut<T>(
  endpoint: string,
  data?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
  });

  return handleResponse<T>(response);
}
// ==================== Tips API ====================

export interface Tip {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  targetFeature?: string;
  isDismissed: boolean;
  dismissedAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  priority: number;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchActiveTips(options?: {
  limit?: number;
  offset?: number;
  targetFeature?: string;
}): Promise<{ tips: Tip[]; total: number; limit: number; offset: number }> {
  return apiGet<{ tips: Tip[]; total: number; limit: number; offset: number }>(
    "/tips",
    options,
  );
}

export async function viewTip(tipId: string): Promise<{ success: boolean; tip: Tip }> {
  return apiPatch<{ success: boolean; tip: Tip }>(`/tips/${tipId}/view`);
}

export async function dismissTip(tipId: string): Promise<{ success: boolean; tip: Tip }> {
  return apiPatch<{ success: boolean; tip: Tip }>(`/tips/${tipId}/dismiss`);
}

export async function createTip(data: {
  title: string;
  description: string;
  category?: string;
  targetFeature?: string;
  priority?: number;
  icon?: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; tip: Tip }> {
  return apiPost<{ success: boolean; tip: Tip }>("/tips", data);
}

// ==================== Goals API ====================

export type GoalStatus = "ACTIVE" | "COMPLETED" | "PAUSED" | "ARCHIVED" | "ABANDONED";

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: string;
  status: GoalStatus;
  progress: number;
  targetDate?: string;
  completedAt?: string;
  archivedAt?: string;
  detectedFrom?: string;
  confidence: number;
  tags: string[];
  relatedMemoryIds: string[];
  milestones: Array<{ name: string; completed: boolean; date: string }>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface GoalStats {
  total: number;
  active: number;
  completed: number;
  paused: number;
  abandoned: number;
  completionRate: number;
}

export async function fetchGoals(options?: {
  status?: GoalStatus;
  category?: string;
  includeArchived?: boolean;
}): Promise<{ success: boolean; goals: Goal[] }> {
  return apiGet<{ success: boolean; goals: Goal[] }>("/goals", options);
}

export async function fetchGoal(goalId: string): Promise<{ success: boolean; goal: Goal }> {
  return apiGet<{ success: boolean; goal: Goal }>(`/goals/${goalId}`);
}

export async function fetchGoalStats(): Promise<{ success: boolean; stats: GoalStats }> {
  return apiGet<{ success: boolean; stats: GoalStats }>("/goals/stats");
}

export async function fetchGoalCategories(): Promise<{ success: boolean; categories: string[] }> {
  return apiGet<{ success: boolean; categories: string[] }>("/goals/categories");
}

export async function createGoal(data: {
  title: string;
  description?: string;
  category: string;
  targetDate?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; goal: Goal }> {
  return apiPost<{ success: boolean; goal: Goal }>("/goals", data);
}

export async function updateGoal(
  goalId: string,
  data: Partial<{
    title: string;
    description: string;
    category: string;
    status: GoalStatus;
    progress: number;
    targetDate: string;
    tags: string[];
    metadata: Record<string, any>;
  }>
): Promise<{ success: boolean; goal: Goal }> {
  return apiPatch<{ success: boolean; goal: Goal }>(`/goals/${goalId}`, data);
}

export async function updateGoalProgress(
  goalId: string,
  progress: number
): Promise<{ success: boolean; goal: Goal }> {
  return apiPatch<{ success: boolean; goal: Goal }>(`/goals/${goalId}/progress`, { progress });
}

export async function deleteGoal(goalId: string): Promise<{ success: boolean; message: string }> {
  return apiDelete<{ success: boolean; message: string }>(`/goals/${goalId}`);
}

export async function addGoalMilestone(
  goalId: string,
  milestone: { name: string; completed?: boolean; date?: string }
): Promise<{ success: boolean; goal: Goal }> {
  return apiPost<{ success: boolean; goal: Goal }>(`/goals/${goalId}/milestones`, milestone);
}

// ==================== Achievements API ====================

export interface Achievement {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  icon?: string;
  unlockedAt?: string;
  isUnlocked: boolean;
  detectedFrom?: string;
  confidence: number;
  criteria: Record<string, any>;
  significance: "minor" | "normal" | "major" | "milestone";
  relatedGoalIds: string[];
  relatedMemoryIds: string[];
  displayOrder: number;
  isHidden: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AchievementStats {
  total: number;
  unlocked: number;
  locked: number;
  unlockedPercentage: number;
  byCategory: Array<{ category: string; total: number; unlocked: number }>;
}

export async function fetchAchievements(options?: {
  category?: string;
  unlockedOnly?: boolean;
  includeHidden?: boolean;
}): Promise<{ success: boolean; achievements: Achievement[] }> {
  return apiGet<{ success: boolean; achievements: Achievement[] }>("/achievements", options);
}

export async function fetchAchievement(
  achievementId: string
): Promise<{ success: boolean; achievement: Achievement }> {
  return apiGet<{ success: boolean; achievement: Achievement }>(`/achievements/${achievementId}`);
}

export async function fetchAchievementStats(): Promise<{ success: boolean; stats: AchievementStats }> {
  return apiGet<{ success: boolean; stats: AchievementStats }>("/achievements/stats");
}

export async function fetchAchievementCategories(): Promise<{ success: boolean; categories: string[] }> {
  return apiGet<{ success: boolean; categories: string[] }>("/achievements/categories");
}

export async function createAchievement(data: {
  title: string;
  description: string;
  category: string;
  icon?: string;
  significance?: "minor" | "normal" | "major" | "milestone";
  criteria?: Record<string, any>;
  isHidden?: boolean;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; achievement: Achievement }> {
  return apiPost<{ success: boolean; achievement: Achievement }>("/achievements", data);
}

export async function updateAchievement(
  achievementId: string,
  data: Partial<{
    title: string;
    description: string;
    category: string;
    icon: string;
    significance: "minor" | "normal" | "major" | "milestone";
    criteria: Record<string, any>;
    isHidden: boolean;
    metadata: Record<string, any>;
  }>
): Promise<{ success: boolean; achievement: Achievement }> {
  return apiPatch<{ success: boolean; achievement: Achievement }>(`/achievements/${achievementId}`, data);
}

export async function unlockAchievement(
  achievementId: string
): Promise<{ success: boolean; achievement: Achievement }> {
  return apiPost<{ success: boolean; achievement: Achievement }>(`/achievements/${achievementId}/unlock`);
}

export async function deleteAchievement(
  achievementId: string
): Promise<{ success: boolean; message: string }> {
  return apiDelete<{ success: boolean; message: string }>(`/achievements/${achievementId}`);
}