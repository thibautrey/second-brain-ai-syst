import { useState, useRef, useEffect } from "react";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { RecordSamplesStep } from "../components/training/RecordSamplesStep";
import { VerificationResults } from "../components/training/VerificationResults";
import * as trainingAPI from "../services/training-api";
import { useAuth } from "../contexts/AuthContext";

interface Recording {
  id: string;
  url: string;
  duration: number;
  phraseIndex: number;
  timestamp: number;
  uploadedSampleId?: string;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
}

type Step = "recording" | "training" | "verification";

export function TrainingPage() {
  const { user } = useAuth();

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>("recording");

  // Profile setup state - auto-generated based on user ID
  const [speakerProfileId, setSpeakerProfileId] = useState<string | null>(null);

  // Recording state
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);

  // Training state
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingResult, setTrainingResult] = useState<{
    confidenceScore: number;
    trainingDuration: number;
    sessionId: string;
  } | null>(null);

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    recognized: boolean;
    confidence: number;
  } | null>(null);

  // General state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentSessionIdRef = useRef<string | null>(null);

  // Initialize speaker profile on component mount
  useEffect(() => {
    if (user?.id && !speakerProfileId) {
      const generatedId = `profile-${user.id}-${Date.now()}`;
      setSpeakerProfileId(generatedId);
    }
  }, [user?.id, speakerProfileId]);

  // Step 2: Record samples
  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!speakerProfileId) {
        throw new Error("No speaker profile selected");
      }

      const TRAINING_PHRASES = [
        { text: "My voice is my password", category: "passphrase" },
        { text: "Verify my identity", category: "passphrase" },
        { text: "Approve this transaction", category: "passphrase" },
        { text: "Set a reminder for tomorrow morning", category: "sentence" },
        { text: "What is the weather today", category: "sentence" },
        { text: "Play my favorite music", category: "sentence" },
        {
          text: "Call my mom and tell her I'm running late",
          category: "sentence",
        },
        { text: "Send a message to my friend", category: "sentence" },
        { text: "Seven, three, nine, two, five", category: "numeric" },
        { text: "One, four, six, eight, zero", category: "numeric" },
      ];

      const audioFile = new File([audioBlob], `recording-${Date.now()}.wav`, {
        type: "audio/wav",
      });

      const phrase = TRAINING_PHRASES[currentPhraseIndex];

      const newRecording: Recording = {
        id: `recording-${Date.now()}`,
        url: URL.createObjectURL(audioBlob),
        duration,
        phraseIndex: currentPhraseIndex,
        timestamp: Date.now(),
        uploadStatus: "uploading",
      };

      setRecordings((prev) => [...prev, newRecording]);

      // Upload to backend
      const uploaded = await trainingAPI.uploadSample(
        audioFile,
        speakerProfileId,
        phrase.text,
        phrase.category,
      );

      // Update recording with server ID and mark as completed
      setRecordings((prev) =>
        prev.map((r) =>
          r.id === newRecording.id
            ? {
                ...r,
                uploadedSampleId: uploaded.id,
                uploadStatus: "completed" as const,
              }
            : r,
        ),
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to upload sample";
      setError(msg);

      // Mark the last recording as failed
      setRecordings((prev) =>
        prev.map((r, idx) =>
          idx === prev.length - 1 && r.uploadStatus === "uploading"
            ? { ...r, uploadStatus: "failed" as const }
            : r,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRecording = async (id: string) => {
    const recording = recordings.find((r) => r.id === id);

    if (recording?.uploadedSampleId) {
      setError(null);
      try {
        await trainingAPI.deleteSample(recording.uploadedSampleId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete";
        setError(msg);
        return;
      }
    }

    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  // Step 3: Training
  const handleStartTraining = async () => {
    if (!speakerProfileId) {
      setError("No speaker profile found");
      return;
    }

    const uploadedRecordings = recordings.filter(
      (r) => r.uploadStatus === "completed",
    );
    if (uploadedRecordings.length === 0) {
      setError("No successfully uploaded samples");
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);
    setError(null);
    setCurrentStep("training");

    try {
      // Start training session
      const session = await trainingAPI.startTraining(speakerProfileId);
      currentSessionIdRef.current = session.id;

      // Poll for completion
      const startTime = Date.now();
      const completedSession = await trainingAPI.pollTrainingStatus(
        session.id,
        2000,
        600000,
      );

      const trainingDuration = (Date.now() - startTime) / 1000;

      setTrainingResult({
        confidenceScore: completedSession.confidenceScore || 0.85,
        trainingDuration,
        sessionId: session.id,
      });

      setTrainingProgress(100);
      setCurrentStep("verification");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Training failed";
      setError(msg);
      setIsTraining(false);
      setCurrentStep("recording");
    }
  };

  // Step 4: Verification
  const handleVerifyVoice = async (audioBlob: Blob, _duration: number) => {
    setIsVerifying(true);
    setError(null);

    try {
      if (!speakerProfileId) {
        throw new Error("No speaker profile");
      }

      // Simulate verification
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setVerificationResult({
        recognized: true,
        confidence: trainingResult?.confidenceScore || 0.92,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleComplete = () => {
    window.location.href = "/";
  };

  // Step progress bar
  const steps: Array<{
    key: Step;
    label: string;
    completed: boolean;
  }> = [
    { key: "recording", label: "Record", completed: recordings.length >= 5 },
    { key: "training", label: "Train", completed: trainingResult !== null },
    {
      key: "verification",
      label: "Verify",
      completed: verificationResult !== null,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      {/* Header with back button */}
      <div className="max-w-4xl mx-auto mb-8">
        <Button
          onClick={() => window.history.back()}
          variant="ghost"
          className="gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Step Progress Indicator */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex items-center flex-1">
              {/* Step Circle */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  step.key === currentStep
                    ? "bg-blue-600 text-white ring-2 ring-blue-200"
                    : step.completed
                      ? "bg-green-600 text-white"
                      : "bg-slate-300 text-slate-600"
                }`}
              >
                {step.completed && step.key !== currentStep ? (
                  "✓"
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Step Label */}
              <p
                className={`ml-3 font-medium ${
                  step.key === currentStep
                    ? "text-blue-600"
                    : step.completed
                      ? "text-green-600"
                      : "text-slate-500"
                }`}
              >
                {step.label}
              </p>

              {/* Connector Line */}
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-3 rounded-full transition-all ${
                    step.completed ? "bg-green-600" : "bg-slate-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {/* Global Error Banner */}
        {error && currentStep !== "verification" && (
          <div className="mb-6 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        )}
        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {currentStep === "recording" && speakerProfileId && (
            <RecordSamplesStep
              recordings={recordings}
              currentPhraseIndex={currentPhraseIndex}
              speakerProfileId={speakerProfileId}
              onRecordingComplete={handleRecordingComplete}
              onDeleteRecording={handleDeleteRecording}
              onPhraseChange={setCurrentPhraseIndex}
              onContinue={handleStartTraining}
              isLoading={isTraining}
              error={error || undefined}
            />
          )}

          {currentStep === "training" && isTraining && (
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Training Your Voice Profile
              </h2>
              <p className="text-slate-600">
                Processing your recordings to create your unique voice
                profile...
              </p>

              {/* Training Progress */}
              <div className="space-y-4">
                <div className="relative h-32 flex items-center justify-center">
                  <svg className="absolute w-32 h-32" viewBox="0 0 120 120">
                    {/* Background circle */}
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="3"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="url(#gradient)"
                      strokeWidth="3"
                      strokeDasharray={`${(trainingProgress / 100) * 339.3} 339.3`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 0.5s ease" }}
                    />
                    <defs>
                      <linearGradient
                        id="gradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>

                  <div className="text-center z-10">
                    <p className="text-4xl font-bold text-blue-600">
                      {Math.round(trainingProgress)}%
                    </p>
                    <p className="text-xs text-slate-600 mt-1">Training</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <p>Processing {recordings.length} voice samples...</p>
                  <p>Building your unique voice profile...</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === "verification" && trainingResult && (
            <VerificationResults
              speakerProfileId={speakerProfileId || ""}
              confidenceScore={trainingResult.confidenceScore}
              sampleCount={recordings.length}
              trainingDuration={trainingResult.trainingDuration}
              onVerifyVoice={handleVerifyVoice}
              onComplete={handleComplete}
              isVerifying={isVerifying}
              verificationResult={verificationResult}
              verificationError={error || undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
