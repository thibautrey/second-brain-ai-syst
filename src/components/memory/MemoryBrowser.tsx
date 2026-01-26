import { useState, useCallback } from "react";
import { useMemories } from "../../hooks/useMemories";
import { Memory, MemoryViewMode } from "../../types/memory";
import { MemorySearchBar } from "./MemorySearchBar";
import { MemoryTimeline } from "./MemoryTimeline";
import { MemoryStatsWidget } from "./MemoryStatsWidget";
import { MemoryDetailPanel } from "./MemoryDetailPanel";
import { Button } from "../ui/button";
import { RefreshCw, Plus } from "lucide-react";
import { cn } from "../../lib/utils";

export function MemoryBrowser() {
  const {
    memories,
    stats,
    timelineGroups,
    isLoading,
    isSearching,
    error,
    filters,
    hasMore,
    searchQuery,
    isSemanticSearch,
    loadMore,
    refresh,
    search,
    clearSearch,
    togglePin,
    toggleArchive,
    deleteMemory,
    updateFilters,
  } = useMemories();

  const [viewMode, setViewMode] = useState<MemoryViewMode>("list");
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const handleSelectMemory = useCallback((memory: Memory) => {
    setSelectedMemory(memory);
    setIsPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const handlePin = useCallback(
    async (memoryId: string, isPinned: boolean) => {
      await togglePin(memoryId, isPinned);
      // Update selected memory if it's the one being modified
      if (selectedMemory?.id === memoryId) {
        setSelectedMemory((prev) =>
          prev ? { ...prev, isPinned: !isPinned } : null,
        );
      }
    },
    [togglePin, selectedMemory],
  );

  const handleArchive = useCallback(
    async (memoryId: string, isArchived: boolean) => {
      await toggleArchive(memoryId, isArchived);
      if (selectedMemory?.id === memoryId) {
        setSelectedMemory((prev) =>
          prev ? { ...prev, isArchived: !isArchived } : null,
        );
      }
    },
    [toggleArchive, selectedMemory],
  );

  const handleDelete = useCallback(
    async (memoryId: string) => {
      if (confirm("Êtes-vous sûr de vouloir supprimer ce souvenir ?")) {
        await deleteMemory(memoryId);
        if (selectedMemory?.id === memoryId) {
          setIsPanelOpen(false);
          setSelectedMemory(null);
        }
      }
    },
    [deleteMemory, selectedMemory],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Mémoires</h2>
          <p className="text-slate-600 mt-1">
            Explorez et gérez vos souvenirs
            {isSemanticSearch && searchQuery && (
              <span className="ml-2 text-purple-600 text-sm">
                • Recherche sémantique active
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
            className="gap-2 flex-1 sm:flex-initial"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <MemoryStatsWidget stats={stats} isLoading={isLoading && !stats} />

      {/* Search Bar */}
      <MemorySearchBar
        searchQuery={searchQuery}
        isSearching={isSearching}
        isSemanticSearch={isSemanticSearch}
        viewMode={viewMode}
        filters={filters}
        onSearch={search}
        onClearSearch={clearSearch}
        onViewModeChange={setViewMode}
        onFiltersChange={updateFilters}
      />

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-medium">Erreur</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Timeline */}
      <MemoryTimeline
        groups={timelineGroups}
        viewMode={viewMode}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onPin={handlePin}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onSelect={handleSelectMemory}
      />

      {/* Detail Panel */}
      <MemoryDetailPanel
        memory={selectedMemory}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        onPin={handlePin}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />
    </div>
  );
}
