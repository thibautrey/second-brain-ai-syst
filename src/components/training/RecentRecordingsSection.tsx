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
        err instanceof Error ? err.message : "Failed to load recordings",
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
      await trainingAPI.reclassifyRecording(
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
        }));
      } else {
        setStats((prev) => ({
          ...prev,
          totalPositives: Math.max(0, prev.totalPositives - 1),
          totalNegatives: prev.totalNegatives + 1,
        }));
      }
      onRefreshProfile?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reclassify recording",
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
    if (
      !window.confirm(
        "Are you sure you want to clear all negative examples? This will reset the system's learning about other speakers.",
      )
    ) {
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
          : "Failed to clear negative examples",
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

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Volume2 className="w-5 h-5 text-blue-600" />
              Recent Audio Classifications
            </CardTitle>
            <CardDescription>
              Review and correct speaker classifications from continuous
              listening
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
              Refresh
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
                Clear All Others
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
              <p className="text-sm font-medium text-emerald-900">Your Voice</p>
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
              <p className="text-sm font-medium text-slate-700">Others</p>
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
            <p className="mb-1 font-medium">Why review these?</p>
            <p className="text-blue-700">
              If the system incorrectly classified your voice as "someone else",
              it will avoid matching similar audio in the future. Correcting
              these helps improve accuracy.
            </p>
          </div>
        </div>

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
            <p className="text-slate-500">No recent audio classifications</p>
            <p className="mt-1 text-sm text-slate-400">
              Audio from continuous listening will appear here
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

      // Try to get audio from source session
      let audioUrl = "";
      if (recording.sourceSessionId) {
        // Fetch audio from the session
        audioUrl = `${API_BASE_URL}/api/conversations/sessions/${recording.sourceSessionId}/audio`;
      }

      if (!audioUrl) {
        setAudioError(
          "Audio source not available for this recording. Original session data may have been archived.",
        );
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
          `Failed to load audio: ${response.status} ${response.statusText}`,
        );
      }

      const blob = await response.blob();

      // Check if blob is valid audio
      if (!blob.type.startsWith("audio/")) {
        throw new Error(
          "Received data is not audio format. The audio file may have been deleted or corrupted.",
        );
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
        setAudioError("Failed to play audio. The file may be corrupted.");
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl_blob);
      });

      audio.play();
      setIsPlaying(true);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to load audio";
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
              {isNegative ? "Classified as Other" : "Your Voice"}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-xs text-slate-500">
                    {confidencePercent}% confidence
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The system is {confidencePercent}% confident this
                    classification is correct
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
                  {audioError ? "No audio" : isPlaying ? "Stop" : "Play"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {audioError
                  ? audioError
                  : isPlaying
                    ? "Stop playback"
                    : "Play audio"}
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
                  <span className="hidden sm:inline">That's me</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark this as your voice</p>
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
                  <span className="hidden sm:inline">Not me</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark this as someone else's voice</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

export default RecentRecordingsSection;
