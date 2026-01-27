import { useState, useRef, useEffect } from "react";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { ProfileSelectionStep } from "../components/training/ProfileSelectionStep";
import { RecordSamplesStep } from "../components/training/RecordSamplesStep";
import { ReadParagraphStep, TRAINING_PARAGRAPHS_BY_LANGUAGE } from "../components/training/ReadParagraphStep";
import { VerificationResults } from "../components/training/VerificationResults";
import * as trainingAPI from "../services/training-api";
import { useAuth } from "../contexts/AuthContext";

interface Recording {
  id: string;
  url: string;
  duration: number;
  phraseIndex: number;
  language: string;
  timestamp: number;
  uploadedSampleId?: string;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
}

interface ParagraphRecording {
  id: string;
  url: string;
  duration: number;
  paragraphIndex: number;
  language: string;
  timestamp: number;
  uploadedSampleId?: string;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
}

type Step = "profile-selection" | "recording" | "paragraph-reading" | "training" | "verification";

export function TrainingPage() {
  const { user } = useAuth();

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>("profile-selection");

  // Profile setup state
  const [speakerProfileId, setSpeakerProfileId] = useState<string | null>(null);

  // Recording state
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);

  // Paragraph recording state
  const [paragraphRecordings, setParagraphRecordings] = useState<ParagraphRecording[]>([]);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);

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

  // Handle profile selection
  const handleProfileSelected = (profileId: string) => {
    setSpeakerProfileId(profileId);
  };

  const handleProfileSelectionContinue = async () => {
    if (!speakerProfileId) {
      setError("Please select or create a profile");
      return;
    }
    setCurrentStep("recording");
  };

  // Step 2: Record samples
  const handleRecordingComplete = async (
    audioBlob: Blob,
    duration: number,
    language: string = "en",
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!speakerProfileId) {
        throw new Error("No speaker profile selected");
      }

      // Training phrases by language - matches RecordSamplesStep
      const TRAINING_PHRASES_BY_LANGUAGE: Record<
        string,
        { text: string; category: string }[]
      > = {
        en: [
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
        ],
        fr: [
          { text: "Ma voix est mon mot de passe", category: "passphrase" },
          { text: "Vérifiez mon identité", category: "passphrase" },
          { text: "Approuvez cette transaction", category: "passphrase" },
          { text: "Mets un rappel pour demain matin", category: "sentence" },
          { text: "Quel temps fait-il aujourd'hui", category: "sentence" },
          { text: "Joue ma musique préférée", category: "sentence" },
          {
            text: "Appelle ma mère et dis-lui que je suis en retard",
            category: "sentence",
          },
          { text: "Envoie un message à mon ami", category: "sentence" },
          { text: "Sept, trois, neuf, deux, cinq", category: "numeric" },
          { text: "Un, quatre, six, huit, zéro", category: "numeric" },
        ],
        es: [
          { text: "Mi voz es mi contraseña", category: "passphrase" },
          { text: "Verifica mi identidad", category: "passphrase" },
          { text: "Aprueba esta transacción", category: "passphrase" },
          {
            text: "Pon un recordatorio para mañana por la mañana",
            category: "sentence",
          },
          { text: "Qué tiempo hace hoy", category: "sentence" },
          { text: "Pon mi música favorita", category: "sentence" },
          {
            text: "Llama a mi madre y dile que llego tarde",
            category: "sentence",
          },
          { text: "Envía un mensaje a mi amigo", category: "sentence" },
          { text: "Siete, tres, nueve, dos, cinco", category: "numeric" },
          { text: "Uno, cuatro, seis, ocho, cero", category: "numeric" },
        ],
        de: [
          { text: "Meine Stimme ist mein Passwort", category: "passphrase" },
          { text: "Überprüfe meine Identität", category: "passphrase" },
          { text: "Genehmige diese Transaktion", category: "passphrase" },
          {
            text: "Setze eine Erinnerung für morgen früh",
            category: "sentence",
          },
          { text: "Wie ist das Wetter heute", category: "sentence" },
          { text: "Spiele meine Lieblingsmusik", category: "sentence" },
          {
            text: "Ruf meine Mutter an und sag ihr dass ich mich verspäte",
            category: "sentence",
          },
          {
            text: "Schicke eine Nachricht an meinen Freund",
            category: "sentence",
          },
          { text: "Sieben, drei, neun, zwei, fünf", category: "numeric" },
          { text: "Eins, vier, sechs, acht, null", category: "numeric" },
        ],
        it: [
          { text: "La mia voce è la mia password", category: "passphrase" },
          { text: "Verifica la mia identità", category: "passphrase" },
          { text: "Approva questa transazione", category: "passphrase" },
          {
            text: "Imposta un promemoria per domani mattina",
            category: "sentence",
          },
          { text: "Che tempo fa oggi", category: "sentence" },
          { text: "Metti la mia musica preferita", category: "sentence" },
          {
            text: "Chiama mia madre e dille che sono in ritardo",
            category: "sentence",
          },
          { text: "Invia un messaggio al mio amico", category: "sentence" },
          { text: "Sette, tre, nove, due, cinque", category: "numeric" },
          { text: "Uno, quattro, sei, otto, zero", category: "numeric" },
        ],
        pt: [
          { text: "Minha voz é minha senha", category: "passphrase" },
          { text: "Verifique minha identidade", category: "passphrase" },
          { text: "Aprove esta transação", category: "passphrase" },
          {
            text: "Defina um lembrete para amanhã de manhã",
            category: "sentence",
          },
          { text: "Como está o tempo hoje", category: "sentence" },
          { text: "Toque minha música favorita", category: "sentence" },
          {
            text: "Ligue para minha mãe e diga que estou atrasado",
            category: "sentence",
          },
          { text: "Envie uma mensagem para meu amigo", category: "sentence" },
          { text: "Sete, três, nove, dois, cinco", category: "numeric" },
          { text: "Um, quatro, seis, oito, zero", category: "numeric" },
        ],
        nl: [
          { text: "Mijn stem is mijn wachtwoord", category: "passphrase" },
          { text: "Verifieer mijn identiteit", category: "passphrase" },
          { text: "Keur deze transactie goed", category: "passphrase" },
          {
            text: "Zet een herinnering voor morgenochtend",
            category: "sentence",
          },
          { text: "Wat is het weer vandaag", category: "sentence" },
          { text: "Speel mijn favoriete muziek", category: "sentence" },
          {
            text: "Bel mijn moeder en zeg dat ik te laat ben",
            category: "sentence",
          },
          { text: "Stuur een bericht naar mijn vriend", category: "sentence" },
          { text: "Zeven, drie, negen, twee, vijf", category: "numeric" },
          { text: "Een, vier, zes, acht, nul", category: "numeric" },
        ],
        zh: [
          { text: "我的声音就是我的密码", category: "passphrase" },
          { text: "验证我的身份", category: "passphrase" },
          { text: "批准这笔交易", category: "passphrase" },
          { text: "设置明天早上的提醒", category: "sentence" },
          { text: "今天天气怎么样", category: "sentence" },
          { text: "播放我最喜欢的音乐", category: "sentence" },
          { text: "打电话给我妈妈说我要迟到了", category: "sentence" },
          { text: "给我的朋友发消息", category: "sentence" },
          { text: "七、三、九、二、五", category: "numeric" },
          { text: "一、四、六、八、零", category: "numeric" },
        ],
        ja: [
          { text: "私の声が私のパスワードです", category: "passphrase" },
          { text: "私の身元を確認してください", category: "passphrase" },
          { text: "この取引を承認してください", category: "passphrase" },
          { text: "明日の朝にリマインダーを設定して", category: "sentence" },
          { text: "今日の天気はどうですか", category: "sentence" },
          { text: "お気に入りの音楽を再生して", category: "sentence" },
          { text: "母に電話して遅れると伝えて", category: "sentence" },
          { text: "友達にメッセージを送って", category: "sentence" },
          { text: "七、三、九、二、五", category: "numeric" },
          { text: "一、四、六、八、ゼロ", category: "numeric" },
        ],
        ko: [
          { text: "내 목소리가 내 비밀번호입니다", category: "passphrase" },
          { text: "내 신원을 확인해 주세요", category: "passphrase" },
          { text: "이 거래를 승인해 주세요", category: "passphrase" },
          { text: "내일 아침에 알림을 설정해 줘", category: "sentence" },
          { text: "오늘 날씨가 어때", category: "sentence" },
          { text: "내가 좋아하는 음악 틀어 줘", category: "sentence" },
          { text: "엄마한테 전화해서 늦는다고 말해 줘", category: "sentence" },
          { text: "친구에게 메시지를 보내 줘", category: "sentence" },
          { text: "칠, 삼, 구, 이, 오", category: "numeric" },
          { text: "일, 사, 육, 팔, 영", category: "numeric" },
        ],
      };

      const phrases =
        TRAINING_PHRASES_BY_LANGUAGE[language] ||
        TRAINING_PHRASES_BY_LANGUAGE.en;

      // Get the actual MIME type from the blob and determine file extension
      const actualMimeType = audioBlob.type || "audio/webm";
      const extensionMap: Record<string, string> = {
        "audio/webm": "webm",
        "audio/webm;codecs=opus": "webm",
        "audio/ogg": "ogg",
        "audio/ogg;codecs=opus": "ogg",
        "audio/mp4": "mp4",
        "audio/wav": "wav",
        "audio/mpeg": "mp3",
      };
      const extension = extensionMap[actualMimeType] || "webm";

      const audioFile = new File(
        [audioBlob],
        `recording-${Date.now()}.${extension}`,
        {
          type: actualMimeType,
        },
      );

      const phrase = phrases[currentPhraseIndex];

      const newRecording: Recording = {
        id: `recording-${Date.now()}`,
        url: URL.createObjectURL(audioBlob),
        duration,
        phraseIndex: currentPhraseIndex,
        language,
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

  // Handler to proceed from phrases to paragraph reading
  const handleProceedToParagraphs = () => {
    setCurrentStep("paragraph-reading");
  };

  // Handler for paragraph recording completion
  const handleParagraphRecordingComplete = async (
    audioBlob: Blob,
    duration: number,
    language: string = "en",
    paragraphIndex: number
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!speakerProfileId) {
        throw new Error("No speaker profile selected");
      }

      const paragraphs =
        TRAINING_PARAGRAPHS_BY_LANGUAGE[language] ||
        TRAINING_PARAGRAPHS_BY_LANGUAGE.en;

      // Get the actual MIME type from the blob
      const actualMimeType = audioBlob.type || "audio/webm";
      const extensionMap: Record<string, string> = {
        "audio/webm": "webm",
        "audio/webm;codecs=opus": "webm",
        "audio/ogg": "ogg",
        "audio/ogg;codecs=opus": "ogg",
        "audio/mp4": "mp4",
        "audio/wav": "wav",
        "audio/mpeg": "mp3",
      };
      const extension = extensionMap[actualMimeType] || "webm";

      const audioFile = new File(
        [audioBlob],
        `paragraph-recording-${Date.now()}.${extension}`,
        {
          type: actualMimeType,
        }
      );

      const paragraph = paragraphs[paragraphIndex];

      const newRecording: ParagraphRecording = {
        id: `paragraph-${Date.now()}`,
        url: URL.createObjectURL(audioBlob),
        duration,
        paragraphIndex,
        language,
        timestamp: Date.now(),
        uploadStatus: "uploading",
      };

      setParagraphRecordings((prev) => [...prev, newRecording]);

      // Upload to backend
      const uploaded = await trainingAPI.uploadSample(
        audioFile,
        speakerProfileId,
        paragraph.text,
        "paragraph", // Use 'paragraph' as category for longer texts
      );

      // Update recording with server ID and mark as completed
      setParagraphRecordings((prev) =>
        prev.map((r) =>
          r.id === newRecording.id
            ? {
                ...r,
                uploadedSampleId: uploaded.id,
                uploadStatus: "completed" as const,
              }
            : r
        )
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to upload paragraph recording";
      setError(msg);

      // Mark the last recording as failed
      setParagraphRecordings((prev) =>
        prev.map((r, idx) =>
          idx === prev.length - 1 && r.uploadStatus === "uploading"
            ? { ...r, uploadStatus: "failed" as const }
            : r
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for deleting paragraph recordings
  const handleDeleteParagraphRecording = async (id: string) => {
    const recording = paragraphRecordings.find((r) => r.id === id);

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

    setParagraphRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  // Handler to go back to phrase recording from paragraph reading
  const handleBackToPhrases = () => {
    setCurrentStep("recording");
  };

  // Step 3: Training
  const handleStartTraining = async () => {
    if (!speakerProfileId) {
      setError("No speaker profile found");
      return;
    }

    const uploadedPhraseRecordings = recordings.filter(
      (r) => r.uploadStatus === "completed",
    );
    const uploadedParagraphRecordings = paragraphRecordings.filter(
      (r) => r.uploadStatus === "completed",
    );
    const totalUploadedRecordings = uploadedPhraseRecordings.length + uploadedParagraphRecordings.length;
    
    if (totalUploadedRecordings === 0) {
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

      // Poll for completion with progress callback
      const startTime = Date.now();
      const completedSession = await trainingAPI.pollTrainingStatus(
        session.id,
        2000,
        600000,
        (session) => {
          // Update progress on each poll
          setTrainingProgress(session.progress);
        },
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
    {
      key: "profile-selection",
      label: "Profile",
      completed: speakerProfileId !== null,
    },
    { key: "recording", label: "Phrases", completed: recordings.length >= 1 },
    { key: "paragraph-reading", label: "Paragraphs", completed: paragraphRecordings.length >= 1 },
    { key: "training", label: "Train", completed: trainingResult !== null },
    {
      key: "verification",
      label: "Verify",
      completed: verificationResult !== null,
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 py-6 px-4">
      {/* Header with back button */}
      <div className="max-w-4xl mx-auto mb-4">
        <Button
          onClick={() => window.history.back()}
          variant="ghost"
          className="gap-2 text-slate-600 hover:text-slate-900 mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Step Progress Indicator */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex items-center flex-1">
              {/* Step Circle */}
              <div
                className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold transition-all ${
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
                className={`ml-2 sm:ml-3 text-xs sm:text-base font-medium ${
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
                  className={`flex-1 h-1 mx-1 sm:mx-3 rounded-full transition-all ${
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
          <div className="mb-4 flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-800 mt-1">{error || ""}</p>
            </div>
          </div>
        )}
        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {currentStep === "profile-selection" && (
            <ProfileSelectionStep
              onProfileSelected={handleProfileSelected}
              onContinue={handleProfileSelectionContinue}
              isLoading={isLoading}
              error={error || undefined}
            />
          )}

          {currentStep === "recording" && speakerProfileId && (
            <RecordSamplesStep
              recordings={recordings}
              currentPhraseIndex={currentPhraseIndex}
              speakerProfileId={speakerProfileId}
              onRecordingComplete={handleRecordingComplete}
              onDeleteRecording={handleDeleteRecording}
              onPhraseChange={setCurrentPhraseIndex}
              onContinue={handleProceedToParagraphs}
              isLoading={isLoading}
              error={error || undefined}
            />
          )}

          {currentStep === "paragraph-reading" && speakerProfileId && (
            <ReadParagraphStep
              recordings={paragraphRecordings}
              currentParagraphIndex={currentParagraphIndex}
              speakerProfileId={speakerProfileId}
              onRecordingComplete={handleParagraphRecordingComplete}
              onDeleteRecording={handleDeleteParagraphRecording}
              onParagraphChange={setCurrentParagraphIndex}
              onContinue={handleStartTraining}
              onBack={handleBackToPhrases}
              isLoading={isLoading}
              error={error || undefined}
            />
          )}

          {currentStep === "training" && isTraining && (
            <div className="max-w-2xl mx-auto text-center space-y-4">
              <h2 className="text-2xl font-bold text-slate-900">
                Training Your Voice Profile
              </h2>
              <p className="text-slate-600">
                Processing your recordings to create your unique voice
                profile...
              </p>

              {/* Training Progress */}
              <div className="space-y-3">
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
                  <p>Processing {recordings.length + paragraphRecordings.length} voice samples...</p>
                  <p>({recordings.length} phrases, {paragraphRecordings.length} paragraphs)</p>
                  <p>Building your unique voice profile...</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === "verification" && trainingResult && (
            <VerificationResults
              speakerProfileId={speakerProfileId || ""}
              confidenceScore={trainingResult.confidenceScore}
              sampleCount={recordings.length + paragraphRecordings.length}
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
