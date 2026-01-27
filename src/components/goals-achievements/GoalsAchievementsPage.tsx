/**
 * Goals & Achievements Page
 *
 * A unified page for managing goals and viewing achievements
 * Features tabbed navigation between Goals and Achievements
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Target,
  Trophy,
  Plus,
  TrendingUp,
  CheckCircle2,
  Pause,
  Archive,
  Calendar,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Trash2,
  Play,
  X,
  Lightbulb,
  Lock,
  Star,
  Award,
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
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Select } from "../ui/select";
import { useGoals } from "../../hooks/useGoals";
import { useAchievements } from "../../hooks/useAchievements";
import type { Goal, GoalStatus, Milestone, Achievement } from "../../types/goals-achievements";

const GOAL_CATEGORIES = [
  "health",
  "productivity",
  "learning",
  "relationships",
  "career",
  "finance",
  "creativity",
  "personal_growth",
  "other",
];

const STATUS_FILTERS = [
  { value: "all", label: "All Goals" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PAUSED", label: "Paused" },
];

const SIGNIFICANCE_ORDER = ["milestone", "major", "normal", "minor"];

export function GoalsAchievementsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"goals" | "achievements">("goals");

  const goalsHook = useGoals({ filters: { includeArchived: false } });
  const achievementsHook = useAchievements({ filters: { includeHidden: false } });

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Goals & Achievements</h1>
          <p className="text-gray-500 mt-1">
            Track your progress and celebrate your accomplishments
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("goals")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "goals"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <Target className="w-4 h-4" />
          Goals
        </button>
        <button
          onClick={() => setActiveTab("achievements")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "achievements"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <Trophy className="w-4 h-4" />
          Achievements
        </button>
      </div>

      {/* Goals Tab */}
      {activeTab === "goals" && (
        <GoalsTabContent {...goalsHook} />
      )}

      {/* Achievements Tab */}
      {activeTab === "achievements" && (
        <AchievementsTabContent {...achievementsHook} />
      )}
    </div>
  );
}

// ============ Goals Tab Content ============

