import { useState } from "react";
import { Button } from "../ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Play,
  Trash2,
  Globe,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { RecordingControl } from "./RecordingControl";

interface ParagraphRecording {
  id: string;
  url: string;
  duration: number;
  paragraphIndex: number;
  language: string;
  timestamp: number;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
}

interface ReadParagraphStepProps {
  recordings: ParagraphRecording[];
  currentParagraphIndex: number;
  speakerProfileId: string;
  onRecordingComplete: (
    audioBlob: Blob,
    duration: number,
    language: string,
    paragraphIndex: number
  ) => Promise<void>;
  onDeleteRecording: (id: string) => void;
  onParagraphChange: (index: number) => void;
  onContinue: () => void;
  onBack: () => void;
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
];

// Training paragraphs organized by language - longer texts for better voice modeling
const TRAINING_PARAGRAPHS_BY_LANGUAGE: Record<
  string,
  { text: string; title: string; estimatedTime: string }[]
> = {
  en: [
    {
      title: "A Morning Routine",
      estimatedTime: "30-45 sec",
      text: "Every morning, I wake up around seven o'clock and start my day with a glass of water. After stretching for a few minutes, I head to the kitchen to prepare breakfast. I usually have some toast with jam and a cup of fresh coffee. While eating, I like to check the weather forecast and plan my activities for the day. It's a simple routine, but it helps me feel organized and ready to take on whatever challenges lie ahead.",
    },
    {
      title: "Technology Today",
      estimatedTime: "30-45 sec",
      text: "Technology has transformed the way we live and work in remarkable ways. Smartphones allow us to stay connected with friends and family no matter where we are. We can access information instantly, manage our schedules, and even control our homes remotely. While these advancements bring great convenience, it's important to find balance and occasionally disconnect to enjoy the simple pleasures of life without screens.",
    },
    {
      title: "A Walk in Nature",
      estimatedTime: "30-45 sec",
      text: "There's something magical about taking a walk through the forest on a crisp autumn morning. The leaves crunch beneath your feet, painted in brilliant shades of orange, red, and gold. Birds sing their morning songs from high up in the branches, while squirrels dart across the path collecting acorns for winter. The fresh air fills your lungs, and for a moment, all your worries seem to fade away into the peaceful surroundings.",
    },
  ],
  fr: [
    {
      title: "Une Routine Matinale",
      estimatedTime: "30-45 sec",
      text: "Chaque matin, je me réveille vers sept heures et je commence ma journée avec un verre d'eau. Après quelques minutes d'étirements, je me dirige vers la cuisine pour préparer le petit-déjeuner. Je prends habituellement des tartines avec de la confiture et une tasse de café frais. Pendant que je mange, j'aime consulter la météo et planifier mes activités de la journée. C'est une routine simple, mais elle m'aide à me sentir organisé et prêt à affronter tous les défis qui m'attendent.",
    },
    {
      title: "La Technologie Aujourd'hui",
      estimatedTime: "30-45 sec",
      text: "La technologie a transformé notre façon de vivre et de travailler de manière remarquable. Les smartphones nous permettent de rester connectés avec nos amis et notre famille, peu importe où nous sommes. Nous pouvons accéder à l'information instantanément, gérer nos emplois du temps et même contrôler nos maisons à distance. Bien que ces avancées apportent un grand confort, il est important de trouver un équilibre et de se déconnecter occasionnellement pour profiter des plaisirs simples de la vie sans écrans.",
    },
    {
      title: "Une Promenade dans la Nature",
      estimatedTime: "30-45 sec",
      text: "Il y a quelque chose de magique à se promener dans la forêt par un matin d'automne frais. Les feuilles craquent sous vos pieds, peintes dans des teintes brillantes d'orange, de rouge et d'or. Les oiseaux chantent leurs mélodies matinales depuis les branches, tandis que les écureuils traversent le chemin en collectant des glands pour l'hiver. L'air frais remplit vos poumons, et pendant un moment, tous vos soucis semblent s'évanouir dans ce cadre paisible.",
    },
  ],
  es: [
    {
      title: "Una Rutina Matutina",
      estimatedTime: "30-45 sec",
      text: "Cada mañana, me despierto alrededor de las siete y comienzo mi día con un vaso de agua. Después de estirarme unos minutos, me dirijo a la cocina para preparar el desayuno. Normalmente tomo tostadas con mermelada y una taza de café recién hecho. Mientras como, me gusta consultar el pronóstico del tiempo y planificar mis actividades del día. Es una rutina simple, pero me ayuda a sentirme organizado y listo para enfrentar cualquier desafío que se presente.",
    },
    {
      title: "La Tecnología Hoy",
      estimatedTime: "30-45 sec",
      text: "La tecnología ha transformado la forma en que vivimos y trabajamos de maneras extraordinarias. Los teléfonos inteligentes nos permiten mantenernos conectados con amigos y familiares sin importar dónde estemos. Podemos acceder a la información al instante, gestionar nuestras agendas e incluso controlar nuestros hogares de forma remota. Aunque estos avances nos brindan gran comodidad, es importante encontrar un equilibrio y desconectarnos ocasionalmente para disfrutar de los placeres simples de la vida sin pantallas.",
    },
    {
      title: "Un Paseo por la Naturaleza",
      estimatedTime: "30-45 sec",
      text: "Hay algo mágico en dar un paseo por el bosque en una fresca mañana de otoño. Las hojas crujen bajo tus pies, pintadas en brillantes tonos de naranja, rojo y dorado. Los pájaros cantan sus canciones matutinas desde lo alto de las ramas, mientras las ardillas corren por el camino recolectando bellotas para el invierno. El aire fresco llena tus pulmones, y por un momento, todas tus preocupaciones parecen desvanecerse en el entorno pacífico.",
    },
  ],
  de: [
    {
      title: "Eine Morgenroutine",
      estimatedTime: "30-45 sec",
      text: "Jeden Morgen wache ich gegen sieben Uhr auf und beginne meinen Tag mit einem Glas Wasser. Nach ein paar Minuten Dehnen gehe ich in die Küche, um das Frühstück vorzubereiten. Normalerweise esse ich Toast mit Marmelade und trinke eine Tasse frischen Kaffee. Beim Essen schaue ich gerne die Wettervorhersage und plane meine Aktivitäten für den Tag. Es ist eine einfache Routine, aber sie hilft mir, mich organisiert zu fühlen und bereit zu sein, alle Herausforderungen anzunehmen, die vor mir liegen.",
    },
    {
      title: "Technologie Heute",
      estimatedTime: "30-45 sec",
      text: "Die Technologie hat unsere Art zu leben und zu arbeiten auf bemerkenswerte Weise verändert. Smartphones ermöglichen es uns, mit Freunden und Familie in Kontakt zu bleiben, egal wo wir sind. Wir können sofort auf Informationen zugreifen, unsere Termine verwalten und sogar unsere Häuser aus der Ferne steuern. Obwohl diese Fortschritte großen Komfort bieten, ist es wichtig, ein Gleichgewicht zu finden und sich gelegentlich zu trennen, um die einfachen Freuden des Lebens ohne Bildschirme zu genießen.",
    },
    {
      title: "Ein Spaziergang in der Natur",
      estimatedTime: "30-45 sec",
      text: "Es ist etwas Magisches an einem Spaziergang durch den Wald an einem frischen Herbstmorgen. Die Blätter knirschen unter den Füßen, gefärbt in leuchtenden Tönen von Orange, Rot und Gold. Vögel singen ihre Morgenlieder hoch oben in den Ästen, während Eichhörnchen über den Weg huschen und Eicheln für den Winter sammeln. Die frische Luft füllt die Lungen, und für einen Moment scheinen alle Sorgen in der friedlichen Umgebung zu verschwinden.",
    },
  ],
  it: [
    {
      title: "Una Routine Mattutina",
      estimatedTime: "30-45 sec",
      text: "Ogni mattina mi sveglio verso le sette e inizio la mia giornata con un bicchiere d'acqua. Dopo qualche minuto di stretching, mi dirigo in cucina per preparare la colazione. Di solito mangio del pane tostato con marmellata e bevo una tazza di caffè fresco. Mentre mangio, mi piace controllare le previsioni del tempo e pianificare le mie attività della giornata. È una routine semplice, ma mi aiuta a sentirmi organizzato e pronto ad affrontare qualsiasi sfida mi aspetti.",
    },
    {
      title: "La Tecnologia Oggi",
      estimatedTime: "30-45 sec",
      text: "La tecnologia ha trasformato il nostro modo di vivere e lavorare in modi straordinari. Gli smartphone ci permettono di restare connessi con amici e familiari ovunque siamo. Possiamo accedere alle informazioni istantaneamente, gestire i nostri impegni e persino controllare le nostre case da remoto. Sebbene questi progressi portino grande comodità, è importante trovare un equilibrio e disconnettersi occasionalmente per godere dei piaceri semplici della vita senza schermi.",
    },
    {
      title: "Una Passeggiata nella Natura",
      estimatedTime: "30-45 sec",
      text: "C'è qualcosa di magico nel fare una passeggiata nel bosco in una fresca mattina d'autunno. Le foglie scricchiolano sotto i piedi, dipinte in brillanti sfumature di arancione, rosso e oro. Gli uccelli cantano le loro canzoni mattutine dall'alto dei rami, mentre gli scoiattoli attraversano il sentiero raccogliendo ghiande per l'inverno. L'aria fresca riempie i polmoni, e per un momento tutte le preoccupazioni sembrano svanire nel paesaggio sereno.",
    },
  ],
  pt: [
    {
      title: "Uma Rotina Matinal",
      estimatedTime: "30-45 sec",
      text: "Todas as manhãs, acordo por volta das sete horas e começo meu dia com um copo de água. Depois de me alongar por alguns minutos, vou para a cozinha preparar o café da manhã. Normalmente como torradas com geleia e tomo uma xícara de café fresco. Enquanto como, gosto de verificar a previsão do tempo e planejar minhas atividades do dia. É uma rotina simples, mas me ajuda a me sentir organizado e pronto para enfrentar qualquer desafio que apareça.",
    },
    {
      title: "A Tecnologia Hoje",
      estimatedTime: "30-45 sec",
      text: "A tecnologia transformou a forma como vivemos e trabalhamos de maneiras extraordinárias. Os smartphones nos permitem ficar conectados com amigos e familiares, não importa onde estejamos. Podemos acessar informações instantaneamente, gerenciar nossos compromissos e até controlar nossas casas remotamente. Embora esses avanços tragam grande conveniência, é importante encontrar equilíbrio e desconectar ocasionalmente para aproveitar os prazeres simples da vida sem telas.",
    },
    {
      title: "Um Passeio na Natureza",
      estimatedTime: "30-45 sec",
      text: "Há algo mágico em fazer um passeio pela floresta em uma manhã fresca de outono. As folhas estalam sob seus pés, pintadas em tons brilhantes de laranja, vermelho e dourado. Os pássaros cantam suas canções matinais no alto dos galhos, enquanto os esquilos correm pelo caminho coletando bolotas para o inverno. O ar fresco enche seus pulmões, e por um momento, todas as suas preocupações parecem desaparecer no ambiente tranquilo.",
    },
  ],
};

