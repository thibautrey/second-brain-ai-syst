/**
 * Goals and Achievements Types
 */

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
  milestones: Milestone[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  name: string;
  completed: boolean;
  date: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  category: string;
  targetDate?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  category?: string;
  status?: GoalStatus;
  progress?: number;
  targetDate?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface GoalStats {
  total: number;
  active: number;
  completed: number;
  paused: number;
  abandoned: number;
  completionRate: number;
}

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
  significance: string;
  relatedGoalIds: string[];
  relatedMemoryIds: string[];
  displayOrder: number;
  isHidden: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAchievementInput {
  title: string;
  description: string;
  category: string;
  icon?: string;
  significance?: string;
  criteria?: Record<string, any>;
  isHidden?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateAchievementInput {
  title?: string;
  description?: string;
  category?: string;
  icon?: string;
  criteria?: Record<string, any>;
  significance?: string;
  isHidden?: boolean;
  metadata?: Record<string, any>;
}

export interface AchievementStats {
  total: number;
  unlocked: number;
  locked: number;
  unlockedPercentage: number;
  byCategory: Array<{
    category: string;
    total: number;
    unlocked: number;
  }>;
}
