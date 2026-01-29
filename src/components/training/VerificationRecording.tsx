import { useRef, useEffect, useState } from "react";
import { Mic, Square, Volume2, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { VoiceActivityDetector } from "../../utils/voice-activity-detection";
import { DEFAULT_VERIFICATION_VAD_CONFIG } from "../../config/vad-config";
import { useTranslation } from "react-i18next";

interface VerificationRecordingProps {
  onComplete: (audioBlob: Blob, duration: number) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}

export function VerificationRecording({
  onComplete,
  onCancel,
  disabled = false,
}: VerificationRecordingProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);

  // Monitor audio level
  useEffect(() => {
    if (!isRecording || !analyserRef.current) return;

    const updateLevel = () => {
      if (!analyserRef.current) return;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel((average / 255) * 100);
      rafRef.current = requestAnimationFrame(updateLevel);
    };

    rafRef.current = requestAnimationFrame(updateLevel);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRecording]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();

      // Setup audio level monitoring
      const analyser = audioContextRef.current.createAnalyser();
      analyserRef.current = analyser;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);

      // Initialize Voice Activity Detection
      vadRef.current = new VoiceActivityDetector(
        audioContextRef.current,
        stream,
        {
          silenceThreshold: DEFAULT_VERIFICATION_VAD_CONFIG.silenceThreshold,
          silenceDuration: DEFAULT_VERIFICATION_VAD_CONFIG.silenceDuration,
          minRecordingDuration:
            DEFAULT_VERIFICATION_VAD_CONFIG.minRecordingDuration,
        },
      );

      // Determine the best supported MIME type
      const supportedMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
      ];

      let mimeType = "";
      for (const type of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      // Store the actual MIME type being used
      const actualMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";

      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // Use the actual MIME type from MediaRecorder
        const audioBlob = new Blob(audioChunks, { type: actualMimeType });
        setIsProcessing(true);
        await onComplete(audioBlob, recordingTime);
        setIsProcessing(false);
        setRecordingTime(0);
        setAudioLevel(0);
      };

      mediaRecorder.start();
      setRecordingTime(0);
      setAudioLevel(0);
      setIsRecording(true);

      // Start VAD monitoring - auto-stop when silence is detected
      if (vadRef.current) {
        vadRef.current.start(() => {
          // Auto-stop when extended silence is detected
          if (mediaRecorderRef.current && isRecording) {
            handleStop();
          }
        });
      }
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert(t("training.verificationRecording.errors.micAccess"));
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current) {
      // Stop VAD monitoring
      if (vadRef.current) {
        vadRef.current.stop();
        vadRef.current = null;
      }

      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      setIsRecording(false);
    }
  };

  const handleCancel = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop VAD monitoring
      if (vadRef.current) {
        vadRef.current.stop();
        vadRef.current = null;
      }

      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      setIsRecording(false);
      setRecordingTime(0);
      setAudioLevel(0);
    }
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-6 space-y-6 bg-white border rounded-lg border-slate-200">
      {/* Instructions */}
      <div className="space-y-2">
        <div className="flex items-start gap-3 p-4 border-2 border-blue-200 rounded-lg bg-linear-to-r from-blue-50 to-indigo-50">
          <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-900">
              {t("training.verificationRecording.title")}
            </p>
            <p className="text-sm text-slate-700 mt-1">
              {t("training.verificationRecording.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Audio Level Monitor */}
      {isRecording && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <Volume2 className="w-4 h-4" />
              {t("training.verificationRecording.audioLevel")}
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
              {t("training.verificationRecording.lowVolume")}
            </p>
          )}
        </div>
      )}

      {/* Timer Display */}
      <div className="text-center">
        <p className="mb-1 text-xs text-slate-600">
          {t("training.verificationRecording.recordingTime")}
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
          {t("training.verificationRecording.recordingInProgress")}
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-blue-600">
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
          {t("training.verificationRecording.processing")}
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3">
        {!isRecording ? (
          <Button
            onClick={handleStart}
            disabled={disabled || isProcessing}
            className="flex-1 gap-2 py-3 font-medium text-white bg-red-600 hover:bg-red-700"
          >
            <Mic className="w-5 h-5" />
            {t("training.verificationRecording.start")}
          </Button>
        ) : (
          <>
            <Button
              onClick={handleStop}
              className="flex-1 gap-2 py-3 font-medium text-white bg-slate-900 hover:bg-slate-800"
            >
              <Square className="w-5 h-5" />
              {t("training.verificationRecording.stop")}
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
          {t("training.verificationRecording.tipsTitle")}
        </p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>{t("training.verificationRecording.tips.0")}</li>
          <li>{t("training.verificationRecording.tips.1")}</li>
          <li>{t("training.verificationRecording.tips.2")}</li>
          <li>{t("training.verificationRecording.tips.3")}</li>
        </ul>
      </div>
    </div>
  );
}