export function ReadParagraphStep({
  recordings,
  currentParagraphIndex,
  speakerProfileId,
  onRecordingComplete,
  onDeleteRecording,
  onParagraphChange,
  onContinue,
  onBack,
  isLoading,
  error,
}: ReadParagraphStepProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  // Get paragraphs for current language
  const currentParagraphs =
    TRAINING_PARAGRAPHS_BY_LANGUAGE[selectedLanguage] ||
    TRAINING_PARAGRAPHS_BY_LANGUAGE.en;
  const currentParagraph =
    currentParagraphs[currentParagraphIndex] || currentParagraphs[0];

  // Get language info
  const currentLanguageInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage) ||
    SUPPORTED_LANGUAGES[0];

  // Count recordings by language
  const recordingsByLanguage = SUPPORTED_LANGUAGES.reduce(
    (acc, lang) => {
      acc[lang.code] = recordings.filter(
        (r) => r.language === lang.code
      ).length;
      return acc;
    },
    {} as Record<string, number>
  );

  const languagesUsed = Object.entries(recordingsByLanguage).filter(
    ([, count]) => count > 0
  );
  const totalRecordings = recordings.length;

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setIsRecording(false);
    setRecordingError(null);
    try {
      await onRecordingComplete(
        audioBlob,
        duration,
        selectedLanguage,
        currentParagraphIndex
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Recording failed";
      setRecordingError(msg);
    }
  };

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    setShowLanguageSelector(false);
    onParagraphChange(0);
  };

  const handlePrevParagraph = () => {
    if (currentParagraphIndex > 0) {
      onParagraphChange(currentParagraphIndex - 1);
    }
  };

  const handleNextParagraph = () => {
    if (currentParagraphIndex < currentParagraphs.length - 1) {
      onParagraphChange(currentParagraphIndex + 1);
    }
  };

  // Need at least 1 paragraph recording to continue
  const canContinue = totalRecordings >= 1;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-indigo-600" />
          Read Longer Texts
        </h2>
        <p className="text-slate-600">
          Read the paragraph below naturally. Longer recordings help the system
          better understand your voice patterns, intonation, and speaking
          rhythm.
        </p>
      </div>

      {/* Language Selector */}
      <div className="bg-linear-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <span className="font-medium text-slate-900">Reading Language</span>
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
                        {count} recording{count > 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{totalRecordings}</p>
            <p className="text-xs text-slate-600 mt-1">Paragraph Recordings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">
              {currentParagraphIndex + 1}/{currentParagraphs.length}
            </p>
            <p className="text-xs text-slate-600 mt-1">Current Text</p>
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
              {canContinue ? "Ready" : "Record at least 1"}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}
      </div>

      {/* Paragraph Display */}
      <div className="bg-white rounded-lg border-2 border-indigo-200 shadow-sm mb-6">
        <div className="p-4 border-b border-indigo-100 bg-indigo-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">
                {currentParagraph.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Estimated reading time: {currentParagraph.estimatedTime}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevParagraph}
                disabled={currentParagraphIndex === 0}
                className="p-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-600 min-w-[60px] text-center">
                {currentParagraphIndex + 1} / {currentParagraphs.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextParagraph}
                disabled={currentParagraphIndex === currentParagraphs.length - 1}
                className="p-2"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-lg leading-relaxed text-slate-800">
            {currentParagraph.text}
          </p>
        </div>
      </div>

      {/* Recording Control */}
      <div className="mb-8">
        <RecordingControl
          phrase={currentParagraph.text}
          category={`Paragraph - ${currentParagraph.title}`}
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

      {/* Paragraph Selector */}
      <div className="mb-8">
        <h3 className="font-semibold text-slate-900 mb-4">
          Select Text to Read
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({currentLanguageInfo.flag} {currentLanguageInfo.name})
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {currentParagraphs.map((paragraph, idx) => {
            const count = recordings.filter(
              (r) =>
                r.paragraphIndex === idx && r.language === selectedLanguage
            ).length;
            return (
              <button
                key={idx}
                onClick={() => onParagraphChange(idx)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  currentParagraphIndex === idx
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium text-slate-900">{paragraph.title}</p>
                  {count > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full shrink-0">
                      {count}x
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {paragraph.text.substring(0, 100)}...
                </p>
                <p className="text-xs text-indigo-600 mt-2">
                  ~{paragraph.estimatedTime}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recorded Samples */}
      {recordings.length > 0 && (
        <div className="mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">
            Your Paragraph Recordings
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recordings.map((recording) => {
              const recordingLang = recording.language || "en";
              const langParagraphs =
                TRAINING_PARAGRAPHS_BY_LANGUAGE[recordingLang] ||
                TRAINING_PARAGRAPHS_BY_LANGUAGE.en;
              const paragraph =
                langParagraphs[recording.paragraphIndex] || langParagraphs[0];
              const langInfo = SUPPORTED_LANGUAGES.find(
                (l) => l.code === recordingLang
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
                    <p className="text-sm font-medium text-slate-900">
                      {paragraph.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                      <span>{durationStr}</span>
                      <span>•</span>
                      <span>
                        {new Date(recording.timestamp).toLocaleTimeString()}
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
      <div className="flex flex-col gap-3 pt-4 border-t border-slate-200">
        <div className="flex gap-3">
          <Button
            onClick={onBack}
            variant="outline"
            className="px-6 py-3 font-medium"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Phrases
          </Button>
          <Button
            onClick={onContinue}
            disabled={isLoading}
            className={`flex-1 py-3 font-medium ${
              canContinue
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-white"
            }`}
          >
            {isLoading
              ? "Processing..."
              : canContinue
                ? "Continue to Training"
                : "Skip & Continue to Training"}
          </Button>
        </div>
        {!canContinue && (
          <p className="text-xs text-center text-slate-500">
            💡 Recording at least one paragraph is recommended for better voice recognition, but you can skip this step.
          </p>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
        <h4 className="font-semibold text-indigo-900 mb-2">
          Why Read Longer Texts?
        </h4>
        <ul className="text-sm text-indigo-800 space-y-1">
          <li>
            • Longer recordings capture more voice characteristics and patterns
          </li>
          <li>• Helps the system learn your natural speaking rhythm</li>
          <li>• Improves recognition of your voice in continuous speech</li>
          <li>• Better handles variations in tone and emphasis</li>
        </ul>
      </div>
    </div>
  );
}

export { TRAINING_PARAGRAPHS_BY_LANGUAGE };
