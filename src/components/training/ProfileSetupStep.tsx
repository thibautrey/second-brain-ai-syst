import { useState } from "react";
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
  const [formError, setFormError] = useState<string | null>(null);

  const handleContinue = async () => {
    setFormError(null);

    if (!profileName.trim()) {
      setFormError("Profile name is required");
      return;
    }

    try {
      await onContinue();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">
          Create Your Speaker Profile
        </h2>
        <p className="text-slate-600">
          Set up your profile to get started. This will be your unique voice
          identity in the system.
        </p>
      </div>

      <div className="p-8 space-y-6 bg-white border rounded-lg shadow-sm border-slate-200">
        {/* Profile Name Input */}
        <div>
          <label
            htmlFor="profile-name"
            className="block mb-2 text-sm font-medium text-slate-900"
          >
            Profile Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={profileName}
            onChange={(e) => onProfileNameChange(e.target.value)}
            placeholder="e.g., My Work Voice, Personal"
            className="w-full px-4 py-3 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-slate-500">
            Give your profile a memorable name
          </p>
        </div>

        {/* Email Display */}
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-900">
            Email Address
          </label>
          <div className="w-full px-4 py-3 border rounded-lg border-slate-300 bg-slate-50 text-slate-700">
            {userEmail}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Your account email (linked to your voice profile)
          </p>
        </div>

        {/* Error Message */}
        {(error || formError) && (
          <div className="flex gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
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
            {isLoading ? "Creating Profile..." : "Continue to Recording"}
          </Button>
        </div>
      </div>

      {/* Info Section */}
      <div className="grid grid-cols-1 gap-4 mt-8 md:grid-cols-2">
        <div className="p-4 border rounded-lg bg-slate-50 border-slate-200">
          <h3 className="flex items-center gap-2 mb-3 font-semibold text-slate-900">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            What happens next
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>• Record 5-10 voice samples</li>
            <li>• Read provided phrases naturally</li>
            <li>• Train the AI model</li>
            <li>• Verify your voice profile</li>
          </ul>
        </div>

        <div className="p-4 border rounded-lg bg-slate-50 border-slate-200">
          <h3 className="flex items-center gap-2 mb-3 font-semibold text-slate-900">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Time estimate
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>• Setup: 2 minutes</li>
            <li>• Recording: 5-10 minutes</li>
            <li>• Training: 2-5 minutes</li>
            <li>• Total: ~15 minutes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
