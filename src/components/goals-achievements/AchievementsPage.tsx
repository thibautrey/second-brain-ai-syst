/**
 * Achievements Page
 *
 * A user-friendly page for viewing and celebrating achievements
 * Styled to match the analytics page design
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Trophy,
  Lock,
  Star,
  Award,
  Sparkles,
  RefreshCw,
  Filter,
  Unlock,
  Crown,
  Medal,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { useAchievements } from "../../hooks/useAchievements";
import type { Achievement } from "../../types/goals-achievements";

const SIGNIFICANCE_ORDER = ["milestone", "major", "normal", "minor"];

export function AchievementsPage() {
  const { t } = useTranslation();
  const {
    achievements,
    stats,
    categories,
    loading,
    error,
    refresh,
    unlockAchievement,
  } = useAchievements({ filters: { includeHidden: false } });

  const [activeFilter, setActiveFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Sort achievements by unlocked status and significance
  const sortedAchievements = [...achievements].sort((a, b) => {
    // Unlocked first
    if (a.isUnlocked !== b.isUnlocked) {
      return a.isUnlocked ? -1 : 1;
    }
    // Then by significance
    const aIndex = SIGNIFICANCE_ORDER.indexOf(a.significance);
    const bIndex = SIGNIFICANCE_ORDER.indexOf(b.significance);
    return aIndex - bIndex;
  });

  const filteredAchievements = sortedAchievements.filter((achievement) => {
    if (activeFilter === "unlocked" && !achievement.isUnlocked) return false;
    if (activeFilter === "locked" && achievement.isUnlocked) return false;
    if (categoryFilter && achievement.category !== categoryFilter) return false;
    return true;
  });

  const getSignificanceIcon = (significance: string) => {
    switch (significance) {
      case "milestone":
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case "major":
        return <Trophy className="w-6 h-6 text-purple-500" />;
      case "normal":
        return <Medal className="w-6 h-6 text-blue-500" />;
      default:
        return <Star className="w-6 h-6 text-gray-400" />;
    }
  };

  const getSignificanceColor = (significance: string, unlocked: boolean) => {
    if (!unlocked) return "border-dashed border-gray-300 bg-gray-50";
    switch (significance) {
      case "milestone":
        return "border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50";
      case "major":
        return "border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-indigo-50";
      case "normal":
        return "border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50";
      default:
        return "border border-gray-200";
    }
  };

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      consistency: "🔥",
      milestone: "🏆",
      personal_growth: "🌱",
      learning: "📚",
      productivity: "⚡",
      health: "💪",
      social: "🤝",
      creativity: "🎨",
      explorer: "🧭",
      other: "✨",
    };
    return emojis[category] || "✨";
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="p-4 rounded-full bg-red-100 mb-4">
          <Trophy className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Unable to load your achievements
        </h3>
        <p className="text-gray-500 mb-4 max-w-sm">
          We couldn't fetch your achievements right now. Please try again.
        </p>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Achievements</h1>
          <p className="text-gray-500 mt-1">
            Celebrate your milestones and accomplishments
          </p>
        </div>
      </div>

      {/* Overall Progress Card */}
      {stats && (
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <CardContent className="pt-6 pb-6 relative">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                  <Trophy className="w-4 h-4" />
                  <span>Achievement Progress</span>
                </div>
                <p className="text-4xl font-bold mb-1">
                  {stats.unlocked} / {stats.total}
                </p>
                <p className="text-white/80">achievements unlocked</p>
              </div>
              <div className="text-center">
                <div className="text-6xl mb-2">🏆</div>
                <p className="text-2xl font-bold">
                  {stats.unlockedPercentage.toFixed(0)}%
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Progress
                value={stats.unlockedPercentage}
                className="h-3 bg-white/20"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats by Category */}
      {stats && stats.byCategory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.byCategory.slice(0, 4).map((cat) => (
            <Card
              key={cat.category}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() =>
                setCategoryFilter(
                  categoryFilter === cat.category ? null : cat.category
                )
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{getCategoryEmoji(cat.category)}</span>
                  <Badge
                    variant={
                      categoryFilter === cat.category ? "default" : "outline"
                    }
                  >
                    {cat.unlocked}/{cat.total}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-gray-700 capitalize">
                  {cat.category.replace("_", " ")}
                </p>
                <Progress
                  value={(cat.unlocked / cat.total) * 100}
                  className="h-1.5 mt-2"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && achievements.length === 0 && (
        <Card className="bg-gradient-to-br from-slate-50 to-amber-50 border-slate-200">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
              <Trophy className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Start Your Journey!
            </h3>
            <p className="text-gray-600 max-w-md mx-auto mb-4">
              As you use your Second Brain, you'll unlock achievements for
              consistency, milestones, and personal growth. Keep going!
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-amber-500" /> Consistency rewards
              </span>
              <span className="flex items-center gap-1">
                <Crown className="w-4 h-4 text-purple-500" /> Milestone badges
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-blue-500" /> Growth recognition
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {achievements.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 p-1 rounded-lg">
            {[
              { value: "all", label: "All" },
              { value: "unlocked", label: "Unlocked" },
              { value: "locked", label: "Locked" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() =>
                  setActiveFilter(filter.value as "all" | "unlocked" | "locked")
                }
                className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  activeFilter === filter.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {categoryFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryFilter(null)}
            >
              <Filter className="w-4 h-4 mr-1" />
              Clear filter: {categoryFilter}
            </Button>
          )}
        </div>
      )}

      {/* Achievements Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-12 w-12 bg-gray-200 rounded-full mb-4" />
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAchievements.map((achievement) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              getSignificanceIcon={getSignificanceIcon}
              getSignificanceColor={getSignificanceColor}
              getCategoryEmoji={getCategoryEmoji}
            />
          ))}
        </div>
      )}

      {/* Motivation */}
      {stats && stats.locked > 0 && (
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 border-0 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 pb-6 relative">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Keep Going!</span>
            </div>
            <p className="text-lg text-white/90">
              You still have <span className="font-bold">{stats.locked}</span>{" "}
              achievement{stats.locked > 1 ? "s" : ""} to unlock. Every
              interaction with your Second Brain brings you closer! 🌟
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ Sub-components ============

interface AchievementCardProps {
  achievement: Achievement;
  getSignificanceIcon: (significance: string) => React.ReactNode;
  getSignificanceColor: (significance: string, unlocked: boolean) => string;
  getCategoryEmoji: (category: string) => string;
}

function AchievementCard({
  achievement,
  getSignificanceIcon,
  getSignificanceColor,
  getCategoryEmoji,
}: AchievementCardProps) {
  return (
    <Card
      className={`transition-all hover:shadow-lg ${getSignificanceColor(
        achievement.significance,
        achievement.isUnlocked
      )} ${!achievement.isUnlocked ? "opacity-70" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {achievement.isUnlocked ? (
              <div className="text-4xl">{achievement.icon || "🏆"}</div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <Lock className="w-6 h-6 text-gray-400" />
              </div>
            )}
            {achievement.isUnlocked && getSignificanceIcon(achievement.significance)}
          </div>
          {achievement.isUnlocked && (
            <Badge
              className={
                achievement.significance === "milestone"
                  ? "bg-yellow-100 text-yellow-800"
                  : achievement.significance === "major"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-blue-100 text-blue-800"
              }
            >
              {achievement.significance}
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-3">
          {achievement.isUnlocked ? (
            achievement.title
          ) : (
            <span className="text-gray-400">???</span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-gray-600 mb-3">
          {achievement.isUnlocked
            ? achievement.description
            : achievement.criteria?.hint || "Keep using your Second Brain to discover this achievement!"}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {getCategoryEmoji(achievement.category)}{" "}
            {achievement.category.replace("_", " ")}
          </Badge>
          {achievement.isUnlocked && achievement.unlockedAt && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Unlock className="w-3 h-3" />
              {new Date(achievement.unlockedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default AchievementsPage;
