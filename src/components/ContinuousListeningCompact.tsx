/**
 * Continuous Listening Compact Button
 *
 * Ultra-minimal icon + status indicator for top bar
 * Option A: Just icon with colored dot
 */

import React from "react";
import { Mic, MicOff } from "lucide-react";
import { useContinuousListening } from "../contexts/ContinuousListeningContext";
import { cn } from "../lib/utils";

export function ContinuousListeningCompact() {
  const { state, actions } = useContinuousListening();

  const handleClick = () => {
    if (state.isConnected) {
      actions.stopListening();
    } else {
      actions.startListening();
    }
  };

  // Determine the status dot color
  const getStatusDotColor = () => {
    if (state.state === "error") return "bg-red-500";
    if (state.state === "connecting") return "bg-yellow-500 animate-pulse";
    if (state.isSpeechDetected) return "bg-green-500";
    if (state.isConnected) return "bg-blue-500";
    return "bg-slate-400";
  };

  return (
    <button
      onClick={handleClick}
      disabled={state.state === "connecting"}
      className={cn(
        "relative p-2 rounded-lg transition-colors",
        state.isConnected
          ? "hover:bg-blue-50 text-blue-600"
          : "hover:bg-slate-100 text-slate-600",
        state.state === "connecting" && "cursor-wait opacity-60",
      )}
      aria-label={state.isConnected ? "Arrêter l'écoute" : "Démarrer l'écoute"}
      title={
        state.isConnected
          ? "Écoute active - Cliquez pour arrêter"
          : "Cliquez pour activer l'écoute"
      }
    >
      {/* Icon */}
      {state.isConnected ? (
        <Mic className="w-5 h-5" />
      ) : (
        <MicOff className="w-5 h-5" />
      )}

      {/* Status Indicator Dot */}
      <span
        className={cn(
          "absolute top-1 right-1 w-2 h-2 rounded-full transition-colors",
          getStatusDotColor(),
        )}
      />
    </button>
  );
}
