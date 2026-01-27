/**
 * Goals Page
 *
 * A user-friendly page for managing personal goals
 * Styled to match the analytics page design
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Target,
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
import type { Goal, GoalStatus, Milestone } from "../../types/goals-achievements";

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

export function GoalsPage() {
  const { t } = useTranslation();
  const {
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
  } = useGoals({ filters: { includeArchived: false } });

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
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Goals</h1>
          <p className="text-gray-500 mt-1">
            Track your progress and achieve your dreams
          </p>
        </div>

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

export default GoalsPage;
