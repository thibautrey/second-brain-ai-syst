import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ProfileSetupStepProps {
  profileName: string;
  userEmail: string;
  onProfileNameChange: (name: string) => void;
  onContinue: () => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export function ProfileSetupStep({
  profileName,
  userEmail,
  onProfileNameChange,
  onContinue,
  isLoading,
  error,
}: ProfileSetupStepProps) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);

  const handleContinue = async () => {
    setFormError(null);

    if (!profileName.trim()) {
      setFormError(t("training.profileSetup.errors.profileNameRequired"));
      return;
    }

    try {
      await onContinue();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : t("training.profileSetup.errors.generic"),
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">
          {t("training.profileSetup.title")}
        </h2>
        <p className="text-slate-600">
          {t("training.profileSetup.subtitle")}
        </p>
      </div>

      <div className="p-8 space-y-6 bg-white border rounded-lg shadow-sm border-slate-200">
        {/* Profile Name Input */}
        <div>
          <label
            htmlFor="profile-name"
            className="block mb-2 text-sm font-medium text-slate-900"
          >
            {t("training.profileSetup.profileNameLabel")}
          </label>
          <input
            id="profile-name"
            type="text"
            value={profileName}
            onChange={(e) => onProfileNameChange(e.target.value)}
            placeholder={t("training.profileSetup.profileNamePlaceholder")}
            className="w-full px-4 py-3 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-slate-500">
            {t("training.profileSetup.profileNameHint")}
          </p>
        </div>

        {/* Email Display */}
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-900">
            {t("training.profileSetup.emailLabel")}
          </label>
          <div className="w-full px-4 py-3 border rounded-lg border-slate-300 bg-slate-50 text-slate-700">
            {userEmail}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t("training.profileSetup.emailHint")}
          </p>
        </div>

        {/* Error Message */}
        {(error || formError) && (
          <div className="flex gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">
                {t("common.error")}
              </p>
              <p className="mt-1 text-sm text-red-800">{error || formError}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleContinue}
            disabled={isLoading || !profileName.trim()}
            className="flex-1 py-3 font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            {isLoading
              ? t("training.profileSetup.creating")
              : t("training.profileSetup.continueToRecording")}
          </Button>
        </div>
      </div>

      {/* Info Section */}
      <div className="grid grid-cols-1 gap-4 mt-8 md:grid-cols-2">
        <div className="p-4 border rounded-lg bg-slate-50 border-slate-200">
          <h3 className="flex items-center gap-2 mb-3 font-semibold text-slate-900">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            {t("training.profileSetup.nextStepsTitle")}
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {t<string[]>("training.profileSetup.nextSteps", {
              returnObjects: true,
            }).map((step) => (
              <li key={step}>• {step}</li>
            ))}
          </ul>
        </div>

        <div className="p-4 border rounded-lg bg-slate-50 border-slate-200">
          <h3 className="flex items-center gap-2 mb-3 font-semibold text-slate-900">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            {t("training.profileSetup.timeEstimateTitle")}
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {t<string[]>("training.profileSetup.timeEstimates", {
              returnObjects: true,
            }).map((step) => (
              <li key={step}>• {step}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
