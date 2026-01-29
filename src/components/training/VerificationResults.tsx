import { useState } from "react";
import { Button } from "../ui/button";
import { AlertCircle, CheckCircle2, TrendingUp, Mic } from "lucide-react";
import { VerificationRecording } from "./VerificationRecording";
import { useTranslation } from "react-i18next";

interface VerificationResultsProps {
  speakerProfileId: string;
  confidenceScore: number;
  sampleCount: number;
  trainingDuration: number;
  onVerifyVoice: (audioBlob: Blob, duration: number) => Promise<void>;
  onComplete: () => void;
  isVerifying?: boolean;
  verificationResult?: {
    recognized: boolean;
    confidence: number;
  } | null;
  verificationError?: string;
}

export function VerificationResults({
  speakerProfileId,
  confidenceScore,
  sampleCount,
  trainingDuration,
  onVerifyVoice,
  onComplete,
  isVerifying,
  verificationResult,
  verificationError,
}: VerificationResultsProps) {
  const { t } = useTranslation();
  const [isRecordingVerification, setIsRecordingVerification] = useState(false);

  const qualityLabel =
    confidenceScore >= 0.9
      ? t("training.verificationResults.quality.excellent")
      : confidenceScore >= 0.8
        ? t("training.verificationResults.quality.veryGood")
        : confidenceScore >= 0.7
          ? t("training.verificationResults.quality.good")
          : t("training.verificationResults.quality.fair");

  const qualityColor =
    confidenceScore >= 0.9
      ? "text-green-600"
      : confidenceScore >= 0.8
        ? "text-emerald-600"
        : confidenceScore >= 0.7
          ? "text-blue-600"
          : "text-amber-600";

  const handleVerificationComplete = async (
    audioBlob: Blob,
    duration: number,
  ) => {
    setIsRecordingVerification(false);
    await onVerifyVoice(audioBlob, duration);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Success Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
          <h2 className="text-2xl font-bold text-slate-900">
            {t("training.verificationResults.title")}
          </h2>
        </div>
        <p className="text-slate-600">
          {t("training.verificationResults.subtitle")}
        </p>
      </div>

      {/* Profile Summary Card */}
      <div className="p-8 mb-6 space-y-6 bg-white border rounded-lg shadow-sm border-slate-200">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {/* Confidence Score */}
          <div className="p-4 border border-blue-200 rounded-lg bg-linear-to-br from-blue-50 to-indigo-50">
            <p className="mb-1 text-xs font-medium text-slate-600">
              {t("training.verificationResults.metrics.confidenceLabel")}
            </p>
            <p className={`text-3xl font-bold ${qualityColor}`}>
              {(confidenceScore * 100).toFixed(1)}%
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {qualityLabel}
            </p>
          </div>

          {/* Samples Recorded */}
          <div className="p-4 border border-purple-200 rounded-lg bg-linear-to-br from-purple-50 to-pink-50">
            <p className="mb-1 text-xs font-medium text-slate-600">
              {t("training.verificationResults.metrics.samplesLabel")}
            </p>
            <p className="text-3xl font-bold text-purple-600">{sampleCount}</p>
            <p className="mt-1 text-xs text-slate-600">
              {t("training.verificationResults.metrics.samplesUnit")}
            </p>
          </div>

          {/* Training Time */}
          <div className="p-4 border rounded-lg bg-linear-to-br from-emerald-50 to-cyan-50 border-emerald-200">
            <p className="mb-1 text-xs font-medium text-slate-600">
              {t("training.verificationResults.metrics.durationLabel")}
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              {trainingDuration.toFixed(1)}s
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {t("training.verificationResults.metrics.durationUnit")}
            </p>
          </div>
        </div>

        {/* Profile Quality Info */}
        <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-green-900">
                {confidenceScore >= 0.9
                  ? t("training.verificationResults.profile.excellentTitle")
                  : confidenceScore >= 0.8
                    ? t("training.verificationResults.profile.goodTitle")
                    : t("training.verificationResults.profile.createdTitle")}
              </p>
              <p className="mt-1 text-sm text-green-800">
                {confidenceScore >= 0.9
                  ? t("training.verificationResults.profile.excellentBody")
                  : confidenceScore >= 0.8
                    ? t("training.verificationResults.profile.goodBody")
                    : t("training.verificationResults.profile.createdBody")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Section */}
      <div className="p-8 mb-6 bg-white border rounded-lg shadow-sm border-slate-200">
        <h3 className="flex items-center gap-2 mb-4 text-lg font-bold text-slate-900">
          <Mic className="w-5 h-5" />
          {t("training.verificationResults.verifyTitle")}
        </h3>

        <p className="mb-6 text-slate-600">
          {t("training.verificationResults.verifySubtitle")}
        </p>

        {isRecordingVerification ? (
          <VerificationRecording
            onComplete={handleVerificationComplete}
            onCancel={() => setIsRecordingVerification(false)}
            disabled={isVerifying}
          />
        ) : (
          <Button
            onClick={() => setIsRecordingVerification(true)}
            disabled={isVerifying}
            className="w-full gap-2 py-3 font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Mic className="w-5 h-5" />
            {isVerifying
              ? t("training.verificationResults.verifying")
              : t("training.verificationResults.startVerification")}
          </Button>
        )}

        {/* Verification Results */}
        {verificationResult && (
          <div
            className={`mt-6 p-4 rounded-lg border-2 ${
              verificationResult.recognized
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {verificationResult.recognized ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              )}
              <div>
                <p
                  className={`font-semibold ${
                    verificationResult.recognized
                      ? "text-green-900"
                      : "text-amber-900"
                  }`}
                >
                  {verificationResult.recognized
                    ? t("training.verificationResults.recognized")
                    : t("training.verificationResults.notRecognized")}
                </p>
                <p
                  className={`text-sm mt-1 ${
                    verificationResult.recognized
                      ? "text-green-800"
                      : "text-amber-800"
                  }`}
                >
                  {t("training.verificationResults.confidence", {
                    score: (verificationResult.confidence * 100).toFixed(1),
                  })}
                </p>
                {!verificationResult.recognized && (
                  <p className="mt-2 text-sm text-amber-800">
                    {t("training.verificationResults.notRecognizedHint")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {verificationError && (
          <div className="flex gap-3 p-4 mt-6 border border-red-200 rounded-lg bg-red-50">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-900">{verificationError}</p>
          </div>
        )}
      </div>

      {/* Next Steps */}
      <div className="p-6 mb-6 space-y-4 border border-blue-200 rounded-lg bg-linear-to-r from-blue-50 to-indigo-50">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <CheckCircle2 className="w-5 h-5 text-blue-600" />
          {t("training.verificationResults.nextStepsTitle")}
        </h3>
        <ul className="space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <span className="shrink-0 font-bold text-blue-600">1.</span>
            <span>{t("training.verificationResults.nextSteps.0")}</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 font-bold text-blue-600">2.</span>
            <span>{t("training.verificationResults.nextSteps.1")}</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 font-bold text-blue-600">3.</span>
            <span>{t("training.verificationResults.nextSteps.2")}</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 font-bold text-blue-600">4.</span>
            <span>{t("training.verificationResults.nextSteps.3")}</span>
          </li>
        </ul>
      </div>

      {/* Action Button */}
      <Button
        onClick={onComplete}
        className="w-full py-3 text-lg font-semibold text-white bg-green-600 hover:bg-green-700"
      >
        {t("training.verificationResults.complete")}
      </Button>

      {/* Info Footer */}
      <div className="p-4 mt-6 space-y-2 text-xs border rounded-lg bg-slate-50 border-slate-200 text-slate-600">
        <p>
          <strong>{t("training.verificationResults.profileId")}:</strong>{" "}
          {speakerProfileId.substring(0, 16)}...
        </p>
        <p>
          <strong>{t("training.verificationResults.noteLabel")}:</strong>{" "}
          {t("training.verificationResults.note")}
        </p>
      </div>
    </div>
  );
}
