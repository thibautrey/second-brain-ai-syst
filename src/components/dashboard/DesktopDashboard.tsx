import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { BarChart3, Brain, Mic } from "lucide-react";

interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

interface DesktopDashboardProps {
  user: User | null;
  totalMemories: number;
  totalInteractions: number;
  dailySummaries: number;
  isLoading: boolean;
  error: string | null;
  recentActivityItems: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: Date;
    icon: string;
    type: "memory" | "interaction" | "todo" | "summary";
  }>;
  activityLoading: boolean;
  activityError: string | null;
  formatTimeAgo: (date: Date) => string;
}

export function DesktopDashboard({
  user,
  totalMemories,
  totalInteractions,
  dailySummaries,
  isLoading,
  error,
  recentActivityItems,
  activityLoading,
  activityError,
  formatTimeAgo,
}: DesktopDashboardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const displayName = user?.name || user?.email?.split("@")[0] || "";
  const greetingText = displayName
    ? t("dashboard.greeting", { name: displayName })
    : t("dashboard.welcome");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{greetingText}</h1>
        <p className="text-gray-600 mt-2">{t("dashboard.summary")}</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Stats Cards */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t("dashboard.totalMemories")}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  totalMemories
                )}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Brain className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t("dashboard.totalInteractions")}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  totalInteractions
                )}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Mic className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t("dashboard.dailySummaries")}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  dailySummaries
                )}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-6">
          <Button
            onClick={() => console.log("Record thought")}
            className="h-32 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-semibold flex flex-col items-center justify-center gap-2"
          >
            <Mic className="w-8 h-8" />
            {t("dashboard.recordThought")}
          </Button>

          <Button
            onClick={() => navigate("/dashboard/memories")}
            className="h-32 bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white text-lg font-semibold flex flex-col items-center justify-center gap-2"
          >
            <Brain className="w-8 h-8" />
            {t("dashboard.viewMemories")}
          </Button>

          <Button
            onClick={() => navigate("/dashboard/analytics")}
            className="h-32 bg-gradient-to-br from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white text-lg font-semibold flex flex-col items-center justify-center gap-2"
          >
            <BarChart3 className="w-8 h-8" />
            {t("dashboard.todaysSummary")}
          </Button>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          {t("dashboard.recentActivity")}
        </h2>

        {activityError && (
          <div className="p-3 bg-orange-50 border border-orange-300 rounded mb-4">
            <p className="text-sm text-orange-800">{activityError}</p>
          </div>
        )}

        {activityLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : recentActivityItems.length > 0 ? (
          <div className="space-y-3">
            {recentActivityItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="text-xl">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.title}</p>
                  <p className="text-sm text-gray-600 truncate">{item.description}</p>
                </div>
                <p className="text-xs text-gray-500 whitespace-nowrap">
                  {formatTimeAgo(item.timestamp)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">
            {t("dashboard.noRecentActivity")}
          </p>
        )}
      </div>
    </div>
  );
}
