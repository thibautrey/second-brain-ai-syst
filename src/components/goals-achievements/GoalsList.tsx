/**
 * GoalsList Component - Display and manage goals
 */

import { useState } from "react";
import { Plus, Target, TrendingUp, CheckCircle2, Pause, Archive } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { useGoals } from "../../hooks/useGoals";
import type { Goal, GoalStatus } from "../../types/goals-achievements";

export function GoalsList() {
  const { goals, stats, categories, loading, error, updateGoal, updateProgress, deleteGoal } = useGoals({
    filters: { includeArchived: false },
  });

  const [activeFilter, setActiveFilter] = useState<GoalStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);

  const filteredGoals = activeFilter === "all" 
    ? goals 
    : goals.filter(g => g.status === activeFilter);

  const getStatusIcon = (status: GoalStatus) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "PAUSED":
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case "ARCHIVED":
        return <Archive className="w-4 h-4 text-gray-400" />;
      default:
        return <Target className="w-4 h-4 text-blue-500" />;
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

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Loading goals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Goals</h2>
          <p className="text-slate-600 mt-1">Track your progress and achievements</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          New Goal
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Goals</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Target className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Active</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Success Rate</p>
                  <p className="text-2xl font-bold">{stats.completionRate.toFixed(0)}%</p>
                </div>
                <div className="text-3xl">🎯</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button
          variant={activeFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("all")}
        >
          All
        </Button>
        <Button
          variant={activeFilter === "ACTIVE" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("ACTIVE")}
        >
          Active
        </Button>
        <Button
          variant={activeFilter === "COMPLETED" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("COMPLETED")}
        >
          Completed
        </Button>
        <Button
          variant={activeFilter === "PAUSED" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("PAUSED")}
        >
          Paused
        </Button>
      </div>

      {/* Goals List */}
      {filteredGoals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No goals yet. Create your first goal to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGoals.map((goal) => (
            <Card key={goal.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(goal.status)}
                      <CardTitle className="text-lg">{goal.title}</CardTitle>
                    </div>
                    {goal.description && (
                      <p className="text-sm text-slate-600 mt-1">{goal.description}</p>
                    )}
                  </div>
                  <Badge className={getStatusColor(goal.status)}>
                    {goal.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600">Progress</span>
                      <span className="text-sm font-semibold">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Category:</span>
                      <Badge variant="outline" className="text-xs">
                        {goal.category}
                      </Badge>
                    </div>
                    {goal.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {goal.tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Milestones */}
                  {goal.milestones && goal.milestones.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium text-slate-700 mb-2">Milestones</p>
                      <div className="space-y-1">
                        {goal.milestones.map((milestone: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {milestone.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                            )}
                            <span className={milestone.completed ? "text-slate-500 line-through" : ""}>
                              {milestone.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {goal.status === "ACTIVE" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateGoal(goal.id, { status: "COMPLETED" })}
                        >
                          Mark Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateGoal(goal.id, { status: "PAUSED" })}
                        >
                          Pause
                        </Button>
                      </>
                    )}
                    {goal.status === "PAUSED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateGoal(goal.id, { status: "ACTIVE" })}
                      >
                        Resume
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this goal?")) {
                          deleteGoal(goal.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
