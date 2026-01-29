import { Memory, MemoryViewMode } from "../../types/memory";
import { cn } from "../../lib/utils";
import {
  Pin,
  Archive,
  Trash2,
  MoreHorizontal,
  Clock,
  Tag,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useState } from "react";

interface MemoryCardProps {
  memory: Memory;
  viewMode: MemoryViewMode;
  onPin: (memoryId: string, isPinned: boolean) => void;
  onArchive: (memoryId: string, isArchived: boolean) => void;
  onDelete: (memoryId: string) => void;
  onSelect: (memory: Memory) => void;
}

export function MemoryCard({
  memory,
  viewMode,
  onPin,
  onArchive,
  onDelete,
  onSelect,
}: MemoryCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formattedDate = new Date(memory.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const importanceColor =
    memory.importanceScore >= 0.8
      ? "bg-red-100 text-red-700 border-red-200"
      : memory.importanceScore >= 0.6
        ? "bg-orange-100 text-orange-700 border-orange-200"
        : memory.importanceScore >= 0.4
          ? "bg-yellow-100 text-yellow-700 border-yellow-200"
          : "bg-slate-100 text-slate-600 border-slate-200";

  const typeLabel = memory.type === "LONG_TERM" ? "Long terme" : "Court terme";
  const typeBadgeColor =
    memory.type === "LONG_TERM"
      ? "bg-purple-100 text-purple-700"
      : "bg-blue-100 text-blue-700";

  // Truncate content for display
  const truncatedContent =
    memory.content.length > (viewMode === "list" ? 200 : 150)
      ? memory.content.substring(0, viewMode === "list" ? 200 : 150) + "..."
      : memory.content;

  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "group relative flex items-start gap-4 p-4 bg-white border rounded-lg transition-all cursor-pointer",
          memory.isPinned
            ? "border-blue-300 bg-blue-50/30"
            : "border-slate-200",
          isHovered ? "shadow-md border-blue-200" : "hover:shadow-sm",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onSelect(memory)}
      >
        {/* Pin indicator */}
        {memory.isPinned && (
          <div className="absolute top-2 right-2">
            <Pin className="w-4 h-4 text-blue-500 fill-blue-500" />
          </div>
        )}

        {/* Timeline dot */}
        <div className="shrink-0 mt-2">
          <div
            className={cn(
              "w-3 h-3 rounded-full border-2",
              memory.type === "LONG_TERM"
                ? "bg-purple-500 border-purple-300"
                : "bg-blue-500 border-blue-300",
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-medium rounded-full",
                typeBadgeColor,
              )}
            >
              {typeLabel}
            </span>
            {memory.importanceScore >= 0.6 && (
              <span
                className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded-full border",
                  importanceColor,
                )}
              >
                {Math.round(memory.importanceScore * 100)}%
              </span>
            )}
          </div>

          <p className="text-sm text-slate-800 leading-relaxed mb-2">
            {truncatedContent}
          </p>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formattedDate}
            </span>
            {memory.tags.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {memory.tags.slice(0, 3).join(", ")}
                {memory.tags.length > 3 && ` +${memory.tags.length - 3}`}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div
          className={cn(
            "shrink-0 flex items-center gap-1 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0",
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onPin(memory.id, memory.isPinned);
            }}
          >
            <Pin className={cn("w-4 h-4", memory.isPinned && "fill-current")} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onArchive(memory.id, memory.isArchived)}
              >
                <Archive className="w-4 h-4 mr-2" />
                {memory.isArchived ? "Désarchiver" : "Archiver"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => onDelete(memory.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={cn(
        "group relative p-4 bg-white border rounded-lg transition-all cursor-pointer h-full flex flex-col",
        memory.isPinned ? "border-blue-300 bg-blue-50/30" : "border-slate-200",
        isHovered
          ? "shadow-md border-blue-200 scale-[1.02]"
          : "hover:shadow-sm",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(memory)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded-full",
              typeBadgeColor,
            )}
          >
            {typeLabel}
          </span>
          {memory.isPinned && (
            <Pin className="w-3 h-3 text-blue-500 fill-blue-500" />
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0 transition-opacity",
                isHovered ? "opacity-100" : "opacity-0",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPin(memory.id, memory.isPinned)}>
              <Pin className="w-4 h-4 mr-2" />
              {memory.isPinned ? "Désépingler" : "Épingler"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onArchive(memory.id, memory.isArchived)}
            >
              <Archive className="w-4 h-4 mr-2" />
              {memory.isArchived ? "Désarchiver" : "Archiver"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => onDelete(memory.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <p className="flex-1 text-sm text-slate-800 leading-relaxed mb-3">
        {truncatedContent}
      </p>

      {/* Tags */}
      {memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {memory.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full"
            >
              {tag}
            </span>
          ))}
          {memory.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-slate-400">
              +{memory.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formattedDate}
        </span>
        {memory.importanceScore >= 0.4 && (
          <span
            className={cn("px-2 py-0.5 rounded-full border", importanceColor)}
          >
            {Math.round(memory.importanceScore * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}
