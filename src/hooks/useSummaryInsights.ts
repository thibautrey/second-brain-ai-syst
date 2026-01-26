/**
 * useSummaryInsights Hook
 *
 * Fetches AI-generated insights and summaries
 */

import { useState, useEffect } from "react";
import { apiGet } from "../services/api";

export interface LatestSummary {
  id: string;
  title: string;
  summary: string;
  keyInsights: string[];
  topics: string[];
  sentiment: string;
  periodStart: string;
  periodEnd: string;
}

export interface UseSummaryInsightsReturn {
  insights: string[];
  latestSummary: LatestSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSummaryInsights(): UseSummaryInsightsReturn {
  const [insights, setInsights] = useState<string[]>([]);
  const [latestSummary, setLatestSummary] = useState<LatestSummary | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<{
        insights: string[];
        latestSummary: LatestSummary | null;
      }>("/analytics/insights");

      setInsights(response.insights || []);
      setLatestSummary(response.latestSummary || null);
    } catch (err) {
      console.error("Failed to fetch insights:", err);
      setError(err instanceof Error ? err.message : "Failed to load insights");
      setInsights([]);
      setLatestSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  return {
    insights,
    latestSummary,
    isLoading,
    error,
    refresh: fetchInsights,
  };
}

export default useSummaryInsights;
