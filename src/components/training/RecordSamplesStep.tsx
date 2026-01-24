import { useState } from "react";
import { Button } from "../ui/button";
import { AlertCircle, CheckCircle2, Play, Trash2, Globe } from "lucide-react";
import { RecordingControl } from "./RecordingControl";

interface Recording {
  id: string;
  url: string;
  duration: number;
  phraseIndex: number;
  language: string;
  timestamp: number;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
}

interface RecordSamplesStepProps {
  recordings: Recording[];
  currentPhraseIndex: number;
  speakerProfileId: string;
  onRecordingComplete: (
    audioBlob: Blob,
    duration: number,
    language: string,
  ) => Promise<void>;
  onDeleteRecording: (id: string) => void;
  onPhraseChange: (index: number) => void;
  onContinue: () => void;
  isLoading?: boolean;
  error?: string;
}

// Supported languages with their display names and flags
const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
];

// Training phrases organized by language
const TRAINING_PHRASES_BY_LANGUAGE: Record<
  string,
  { text: string; category: string }[]
> = {
  en: [
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
  ],
  fr: [
    { text: "Ma voix est mon mot de passe", category: "Passphrase" },
    { text: "Vérifiez mon identité", category: "Passphrase" },
    { text: "Approuvez cette transaction", category: "Passphrase" },
    { text: "Mets un rappel pour demain matin", category: "Sentence" },
    { text: "Quel temps fait-il aujourd'hui", category: "Sentence" },
    { text: "Joue ma musique préférée", category: "Sentence" },
    {
      text: "Appelle ma mère et dis-lui que je suis en retard",
      category: "Sentence",
    },
    { text: "Envoie un message à mon ami", category: "Sentence" },
    { text: "Sept, trois, neuf, deux, cinq", category: "Numeric" },
    { text: "Un, quatre, six, huit, zéro", category: "Numeric" },
  ],
  es: [
    { text: "Mi voz es mi contraseña", category: "Passphrase" },
    { text: "Verifica mi identidad", category: "Passphrase" },
    { text: "Aprueba esta transacción", category: "Passphrase" },
    {
      text: "Pon un recordatorio para mañana por la mañana",
      category: "Sentence",
    },
    { text: "Qué tiempo hace hoy", category: "Sentence" },
    { text: "Pon mi música favorita", category: "Sentence" },
    { text: "Llama a mi madre y dile que llego tarde", category: "Sentence" },
    { text: "Envía un mensaje a mi amigo", category: "Sentence" },
    { text: "Siete, tres, nueve, dos, cinco", category: "Numeric" },
    { text: "Uno, cuatro, seis, ocho, cero", category: "Numeric" },
  ],
  de: [
    { text: "Meine Stimme ist mein Passwort", category: "Passphrase" },
    { text: "Überprüfe meine Identität", category: "Passphrase" },
    { text: "Genehmige diese Transaktion", category: "Passphrase" },
    { text: "Setze eine Erinnerung für morgen früh", category: "Sentence" },
    { text: "Wie ist das Wetter heute", category: "Sentence" },
    { text: "Spiele meine Lieblingsmusik", category: "Sentence" },
    {
      text: "Ruf meine Mutter an und sag ihr dass ich mich verspäte",
      category: "Sentence",
    },
    { text: "Schicke eine Nachricht an meinen Freund", category: "Sentence" },
    { text: "Sieben, drei, neun, zwei, fünf", category: "Numeric" },
    { text: "Eins, vier, sechs, acht, null", category: "Numeric" },
  ],
  it: [
    { text: "La mia voce è la mia password", category: "Passphrase" },
    { text: "Verifica la mia identità", category: "Passphrase" },
    { text: "Approva questa transazione", category: "Passphrase" },
    { text: "Imposta un promemoria per domani mattina", category: "Sentence" },
    { text: "Che tempo fa oggi", category: "Sentence" },
    { text: "Metti la mia musica preferita", category: "Sentence" },
    {
      text: "Chiama mia madre e dille che sono in ritardo",
      category: "Sentence",
    },
    { text: "Invia un messaggio al mio amico", category: "Sentence" },
    { text: "Sette, tre, nove, due, cinque", category: "Numeric" },
    { text: "Uno, quattro, sei, otto, zero", category: "Numeric" },
  ],
  pt: [
    { text: "Minha voz é minha senha", category: "Passphrase" },
    { text: "Verifique minha identidade", category: "Passphrase" },
    { text: "Aprove esta transação", category: "Passphrase" },
    { text: "Defina um lembrete para amanhã de manhã", category: "Sentence" },
    { text: "Como está o tempo hoje", category: "Sentence" },
    { text: "Toque minha música favorita", category: "Sentence" },
    {
      text: "Ligue para minha mãe e diga que estou atrasado",
      category: "Sentence",
    },
    { text: "Envie uma mensagem para meu amigo", category: "Sentence" },
    { text: "Sete, três, nove, dois, cinco", category: "Numeric" },
    { text: "Um, quatro, seis, oito, zero", category: "Numeric" },
  ],
  nl: [
    { text: "Mijn stem is mijn wachtwoord", category: "Passphrase" },
    { text: "Verifieer mijn identiteit", category: "Passphrase" },
    { text: "Keur deze transactie goed", category: "Passphrase" },
    { text: "Zet een herinnering voor morgenochtend", category: "Sentence" },
    { text: "Wat is het weer vandaag", category: "Sentence" },
    { text: "Speel mijn favoriete muziek", category: "Sentence" },
    { text: "Bel mijn moeder en zeg dat ik te laat ben", category: "Sentence" },
    { text: "Stuur een bericht naar mijn vriend", category: "Sentence" },
    { text: "Zeven, drie, negen, twee, vijf", category: "Numeric" },
    { text: "Een, vier, zes, acht, nul", category: "Numeric" },
  ],
  zh: [
    { text: "我的声音就是我的密码", category: "Passphrase" },
    { text: "验证我的身份", category: "Passphrase" },
    { text: "批准这笔交易", category: "Passphrase" },
    { text: "设置明天早上的提醒", category: "Sentence" },
    { text: "今天天气怎么样", category: "Sentence" },
    { text: "播放我最喜欢的音乐", category: "Sentence" },
    { text: "打电话给我妈妈说我要迟到了", category: "Sentence" },
    { text: "给我的朋友发消息", category: "Sentence" },
    { text: "七、三、九、二、五", category: "Numeric" },
    { text: "一、四、六、八、零", category: "Numeric" },
  ],
  ja: [
    { text: "私の声が私のパスワードです", category: "Passphrase" },
    { text: "私の身元を確認してください", category: "Passphrase" },
    { text: "この取引を承認してください", category: "Passphrase" },
    { text: "明日の朝にリマインダーを設定して", category: "Sentence" },
    { text: "今日の天気はどうですか", category: "Sentence" },
    { text: "お気に入りの音楽を再生して", category: "Sentence" },
    { text: "母に電話して遅れると伝えて", category: "Sentence" },
    { text: "友達にメッセージを送って", category: "Sentence" },
    { text: "七、三、九、二、五", category: "Numeric" },
    { text: "一、四、六、八、ゼロ", category: "Numeric" },
  ],
  ko: [
    { text: "내 목소리가 내 비밀번호입니다", category: "Passphrase" },
    { text: "내 신원을 확인해 주세요", category: "Passphrase" },
    { text: "이 거래를 승인해 주세요", category: "Passphrase" },
    { text: "내일 아침에 알림을 설정해 줘", category: "Sentence" },
    { text: "오늘 날씨가 어때", category: "Sentence" },
    { text: "내가 좋아하는 음악 틀어 줘", category: "Sentence" },
    { text: "엄마한테 전화해서 늦는다고 말해 줘", category: "Sentence" },
    { text: "친구에게 메시지를 보내 줘", category: "Sentence" },
    { text: "칠, 삼, 구, 이, 오", category: "Numeric" },
    { text: "일, 사, 육, 팔, 영", category: "Numeric" },
  ],
};

