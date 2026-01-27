import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

// Mobile-specific components
export function InsightLine({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-lg" role="img" aria-label={label}>
          {icon}
        </span>
        <span className="text-slate-700">{label}</span>
      </div>
      <span className="font-bold text-slate-900 text-lg">{value}</span>
    </div>
  );
}

export function MobileActionButton({
  icon,
  iconLabel,
  title,
  description,
  onClick,
  variant = "default",
}: {
  icon: string;
  iconLabel: string;
  title: string;
  description: string;
  onClick: () => void;
  variant?: "primary" | "default";
}) {
  const isPrimary = variant === "primary";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        isPrimary
          ? "bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-400 text-white shadow-lg hover:shadow-xl"
          : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50"
      }`}
      aria-label={`${title}: ${description}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl" role="img" aria-label={iconLabel}>
          {icon}
        </div>
        <div className="flex-1">
          <p
            className={`font-semibold text-base ${isPrimary ? "text-white" : "text-slate-900"}`}
          >
            {title}
          </p>
          <p
            className={`text-sm mt-0.5 ${isPrimary ? "text-blue-100" : "text-slate-500"}`}
          >
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

export function MobileActivityItem({
  title,
  time,
  icon = "📌",
  iconLabel = "Activity",
}: {
  title: string;
  time: string;
  icon?: string;
  iconLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-2 border-b border-slate-100 last:border-0">
      <div className="text-base" role="img" aria-label={iconLabel}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900 truncate">{title}</p>
      </div>
      <p className="text-xs text-slate-400 whitespace-nowrap">{time}</p>
    </div>
  );
}

interface MobileDashboardProps {
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

export function MobileDashboard({
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
}: MobileDashboardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const displayName = user?.name || user?.email?.split("@")[0] || "";

  return (
    <div className="space-y-6">
      {/* Mobile Header */}
      <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {t("dashboard.welcome")}
          </h2>
        <p className="text-sm text-slate-600">
          {displayName || t("dashboard.summary")}
        </p>
      </div>

      {/* Key Insights - Text Format */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
          {t("navigation.appName")}
        </h3>
        {error && (
          <div className="p-3 mb-4 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-white/50 rounded animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <InsightLine
              icon="📚"
              label={t("dashboard.totalMemories")}
              value={totalMemories}
            />
            <InsightLine
              icon="💬"
              label={t("dashboard.totalInteractions")}
              value={totalInteractions}
            />
            <InsightLine
              icon="📝"
              label={t("dashboard.dailySummaries")}
              value={dailySummaries}
            />
          </div>
        )}
      </div>

      {/* Primary Actions */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
          {t("dashboard.quickActions")}
        </h3>
        <MobileActionButton
          icon="🎤"
          iconLabel="Microphone"
          title={t("dashboard.recordThought")}
          description={t("dashboard.recordThoughtDescription")}
          onClick={() => {
            // TODO: Implement voice recording functionality
            console.log("Record thought clicked");
          }}
          variant="primary"
        />
        <MobileActionButton
          icon="🧠"
          iconLabel="Brain"
          title={t("dashboard.viewMemories")}
          description={t("dashboard.viewMemoriesDescription")}
          onClick={() => navigate("/dashboard/memories")}
        />
        <MobileActionButton
          icon="📊"
          iconLabel="Chart"
          title={t("dashboard.todaysSummary")}
          description={t("dashboard.todaysSummaryDescription")}
          onClick={() => navigate("/dashboard/analytics")}
        />
      </div>

      {/* Recent Activity - Always show container */}
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Recent Activity
        </h3>
        {activityError && (
          <div className="p-2 text-xs text-orange-700 bg-orange-50 rounded border border-orange-200 mb-3">
            {activityError}
          </div>
        )}
        {activityLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : recentActivityItems.length > 0 ? (
          <div className="space-y-3">
            {recentActivityItems.slice(0, 3).map((item) => (
              <MobileActivityItem
                key={item.id}
                title={item.title}
                time={formatTimeAgo(item.timestamp)}
                icon={item.icon}
                iconLabel={`${item.type} activity`}
              />
            ))}
          </div>
        ) : (
            <p className="text-sm text-slate-500 py-4">
              {t("dashboard.noRecentActivity")}
            </p>
        )}
      </div>
    </div>
  );
}
