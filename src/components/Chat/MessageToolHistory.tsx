/**
 * Message Tool History Component
 *
 * Displays a compact summary of tools used to generate an assistant message
 * Expandable to show details of each tool execution
 */

import React, { useState } from "react";
import { cn } from "../../lib/utils";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ToolCallData } from "../../types/chat";

interface MessageToolHistoryProps {
  toolCalls: ToolCallData[];
  className?: string;
}

// Map tool names to friendly display
const TOOL_DISPLAY_INFO: Record<
  string,
  { emoji: string; displayName: string }
> = {
  todo: { emoji: "✅", displayName: "Tâches" },
  notification: { emoji: "🔔", displayName: "Notifications" },
  scheduled_task: { emoji: "⏰", displayName: "Tâches planifiées" },
  curl: { emoji: "🌐", displayName: "Requête HTTP" },
  user_context: { emoji: "👤", displayName: "Contexte utilisateur" },
  user_profile: { emoji: "📋", displayName: "Profil utilisateur" },
  long_running_task: { emoji: "⚙️", displayName: "Tâche longue" },
  code_executor: { emoji: "🐍", displayName: "Code Python" },
  generate_tool: { emoji: "✨", displayName: "Génération d'outil" },
  secrets: { emoji: "🔐", displayName: "Secrets" },
  memory: { emoji: "🧠", displayName: "Mémoire" },
};

function getToolInfo(toolName: string) {
  const normalized = toolName.toLowerCase().replace(/[^a-z_]/g, "");
  return (
    TOOL_DISPLAY_INFO[normalized] || {
      emoji: "🔧",
      displayName: toolName,
    }
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function MessageToolHistory({
  toolCalls,
  className,
}: MessageToolHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const successCount = toolCalls.filter((t) => t.status === "success").length;
  const errorCount = toolCalls.filter((t) => t.status === "error").length;
  const totalDuration = toolCalls.reduce((acc, t) => {
    if (t.endTime && t.startTime) {
      return acc + (t.endTime - t.startTime);
    }
    return acc;
  }, 0);

  return (
    <div className={cn("mt-2", className)}>
      {/* Compact summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors w-full",
          "bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200",
          isExpanded && "bg-slate-200/80"
        )}
      >
        <Wrench className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-600 font-medium">
          {toolCalls.length} outil{toolCalls.length > 1 ? "s" : ""} utilisé
          {toolCalls.length > 1 ? "s" : ""}
        </span>

        {/* Status badges */}
        <div className="flex items-center gap-1.5 ml-auto">
          {successCount > 0 && (
            <span className="flex items-center gap-0.5 text-green-600">
              <CheckCircle2 className="w-3 h-3" />
              {successCount}
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-0.5 text-red-600">
              <XCircle className="w-3 h-3" />
              {errorCount}
            </span>
          )}
          {totalDuration > 0 && (
            <span className="flex items-center gap-0.5 text-slate-500">
              <Clock className="w-3 h-3" />
              {formatDuration(totalDuration)}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-slate-200">
              {toolCalls.map((tool, index) => {
                const info = getToolInfo(tool.toolName);
                const duration =
                  tool.endTime && tool.startTime
                    ? tool.endTime - tool.startTime
                    : 0;
                const isSuccess = tool.status === "success";
                const isError = tool.status === "error";

                return (
                  <motion.div
                    key={tool.id || index}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded text-xs",
                      isSuccess && "bg-green-50/50",
                      isError && "bg-red-50/50",
                      !isSuccess && !isError && "bg-slate-50/50"
                    )}
                  >
                    <span className="text-sm">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-700 truncate">
                          {info.displayName}
                        </span>
                        {tool.action && (
                          <span className="text-slate-400">
                            → {tool.action}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {duration > 0 && (
                        <span className="text-slate-400">
                          {formatDuration(duration)}
                        </span>
                      )}
                      {isSuccess && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      )}
                      {isError && (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Show errors if any */}
            {errorCount > 0 && (
              <div className="mt-2 space-y-1">
                {toolCalls
                  .filter((t) => t.status === "error" && t.error)
                  .map((tool, index) => {
                    const info = getToolInfo(tool.toolName);
                    return (
                      <div
                        key={`error-${tool.id || index}`}
                        className="px-2 py-1.5 rounded bg-red-50 border border-red-100 text-xs text-red-600"
                      >
                        <span className="font-medium">
                          {info.emoji} {info.displayName}:
                        </span>{" "}
                        {tool.error}
                      </div>
                    );
                  })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MessageToolHistory;
