/**
 * ToolPreview Component
 *
 * Displays tool call arguments as they're being generated in real-time
 * Shows partial JSON with syntax highlighting and preview of parsed values
 */

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Code2, Loader2, Wrench, XCircle } from "lucide-react";
import React, { useMemo } from "react";

import { ToolCallData } from "../../types/chat";
import { cn } from "../../lib/utils";

interface ToolPreviewProps {
  toolCall: ToolCallData;
  className?: string;
  /** Show full JSON or just key values */
  showFullJson?: boolean;
}

// Tool display info mapping
const TOOL_DISPLAY_INFO: Record<
  string,
  { emoji: string; displayName: string; color: string }
> = {
  todo: { emoji: "✅", displayName: "Tâches", color: "text-green-600" },
  notification: {
    emoji: "🔔",
    displayName: "Notifications",
    color: "text-yellow-600",
  },
  scheduled_task: {
    emoji: "⏰",
    displayName: "Tâches planifiées",
    color: "text-blue-600",
  },
  curl: { emoji: "🌐", displayName: "Requête HTTP", color: "text-purple-600" },
  user_context: {
    emoji: "👤",
    displayName: "Contexte utilisateur",
    color: "text-indigo-600",
  },
  user_profile: {
    emoji: "📋",
    displayName: "Profil utilisateur",
    color: "text-teal-600",
  },
  long_running_task: {
    emoji: "⚙️",
    displayName: "Tâche longue",
    color: "text-orange-600",
  },
  code_executor: {
    emoji: "🐍",
    displayName: "Code Python",
    color: "text-emerald-600",
  },
  generate_tool: {
    emoji: "✨",
    displayName: "Génération d'outil",
    color: "text-pink-600",
  },
  secrets: { emoji: "🔐", displayName: "Secrets", color: "text-red-600" },
  memory: { emoji: "🧠", displayName: "Mémoire", color: "text-violet-600" },
  browser: { emoji: "🌐", displayName: "Navigateur", color: "text-cyan-600" },
};

function getToolInfo(toolName: string) {
  const normalized = toolName.toLowerCase().replace(/[^a-z_]/g, "");
  return (
    TOOL_DISPLAY_INFO[normalized] || {
      emoji: "🔧",
      displayName: toolName,
      color: "text-slate-600",
    }
  );
}

/**
 * Highlight JSON syntax with colors
 */
function highlightJson(json: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Simple regex-based highlighting
  const patterns = [
    { pattern: /"([^"\\]|\\.)*"(?=\s*:)/g, className: "text-blue-600" }, // keys
    { pattern: /"([^"\\]|\\.)*"(?!\s*:)/g, className: "text-green-600" }, // string values
    { pattern: /\b(true|false)\b/g, className: "text-orange-600" }, // booleans
    { pattern: /\b(null)\b/g, className: "text-red-500" }, // null
    { pattern: /\b(-?\d+\.?\d*)\b/g, className: "text-purple-600" }, // numbers
  ];

  let remaining = json;
  let lastIndex = 0;
  const allMatches: Array<{
    index: number;
    length: number;
    className: string;
    text: string;
  }> = [];

  for (const { pattern, className } of patterns) {
    let match;
    const regex = new RegExp(pattern.source, "g");
    while ((match = regex.exec(json)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        className,
        text: match[0],
      });
    }
  }

  // Sort by index
  allMatches.sort((a, b) => a.index - b.index);

  // Build highlighted parts
  let currentIndex = 0;
  for (const match of allMatches) {
    if (match.index >= currentIndex) {
      // Add non-highlighted text before this match
      if (match.index > currentIndex) {
        parts.push(
          <span key={key++} className="text-slate-500">
            {json.slice(currentIndex, match.index)}
          </span>,
        );
      }
      // Add highlighted match
      parts.push(
        <span key={key++} className={match.className}>
          {match.text}
        </span>,
      );
      currentIndex = match.index + match.length;
    }
  }

  // Add remaining text
  if (currentIndex < json.length) {
    parts.push(
      <span key={key++} className="text-slate-500">
        {json.slice(currentIndex)}
      </span>,
    );
  }

  return parts;
}

/**
 * Format a preview of parsed arguments
 */
function formatPreview(parsed: Record<string, unknown>): React.ReactNode[] {
  const entries = Object.entries(parsed).slice(0, 4); // Show max 4 fields
  const hasMore = Object.keys(parsed).length > 4;

  return [
    ...entries.map(([key, value], index) => (
      <div key={key} className="flex items-start gap-2 text-xs">
        <span className="font-medium text-slate-500">{key}:</span>
        <span className="text-slate-700 truncate max-w-[150px]">
          {typeof value === "string"
            ? `"${value.slice(0, 30)}${value.length > 30 ? "..." : ""}"`
            : JSON.stringify(value)}
        </span>
      </div>
    )),
    ...(hasMore
      ? [
          <div key="more" className="text-xs italic text-slate-400">
            +{Object.keys(parsed).length - 4} autres champs...
          </div>,
        ]
      : []),
  ];
}

