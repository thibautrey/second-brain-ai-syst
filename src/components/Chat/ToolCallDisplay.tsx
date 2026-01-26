/**
 * Tool Call Display Component
 *
 * Elegant, modern display for tool calls in chat with animations
 * Shows only the latest tool call with smooth transitions
 */

import React, { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Wrench,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Tool call status types
export type ToolCallStatus = "pending" | "executing" | "success" | "error";

export interface ToolCall {
  id: string;
  toolName: string;
  action?: string;
  status: ToolCallStatus;
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
}

export interface ToolGenerationStep {
  phase:
    | "starting"
    | "checking"
    | "generating"
    | "executing"
    | "fixing"
    | "schema"
    | "saving"
    | "completed"
    | "error";
  message: string;
  iteration?: number;
  maxIterations?: number;
  details?: Record<string, any>;
}

interface ToolCallDisplayProps {
  toolCall: ToolCall | null;
  generationStep?: ToolGenerationStep | null;
  className?: string;
}

// Map tool names to friendly display names and emojis
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
};

// Get display info for a tool
function getToolInfo(toolName: string): {
  emoji: string;
  displayName: string;
  color: string;
} {
  const normalized = toolName.toLowerCase().replace(/[^a-z_]/g, "");
  return (
    TOOL_DISPLAY_INFO[normalized] || {
      emoji: "🔧",
      displayName: toolName,
      color: "text-slate-600",
    }
  );
}

// Status icon component
function StatusIcon({ status }: { status: ToolCallStatus }) {
  switch (status) {
    case "pending":
      return <Clock className="w-4 h-4 text-slate-400 animate-pulse" />;
    case "executing":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case "success":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-500" />;
  }
}

// Generation phase icon
function PhaseIcon({ phase }: { phase: ToolGenerationStep["phase"] }) {
  switch (phase) {
    case "starting":
      return <Zap className="w-4 h-4 text-yellow-500" />;
    case "checking":
      return <Clock className="w-4 h-4 text-blue-500" />;
    case "generating":
      return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />;
    case "executing":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case "fixing":
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case "schema":
      return <Wrench className="w-4 h-4 text-indigo-500" />;
    case "saving":
      return <Loader2 className="w-4 h-4 text-green-500 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-500" />;
  }
}

export function ToolCallDisplay({
  toolCall,
  generationStep,
  className,
}: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time for executing tools
  useEffect(() => {
    if (toolCall?.status === "executing") {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - toolCall.startTime);
      }, 100);
      return () => clearInterval(interval);
    } else if (toolCall?.endTime && toolCall?.startTime) {
      setElapsedTime(toolCall.endTime - toolCall.startTime);
    }
  }, [toolCall?.status, toolCall?.startTime, toolCall?.endTime]);

  // If we have a generation step, show that instead of regular tool call
  if (generationStep) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={generationStep.phase + (generationStep.iteration || 0)}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "rounded-lg border bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 p-3 shadow-sm",
            className,
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-100">
              <PhaseIcon phase={generationStep.phase} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-pink-700">
                  ✨ Génération d'outil
                </span>
                {generationStep.iteration && generationStep.maxIterations && (
                  <span className="text-xs text-pink-500 bg-pink-100 px-2 py-0.5 rounded-full">
                    {generationStep.iteration}/{generationStep.maxIterations}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 truncate">
                {generationStep.message}
              </p>
            </div>
            {generationStep.phase === "completed" && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </motion.div>
            )}
          </div>

          {/* Progress bar for iterative phases */}
          {generationStep.iteration &&
            generationStep.maxIterations &&
            generationStep.phase !== "completed" &&
            generationStep.phase !== "error" && (
              <div className="mt-2">
                <div className="w-full bg-pink-200 rounded-full h-1.5">
                  <motion.div
                    className="bg-pink-500 h-1.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(generationStep.iteration / generationStep.maxIterations) * 100}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!toolCall) return null;

  const toolInfo = getToolInfo(toolCall.toolName);
  const isExecuting = toolCall.status === "executing";
  const hasResult = toolCall.status === "success" && toolCall.result;
  const hasError = toolCall.status === "error";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={toolCall.id}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "rounded-lg border bg-slate-50 p-3 shadow-sm transition-colors",
          isExecuting && "border-blue-200 bg-blue-50/50",
          hasResult && "border-green-200 bg-green-50/50",
          hasError && "border-red-200 bg-red-50/50",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full",
              isExecuting && "bg-blue-100",
              hasResult && "bg-green-100",
              hasError && "bg-red-100",
              !isExecuting && !hasResult && !hasError && "bg-slate-100",
            )}
          >
            <span className="text-base">{toolInfo.emoji}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium", toolInfo.color)}>
                {toolInfo.displayName}
              </span>
              {toolCall.action && (
                <span className="text-xs text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                  {toolCall.action}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <StatusIcon status={toolCall.status} />
              <span>
                {isExecuting
                  ? `En cours... ${(elapsedTime / 1000).toFixed(1)}s`
                  : toolCall.status === "success"
                    ? `Terminé en ${(elapsedTime / 1000).toFixed(1)}s`
                    : toolCall.status === "error"
                      ? "Échec"
                      : "En attente"}
              </span>
            </div>
          </div>

          {/* Expand button for results */}
          {(hasResult || hasError) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-slate-200 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>
          )}
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-slate-200">
                {hasError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {toolCall.error}
                  </div>
                )}
                {hasResult && (
                  <pre className="text-xs text-slate-600 bg-slate-100 p-2 rounded overflow-x-auto max-h-40">
                    {typeof toolCall.result === "string"
                      ? toolCall.result
                      : JSON.stringify(toolCall.result, null, 2)}
                  </pre>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

export default ToolCallDisplay;
