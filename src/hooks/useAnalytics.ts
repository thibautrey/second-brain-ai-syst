/**
 * useAnalytics Hook
 *
 * Fetches analytics data for the user's Second Brain
 */

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "../services/api";

export type TimePeriod = "today" | "week" | "month" | "year";

export interface AnalyticsStats {
  totalMemories: number;
  totalInteractions: number;
  activeGoals: number;
  achievements: number;
  currentStreak: number;
  longestStreak: number;
  weeklyData?: Array<{ day: string; count: number; date: string }>;
}

export interface AnalyticsTrends {
  memoriesChange: number;
  interactionsChange: number;
  goalsChange: number;
  achievementsChange: number;
}

export interface TopicData {
  name: string;
  count: number;
  percentage: number;
}

export interface ActivityByHour {
  hour: number;
  count: number;
}

export interface SentimentOverview {
  positive: number;
  neutral: number;
  negative: number;
}

export interface UseAnalyticsReturn {
  stats: AnalyticsStats | null;
  trends: AnalyticsTrends | null;
  activityByHour: ActivityByHour[];
  topTopics: TopicData[];
  sentimentOverview: SentimentOverview | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAnalytics(period: TimePeriod = "week"): UseAnalyticsReturn {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null);
  const [activityByHour, setActivityByHour] = useState<ActivityByHour[]>([]);
  const [topTopics, setTopTopics] = useState<TopicData[]>([]);
  const [sentimentOverview, setSentimentOverview] =
    useState<SentimentOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<{
        stats: AnalyticsStats;
        trends: AnalyticsTrends;
        activityByHour: ActivityByHour[];
        topTopics: TopicData[];
        sentimentOverview: SentimentOverview;
      }>("/analytics", { period });

      setStats(response.stats);
      setTrends(response.trends);
      setActivityByHour(response.activityByHour || []);
      setTopTopics(response.topTopics || []);
      setSentimentOverview(response.sentimentOverview || null);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");

      // Set default empty data on error
      setStats(null);
      setTrends(null);
      setActivityByHour([]);
      setTopTopics([]);
      setSentimentOverview(null);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    stats,
    trends,
    activityByHour,
    topTopics,
    sentimentOverview,
    isLoading,
    error,
    refresh: fetchAnalytics,
  };
}

export default useAnalytics;
