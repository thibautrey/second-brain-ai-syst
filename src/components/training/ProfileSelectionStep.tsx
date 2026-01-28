import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import {
  AlertCircle,
  Plus,
  CheckCircle2,
  Mic,
  Square,
  Shield,
  X,
  Trash2,
} from "lucide-react";
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
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [newProfileName, setNewProfileName] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  // Verification state
  const [verifyingProfileId, setVerifyingProfileId] = useState<string | null>(
    null,
  );
  const [isRecordingVerification, setIsRecordingVerification] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    recognized: boolean;
    confidence: number;
    profileName: string;
  } | null>(null);

  // Delete state
  const [confirmDeleteProfileId, setConfirmDeleteProfileId] = useState<
    string | null
  >(null);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
          err instanceof Error
            ? err.message
            : t("training.profileSelection.errors.loadProfiles"),
        );
      } finally {
        setIsLoadingProfiles(false);
      }
    };

    loadProfiles();
  }, [onProfileSelected]);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setLocalError(t("training.profileSelection.errors.profileNameRequired"));
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
        err instanceof Error
          ? err.message
          : t("training.profileSelection.errors.createProfile"),
      );
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleSelectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    onProfileSelected(profileId);
  };

  // Handle delete profile
  const handleDeleteProfile = async (profileId: string) => {
    try {
      setIsDeletingProfile(true);
      setLocalError(null);
      await trainingAPI.deleteSpeakerProfile(profileId);

      // Remove from local state
      setProfiles(profiles.filter((p) => p.id !== profileId));

      // Clear selection if deleted profile was selected
      if (selectedProfileId === profileId) {
        setSelectedProfileId(null);
      }

      setConfirmDeleteProfileId(null);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : t("training.profileSelection.errors.deleteProfile"),
      );
    } finally {
      setIsDeletingProfile(false);
    }
  };

  // Start verification recording
  const startVerificationRecording = async (profileId: string) => {
    setVerifyingProfileId(profileId);
    setVerificationResult(null);
    setLocalError(null);

    try {
      // Use same audio parameters as continuous listening for consistency
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        await handleVerification(audioBlob, profileId);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecordingVerification(true);
    } catch (err) {
      setLocalError(t("training.profileSelection.errors.microphoneAccess"));
      setVerifyingProfileId(null);
    }
  };

  // Stop verification recording
  const stopVerificationRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecordingVerification(false);
  };

  // Cancel verification
  const cancelVerification = () => {
    stopVerificationRecording();
    setVerifyingProfileId(null);
    setVerificationResult(null);
  };

  // Handle verification API call
  const handleVerification = async (audioBlob: Blob, profileId: string) => {
    setIsVerifying(true);
    setLocalError(null);

    try {
      const mimeType = audioBlob.type || "audio/webm";
      const extensionMap: Record<string, string> = {
        "audio/webm": "webm",
        "audio/webm;codecs=opus": "webm",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
      };
      const extension = extensionMap[mimeType] || "webm";

      const audioFile = new File(
        [audioBlob],
        `verification-${Date.now()}.${extension}`,
        {
          type: mimeType,
        },
      );

      const result = await trainingAPI.verifyVoice(audioFile, profileId);
      setVerificationResult({
        recognized: result.recognized,
        confidence: result.confidence,
        profileName: result.profileName,
      });
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : t("training.profileSelection.errors.verificationFailed"),
      );
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoadingProfiles) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-slate-600">
          {t("training.profileSelection.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {t("training.profileSelection.title")}
        </h2>
        <p className="text-slate-600">
          {t("training.profileSelection.subtitle")}
        </p>
      </div>

      {(error || localError) && (
        <div className="mb-6 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">{t("common.error")}</p>
            <p className="text-sm text-red-800 mt-1">{error || localError}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Existing Profiles */}
        {profiles.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {t("training.profileSelection.yourProfiles")}
            </h3>
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`p-4 border rounded-lg transition-all ${
                    selectedProfileId === profile.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => handleSelectProfile(profile.id)}
                  >
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
                        {t("training.profileSelection.sampleCount", {
                          count: profile.voiceSamples?.length || 0,
                        })}{" "}
                        •{" "}
                        {t("training.profileSelection.createdOn", {
                          date: new Date(
                            profile.createdAt,
                          ).toLocaleDateString(),
                        })}
                      </p>

                      {profile.isEnrolled && (
                        <div className="mt-2 inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
                          {t("training.profileSelection.enrolled")}
                        </div>
                      )}
                    </div>
                    {/* Delete button */}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteProfileId(profile.id);
                      }}
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                      disabled={isDeletingProfile}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Delete confirmation */}
                  {confirmDeleteProfileId === profile.id && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-900 mb-3">
                        {t("training.profileSelection.confirmDelete")}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(profile.id);
                          }}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white gap-1"
                          disabled={isDeletingProfile}
                        >
                          {isDeletingProfile ? (
                            <span className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              {t("training.profileSelection.deleting")}
                            </span>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              {t("common.delete")}
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteProfileId(null);
                          }}
                          size="sm"
                          variant="outline"
                          disabled={isDeletingProfile}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Verify Voice Button - only for enrolled profiles */}
                  {profile.isEnrolled && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      {verifyingProfileId === profile.id ? (
                        <div className="space-y-3">
                          {isRecordingVerification ? (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 flex-1">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-sm text-slate-600">
                                  {t("training.profileSelection.recording")}
                                </span>
                              </div>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopVerificationRecording();
                                }}
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white gap-1"
                              >
                                <Square className="w-4 h-4" />
                                {t("training.profileSelection.stop")}
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelVerification();
                                }}
                                size="sm"
                                variant="outline"
                                className="gap-1"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : isVerifying ? (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                              {t("training.profileSelection.verifying")}
                            </div>
                          ) : verificationResult ? (
                            <div
                              className={`p-3 rounded-lg ${
                                verificationResult.recognized
                                  ? "bg-green-50 border border-green-200"
                                  : "bg-amber-50 border border-amber-200"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {verificationResult.recognized ? (
                                  <>
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <span className="font-medium text-green-900">
                                      {t(
                                        "training.profileSelection.voiceRecognized",
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-5 h-5 text-amber-600" />
                                    <span className="font-medium text-amber-900">
                                      {t(
                                        "training.profileSelection.voiceNotRecognized",
                                      )}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm mt-1 text-slate-600">
                                {t("training.profileSelection.confidence", {
                                  percent: (
                                    verificationResult.confidence * 100
                                  ).toFixed(1),
                                })}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startVerificationRecording(profile.id);
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                >
                                  <Mic className="w-4 h-4" />
                                  {t("training.profileSelection.tryAgain")}
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVerifyingProfileId(null);
                                    setVerificationResult(null);
                                  }}
                                  size="sm"
                                  variant="ghost"
                                >
                                  {t("training.profileSelection.close")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startVerificationRecording(profile.id);
                                }}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-1"
                              >
                                <Mic className="w-4 h-4" />
                                {t("training.profileSelection.startRecording")}
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelVerification();
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                {t("common.cancel")}
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVerifyingProfileId(profile.id);
                          }}
                          size="sm"
                          variant="outline"
                          className="gap-2 text-slate-600 hover:text-slate-900"
                        >
                          <Shield className="w-4 h-4" />
                          {t("training.profileSelection.verifyVoice")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create New Profile */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {t("training.profileSelection.createTitle")}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                {t("training.profileSelection.profileNameLabel")}
              </label>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder={t(
                  "training.profileSelection.profileNamePlaceholder",
                )}
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
              {isCreatingProfile
                ? t("training.profileSelection.creating")
                : t("training.profileSelection.createAction")}
            </Button>
          </div>
        </div>

        {/* Continue Button */}
        <Button
          onClick={onContinue}
          disabled={isLoading || !selectedProfileId}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 font-medium text-lg"
        >
          {t("training.profileSelection.continue")}
        </Button>
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">
          {t("training.profileSelection.tipsTitle")}
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          {t<string[]>("training.profileSelection.tips", {
            returnObjects: true,
          }).map((tip) => (
            <li key={tip}>• {tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
