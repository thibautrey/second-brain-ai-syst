import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "i18next-react";
import { MemoryFilters, MemoryViewMode } from "../../types/memory";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Search,
  X,
  Filter,
  List,
  LayoutGrid,
  Pin,
  Archive,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "../ui/dropdown-menu";

interface MemorySearchBarProps {
  searchQuery: string;
  isSearching: boolean;
  isSemanticSearch: boolean;
  viewMode: MemoryViewMode;
  filters: MemoryFilters;
  onSearch: (query: string, semantic?: boolean) => void;
  onClearSearch: () => void;
  onViewModeChange: (mode: MemoryViewMode) => void;
  onFiltersChange: (filters: Partial<MemoryFilters>) => void;
}

export function MemorySearchBar({
  searchQuery,
  isSearching,
  isSemanticSearch,
  viewMode,
  filters,
  onSearch,
  onClearSearch,
  onViewModeChange,
  onFiltersChange,
}: MemorySearchBarProps) {
  const { t } = useTranslation();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [useSemanticSearch, setUseSemanticSearch] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== searchQuery) {
        onSearch(localQuery, useSemanticSearch);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localQuery, searchQuery, useSemanticSearch, onSearch]);

  // Sync local query with external search query
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleClear = useCallback(() => {
    setLocalQuery("");
    onClearSearch();
  }, [onClearSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        onSearch(localQuery, useSemanticSearch);
      }
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [localQuery, useSemanticSearch, onSearch, handleClear],
  );

  const activeFiltersCount = [
    filters.type,
    filters.isPinned,
    filters.isArchived,
    filters.minImportance,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder={
            useSemanticSearch
              ? t("memory.searchPlaceholder")
              : t("common.search")
          }
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn("pl-10 pr-20", isSearching && "animate-pulse")}
        />

        {/* Search type indicator and clear button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {localQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
              onClick={handleClear}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-xs gap-1",
              useSemanticSearch ? "text-purple-600" : "text-slate-500",
            )}
            onClick={() => setUseSemanticSearch(!useSemanticSearch)}
            title={
              useSemanticSearch
                ? "Recherche sémantique activée"
                : "Recherche textuelle"
            }
          >
            <Sparkles
              className={cn("w-3 h-3", useSemanticSearch && "text-purple-500")}
            />
            {useSemanticSearch ? "IA" : "Texte"}
          </Button>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex items-center gap-2">
        {/* Quick Filters */}
        <Button
          variant={filters.isPinned ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() =>
            onFiltersChange({ isPinned: filters.isPinned ? undefined : true })
          }
        >
          <Pin className={cn("w-4 h-4", filters.isPinned && "fill-current")} />
          <span className="ml-1 hidden sm:inline">Épinglés</span>
        </Button>

        <Button
          variant={filters.isArchived ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() =>
            onFiltersChange({ isArchived: filters.isArchived ? false : true })
          }
        >
          <Archive className="w-4 h-4" />
          <span className="ml-1 hidden sm:inline">Archives</span>
        </Button>

        {/* Advanced Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 relative">
              <SlidersHorizontal className="w-4 h-4" />
              <span className="ml-1 hidden sm:inline">Filtres</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("memory.memoryType")}</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={filters.type === "SHORT_TERM"}
              onCheckedChange={(checked) =>
                onFiltersChange({ type: checked ? "SHORT_TERM" : undefined })
              }
            >
              Court terme
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.type === "LONG_TERM"}
              onCheckedChange={(checked) =>
                onFiltersChange({ type: checked ? "LONG_TERM" : undefined })
              }
            >
              Long terme
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Importance minimum</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={filters.minImportance === 0.8}
              onCheckedChange={(checked) =>
                onFiltersChange({ minImportance: checked ? 0.8 : undefined })
              }
            >
              Haute (≥80%)
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.minImportance === 0.5}
              onCheckedChange={(checked) =>
                onFiltersChange({ minImportance: checked ? 0.5 : undefined })
              }
            >
              Moyenne (≥50%)
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() =>
                onFiltersChange({
                  type: undefined,
                  isPinned: undefined,
                  isArchived: false,
                  minImportance: undefined,
                })
              }
            >
              <X className="w-4 h-4 mr-2" />
              Réinitialiser les filtres
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View Mode Toggle */}
        <div className="flex items-center border rounded-lg overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 rounded-none border-0",
              viewMode === "list" && "bg-slate-100",
            )}
            onClick={() => onViewModeChange("list")}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 rounded-none border-0",
              viewMode === "grid" && "bg-slate-100",
            )}
            onClick={() => onViewModeChange("grid")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
