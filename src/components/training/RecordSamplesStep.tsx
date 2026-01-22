import { useState } from "react";
import { Button } from "../ui/button";
import { AlertCircle, CheckCircle2, Play, Trash2, Plus } from "lucide-react";
import { RecordingControl } from "./RecordingControl";

interface Recording {
  id: string;
  url: string;
  duration: number;
  phraseIndex: number;
  timestamp: number;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
}

interface RecordSamplesStepProps {
  recordings: Recording[];
  currentPhraseIndex: number;
  speakerProfileId: string;
  onRecordingComplete: (audioBlob: Blob, duration: number) => Promise<void>;
  onDeleteRecording: (id: string) => void;
  onPhraseChange: (index: number) => void;
  onContinue: () => void;
  isLoading?: boolean;
  error?: string;
}

const TRAINING_PHRASES = [
  { text: "My voice is my password", category: "Passphrase" },
  { text: "Verify my identity", category: "Passphrase" },
  { text: "Approve this transaction", category: "Passphrase" },
  { text: "Set a reminder for tomorrow morning", category: "Sentence" },
  { text: "What is the weather today", category: "Sentence" },
  { text: "Play my favorite music", category: "Sentence" },
  { text: "Call my mom and tell her I'm running late", category: "Sentence" },
  { text: "Send a message to my friend", category: "Sentence" },
  { text: "Seven, three, nine, two, five", category: "Numeric" },
  { text: "One, four, six, eight, zero", category: "Numeric" },
];

export function RecordSamplesStep({
  recordings,
  currentPhraseIndex,
  speakerProfileId,
  onRecordingComplete,
  onDeleteRecording,
  onPhraseChange,
  onContinue,
  isLoading,
  error,
}: RecordSamplesStepProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const currentPhrase = TRAINING_PHRASES[currentPhraseIndex];
  const recordingsForPhrase = recordings.filter(
    (r) => r.phraseIndex === currentPhraseIndex,
  ).length;
  const totalRecordings = recordings.length;
  const uniquePhrases = new Set(recordings.map((r) => r.phraseIndex)).size;

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setIsRecording(false);
    setRecordingError(null);
    try {
      await onRecordingComplete(audioBlob, duration);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Recording failed";
      setRecordingError(msg);
    }
  };

  const canContinue = totalRecordings >= 5 && uniquePhrases >= 3;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Record Voice Samples
        </h2>
        <p className="text-slate-600">
          Record natural readings of the phrases below. Aim for 5-10 samples
          across different phrases.
        </p>
      </div>

      {/* Progress Overview */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {totalRecordings}
            </p>
            <p className="text-xs text-slate-600 mt-1">Total Samples</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">
              {uniquePhrases}
            </p>
            <p className="text-xs text-slate-600 mt-1">Unique Phrases</p>
          </div>
          <div className="text-center">
            <p
              className={`text-2xl font-bold ${
                canContinue ? "text-green-600" : "text-amber-600"
              }`}
            >
              {canContinue ? "✓" : "•"}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {canContinue ? "Ready" : "Keep Recording"}
            </p>
          </div>
        </div>

        {!canContinue && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
            Record at least 5 samples from at least 3 different phrases to
            continue.
          </div>
        )}

        {error && (
          <div className="mt-4 flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}
      </div>

      {/* Recording Control */}
      <div className="mb-8">
        <RecordingControl
          phrase={currentPhrase.text}
          category={currentPhrase.category}
          isRecording={isRecording}
          onStart={() => setIsRecording(true)}
          onStop={handleRecordingComplete}
          onCancel={() => setIsRecording(false)}
          disabled={isLoading}
        />

        {recordingError && (
          <div className="mt-4 flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-900">{recordingError}</p>
          </div>
        )}
      </div>

      {/* Phrase Navigator */}
      <div className="mb-8">
        <h3 className="font-semibold text-slate-900 mb-4">Select Phrase</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {TRAINING_PHRASES.map((phrase, idx) => {
            const count = recordings.filter(
              (r) => r.phraseIndex === idx,
            ).length;
            return (
              <button
                key={idx}
                onClick={() => onPhraseChange(idx)}
                className={`p-3 rounded-lg border-2 text-xs transition-all ${
                  currentPhraseIndex === idx
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="font-medium text-slate-900 text-left line-clamp-2">
                  {phrase.text}
                </p>
                {count > 0 && (
                  <p className="mt-1 text-blue-600 font-semibold">{count}x</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recorded Samples */}
      {recordings.length > 0 && (
        <div className="mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">Your Samples</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recordings.map((recording, idx) => {
              const phrase = TRAINING_PHRASES[recording.phraseIndex];
              const mins = Math.floor(recording.duration / 60);
              const secs = recording.duration % 60;
              const durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;

              return (
                <div
                  key={recording.id}
                  className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 line-clamp-1">
                      "{phrase.text}"
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                      <span>{durationStr}</span>
                      <span>•</span>
                      <span>
                        {new Date(recording.timestamp).toLocaleTimeString()}
                      </span>
                      <span>•</span>
                      <span className="text-blue-600 font-medium">
                        {phrase.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        const audio = new Audio(recording.url);
                        audio.play();
                      }}
                      className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Play recording"
                    >
                      <Play className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => onDeleteRecording(recording.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete recording"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                    {recording.uploadStatus === "completed" && (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    )}
                    {recording.uploadStatus === "uploading" && (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    )}
                    {recording.uploadStatus === "failed" && (
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <Button
          onClick={onContinue}
          disabled={!canContinue || isLoading}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 font-medium"
        >
          {isLoading ? "Processing..." : "Continue to Training"}
        </Button>
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">Recording Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Record in a quiet environment for best results</li>
          <li>• Speak naturally without over-pronunciation</li>
          <li>• Vary your pace and intonation</li>
          <li>• Multiple recordings of the same phrase strengthen the model</li>
        </ul>
      </div>
    </div>
  );
}
