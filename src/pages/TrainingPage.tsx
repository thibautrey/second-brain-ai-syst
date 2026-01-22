import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Trash2,
  Play,
  Upload,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "../components/ui/button";
import * as trainingAPI from "../services/training-api";

interface Recording {
  id: string;
  timestamp: number;
  duration: number;
  url: string;
  label: string;
  phraseIndex: number;
  status: "pending" | "processing" | "completed" | "failed";
  uploadedSampleId?: string;
}

interface TrainingPhrase {
  id: number;
  text: string;
  category: "passphrase" | "sentence" | "numeric";
  difficulty: "easy" | "medium";
}

export function TrainingPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [guidedMode, setGuidedMode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speakerProfileId, setSpeakerProfileId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  // Training phrases based on industry standards
  const trainingPhrases: TrainingPhrase[] = [
    // Passphrase variations
    {
      id: 1,
      text: "My voice is my password",
      category: "passphrase",
      difficulty: "easy",
    },
    {
      id: 2,
      text: "Verify my identity",
      category: "passphrase",
      difficulty: "easy",
    },
    {
      id: 3,
      text: "Approve this transaction",
      category: "passphrase",
      difficulty: "medium",
    },

    // Natural sentences with varied phonetics
    {
      id: 4,
      text: "Set a reminder for tomorrow morning",
      category: "sentence",
      difficulty: "medium",
    },
    {
      id: 5,
      text: "What is the weather today",
      category: "sentence",
      difficulty: "easy",
    },
    {
      id: 6,
      text: "Play my favorite music",
      category: "sentence",
      difficulty: "easy",
    },
    {
      id: 7,
      text: "Call my mom and tell her I'm running late",
      category: "sentence",
      difficulty: "medium",
    },
    {
      id: 8,
      text: "Send a message to my friend",
      category: "sentence",
      difficulty: "medium",
    },

    // Numeric sequences for variety
    {
      id: 9,
      text: "Seven, three, nine, two, five",
      category: "numeric",
      difficulty: "medium",
    },
    {
      id: 10,
      text: "One, four, six, eight, zero",
      category: "numeric",
      difficulty: "medium",
    },
  ];

  const recordedPhrasesCount = new Set(recordings.map((r) => r.phraseIndex))
    .size;
  const recordingsForCurrentPhrase = recordings.filter(
    (r) => r.phraseIndex === currentPhraseIndex,
  ).length;

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/mp3" });
        const url = URL.createObjectURL(audioBlob);

        const newRecording: Recording = {
          id: `recording-${Date.now()}`,
          timestamp: Date.now(),
          duration: recordingTime,
          url,
          label: `${trainingPhrases[currentPhraseIndex].text}`,
          phraseIndex: currentPhraseIndex,
          status: "pending",
        };

        setRecordings([...recordings, newRecording]);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Unable to access microphone. Please check permissions.");
    }
  };

  const handleStopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setIsRecording(false);

      // Prepare to upload after recording stops
      if (mediaRecorderRef.current) {
        const audioChunks: BlobPart[] = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
          const audioFile = new File(audioBlob, `recording-${Date.now()}.wav`, {
            type: "audio/wav",
          });

          const newRecording: Recording = {
            id: `recording-${Date.now()}`,
            timestamp: Date.now(),
            duration: recordingTime,
            url: URL.createObjectURL(audioBlob),
            label: `${trainingPhrases[currentPhraseIndex].text}`,
            phraseIndex: currentPhraseIndex,
            status: "pending",
          };

          setRecordings([...recordings, newRecording]);
          setRecordingTime(0);

          // Upload sample to backend
          setIsUploading(true);
          setError(null);
          try {
            const uploaded = await trainingAPI.uploadSample(
              audioFile,
              speakerProfileId || undefined,
              trainingPhrases[currentPhraseIndex].text,
              trainingPhrases[currentPhraseIndex].category,
            );

            // Update recording with server ID
            setRecordings((prev) =>
              prev.map((r) =>
                r.id === newRecording.id
                  ? { ...r, uploadedSampleId: uploaded.id, status: "completed" }
                  : r,
              ),
            );
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Failed to upload sample";
            setError(errorMsg);
            console.error("Upload error:", err);

            // Mark as failed
            setRecordings((prev) =>
              prev.map((r) =>
                r.id === newRecording.id ? { ...r, status: "failed" } : r,
              ),
            );
          } finally {
            setIsUploading(false);
          }
        };
      }
    }
  };

  const handleDeleteRecording = async (id: string) => {
    const recording = recordings.find((r) => r.id === id);

    // If uploaded, delete from backend
    if (recording?.uploadedSampleId) {
      setError(null);
      try {
        await trainingAPI.deleteSample(recording.uploadedSampleId);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to delete sample";
        console.error("Delete error:", err);
        setError(errorMsg);
        return;
      }
    }

    setRecordings(recordings.filter((r) => r.id !== id));
  };

  const handlePlayRecording = (url: string) => {
    const audio = new Audio(url);
    audio.play();
  };

  const handleStartTraining = async () => {
    if (recordings.length === 0) {
      alert("Please record at least one sample before training.");
      return;
    }

    if (!speakerProfileId) {
      setError("No speaker profile selected. Please set a profile ID.");
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);
    setError(null);

    try {
      // Start training session on backend
      const session = await trainingAPI.startTraining(speakerProfileId);
      currentSessionIdRef.current = session.id;

      // Update recording status to processing
      setRecordings(
        recordings.map((r) => ({ ...r, status: "processing" as const })),
      );

      // Poll training status
      const completedSession = await trainingAPI.pollTrainingStatus(
        session.id,
        2000, // Poll every 2 seconds
        600000, // Timeout after 10 minutes
      );

      // Update progress to 100%
      setTrainingProgress(100);

      // Update all recordings to completed status
      setRecordings(
        recordings.map((r) => ({ ...r, status: "completed" as const })),
      );

      // Show success message
      alert(
        `Training completed! Confidence score: ${completedSession.confidenceScore?.toFixed(2) || "N/A"}`,
      );
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to start training";
      setError(errorMsg);
      console.error("Training error:", err);

      // Mark as failed
      setRecordings(
        recordings.map((r) => ({ ...r, status: "failed" as const })),
      );
    } finally {
      setIsTraining(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          Voice Training
        </h1>
        <p className="text-slate-600">
          Train the AI to recognize and understand your voice for better
          accuracy.
        </p>
      </div>

      {/* Training Mode Toggle */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Training Mode</h3>
          <p className="text-sm text-slate-600">
            {guidedMode
              ? "Guided: Follow the prompts to record each phrase"
              : "Freestyle: Record any phrase you want"}
          </p>
        </div>
        <Button
          onClick={() => setGuidedMode(!guidedMode)}
          className={
            guidedMode
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-slate-500 hover:bg-slate-600"
          }
        >
          {guidedMode ? "Switch to Freestyle" : "Switch to Guided"}
        </Button>
      </div>

      {/* Guided Training Section */}
      {guidedMode && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">
                Guided Recording Session
              </h2>
              <span className="text-sm font-medium text-slate-600">
                {recordedPhrasesCount} of {trainingPhrases.length} phrases
                recorded
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-4">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{
                  width: `${(recordedPhrasesCount / trainingPhrases.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Current Phrase Card */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-6 border-2 border-blue-300">
            <p className="text-sm text-slate-600 mb-2">
              Current Phrase ({currentPhraseIndex + 1}/{trainingPhrases.length})
            </p>
            <p className="text-3xl font-bold text-slate-900 mb-4">
              "{trainingPhrases[currentPhraseIndex].text}"
            </p>
            <div className="flex items-center gap-4">
              <span className="inline-block px-3 py-1 bg-blue-200 text-blue-800 text-xs font-semibold rounded-full">
                {trainingPhrases[currentPhraseIndex].category}
              </span>
              <span className="inline-block px-3 py-1 bg-purple-200 text-purple-800 text-xs font-semibold rounded-full">
                {trainingPhrases[currentPhraseIndex].difficulty}
              </span>
              <span className="text-sm text-slate-600">
                {recordingsForCurrentPhrase} recording
                {recordingsForCurrentPhrase !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Recording Controls */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8 mb-6 border border-blue-200">
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-2">Recording Time</p>
                <p className="text-5xl font-bold text-slate-900 font-mono">
                  {formatTime(recordingTime)}
                </p>
              </div>

              <div className="flex gap-4">
                {!isRecording ? (
                  <Button
                    onClick={handleStartRecording}
                    className="bg-red-500 hover:bg-red-600 text-white gap-2 px-8 py-6 text-lg"
                  >
                    <Mic className="w-5 h-5" />
                    Start Recording
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopRecording}
                    className="bg-slate-900 hover:bg-slate-800 text-white gap-2 px-8 py-6 text-lg"
                  >
                    <Square className="w-5 h-5" />
                    Stop Recording
                  </Button>
                )}
              </div>

              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-slate-600">
                    Recording in progress...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <Button
              onClick={() =>
                setCurrentPhraseIndex(Math.max(0, currentPhraseIndex - 1))
              }
              disabled={currentPhraseIndex === 0}
              variant="outline"
              className="flex-1"
            >
              Previous Phrase
            </Button>
            <Button
              onClick={() =>
                setCurrentPhraseIndex(
                  Math.min(trainingPhrases.length - 1, currentPhraseIndex + 1),
                )
              }
              disabled={currentPhraseIndex === trainingPhrases.length - 1}
              variant="outline"
              className="flex-1"
            >
              Next Phrase
            </Button>
          </div>
        </div>
      )}

      {/* Regular Recording Section */}
      <div className="bg-white rounded-lg shadow border border-slate-200 p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            {guidedMode ? "All Recordings" : "Record Voice Samples"}
          </h2>
          <p className="text-sm text-slate-600">
            {guidedMode
              ? "Manage and review all your recorded samples"
              : "Record samples of your voice to help the AI learn your unique speech patterns."}
          </p>
        </div>

        {!guidedMode && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8 mb-6 border border-blue-200">
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-2">Recording Time</p>
                <p className="text-5xl font-bold text-slate-900 font-mono">
                  {formatTime(recordingTime)}
                </p>
              </div>

              <div className="flex gap-4">
                {!isRecording ? (
                  <Button
                    onClick={handleStartRecording}
                    className="bg-red-500 hover:bg-red-600 text-white gap-2 px-8 py-6 text-lg"
                  >
                    <Mic className="w-5 h-5" />
                    Start Recording
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopRecording}
                    className="bg-slate-900 hover:bg-slate-800 text-white gap-2 px-8 py-6 text-lg"
                  >
                    <Square className="w-5 h-5" />
                    Stop Recording
                  </Button>
                )}
              </div>

              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-slate-600">
                    Recording in progress...
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recording List */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-4">
            Recorded Samples ({recordings.length})
          </h3>
          <div className="space-y-3">
            {recordings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">
                  {guidedMode
                    ? "Start recording phrases to see them here"
                    : "No recordings yet. Start by clicking the record button above."}
                </p>
              </div>
            ) : (
              recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-slate-900 break-words">
                        {recording.label}
                      </p>
                      {recording.status === "completed" && (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                      {recording.status === "processing" && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      )}
                      {recording.status === "failed" && (
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                      <span>Duration: {formatTime(recording.duration)}</span>
                      <span>
                        {new Date(recording.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handlePlayRecording(recording.url)}
                      variant="outline"
                      className="gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Play
                    </Button>
                    <Button
                      onClick={() => handleDeleteRecording(recording.id)}
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Training Section */}
      {recordings.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Model Training
            </h2>
            <p className="text-sm text-slate-600">
              Ready to train? Your {recordings.length} recording
              {recordings.length !== 1 ? "s" : ""} covering{" "}
              {recordedPhrasesCount} unique phrase
              {recordedPhrasesCount !== 1 ? "s" : ""} will be used to create
              your voice profile.
            </p>
          </div>

          {isTraining && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="font-medium text-blue-900">
                  Training in progress...
                </p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(trainingProgress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-blue-700 mt-2">
                {Math.round(trainingProgress)}%
              </p>
            </div>
          )}

          <Button
            onClick={handleStartTraining}
            disabled={isTraining || recordings.length === 0}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-6 text-lg font-semibold gap-2"
          >
            <Upload className="w-5 h-5" />
            Start AI Voice Training
          </Button>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* What We Train On */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">
                What The AI Learns:
              </h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="text-purple-500">✓</span>
                  <span>Your unique voice characteristics</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-500">✓</span>
                  <span>Speech patterns and rhythm</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-500">✓</span>
                  <span>Accent and pronunciation style</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-500">✓</span>
                  <span>Emotional tone variations</span>
                </li>
              </ul>
            </div>

            {/* Tips for Best Results */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">
                For Better Accuracy:
              </h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="text-blue-500">→</span>
                  <span>Record in a quiet room</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">→</span>
                  <span>Speak naturally & clearly</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">→</span>
                  <span>Vary your pace & tone</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">→</span>
                  <span>Use 5+ diverse recordings</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Phrase Reference Section */}
      <div className="bg-white rounded-lg shadow border border-slate-200 p-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Training Phrases Reference
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          These phrases are designed to capture the diversity of your voice for
          accurate recognition.
        </p>

        <div className="space-y-4">
          {/* Passphrases */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs font-bold rounded">
                PASSPHRASE
              </span>
              Secure Phrases
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trainingPhrases
                .filter((p) => p.category === "passphrase")
                .map((phrase) => (
                  <div
                    key={phrase.id}
                    className="p-3 bg-slate-50 rounded border border-slate-200 flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        "{phrase.text}"
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {phrase.difficulty === "easy" ? "👤 Easy" : "⚡ Medium"}
                      </p>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Natural Sentences */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="px-2 py-1 bg-green-200 text-green-800 text-xs font-bold rounded">
                SENTENCE
              </span>
              Natural Conversation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trainingPhrases
                .filter((p) => p.category === "sentence")
                .map((phrase) => (
                  <div
                    key={phrase.id}
                    className="p-3 bg-slate-50 rounded border border-slate-200 flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        "{phrase.text}"
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {phrase.difficulty === "easy" ? "👤 Easy" : "⚡ Medium"}
                      </p>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Numeric Sequences */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="px-2 py-1 bg-purple-200 text-purple-800 text-xs font-bold rounded">
                NUMERIC
              </span>
              Number Sequences
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trainingPhrases
                .filter((p) => p.category === "numeric")
                .map((phrase) => (
                  <div
                    key={phrase.id}
                    className="p-3 bg-slate-50 rounded border border-slate-200 flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        "{phrase.text}"
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {phrase.difficulty === "easy" ? "👤 Easy" : "⚡ Medium"}
                      </p>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            💡 <strong>Pro Tip:</strong> Mix of passphrases, natural sentences,
            and numeric sequences helps the AI recognize your voice in various
            contexts with different phonetic patterns.
          </p>
        </div>
      </div>

      {/* Upload Alternative */}
      <div className="bg-white rounded-lg shadow border border-slate-200 p-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Or Upload Existing Audio Files
        </h2>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="font-medium text-slate-900">
            Drag and drop your audio files here
          </p>
          <p className="text-sm text-slate-600 mt-1">
            Supports MP3, WAV, and OGG formats
          </p>
        </div>
      </div>
    </div>
  );
}
