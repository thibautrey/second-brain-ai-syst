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

    if (!email.trim()) {
    

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Create Your Speaker Profile
        </h2>
        <p className="text-slate-600">
          Set up your profile to get started. This will be your unique voice
          identity in the system.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 space-y-6">
        {/* Profile Name Input */}
        <div>
          <label
            htmlFor="profile-name"
            className="block text-sm font-medium text-slate-900 mb-2"
          >
            Profile Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={profileName}
            onChange={(e) => onProfileNameChange(e.target.value)}
            placeholder="e.g., My Work Voice, Personal"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-slate-500">
            Give your profile a memorable name
          </p>
        </div>

        {/* Email Input */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-900 mb-2"
          >
            Email Address
          </label>
          <input
            id="email"
            type="Display */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Email Address
          </label>
          <div className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-700">
            {userEmail}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Your account email (linked to your voice profile)
              </p>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>💡 Tip:</strong> You can create multiple profiles if you
            want to train different voices (e.g., in different languages or with
            different speakers).
          </p>
        </div>

        {/* Continue Button */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleContinue}
            disabled={isLoading || !profileName.trim() || !email.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 font-medium"
          >
            {isLoading ? "Creating Profile..." : "Continue to Recording"}
          </Button>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 grid grid-cols-1 md:grid-co
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
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

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
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
