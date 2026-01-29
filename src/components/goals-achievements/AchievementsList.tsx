/**
 * AchievementsList Component - Display achievements
 */

import { Trophy, Lock, Star, Award, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { useAchievements } from "../../hooks/useAchievements";

export function AchievementsList() {
  const { achievements, stats, loading, error } = useAchievements({
    filters: { includeHidden: false },
  });

  const getSignificanceIcon = (significance: string) => {
    switch (significance) {
      case "milestone":
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case "major":
        return <Award className="w-6 h-6 text-purple-500" />;
      case "normal":
        return <Star className="w-6 h-6 text-blue-500" />;
      default:
        return <Sparkles className="w-6 h-6 text-slate-400" />;
    }
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case "milestone":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "major":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "normal":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Loading achievements...</p>
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
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-900">Achievements</h2>
        <p className="text-slate-600 mt-1">Your accomplishments and milestones</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-600">Achievement Progress</p>
                  <p className="text-2xl font-bold">
                    {stats.unlocked} / {stats.total}
                  </p>
                </div>
                <Trophy className="w-12 h-12 text-yellow-500" />
              </div>
              <Progress value={stats.unlockedPercentage} className="h-3" />
              <p className="text-sm text-slate-500 mt-2">
                {stats.unlockedPercentage.toFixed(0)}% unlocked
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Achievements Grid */}
      {achievements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No achievements yet. Keep using the system to unlock them!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((achievement) => (
            <Card
              key={achievement.id}
              className={`hover:shadow-lg transition-all ${
                achievement.isUnlocked
                  ? "border-2 " + getSignificanceColor(achievement.significance)
                  : "opacity-60 border-dashed"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {achievement.isUnlocked ? (
                      getSignificanceIcon(achievement.significance)
                    ) : (
                      <Lock className="w-6 h-6 text-slate-400" />
                    )}
                    <div className="text-3xl">{achievement.icon || "🏆"}</div>
                  </div>
                  {achievement.isUnlocked && (
                    <Badge className={getSignificanceColor(achievement.significance)}>
                      {achievement.significance}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-2">{achievement.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-3">
                  {achievement.description}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {achievement.category}
                  </Badge>
                  {achievement.isUnlocked && achievement.unlockedAt && (
                    <span className="text-xs text-slate-500">
                      Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {!achievement.isUnlocked && achievement.criteria && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-slate-500 italic">
                      {achievement.criteria.description || "Keep going to unlock this achievement!"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category Breakdown */}
      {stats && stats.byCategory.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4">By Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.byCategory.map((cat) => (
              <Card key={cat.category}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{cat.category}</span>
                    <span className="text-sm text-slate-600">
                      {cat.unlocked}/{cat.total}
                    </span>
                  </div>
                  <Progress
                    value={(cat.unlocked / cat.total) * 100}
                    className="h-2"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
