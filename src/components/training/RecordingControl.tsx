import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Square, Volume2 } from "lucide-react";
import { Button } from "../ui/button";
import { PCMAudioRecorder } from "../../utils/pcm-audio-recorder";

interface RecordingControlProps {
  phrase: string;
  category: string;
  isRecording: boolean;
  onStart: () => void;
  onStop: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  disabled?: boolean;
  autoStopOnSilence?: boolean;
}

export function RecordingControl({
  phrase,
  category,
  isRecording,
  onStart,
  onStop,
  onCancel,
  disabled,
  autoStopOnSilence = false,
}: RecordingControlProps) {
  const { t } = useTranslation();
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const recorderRef = useRef<PCMAudioRecorder | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;

    timerIntervalRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  const handleStart = async () => {
    try {
      // Create PCM recorder with same format as continuous listening
      recorderRef.current = new PCMAudioRecorder({
        sampleRate: 16000,
        onAudioLevel: (level) => setAudioLevel(level),
        onSilenceDetected: autoStopOnSilence ? handleStop : undefined,
        silenceThreshold: 0.01,
        silenceDurationMs: 1500,
      });

      await recorderRef.current.start();
      setRecordingTime(0);
      setAudioLevel(0);
      onStart();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert(t("training.recordingControl.errors.microphoneAccess"));
    }
  };

  const handleStop = () => {
    if (recorderRef.current && isRecording) {
      try {
        const result = recorderRef.current.stop();
        // Use WAV blob which contains PCM16 data
        onStop(result.wavBlob, result.duration);
      } catch (error) {
        console.error("Error stopping recording:", error);
      }

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      setRecordingTime(0);
      setAudioLevel(0);
      recorderRef.current = null;
    }
  };

  const handleCancel = () => {
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    setRecordingTime(0);
    setAudioLevel(0);
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-6 space-y-6 bg-white border rounded-lg border-slate-200">
      {/* Phrase Display */}
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          {t("training.recordingControl.readPhrase")}
        </p>
        <div className="p-4 border-2 border-blue-200 rounded-lg bg-linear-to-r from-blue-50 to-indigo-50">
          <p className="text-2xl font-bold text-slate-900">"{phrase}"</p>
          <p className="mt-2 text-xs text-slate-600">
            {t("training.recordingControl.categoryLabel")}{" "}
            <span className="font-medium">
              {t(
                `training.recordSamples.categories.${category.toLowerCase()}`,
                category,
              )}
            </span>
          </p>
        </div>
      </div>

      {/* Audio Level Monitor */}
      {isRecording && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <Volume2 className="w-4 h-4" />
              {t("training.recordingControl.audioLevel")}
            </p>
            <p className="text-xs text-slate-600">{Math.round(audioLevel)}%</p>
          </div>
          <div className="w-full h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full transition-all duration-75 bg-linear-to-r from-green-500 to-blue-500"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          {audioLevel < 20 && (
            <p className="flex items-center gap-1 text-xs text-amber-600">
              {t("training.recordingControl.lowVolumeWarning")}
            </p>
          )}
        </div>
      )}

      {/* Timer Display */}
      <div className="text-center">
        <p className="mb-1 text-xs text-slate-600">
          {t("training.recordingControl.recordingTime")}
        </p>
        <p
          className={`text-5xl font-bold font-mono ${
            isRecording ? "text-red-600 animate-pulse" : "text-slate-900"
          }`}
        >
          {formatTime(recordingTime)}
        </p>
      </div>

      {/* Recording Status */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-red-600">
          <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
          {t("training.recordingControl.recordingInProgress")}
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3">
        {!isRecording ? (
          <Button
            onClick={handleStart}
            disabled={disabled}
            className="flex-1 gap-2 py-3 font-medium text-white bg-red-600 hover:bg-red-700"
          >
            <Mic className="w-5 h-5" />
            {t("training.recordingControl.startRecording")}
          </Button>
        ) : (
          <>
            <Button
              onClick={handleStop}
              className="flex-1 gap-2 py-3 font-medium text-white bg-slate-900 hover:bg-slate-800"
            >
              <Square className="w-5 h-5" />
              {t("training.recordingControl.stopRecording")}
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              className="px-4 py-3 font-medium"
            >
              {t("common.cancel")}
            </Button>
          </>
        )}
      </div>

      {/* Tips */}
      <div className="p-3 space-y-1 text-xs text-blue-900 border border-blue-200 rounded-lg bg-blue-50">
        <p className="font-medium">
          {t("training.recordingControl.tipsTitle")}
        </p>
        <ul className="list-disc list-inside space-y-0.5">
          {(
            t("training.recordingControl.tips", {
              returnObjects: true,
            }) as string[]
          ).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
