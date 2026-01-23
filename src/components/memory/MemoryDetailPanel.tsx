import { Memory } from "../../types/memory";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  X,
  Pin,
  Archive,
  Trash2,
  Clock,
  Tag,
  Brain,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";

interface MemoryDetailPanelProps {
  memory: Memory | null;
  isOpen: boolean;
  onClose: () => void;
  onPin: (memoryId: string, isPinned: boolean) => void;
  onArchive: (memoryId: string, isArchived: boolean) => void;
  onDelete: (memoryId: string) => void;
}

export function MemoryDetailPanel({
  memory,
  isOpen,
  onClose,
  onPin,
  onArchive,
  onDelete,
}: MemoryDetailPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!memory) return null;

  const formattedDate = new Date(memory.createdAt).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(memory.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const importanceColor =
    memory.importanceScore >= 0.8
      ? "bg-red-100 text-red-700"
      : memory.importanceScore >= 0.6
        ? "bg-orange-100 text-orange-700"
        : memory.importanceScore >= 0.4
          ? "bg-yellow-100 text-yellow-700"
          : "bg-slate-100 text-slate-600";

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 z-40 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl z-50 transition-transform duration-300 flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Détail du souvenir
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Type and Importance */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-full",
                memory.type === "LONG_TERM"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-blue-100 text-blue-700",
              )}
            >
              {memory.type === "LONG_TERM" ? "Long terme" : "Court terme"}
            </span>
            <span
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-full",
                importanceColor,
              )}
            >
              Importance: {Math.round(memory.importanceScore * 100)}%
            </span>
            {memory.isPinned && (
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <Pin className="w-3 h-3 fill-current" />
                Épinglé
              </span>
            )}
            {memory.isArchived && (
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                <Archive className="w-3 h-3" />
                Archivé
              </span>
            )}
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>

          {/* Content */}
          <div className="relative">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                {memory.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400" />
              )}
            </Button>
          </div>

          {/* Tags */}
          {memory.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
                <Tag className="w-4 h-4" />
                Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {memory.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Entities */}
          {memory.entities.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
                <ExternalLink className="w-4 h-4" />
                Entités détectées
              </div>
              <div className="flex flex-wrap gap-2">
                {memory.entities.map((entity) => (
                  <span
                    key={entity}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full"
                  >
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {Object.keys(memory.metadata).length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">
                Métadonnées
              </div>
              <pre className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 overflow-x-auto">
                {JSON.stringify(memory.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Source info */}
          {(memory.sourceType || memory.sourceId) && (
            <div className="text-sm text-slate-500">
              <span className="font-medium">Source:</span> {memory.sourceType}
              {memory.sourceId && ` (${memory.sourceId})`}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 p-4 border-t border-slate-200 bg-slate-50">
          <Button
            variant={memory.isPinned ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => onPin(memory.id, memory.isPinned)}
          >
            <Pin
              className={cn("w-4 h-4 mr-2", memory.isPinned && "fill-current")}
            />
            {memory.isPinned ? "Désépingler" : "Épingler"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onArchive(memory.id, memory.isArchived)}
          >
            <Archive className="w-4 h-4 mr-2" />
            {memory.isArchived ? "Désarchiver" : "Archiver"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              onDelete(memory.id);
              onClose();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
