import * as trainingAPI from "../../services/training-api";

import {
  AlertCircle,
  CheckCircle,
  Clock,
  HelpCircle,
  Play,
  RefreshCw,
  Trash2,
  User,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";

interface RecentRecordingsSectionProps {
  speakerProfileId?: string;
  onRefreshProfile?: () => void;
}

export function RecentRecordingsSection({
  speakerProfileId,
  onRefreshProfile,
}: RecentRecordingsSectionProps) {
  const { t } = useTranslation();
  const [recordings, setRecordings] = useState<trainingAPI.RecentRecording[]>(
    [],
  );
  const [stats, setStats] = useState<{
    totalNegatives: number;
    totalPositives: number;
  }>({ totalNegatives: 0, totalPositives: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadRecordings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await trainingAPI.getRecentRecordings(
        speakerProfileId,
        50,
      );
      setRecordings(response.recordings);
      setStats(response.stats);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("training.recentRecordings.errors.load"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [speakerProfileId]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  const handleReclassify = async (
    recordingId: string,
    newClassification: "user" | "other",
  ) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(recordingId));
      setSuccessMessage(null);

      const result = await trainingAPI.reclassifyRecording(
        recordingId,
        newClassification,
        speakerProfileId,
      );

      // Remove from local state
      setRecordings((prev) => prev.filter((r) => r.id !== recordingId));

      // Update stats
      if (newClassification === "user") {
        setStats((prev) => ({
          ...prev,
          totalNegatives: Math.max(0, prev.totalNegatives - 1),
          // Increment positives if a voice sample was created
          totalPositives: result.voiceSampleCreated
            ? prev.totalPositives + 1
            : prev.totalPositives,
        }));

        // Show success message if retraining was triggered
        if (result.retrainingTriggered) {
          setSuccessMessage(t("training.recentRecordings.retrainingTriggered"));
        } else if (result.voiceSampleCreated) {
          setSuccessMessage(t("training.recentRecordings.sampleAdded"));
        }
      } else {
        setStats((prev) => ({
          ...prev,
          totalPositives: Math.max(0, prev.totalPositives - 1),
          totalNegatives: prev.totalNegatives + 1,
        }));

        // Show message if retraining was triggered for "other" classification
        if (result.retrainingTriggered) {
          setSuccessMessage(t("training.recentRecordings.retrainingTriggered"));
        }
      }

      onRefreshProfile?.();

      // Clear success message after 5 seconds
      if (result.retrainingTriggered || result.voiceSampleCreated) {
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("training.recentRecordings.errors.reclassify"),
      );
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(recordingId);
        return next;
      });
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(t("training.recentRecordings.confirmClearAll"))) {
      return;
    }

    try {
      setIsClearingAll(true);
      await trainingAPI.clearAllNegatives();
      setRecordings((prev) =>
        prev.filter((r) => r.type !== "negative_example"),
      );
      setStats((prev) => ({ ...prev, totalNegatives: 0 }));
      onRefreshProfile?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("training.recentRecordings.errors.clearAll"),
      );
    } finally {
      setIsClearingAll(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t("timeAgo.justNow");
    if (diffMins < 60) return t("timeAgo.minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("timeAgo.hoursAgo", { count: diffHours });
    if (diffDays < 7) return t("timeAgo.daysAgo", { count: diffDays });
    return date.toLocaleDateString();
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Volume2 className="w-5 h-5 text-blue-600" />
              {t("training.recentRecordings.title")}
            </CardTitle>
            <CardDescription>
              {t("training.recentRecordings.subtitle")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadRecordings}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
              />
              {t("common.refresh")}
            </Button>
            {stats.totalNegatives > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={isClearingAll}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                {t("training.recentRecordings.clearAllOthers")}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-emerald-50 border-emerald-200">
            <div className="p-2 rounded-full bg-emerald-100">
              <User className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-900">
                {t("training.recentRecordings.stats.yourVoice")}
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {stats.totalPositives}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50 border-slate-200">
            <div className="p-2 rounded-full bg-slate-100">
              <Users className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {t("training.recentRecordings.stats.others")}
              </p>
              <p className="text-2xl font-bold text-slate-600">
                {stats.totalNegatives}
              </p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-3 mb-4 border border-blue-200 rounded-lg bg-blue-50">
          <HelpCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="mb-1 font-medium">
              {t("training.recentRecordings.whyReviewTitle")}
            </p>
            <p className="text-blue-700">
              {t("training.recentRecordings.whyReviewDescription")}
            </p>
          </div>
        </div>

        {/* Success Message Display */}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 mb-4 duration-300 border rounded-lg text-emerald-700 border-emerald-200 bg-emerald-50 animate-in slide-in-from-top-2">
            <Zap className="w-5 h-5" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 text-red-700 border border-red-200 rounded-lg bg-red-50">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Recordings List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="py-12 text-center">
            <Volume2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">
              {t("training.recentRecordings.emptyTitle")}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {t("training.recentRecordings.emptyDescription")}
            </p>
          </div>
        ) : (
          <div className="pr-2 space-y-2 overflow-y-auto max-h-96">
            {recordings.map((recording) => (
              <RecordingItem
                key={recording.id}
                recording={recording}
                onReclassify={handleReclassify}
                isProcessing={processingIds.has(recording.id)}
                formatTimeAgo={formatTimeAgo}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RecordingItemProps {
  recording: trainingAPI.RecentRecording;
  onReclassify: (id: string, classification: "user" | "other") => void;
  isProcessing: boolean;
  formatTimeAgo: (date: string) => string;
}

function RecordingItem({
  recording,
  onReclassify,
  isProcessing,
  formatTimeAgo,
}: RecordingItemProps) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isNegative = recording.type === "negative_example";
  const confidencePercent = Math.round(recording.confidence * 100);

  const handlePlayAudio = async () => {
    // Clear any previous errors
    setAudioError(null);

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    // If audio element doesn't exist yet, create it
    try {
      setIsLoadingAudio(true);

      const API_BASE_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3000";

      // Determine the correct endpoint based on recording type
      let audioUrl = "";
      if (recording.type === "negative_example") {
        audioUrl = `${API_BASE_URL}/api/adaptive-learning/negative-examples/${recording.id}/audio`;
      } else if (recording.type === "adaptive_sample") {
        audioUrl = `${API_BASE_URL}/api/adaptive-learning/adaptive-samples/${recording.id}/audio`;
      }

      if (!audioUrl) {
        setAudioError(t("training.recentRecordings.audio.sourceUnavailable"));
        setIsLoadingAudio(false);
        return;
      }

      // First check if the URL returns valid audio data
      const response = await fetch(audioUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          t("training.recentRecordings.audio.loadFailedWithStatus", {
            status: response.status,
            statusText: response.statusText,
          }),
        );
      }

      const blob = await response.blob();

      // Check if blob is valid audio
      if (!blob.type.startsWith("audio/")) {
        throw new Error(t("training.recentRecordings.audio.invalidFormat"));
      }

      const audioUrl_blob = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl_blob);
      audioRef.current = audio;

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        // Clean up blob URL when done
        URL.revokeObjectURL(audioUrl_blob);
      });

      audio.addEventListener("error", () => {
        setAudioError(t("training.recentRecordings.audio.playFailed"));
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl_blob);
      });

      audio.play();
      setIsPlaying(true);
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : t("training.recentRecordings.audio.loadFailed");
      setAudioError(errorMsg);
      console.error("Failed to play audio:", error);
      setIsPlaying(false);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors",
        isNegative
          ? "bg-slate-50 border-slate-200 hover:bg-slate-100"
          : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
      )}
    >
      <div className="flex items-center flex-1 min-w-0 gap-3">
        {/* Icon */}
        <div
          className={cn(
            "p-2 rounded-full shrink-0",
            isNegative ? "bg-slate-200" : "bg-emerald-200",
          )}
        >
          {isNegative ? (
            <Users className="w-4 h-4 text-slate-600" />
          ) : (
            <User className="w-4 h-4 text-emerald-600" />
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge
              variant={isNegative ? "secondary" : "default"}
              className={cn(
                "text-xs",
                isNegative
                  ? "bg-slate-200 text-slate-700 hover:bg-slate-200"
                  : "bg-emerald-200 text-emerald-700 hover:bg-emerald-200",
              )}
            >
              {isNegative
                ? t("training.recentRecordings.badge.other")
                : t("training.recentRecordings.badge.yourVoice")}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-xs text-slate-500">
                    {t("training.recentRecordings.confidenceLabel", {
                      percent: confidencePercent,
                    })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {t("training.recentRecordings.confidenceHint", {
                      percent: confidencePercent,
                    })}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{formatTimeAgo(recording.capturedAt)}</span>
            {recording.duration && (
              <>
                <span>•</span>
                <span>{recording.duration.toFixed(1)}s</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 ml-3 shrink-0">
        {/* Play Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayAudio}
                disabled={isProcessing || isLoadingAudio || !!audioError}
                className={cn(
                  "gap-1.5 bg-white",
                  audioError
                    ? "hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                    : "hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300",
                )}
              >
                {isLoadingAudio ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : audioError ? (
                  <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                ) : isPlaying ? (
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-3 bg-blue-600 rounded"></div>
                    <div className="w-1 h-4 bg-blue-600 rounded"></div>
                    <div className="w-1 h-3 bg-blue-600 rounded"></div>
                  </div>
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                <span className="hidden sm:inline">
                  {audioError
                    ? t("training.recentRecordings.audio.noAudio")
                    : isPlaying
                      ? t("training.recentRecordings.audio.stop")
                      : t("training.recentRecordings.audio.play")}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {audioError
                  ? audioError
                  : isPlaying
                    ? t("training.recentRecordings.audio.stopPlayback")
                    : t("training.recentRecordings.audio.playAudio")}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isNegative ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReclassify(recording.id, "user")}
                  disabled={isProcessing}
                  className="gap-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {t("training.recentRecordings.actions.thatsMe")}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("training.recentRecordings.actions.markAsUser")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReclassify(recording.id, "other")}
                  disabled={isProcessing}
                  className="gap-1.5 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Users className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {t("training.recentRecordings.actions.notMe")}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("training.recentRecordings.actions.markAsOther")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

export default RecentRecordingsSection;
