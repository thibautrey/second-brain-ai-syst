import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { AlertCircle, Plus, CheckCircle2 } from "lucide-react";
import * as trainingAPI from "../../services/training-api";

interface ProfileSelectionStepProps {
  onProfileSelected: (profileId: string) => void;
  onContinue: () => void;
  isLoading?: boolean;
  error?: string;
}

export function ProfileSelectionStep({
  onProfileSelected,
  onContinue,
  isLoading,
  error,
}: ProfileSelectionStepProps) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [newProfileName, setNewProfileName] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  // Load existing profiles on mount
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        setIsLoadingProfiles(true);
        setLocalError(null);
        const loadedProfiles = await trainingAPI.listSpeakerProfiles();
        setProfiles(loadedProfiles);

        // Auto-select first profile if only one exists
        if (loadedProfiles.length === 1) {
          setSelectedProfileId(loadedProfiles[0].id);
          onProfileSelected(loadedProfiles[0].id);
        }
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Failed to load profiles",
        );
      } finally {
        setIsLoadingProfiles(false);
      }
    };

    loadProfiles();
  }, [onProfileSelected]);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setLocalError("Profile name is required");
      return;
    }

    try {
      setIsCreatingProfile(true);
      setLocalError(null);
      const newProfile = await trainingAPI.createSpeakerProfile(
        newProfileName.trim(),
      );
      setProfiles([newProfile, ...profiles]);
      setSelectedProfileId(newProfile.id);
      setNewProfileName("");
      onProfileSelected(newProfile.id);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Failed to create profile",
      );
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleSelectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    onProfileSelected(profileId);
  };

  if (isLoadingProfiles) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-slate-600">Loading your profiles...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Select or Create a Voice Profile
        </h2>
        <p className="text-slate-600">
          You can create multiple profiles for different voices and train them
          independently. You can always add more samples to improve accuracy.
        </p>
      </div>

      {(error || localError) && (
        <div className="mb-6 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-800 mt-1">{error || localError}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Existing Profiles */}
        {profiles.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Your Profiles
            </h3>
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedProfileId === profile.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                  onClick={() => handleSelectProfile(profile.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {selectedProfileId === profile.id && (
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        )}
                        <h4 className="font-medium text-slate-900">
                          {profile.name}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {profile.voiceSamples?.length || 0} samples • Created{" "}
                        {new Date(profile.createdAt).toLocaleDateString()}
                      </p>

                      {profile.isEnrolled && (
                        <div className="mt-2 inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
                          ✓ Enrolled
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create New Profile */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create New Profile
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Profile Name
              </label>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="e.g., Work Voice, Personal, Second Language"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isCreatingProfile || isLoading}
              />
            </div>
            <Button
              onClick={handleCreateProfile}
              disabled={
                isCreatingProfile || isLoading || !newProfileName.trim()
              }
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 font-medium"
            >
              {isCreatingProfile ? "Creating..." : "Create New Profile"}
            </Button>
          </div>
        </div>

        {/* Continue Button */}
        <Button
          onClick={onContinue}
          disabled={isLoading || !selectedProfileId}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 font-medium text-lg"
        >
          Continue with Selected Profile
        </Button>
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • You can add more samples to a profile at any time to improve
            accuracy
          </li>
          <li>• Re-training with more samples will refine the voice model</li>
          <li>• Keep profiles organized by naming them descriptively</li>
        </ul>
      </div>
    </div>
  );
}
