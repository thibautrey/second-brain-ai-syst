/**
 * Continuous Listening Panel Component
 *
 * Full control panel showing listening state, transcript preview,
 * and recent activity.
 */

import React, { useState } from "react";
import {
  Mic,
  MicOff,
  Settings,
  Volume2,
  User,
  Users,
  MessageSquare,
  Brain,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Button } from "./ui/button";
import { useContinuousListening } from "../contexts/ContinuousListeningContext";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

interface ContinuousListeningPanelProps {
  className?: string;
  onOpenSettings?: () => void;
}

export function ContinuousListeningPanel({
  className,
  onOpenSettings,
}: ContinuousListeningPanelProps) {
  const { state, settings, actions } = useContinuousListening();
  const { t } = useTranslation();
  const [showHistory, setShowHistory] = useState(false);

  const handleToggle = () => {
    if (state.isConnected) {
      actions.stopListening();
    } else {
      actions.startListening();
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              {t("continuousListening.panel.title")}
            </CardTitle>
            <CardDescription>
              {state.isConnected
                ? t("continuousListening.panel.connectedDescription")
                : t("continuousListening.panel.disconnectedDescription")}
            </CardDescription>
          </div>
          {onOpenSettings && (
            <Button variant="ghost" size="sm" onClick={onOpenSettings}>
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Control */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-4">
            {/* Big Toggle Button */}
            <Button
              onClick={handleToggle}
              disabled={state.state === "connecting"}
              size="lg"
              className={cn(
                "w-16 h-16 rounded-full p-0 transition-all duration-300",
                state.isConnected
                  ? state.isSpeechDetected
                    ? "bg-green-500 hover:bg-green-600 ring-4 ring-green-200"
                    : "bg-blue-500 hover:bg-blue-600"
                  : "bg-slate-400 hover:bg-slate-500",
                state.state === "connecting" && "animate-pulse",
              )}
            >
              {state.isConnected ? (
                <Mic className="w-7 h-7" />
              ) : (
                <MicOff className="w-7 h-7" />
              )}
            </Button>

            {/* Status Text */}
            <div>
              <p className="font-medium text-slate-900">
                {state.state === "connecting" &&
                  t("continuousListening.state.connecting")}
                {state.state === "listening" &&
                  t("continuousListening.state.listening")}
                {state.state === "processing" &&
                  t("continuousListening.state.processing")}
                {state.state === "idle" && t("continuousListening.state.idle")}
                {state.state === "error" &&
                  t("continuousListening.state.error")}
              </p>
              <p className="text-sm text-slate-500">
                {state.isConnected
                  ? t("continuousListening.wakeWordLabel", {
                      word: settings?.wakeWord || "Hey Brain",
                    })
                  : t("continuousListening.clickToActivate")}
              </p>
            </div>
          </div>

          {/* Audio Level Meter */}
          {state.isConnected && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-75",
                      state.isSpeechDetected ? "bg-green-500" : "bg-blue-400",
                    )}
                    style={{ width: `${Math.min(100, state.audioLevel / 5)}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-slate-400">
                {state.isSpeechDetected
                  ? t("continuousListening.audio.speechDetected")
                  : t("continuousListening.audio.silence")}
              </span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        )}

        {/* Live Transcript */}
        {state.isConnected && state.currentTranscript && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-700 mb-1">
                  {t("continuousListening.transcriptTitle")}
                </p>
                <p className="text-sm text-blue-900">
                  {state.currentTranscript}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Speaker Status */}
        {state.isConnected && state.speakerStatus !== "unknown" && (
          <div
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg",
              state.speakerStatus === "user"
                ? "bg-green-50 border border-green-200"
                : "bg-orange-50 border border-orange-200",
            )}
          >
            {state.speakerStatus === "user" ? (
              <>
                <User className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">
                  {t("continuousListening.speaker.user", {
                    percent: (state.speakerConfidence * 100).toFixed(0),
                  })}
                </span>
              </>
            ) : (
              <>
                <Users className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-orange-700">
                  {t("continuousListening.speaker.other")}
                </span>
              </>
            )}
          </div>
        )}

        {/* Recent Activity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-700">
              {t("continuousListening.recentActivity.title")}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory
                ? t("continuousListening.recentActivity.hide")
                : t("continuousListening.recentActivity.showMore")}
            </Button>
          </div>

          {/* Last Command */}
          {state.lastCommand && (
            <div className="flex items-start gap-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
              <Brain className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-purple-700">
                  {t("continuousListening.recentActivity.commandDetected")}
                </p>
                <p className="text-sm text-purple-900 truncate">
                  {state.lastCommand.text}
                </p>
              </div>
              <CheckCircle className="w-4 h-4 text-purple-500 shrink-0" />
            </div>
          )}

          {/* Last Memory */}
          {state.lastMemory && (
            <div className="flex items-start gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <MessageSquare className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-700">
                  {t("continuousListening.recentActivity.memoryRecorded")}
                </p>
                <p className="text-sm text-emerald-900 truncate">
                  {state.lastMemory.text}
                </p>
              </div>
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
          )}

          {/* No activity */}
          {!state.lastCommand && !state.lastMemory && (
            <div className="flex items-center justify-center p-4 text-slate-400">
              <Clock className="w-4 h-4 mr-2" />
              <span className="text-sm">
                {t("continuousListening.recentActivity.none")}
              </span>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="flex items-center justify-around p-3 bg-slate-50 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">
              {state.sessionsCount}
            </p>
            <p className="text-xs text-slate-500">
              {t("continuousListening.stats.sessions")}
            </p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {state.memoriesStoredCount}
            </p>
            <p className="text-xs text-slate-500">
              {t("continuousListening.stats.memories")}
            </p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {state.commandsDetectedCount}
            </p>
            <p className="text-xs text-slate-500">
              {t("continuousListening.stats.commands")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
