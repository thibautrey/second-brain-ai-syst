import { MemoryTimeGroup, MemoryViewMode, Memory } from "../../types/memory";
import { useTranslation } from "react-i18next";
import { MemoryCard } from "./MemoryCard";
import { cn } from "../../lib/utils";
import { Calendar, Brain, Loader2 } from "lucide-react";

interface MemoryTimelineProps {
  groups: MemoryTimeGroup[];
  viewMode: MemoryViewMode;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onPin: (memoryId: string, isPinned: boolean) => void;
  onArchive: (memoryId: string, isArchived: boolean) => void;
  onDelete: (memoryId: string) => void;
  onSelect: (memory: Memory) => void;
}

export function MemoryTimeline({
  groups,
  viewMode,
  isLoading,
  hasMore,
  onLoadMore,
  onPin,
  onArchive,
  onDelete,
  onSelect,
}: MemoryTimelineProps) {
  const { t } = useTranslation();

  if (isLoading && groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Brain className="w-12 h-12 mb-4 text-slate-300" />
        <p className="text-lg font-medium">{t("memory.noMemoriesFound")}</p>
        <p className="text-sm mt-1">Vos souvenirs apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

      {/* Groups */}
      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.date} className="relative">
            {/* Date separator */}
            <div className="sticky top-0 z-10 flex items-center gap-3 pb-4 bg-slate-50">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white border-2 border-slate-200 shadow-sm">
                <Calendar className="w-4 h-4 text-slate-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 bg-slate-50 px-2">
                {group.label}
              </h3>
              <span className="text-xs text-slate-400 bg-slate-50 px-2">
                {group.memories.length} souvenir
                {group.memories.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Memories */}
            <div
              className={cn(
                "ml-12",
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-3",
              )}
            >
              {group.memories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  viewMode={viewMode}
                  onPin={onPin}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement...
              </>
            ) : (
              "Charger plus de souvenirs"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
