/**
 * ThinkingIndicator Component
 *
 * Displays AI reasoning/thinking content in real-time
 * Used when models like Claude, GPT-5 are using their reasoning capabilities
 */

import { AnimatePresence, motion } from "framer-motion";
import { Brain, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { ThinkingData } from "../../types/chat";
import { cn } from "../../lib/utils";

interface ThinkingIndicatorProps {
  thinking: ThinkingData;
  className?: string;
  /** Whether to show the full thinking content expanded by default */
  defaultExpanded?: boolean;
  /** Max height when collapsed (in pixels) */
  collapsedMaxHeight?: number;
}

export function ThinkingIndicator({
  thinking,
  className,
  defaultExpanded = false,
  collapsedMaxHeight = 100,
}: ThinkingIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [shouldShowExpand, setShouldShowExpand] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if content is long enough to need expand/collapse
  useEffect(() => {
    if (contentRef.current) {
      setShouldShowExpand(contentRef.current.scrollHeight > collapsedMaxHeight);
    }
  }, [thinking.content, collapsedMaxHeight]);

  if (!thinking.content && !thinking.isActive) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "rounded-lg border bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-violet-100/50 border-b border-violet-200">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Brain className="w-4 h-4 text-violet-600" />
            {thinking.isActive && (
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2 h-2"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Sparkles className="w-2 h-2 text-violet-500" />
              </motion.div>
            )}
          </div>
          <span className="text-xs font-medium text-violet-700">
            {thinking.isActive ? "Réflexion en cours..." : "Raisonnement"}
          </span>
        </div>

        {shouldShowExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 transition-colors"
          >
            {isExpanded ? (
              <>
                <span>Réduire</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>Voir tout</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <motion.div
        ref={contentRef}
        className={cn(
          "px-3 py-2 text-xs text-violet-800 leading-relaxed overflow-hidden",
          !isExpanded && "relative",
        )}
        style={{
          maxHeight: isExpanded ? "none" : `${collapsedMaxHeight}px`,
        }}
        animate={{
          maxHeight: isExpanded ? 500 : collapsedMaxHeight,
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Streaming animation for active thinking */}
        {thinking.isActive && (
          <motion.span
            className="inline-block w-1 h-3 bg-violet-500 ml-0.5"
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}

        {/* Thinking content with proper formatting */}
        <div className="whitespace-pre-wrap font-mono">
          {thinking.content || (
            <span className="text-violet-400 italic">
              L'IA réfléchit à votre question...
            </span>
          )}
        </div>

        {/* Fade overlay when collapsed */}
        {!isExpanded && shouldShowExpand && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-violet-50 to-transparent pointer-events-none" />
        )}
      </motion.div>

      {/* Active indicator bar */}
      {thinking.isActive && (
        <motion.div
          className="h-0.5 bg-gradient-to-r from-violet-400 via-purple-500 to-violet-400"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 2,
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
 * Compact thinking indicator for inline display
 */
export function ThinkingIndicatorCompact({
  isActive,
  className,
}: {
  isActive: boolean;
  className?: string;
}) {
  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-700",
        className,
      )}
    >
      <div className="relative">
        <Brain className="w-4 h-4" />
        <motion.div
          className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-violet-500 rounded-full"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
      </div>
      <span className="text-xs font-medium">Réflexion...</span>
    </motion.div>
  );
}

export default ThinkingIndicator;