export function ToolPreview({
  toolCall,
  className,
  showFullJson = false,
}: ToolPreviewProps) {
  const toolInfo = getToolInfo(toolCall.toolName);
  const isStreaming = !toolCall.result && toolCall.partialArgs;
  const isExecuting = toolCall.status === "executing";
  const isSuccess = toolCall.status === "success";
  const isError = toolCall.status === "error";

  // Format partial args for display
  const formattedArgs = useMemo(() => {
    if (!toolCall.partialArgs) return null;

    try {
      // Try to format as JSON
      const formatted = toolCall.partialArgs.replace(/^\s+/gm, (match) =>
        "  ".repeat(Math.floor(match.length / 2)),
      );
      return highlightJson(formatted);
    } catch {
      return <span className="text-slate-600">{toolCall.partialArgs}</span>;
    }
  }, [toolCall.partialArgs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className={cn(
        "rounded-lg border overflow-hidden",
        isExecuting && "border-blue-300 bg-blue-50",
        isSuccess && "border-green-300 bg-green-50",
        isError && "border-red-300 bg-red-50",
        !isExecuting &&
          !isSuccess &&
          !isError &&
          "border-slate-200 bg-slate-50",
        className,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 border-b",
          isExecuting && "bg-blue-100/50 border-blue-200",
          isSuccess && "bg-green-100/50 border-green-200",
          isError && "bg-red-100/50 border-red-200",
          !isExecuting &&
            !isSuccess &&
            !isError &&
            "bg-slate-100/50 border-slate-200",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{toolInfo.emoji}</span>
          <span className={cn("text-sm font-medium", toolInfo.color)}>
            {toolInfo.displayName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isStreaming && (
            <motion.div
              className="flex items-center gap-1 text-xs text-slate-500"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Code2 className="w-3 h-3" />
              <span>Génération...</span>
            </motion.div>
          )}
          {isExecuting && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Exécution...</span>
            </div>
          )}
          {isSuccess && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="w-3 h-3" />
              <span>Terminé</span>
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <XCircle className="w-3 h-3" />
              <span>Erreur</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Parsed preview (if available) */}
        {toolCall.parsedPreview && !showFullJson && (
          <div className="mb-2 space-y-1">
            {formatPreview(toolCall.parsedPreview)}
          </div>
        )}

        {/* Raw JSON (if showFullJson or no preview) */}
        {(showFullJson || !toolCall.parsedPreview) && formattedArgs && (
          <div className="relative">
            <pre className="p-2 overflow-x-auto overflow-y-auto font-mono text-xs rounded bg-white/50 max-h-32">
              <code>{formattedArgs}</code>
              {isStreaming && (
                <motion.span
                  className="inline-block w-1.5 h-3 bg-blue-500 ml-0.5 align-middle"
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                />
              )}
            </pre>
          </div>
        )}

        {/* Error message */}
        {isError && toolCall.error && (
          <div className="p-2 mt-2 text-xs text-red-600 bg-red-100 rounded">
            {toolCall.error}
          </div>
        )}

        {/* Execution time */}
        {toolCall.endTime && toolCall.startTime && (
          <div className="mt-2 text-xs text-slate-400">
            Temps d'exécution: {toolCall.endTime - toolCall.startTime}ms
          </div>
        )}
      </div>

      {/* Progress bar for streaming */}
      {isStreaming && (
        <motion.div
          className="h-0.5 bg-gradient-to-r from-blue-400 via-cyan-500 to-blue-400"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            backgroundSize: "200% 100%",
          }}
        />
      )}
    </motion.div>
  );
}

/**
 * Compact tool preview for inline/mini display
 */
export function ToolPreviewCompact({
  toolCall,
  className,
}: {
  toolCall: ToolCallData;
  className?: string;
}) {
  const toolInfo = getToolInfo(toolCall.toolName);
  const isExecuting = toolCall.status === "executing";
  const isSuccess = toolCall.status === "success";
  const isError = toolCall.status === "error";
  const isStreaming = !toolCall.result && toolCall.partialArgs;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        isExecuting && "bg-blue-100 text-blue-700",
        isSuccess && "bg-green-100 text-green-700",
        isError && "bg-red-100 text-red-700",
        isStreaming && "bg-slate-100 text-slate-700",
        !isExecuting &&
          !isSuccess &&
          !isError &&
          !isStreaming &&
          "bg-slate-100 text-slate-600",
        className,
      )}
    >
      <span>{toolInfo.emoji}</span>
      <span className="max-w-[100px] truncate">{toolInfo.displayName}</span>
      {isStreaming && <Code2 className="w-3 h-3 animate-pulse" />}
      {isExecuting && <Loader2 className="w-3 h-3 animate-spin" />}
      {isSuccess && <CheckCircle2 className="w-3 h-3" />}
      {isError && <XCircle className="w-3 h-3" />}
    </motion.div>
  );
}

export default ToolPreview;
