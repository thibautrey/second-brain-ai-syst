/**
 * Analytics Page
 *
 * A user-friendly, consumer-focused analytics dashboard
 * Shows insights about your Second Brain in a beautiful, non-technical way
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useSummaryInsights } from "../../hooks/useSummaryInsights";
import {
  Brain,
  TrendingUp,
  Calendar,
  Sparkles,
  Heart,
  Target,
  Clock,
  Lightbulb,
  MessageSquare,
  BarChart3,
  Activity,
  Zap,
  Sun,
  Moon,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Progress } from "../ui/progress";
import { MarkdownContent } from "../MarkdownContent";

// Time period options for analytics
type TimePeriod = "today" | "week" | "month" | "year";

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<TimePeriod>("week");

  const {
    stats,
    trends,
    activityByHour,
    topTopics,
    sentimentOverview,
    isLoading,
    error,
    refresh,
  } = useAnalytics(period);

  const {
    insights,
    latestSummary,
    isLoading: insightsLoading,
  } = useSummaryInsights();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="p-4 rounded-full bg-red-100 mb-4">
          <Brain className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t("analytics.errorTitle")}
        </h3>
        <p className="text-gray-500 mb-4 max-w-sm">
          {t("analytics.errorDescription")}
        </p>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          {t("analytics.tryAgain")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("analytics.title")}</h1>
          <p className="text-gray-500 mt-1">{t("analytics.subtitle")}</p>
        </div>

        {/* Time Period Selector */}
        <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 p-1 rounded-lg overflow-x-auto">
          {[
            { value: "today", label: t("analytics.today"), shortLabel: "1D" },
            { value: "week", label: t("analytics.thisWeek"), shortLabel: "7D" },
            { value: "month", label: t("analytics.thisMonth"), shortLabel: "30D" },
            { value: "year", label: t("analytics.thisYear"), shortLabel: "1Y" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setPeriod(option.value as TimePeriod)}
              className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                period === option.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <span className="hidden sm:inline">{option.label}</span>
              <span className="sm:hidden">{option.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI-Generated Summary Card */}
      {latestSummary && (
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 border-0 text-white overflow-hidden relative motion-safe:animate-fade-in-up motion-reduce:animate-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <CardHeader className="relative">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
              <Sparkles className="w-4 h-4" />
              <span>{t("analytics.aiSummaryLabel")}</span>
            </div>
            <CardTitle className="text-2xl text-white">
              {latestSummary.title || t("analytics.yourRecentActivity")}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
                  <div className="text-white/90 leading-relaxed mb-4">
                    {insightsLoading ? (
                      <span className="animate-pulse">
                        {t("analytics.analyzing")}
                      </span>
                    ) : (
                      <MarkdownContent
                        content={latestSummary.summary}
                        className="[&_p]:text-white/90 [&_strong]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_ul]:text-white/90 [&_ol]:text-white/90 [&_li]:text-white/90 [&_code]:bg-white/20 [&_code]:text-white [&_blockquote]:border-white/30 [&_blockquote]:text-white/80"
                      />
                    )}
                  </div>
            {latestSummary.keyInsights &&
              latestSummary.keyInsights.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {latestSummary.keyInsights.slice(0, 3).map((insight, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white/20 rounded-full text-sm"
                    >
                      {insight}
                    </span>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickStatCard
            icon={<Brain className="w-5 h-5" />}
            label={t("analytics.memories")}
            value={stats?.totalMemories ?? 0}
            trend={trends?.memoriesChange}
            color="blue"
            isLoading={isLoading}
          />
          <QuickStatCard
            icon={<MessageSquare className="w-5 h-5" />}
            label={t("analytics.interactions")}
            value={stats?.totalInteractions ?? 0}
            trend={trends?.interactionsChange}
            color="purple"
            isLoading={isLoading}
          />
          <QuickStatCard
            icon={<Target className="w-5 h-5" />}
            label={t("analytics.goalsTracked")}
            value={stats?.activeGoals ?? 0}
            trend={trends?.goalsChange}
            color="green"
            isLoading={isLoading}
          />
          <QuickStatCard
            icon={<Zap className="w-5 h-5" />}
            label={t("analytics.achievements")}
            value={stats?.achievements ?? 0}
            trend={trends?.achievementsChange}
            color="yellow"
            isLoading={isLoading}
        />
      </div>

      {/* Empty State for New Users */}
      {!isLoading && !latestSummary && stats?.totalMemories === 0 && (
        <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <Brain className="w-8 h-8 text-blue-600" />
            </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t("analytics.emptyState.title")}
              </h3>
              <p className="text-gray-600 max-w-md mx-auto mb-4">
                {t("analytics.emptyState.description")}
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-amber-500" />{" "}
                  {t("analytics.emptyState.aiSummaries")}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-4 h-4 text-rose-500" />{" "}
                  {t("analytics.emptyState.moodTracking")}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />{" "}
                  {t("analytics.emptyState.activityTrends")}
                </span>
              </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Activity & Topics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                {t("analytics.activityPattern")}
              </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ActivityChart data={activityByHour} isLoading={isLoading} />
              <p className="text-sm text-gray-500 mt-4 text-center">
                {getMostActiveTime(activityByHour)}
              </p>
            </CardContent>
          </Card>

          {/* What's on Your Mind */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                {t("analytics.whatsOnYourMind")}
              </CardTitle>
            </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="animate-pulse flex items-center gap-3"
                      >
                        <div className="w-full h-8 bg-gray-100 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : topTopics && topTopics.length > 0 ? (
                  <div className="space-y-3">
                    {topTopics.map((topic, idx) => (
                      <TopicBar
                        key={topic.name}
                        name={topic.name}
                        count={topic.count}
                        percentage={topic.percentage}
                        rank={idx + 1}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>{t("analytics.startCapturing")}</p>
                  </div>
                )}
              </CardContent>
          </Card>

          {/* Weekly Summary */}
          {period === "week" && (
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                {t("analytics.weekAtGlance")}
              </CardTitle>
            </CardHeader>
              <CardContent>
                <WeeklyOverview data={stats?.weeklyData} isLoading={isLoading} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Mood & Insights */}
        <div className="space-y-6">
          {/* Streak & Consistency */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
                  <Zap className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {isLoading ? "..." : (stats?.currentStreak ?? 0)} Day Streak
                </h3>
                <p className="text-gray-600 mt-1">
                  Keep capturing your thoughts!
                </p>
                {stats?.longestStreak && stats.longestStreak > 0 && (
                  <p className="text-sm text-amber-600 mt-2">
                    🏆 Best: {stats.longestStreak} days
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Key Insights */}
          {insights && insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {insights.map((insight, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="p-1.5 rounded-full bg-indigo-100 text-indigo-600 mt-0.5">
                        <ChevronRight className="w-3 h-3" />
                      </div>
                      <span className="text-sm text-gray-700">{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Mood Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" />
                Mood Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SentimentChart
                data={sentimentOverview ?? undefined}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============ Sub-components ============

interface QuickStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: number;
  color: "blue" | "purple" | "green" | "yellow";
  isLoading: boolean;
}

function QuickStatCard({
  icon,
  label,
  value,
  trend,
  color,
  isLoading,
}: QuickStatCardProps) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    green: "bg-green-100 text-green-600",
    yellow: "bg-amber-100 text-amber-600",
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
          {trend !== undefined && trend !== 0 && (
            <div
              className={`flex items-center text-sm ${
                trend > 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              <TrendingUp
                className={`w-4 h-4 ${trend < 0 ? "rotate-180" : ""}`}
              />
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? (
              <span className="animate-pulse">—</span>
            ) : (
              value.toLocaleString()
            )}
          </p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface TopicBarProps {
  name: string;
  count: number;
  percentage: number;
  rank: number;
}

function TopicBar({ name, count, percentage, rank }: TopicBarProps) {
  const colors = [
    "bg-indigo-500",
    "bg-purple-500",
    "bg-blue-500",
    "bg-cyan-500",
    "bg-teal-500",
  ];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700 capitalize">{name}</span>
        <span className="text-gray-500">{count} mentions</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[rank - 1] || colors[4]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ActivityChartProps {
  data?: Array<{ hour: number; count: number }>;
  isLoading: boolean;
}

function ActivityChart({ data, isLoading }: ActivityChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-end justify-between gap-1 h-32">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-100 rounded-t animate-pulse"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <p>No activity data yet</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-1 h-32">
        {data.map((item) => {
          const height = (item.count / maxCount) * 100;
          const isNight = item.hour < 6 || item.hour >= 22;

          return (
            <div key={item.hour} className="flex-1 group relative">
              <div
                className={`w-full rounded-t transition-all duration-300 ${
                  isNight ? "bg-indigo-900/30" : "bg-blue-500"
                } ${item.count === 0 ? "bg-gray-100" : ""}`}
                style={{ height: `${Math.max(height, 4)}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {item.hour}:00 - {item.count}{" "}
                {item.count === 1 ? "memory" : "memories"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Moon className="w-3 h-3" /> 12am
        </span>
        <span className="flex items-center gap-1">
          <Sun className="w-3 h-3" /> 12pm
        </span>
        <span className="flex items-center gap-1">
          <Moon className="w-3 h-3" /> 12am
        </span>
      </div>
    </div>
  );
}

interface SentimentChartProps {
  data?: { positive: number; neutral: number; negative: number };
  isLoading: boolean;
}

function SentimentChart({ data, isLoading }: SentimentChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Heart className="w-12 h-12 mx-auto mb-2 text-gray-200" />
        <p>No mood data yet</p>
      </div>
    );
  }

  const total = data.positive + data.neutral + data.negative;
  if (total === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Heart className="w-12 h-12 mx-auto mb-2 text-gray-200" />
        <p>Start capturing memories to see your mood patterns</p>
      </div>
    );
  }

  const sentiments = [
    {
      label: "Positive",
      value: data.positive,
      color: "bg-green-500",
      emoji: "😊",
    },
    {
      label: "Neutral",
      value: data.neutral,
      color: "bg-blue-400",
      emoji: "😐",
    },
    {
      label: "Negative",
      value: data.negative,
      color: "bg-rose-400",
      emoji: "😔",
    },
  ];

  return (
    <div className="space-y-4">
      {sentiments.map((sentiment) => {
        const percentage = Math.round((sentiment.value / total) * 100);
        return (
          <div key={sentiment.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span>{sentiment.emoji}</span>
                <span className="text-gray-700">{sentiment.label}</span>
              </span>
              <span className="text-gray-500">{percentage}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${sentiment.color} rounded-full transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface WeeklyOverviewProps {
  data?: Array<{ day: string; count: number; date: string }>;
  isLoading: boolean;
}

function WeeklyOverview({ data, isLoading }: WeeklyOverviewProps) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (isLoading) {
    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map((day) => (
          <div key={day} className="text-center animate-pulse">
            <div className="w-12 h-12 mx-auto rounded-lg bg-gray-100 mb-2" />
            <div className="h-4 w-8 mx-auto bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map((day) => (
          <div key={day} className="text-center">
            <div className="w-12 h-12 mx-auto rounded-lg bg-gray-50 flex items-center justify-center mb-2">
              <span className="text-gray-300 text-lg">-</span>
            </div>
            <span className="text-xs text-gray-400">{day}</span>
          </div>
        ))}
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="grid grid-cols-7 gap-4">
      {data.map((item, idx) => {
        const intensity = item.count / maxCount;
        const bgColor =
          intensity === 0
            ? "bg-gray-50"
            : intensity < 0.3
              ? "bg-blue-100"
              : intensity < 0.6
                ? "bg-blue-300"
                : "bg-blue-500";

        return (
          <div key={idx} className="text-center group">
            <div
              className={`w-12 h-12 mx-auto rounded-lg ${bgColor} flex items-center justify-center mb-2 transition-transform group-hover:scale-110`}
            >
              <span
                className={`text-lg font-medium ${
                  intensity > 0.5 ? "text-white" : "text-gray-600"
                }`}
              >
                {item.count}
              </span>
            </div>
            <span className="text-xs text-gray-500">{item.day}</span>
          </div>
        );
      })}
    </div>
  );
}

// Helper function
function getMostActiveTime(
  data?: Array<{ hour: number; count: number }>,
): string {
  if (!data || data.length === 0) {
    return "Capture some memories to discover your most active time!";
  }

  const maxHour = data.reduce(
    (max, curr) => (curr.count > max.count ? curr : max),
    data[0],
  );

  if (maxHour.count === 0) {
    return "Capture some memories to discover your most active time!";
  }

  const hour = maxHour.hour;
  const period =
    hour < 12
      ? "morning"
      : hour < 17
        ? "afternoon"
        : hour < 21
          ? "evening"
          : "night";
  const timeStr =
    hour === 0
      ? "12am"
      : hour < 12
        ? `${hour}am`
        : hour === 12
          ? "12pm"
          : `${hour - 12}pm`;

  return `You're most active around ${timeStr} in the ${period}. That's a great time for reflection! ✨`;
}

export default AnalyticsPage;
