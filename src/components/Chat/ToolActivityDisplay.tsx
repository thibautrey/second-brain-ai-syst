/**
 * Tool Activity Display Component
 *
 * Shows real-time tool execution activity during chat processing
 * Displays all active tools with their status and a thinking indicator
 */

import React from "react";
import { cn } from "../../lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Brain,
  Wrench,
  Clock,
  Zap,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ToolCallData, ToolGenerationStepData } from "../../types/chat";

interface ToolActivityDisplayProps {
  activeToolCalls: ToolCallData[];
  currentToolGeneration: ToolGenerationStepData | null;
  thinkingPhase: string | null;
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
  memory: { emoji: "🧠", displayName: "Mémoire", color: "text-violet-600" },
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

function MiniToolStatus({ tool }: { tool: ToolCallData }) {
  const info = getToolInfo(tool.toolName);
  const isExecuting = tool.status === "executing";
  const isSuccess = tool.status === "success";
  const isError = tool.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        isExecuting && "bg-blue-100 text-blue-700",
        isSuccess && "bg-green-100 text-green-700",
        isError && "bg-red-100 text-red-700",
        !isExecuting && !isSuccess && !isError && "bg-slate-100 text-slate-600"
      )}
    >
      <span>{info.emoji}</span>
      <span className="max-w-[100px] truncate">{info.displayName}</span>
      {isExecuting && <Loader2 className="w-3 h-3 animate-spin" />}
      {isSuccess && <CheckCircle2 className="w-3 h-3" />}
      {isError && <XCircle className="w-3 h-3" />}
    </motion.div>
  );
}

function GenerationProgress({ step }: { step: ToolGenerationStepData }) {
  const phaseLabels: Record<ToolGenerationStepData["phase"], string> = {
    starting: "Démarrage",
    checking: "Vérification",
    generating: "Génération",
    executing: "Exécution",
    fixing: "Correction",
    schema: "Schéma",
    saving: "Sauvegarde",
    completed: "Terminé",
    error: "Erreur",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200"
    >
      <Zap className="w-4 h-4 text-pink-500" />
      <span className="text-xs font-medium text-pink-700">
        {phaseLabels[step.phase]}
      </span>
      {step.iteration && step.maxIterations && (
        <span className="text-xs text-pink-500">
          ({step.iteration}/{step.maxIterations})
        </span>
      )}
      {step.phase !== "completed" && step.phase !== "error" && (
        <Loader2 className="w-3 h-3 animate-spin text-pink-500" />
      )}
    </motion.div>
  );
}

export function ToolActivityDisplay({
  activeToolCalls,
  currentToolGeneration,
  thinkingPhase,
  className,
}: ToolActivityDisplayProps) {
  const hasActivity =
    activeToolCalls.length > 0 || currentToolGeneration || thinkingPhase;

  if (!hasActivity) return null;

  const executingTools = activeToolCalls.filter(
    (t) => t.status === "executing"
  );
  const completedTools = activeToolCalls.filter(
    (t) => t.status === "success" || t.status === "error"
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "rounded-xl border bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200 p-3 shadow-sm",
        className
      )}
    >
      {/* Thinking indicator */}
      {thinkingPhase && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 mb-2"
        >
          <div className="relative">
            <Brain className="w-5 h-5 text-blue-600" />
            <motion.div
              className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          </div>
          <span className="text-sm text-slate-600">{thinkingPhase}</span>
        </motion.div>
      )}

      {/* Tool generation progress */}
      {currentToolGeneration && (
        <div className="mb-2">
          <GenerationProgress step={currentToolGeneration} />
        </div>
      )}

      {/* Active tool calls */}
      {activeToolCalls.length > 0 && (
        <div className="space-y-2">
          {/* Currently executing */}
          {executingTools.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence mode="popLayout">
                {executingTools.map((tool) => (
                  <MiniToolStatus key={tool.id} tool={tool} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Completed tools (show as compact summary) */}
          {completedTools.length > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                {completedTools.filter((t) => t.status === "success").length}{" "}
                outil(s) terminé(s)
              </span>
              <div className="flex gap-1">
                {completedTools.slice(-3).map((tool) => {
                  const info = getToolInfo(tool.toolName);
                  return (
                    <span
                      key={tool.id}
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-xs",
                        tool.status === "success"
                          ? "bg-green-100"
                          : "bg-red-100"
                      )}
                      title={`${info.displayName}: ${tool.status}`}
                    >
                      {info.emoji}
                    </span>
                  );
                })}
                {completedTools.length > 3 && (
                  <span className="text-xs text-slate-400">
                    +{completedTools.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default ToolActivityDisplay;
