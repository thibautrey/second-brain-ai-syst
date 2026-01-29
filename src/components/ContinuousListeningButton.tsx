/**
 * Continuous Listening Button Component
 *
 * Main toggle button for starting/stopping continuous listening.
 * Shows visual feedback for VAD, speaker identification, and processing state.
 */

import React from "react";
import {
  Mic,
  MicOff,
  Radio,
  AlertCircle,
  User,
  Users,
  Volume2,
} from "lucide-react";
import { Button } from "./ui/button";
import { useContinuousListening } from "../contexts/ContinuousListeningContext";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

interface ContinuousListeningButtonProps {
  className?: string;
  showStatus?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ContinuousListeningButton({
  className,
  showStatus = true,
  size = "md",
}: ContinuousListeningButtonProps) {
  const { state, actions } = useContinuousListening();
  const { t } = useTranslation();

  const handleClick = () => {
    if (state.isConnected) {
      actions.stopListening();
    } else {
      actions.startListening();
    }
  };

  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  };

  const getStateColor = () => {
    if (state.state === "error") return "bg-red-500 hover:bg-red-600";
    if (!state.isConnected) return "bg-slate-400 hover:bg-slate-500";
    if (state.isSpeechDetected) return "bg-green-500 hover:bg-green-600";
    return "bg-blue-500 hover:bg-blue-600";
  };

  const getIcon = () => {
    if (state.state === "error")
      return <AlertCircle className={iconSizes[size]} />;
    if (state.state === "connecting")
      return <Radio className={cn(iconSizes[size], "animate-pulse")} />;
    if (state.isConnected) return <Mic className={iconSizes[size]} />;
    return <MicOff className={iconSizes[size]} />;
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {/* Main Button */}
      <Button
        onClick={handleClick}
        disabled={state.state === "connecting"}
        className={cn(
          sizeClasses[size],
          "rounded-full p-0 transition-all duration-200",
          getStateColor(),
          state.isSpeechDetected &&
            state.isConnected &&
            "ring-4 ring-green-300 ring-opacity-50",
        )}
        aria-label={
          state.isConnected
            ? t("continuousListening.aria.stopListening")
            : t("continuousListening.aria.startListening")
        }
      >
        {getIcon()}
      </Button>

      {/* Status Indicators */}
      {showStatus && state.isConnected && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          {/* Audio Level Indicator */}
          <div className="flex items-center gap-1">
            <Volume2 className="w-3 h-3" />
            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-100",
                  state.isSpeechDetected ? "bg-green-500" : "bg-blue-400",
                )}
                style={{ width: `${Math.min(100, state.audioLevel / 10)}%` }}
              />
            </div>
          </div>

          {/* Speaker Indicator */}
          <div className="flex items-center gap-1">
            {state.speakerStatus === "user" && (
              <User className="w-3 h-3 text-green-600" />
            )}
            {state.speakerStatus === "other" && (
              <Users className="w-3 h-3 text-orange-500" />
            )}
            {state.speakerStatus === "unknown" && (
              <User className="w-3 h-3 text-slate-400" />
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {state.error && (
        <p className="text-xs text-red-500 text-center max-w-32">
          {state.error}
        </p>
      )}
    </div>
  );
}

/**
 * Compact inline version for header/navigation
 */
export function ContinuousListeningToggle({
  className,
}: {
  className?: string;
}) {
  const { state, actions } = useContinuousListening();

  const handleClick = () => {
    if (state.isConnected) {
      actions.stopListening();
    } else {
      actions.startListening();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={state.state === "connecting"}
      className={cn(
        "relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
        state.isConnected
          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        state.state === "connecting" && "opacity-50 cursor-wait",
        className,
      )}
      aria-label={
        state.isConnected
          ? t("continuousListening.aria.stopListeningShort")
          : t("continuousListening.aria.startListeningShort")
      }
    >
      {state.isConnected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                state.isSpeechDetected
                  ? "bg-green-400 animate-ping"
                  : "bg-blue-400",
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                state.isSpeechDetected ? "bg-green-500" : "bg-blue-500",
              )}
            />
          </span>
          <span>{t("continuousListening.toggle.active")}</span>
        </>
      ) : (
        <>
          <MicOff className="w-4 h-4" />
          <span>{t("continuousListening.toggle.inactive")}</span>
        </>
      )}
    </button>
  );
}