function GoalsTabContent({
  goals,
  stats,
  categories,
  loading,
  error,
  createGoal,
  updateGoal,
  updateProgress,
  deleteGoal,
  refresh,
}: ReturnType<typeof useGoals>) {
  const [activeFilter, setActiveFilter] = useState<GoalStatus | "all">("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    category: "personal_growth",
    targetDate: "",
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");
  const [creating, setCreating] = useState(false);

  const filteredGoals =
    activeFilter === "all"
      ? goals
      : goals.filter((g) => g.status === activeFilter);

  const handleCreateGoal = async () => {
    if (!newGoal.title.trim()) return;

    setCreating(true);
    try {
      await createGoal({
        title: newGoal.title,
        description: newGoal.description || undefined,
        category: newGoal.category,
        targetDate: newGoal.targetDate || undefined,
        tags: newGoal.tags,
      });
      setShowCreateDialog(false);
      setNewGoal({
        title: "",
        description: "",
        category: "personal_growth",
        targetDate: "",
        tags: [],
      });
    } catch (err) {
      console.error("Failed to create goal:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !newGoal.tags.includes(tagInput.trim())) {
      setNewGoal({ ...newGoal, tags: [...newGoal.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewGoal({ ...newGoal, tags: newGoal.tags.filter((t) => t !== tag) });
  };

  const getStatusIcon = (status: GoalStatus) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "PAUSED":
        return <Pause className="w-5 h-5 text-yellow-500" />;
      case "ARCHIVED":
        return <Archive className="w-5 h-5 text-gray-400" />;
      case "ABANDONED":
        return <X className="w-5 h-5 text-red-400" />;
      default:
        return <Target className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: GoalStatus) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "ACTIVE":
        return "bg-blue-100 text-blue-800";
      case "PAUSED":
        return "bg-yellow-100 text-yellow-800";
      case "ABANDONED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      health: "💪",
      productivity: "⚡",
      learning: "📚",
      relationships: "❤️",
      career: "💼",
      finance: "💰",
      creativity: "🎨",
      personal_growth: "🌱",
      other: "🎯",
    };
    return emojis[category] || "🎯";
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="p-4 rounded-full bg-red-100 mb-4">
          <Target className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Unable to load your goals
        </h3>
        <p className="text-gray-500 mb-4 max-w-sm">
          We couldn't fetch your goals right now. Please try again.
        </p>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Action Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Goal
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Target className="w-5 h-5" />}
            label="Total Goals"
            value={stats.total}
            color="blue"
            isLoading={loading}
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Active"
            value={stats.active}
            color="purple"
            isLoading={loading}
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Completed"
            value={stats.completed}
            color="green"
            isLoading={loading}
          />
          <StatCard
            icon={<Sparkles className="w-5 h-5" />}
            label="Success Rate"
            value={`${stats.completionRate.toFixed(0)}%`}
            color="yellow"
            isLoading={loading}
          />
        </div>
      )}

      {/* Empty State */}
      {!loading && goals.length === 0 && (
        <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <Target className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Set Your First Goal!
            </h3>
            <p className="text-gray-600 max-w-md mx-auto mb-4">
              Goals help you stay focused and track your progress. Create your
              first goal to get started on your journey.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Goal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {goals.length > 0 && (
        <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 p-1 rounded-lg overflow-x-auto w-fit">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value as GoalStatus | "all")}
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
      )}

      {/* Goals List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-4" />
                <div className="h-2 bg-gray-100 rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onUpdate={updateGoal}
              onDelete={deleteGoal}
              getStatusIcon={getStatusIcon}
              getStatusColor={getStatusColor}
              getCategoryEmoji={getCategoryEmoji}
            />
          ))}
        </div>
      )}

      {/* Motivation Card */}
      {stats && stats.active > 0 && (
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 border-0 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 pb-6 relative">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
              <Lightbulb className="w-4 h-4" />
              <span>Daily Motivation</span>
            </div>
            <p className="text-lg text-white/90">
              You have <span className="font-bold">{stats.active}</span> active
              goal{stats.active > 1 ? "s" : ""} in progress. Keep pushing
              forward – every small step counts! 🚀
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Goal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Goal</DialogTitle>
            <DialogDescription>
              Set a new goal to track your progress and stay motivated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Goal Title *</label>
              <Input
                placeholder="e.g., Learn a new language"
                value={newGoal.title}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, title: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Add details about your goal..."
                value={newGoal.description}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={newGoal.category}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, category: e.target.value })
                  }
                  options={GOAL_CATEGORIES.map((cat) => ({
                    value: cat,
                    label: `${getCategoryEmoji(cat)} ${cat.replace("_", " ")}`,
                  }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target Date</label>
                <Input
                  type="date"
                  value={newGoal.targetDate}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, targetDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
              {newGoal.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newGoal.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag} <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGoal} disabled={creating || !newGoal.title.trim()}>
              {creating ? "Creating..." : "Create Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Achievements Tab Content ============

function AchievementsTabContent({
  achievements,
  stats,
  categories,
  loading,
  error,
  refresh,
  unlockAchievement,
}: ReturnType<typeof useAchievements>) {
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
    <div className="space-y-8">
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

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: "blue" | "purple" | "green" | "yellow";
  isLoading: boolean;
}

function StatCard({ icon, label, value, color, isLoading }: StatCardProps) {
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
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? <span className="animate-pulse">—</span> : value}
          </p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface GoalCardProps {
  goal: Goal;
  onUpdate: (goalId: string, data: Partial<Goal>) => Promise<any>;
  onDelete: (goalId: string) => Promise<void>;
  getStatusIcon: (status: GoalStatus) => React.ReactNode;
  getStatusColor: (status: GoalStatus) => string;
  getCategoryEmoji: (category: string) => string;
}

function GoalCard({
  goal,
  onUpdate,
  onDelete,
  getStatusIcon,
  getStatusColor,
  getCategoryEmoji,
}: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{getCategoryEmoji(goal.category)}</span>
              {getStatusIcon(goal.status)}
              <CardTitle className="text-lg">{goal.title}</CardTitle>
            </div>
            {goal.description && (
              <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
            )}
          </div>
          <Badge className={getStatusColor(goal.status)}>{goal.status}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Progress</span>
              <span className="text-sm font-semibold">{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} className="h-2" />
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="capitalize">
              {goal.category.replace("_", " ")}
            </Badge>
            {goal.targetDate && (
              <span className="flex items-center gap-1 text-gray-500">
                <Calendar className="w-4 h-4" />
                {new Date(goal.targetDate).toLocaleDateString()}
              </span>
            )}
            {goal.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Milestones */}
          {goal.milestones && goal.milestones.length > 0 && (
            <div className="pt-3 border-t">
              <button
                className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
                onClick={() => setExpanded(!expanded)}
              >
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${
                    expanded ? "rotate-90" : ""
                  }`}
                />
                Milestones ({goal.milestones.filter((m) => m.completed).length}/
                {goal.milestones.length})
              </button>
              {expanded && (
                <div className="space-y-2 ml-6">
                  {goal.milestones.map((milestone: Milestone, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {milestone.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span
                        className={
                          milestone.completed ? "text-gray-500 line-through" : ""
                        }
                      >
                        {milestone.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {goal.status === "ACTIVE" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 hover:text-green-700"
                  onClick={() => onUpdate(goal.id, { status: "COMPLETED" })}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdate(goal.id, { status: "PAUSED" })}
                >
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </Button>
              </>
            )}
            {goal.status === "PAUSED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdate(goal.id, { status: "ACTIVE" })}
              >
                <Play className="w-4 h-4 mr-1" />
                Resume
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700"
              onClick={() => {
                if (confirm("Are you sure you want to delete this goal?")) {
                  onDelete(goal.id);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

export default GoalsAchievementsPage;
