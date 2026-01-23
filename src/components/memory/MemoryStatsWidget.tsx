import { MemoryStats } from "../../types/memory";
import { cn } from "../../lib/utils";
import { Brain, Pin, Archive, Clock, Tag, TrendingUp } from "lucide-react";

interface MemoryStatsWidgetProps {
  stats: MemoryStats | null;
  isLoading?: boolean;
}

export function MemoryStatsWidget({
  stats,
  isLoading,
}: MemoryStatsWidgetProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="p-4 bg-white border border-slate-200 rounded-lg animate-pulse"
          >
            <div className="h-4 w-16 bg-slate-200 rounded mb-2" />
            <div className="h-8 w-12 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      label: "Total",
      value: stats.total,
      icon: Brain,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Court terme",
      value: stats.shortTerm,
      icon: Clock,
      color: "text-cyan-600 bg-cyan-50",
    },
    {
      label: "Long terme",
      value: stats.longTerm,
      icon: TrendingUp,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Épinglés",
      value: stats.pinned,
      icon: Pin,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Cette semaine",
      value: stats.recentWeek,
      icon: Clock,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Archivés",
      value: stats.archived,
      icon: Archive,
      color: "text-slate-600 bg-slate-100",
    },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="p-4 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1.5 rounded-md", item.color)}>
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">
                {item.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Top Tags */}
      {stats.topTags && stats.topTags.length > 0 && (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">
              Tags populaires
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.topTags.map((tagStat) => (
              <span
                key={tagStat.tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full"
              >
                {tagStat.tag}
                <span className="text-xs text-slate-400">
                  ({tagStat.count})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