// For backwards compatibility
const TRAINING_PHRASES = TRAINING_PHRASES_BY_LANGUAGE.en;

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
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  // Get phrases for current language
  const currentPhrases =
    TRAINING_PHRASES_BY_LANGUAGE[selectedLanguage] || TRAINING_PHRASES;
  const currentPhrase = currentPhrases[currentPhraseIndex] || currentPhrases[0];

  // Get language info
  const currentLanguageInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage) ||
    SUPPORTED_LANGUAGES[0];

  // Count recordings by language
  const recordingsByLanguage = SUPPORTED_LANGUAGES.reduce(
    (acc, lang) => {
      acc[lang.code] = recordings.filter(
        (r) => r.language === lang.code,
      ).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const languagesUsed = Object.entries(recordingsByLanguage).filter(
    ([, count]) => count > 0,
  );
  const totalRecordings = recordings.length;
  const uniquePhrases = new Set(
    recordings.map((r) => `${r.language}-${r.phraseIndex}`),
  ).size;

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setIsRecording(false);
    setRecordingError(null);
    try {
      await onRecordingComplete(audioBlob, duration, selectedLanguage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Recording failed";
      setRecordingError(msg);
    }
  };

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    setShowLanguageSelector(false);
    // Reset phrase index when changing language
    onPhraseChange(0);
  };

  const canContinue = totalRecordings >= 1;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Record Voice Samples
        </h2>
        <p className="text-slate-600">
          Record natural readings of the phrases below. Train with multiple
          languages for better accuracy.
        </p>
      </div>

      {/* Language Selector */}
      <div className="bg-linear-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <span className="font-medium text-slate-900">
              Training Language
            </span>
          </div>
          {languagesUsed.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Recorded:</span>
              {languagesUsed.map(([code, count]) => {
                const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-full border border-slate-200"
                  >
                    {lang?.flag} {count}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowLanguageSelector(!showLanguageSelector)}
            className="w-full flex items-center justify-between p-3 bg-white rounded-lg border-2 border-indigo-200 hover:border-indigo-400 transition-colors"
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl">{currentLanguageInfo.flag}</span>
              <span className="font-medium text-slate-900">
                {currentLanguageInfo.name}
              </span>
            </span>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${showLanguageSelector ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showLanguageSelector && (
            <div className="absolute z-10 w-full mt-2 bg-white rounded-lg border border-slate-200 shadow-lg max-h-64 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const count = recordingsByLanguage[lang.code] || 0;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors ${
                      selectedLanguage === lang.code ? "bg-indigo-50" : ""
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl">{lang.flag}</span>
                      <span
                        className={`font-medium ${selectedLanguage === lang.code ? "text-indigo-600" : "text-slate-900"}`}
                      >
                        {lang.name}
                      </span>
                    </span>
                    {count > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                        {count} sample{count > 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-2 text-xs text-slate-500">
          💡 Tip: Recording samples in multiple languages improves recognition
          when you switch languages
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
            Record at least 1 sample to continue.
          </div>
        )}

        {error && (
          <div className="mt-4 flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
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
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-900">{recordingError}</p>
          </div>
        )}
      </div>

      {/* Phrase Navigator */}
      <div className="mb-8">
        <h3 className="font-semibold text-slate-900 mb-4">
          Select Phrase
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({currentLanguageInfo.flag} {currentLanguageInfo.name})
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {currentPhrases.map((phrase, idx) => {
            const count = recordings.filter(
              (r) => r.phraseIndex === idx && r.language === selectedLanguage,
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
            {recordings.map((recording) => {
              const recordingLang = recording.language || "en";
              const langPhrases =
                TRAINING_PHRASES_BY_LANGUAGE[recordingLang] || TRAINING_PHRASES;
              const phrase =
                langPhrases[recording.phraseIndex] || langPhrases[0];
              const langInfo = SUPPORTED_LANGUAGES.find(
                (l) => l.code === recordingLang,
              );
              const mins = Math.floor(recording.duration / 60);
              const secs = recording.duration % 60;
              const durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;

              return (
                <div
                  key={recording.id}
                  className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300"
                >
                  <div className="shrink-0 text-lg" title={langInfo?.name}>
                    {langInfo?.flag || "🌐"}
                  </div>
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

                  <div className="flex items-center gap-2 shrink-0">
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
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    )}
                    {recording.uploadStatus === "uploading" && (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                    {recording.uploadStatus === "failed" && (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
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
          <li>
            • Train with multiple languages for better multilingual recognition
          </li>
          <li>• Multiple recordings of the same phrase strengthen the model</li>
        </ul>
      </div>
    </div>
  );
}
