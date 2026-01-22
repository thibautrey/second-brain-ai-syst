import { useRef, useEffect, useState } from "react";
import { Mic, Square, Play, Trash2, Volume2 } from "lucide-react";
import { Button } from "../ui/button";

interface RecordingControlProps {
  phrase: string;
  category: string;
  isRecording: boolean;
  onStart: () => void;
  onStop: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function RecordingControl({
  phrase,
  category,
  isRecording,
  onStart,
  onStop,
  onCancel,
  disabled,
}: RecordingControlProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

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

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        onStop(audioBlob, recordingTime);
        setRecordingTime(0);
        setAudioLevel(0);
      };

      mediaRecorder.start();
      setRecordingTime(0);
      setAudioLevel(0);
      onStart();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Unable to access microphone. Please check permissions.");
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    }
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
          Read this phrase:
        </p>
        <div className="p-4 border-2 border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
          <p className="text-2xl font-bold text-slate-900">"{phrase}"</p>
          <p className="mt-2 text-xs text-slate-600">
            Category: <span className="font-medium">{category}</span>
          </p>
        </div>
      </div>

      {/* Audio Level Monitor */}
      {isRecording && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <Volume2 className="w-4 h-4" />
              Audio Level
            </p>
            <p className="text-xs text-slate-600">{Math.round(audioLevel)}%</p>
          </div>
          <div className="w-full h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full transition-all duration-75 bg-gradient-to-r from-green-500 to-blue-500"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          {audioLevel < 20 && (
            <p className="flex items-center gap-1 text-xs text-amber-600">
              ⚠️ Volume is low - speak louder or move closer to microphone
            </p>
          )}
        </div>
      )}

      {/* Timer Display */}
      <div className="text-center">
        <p className="mb-1 text-xs text-slate-600">Recording Time</p>
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
          Recording in progress...
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
            Start Recording
          </Button>
        ) : (
          <>
            <Button
              onClick={handleStop}
              className="flex-1 gap-2 py-3 font-medium text-white bg-slate-900 hover:bg-slate-800"
            >
              <Square className="w-5 h-5" />
              Stop Recording
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="px-4 py-3 font-medium"
            >
              Cancel
            </Button>
          </>
        )}
      </div>

      {/* Tips */}
      <div className="p-3 space-y-1 text-xs text-blue-900 border border-blue-200 rounded-lg bg-blue-50">
        <p className="font-medium">Recording tips:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Speak naturally and clearly</li>
          <li>Maintain steady volume</li>
          <li>Avoid background noise if possible</li>
          <li>Record 3-5 samples per phrase</li>
        </ul>
      </div>
    </div>
  );
}
