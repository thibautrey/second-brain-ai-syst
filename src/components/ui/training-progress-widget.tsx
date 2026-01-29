import { useEffect, useState, useRef } from "react";
import * as trainingAPI from "../../services/training-api";
import { useTranslation } from "react-i18next";

interface ActiveTraining {
  id: string;
  progress: number;
  currentStep: string | null;
  status: string;
}

export function TrainingProgressWidget() {
  const { t } = useTranslation();
  const [activeTraining, setActiveTraining] = useState<ActiveTraining | null>(
    null,
  );
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Initial fetch to get current state
    const fetchInitialState = async () => {
      try {
        const sessions = await trainingAPI.getActiveTrainingSessions();
        if (sessions && sessions.length > 0) {
          const session = sessions[0];
          setActiveTraining({
            id: session.id,
            progress: session.progress,
            currentStep: session.currentStep || null,
            status: session.status,
          });
        }
      } catch (error) {
        console.error("Failed to fetch initial training sessions:", error);
      }
    };

    fetchInitialState();

    // Subscribe to SSE updates
    cleanupRef.current = trainingAPI.subscribeToTrainingUpdates(
      (sessions) => {
        if (sessions && sessions.length > 0) {
          // Find active session (pending or in-progress)
          const activeSession = sessions.find(
            (s) => s.status === "pending" || s.status === "in-progress",
          );

          if (activeSession) {
            setActiveTraining({
              id: activeSession.id,
              progress: activeSession.progress,
              currentStep: activeSession.currentStep,
              status: activeSession.status,
            });
          } else {
            // Check if a session just completed or failed
            const completedOrFailed = sessions.find(
              (s) => s.status === "completed" || s.status === "failed",
            );

            if (completedOrFailed) {
              // Show completed state briefly then hide
              setActiveTraining({
                id: completedOrFailed.id,
                progress: completedOrFailed.progress,
                currentStep: completedOrFailed.currentStep,
                status: completedOrFailed.status,
              });

              // Hide widget after 3 seconds if completed/failed
              setTimeout(() => {
                setActiveTraining(null);
              }, 3000);
            } else {
              setActiveTraining(null);
            }
          }
        }
      },
      (error) => {
        console.error("SSE connection error:", error);
      },
    );

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  if (!activeTraining) {
    return null;
  }

  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset =
    circumference - (activeTraining.progress / 100) * circumference;

  const getStepLabel = (step: string | null, progress: number): string => {
    if (!step) return `${progress}%`;

    const stepMap: Record<string, string> = {
      initializing: t("training.widget.steps.initializing"),
      "loading-samples": t("training.widget.steps.loadingSamples"),
      "extracting-embeddings": t("training.widget.steps.extractingEmbeddings"),
      "computing-centroid": t("training.widget.steps.computingCentroid"),
      "computing-statistics": t("training.widget.steps.computingStatistics"),
      "saving-results": t("training.widget.steps.savingResults"),
      completed: t("training.widget.steps.completed"),
    };

    return stepMap[step] || `${progress}%`;
  };

  return (
    <div className="relative">
      <div
        className="relative inline-flex items-center justify-center w-12 h-12 cursor-pointer hover:opacity-80 transition-opacity"
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
      >
        {/* Background circle */}
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-slate-200"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="text-blue-600 transition-all duration-300"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "50px 50px",
            }}
          />
        </svg>

        {/* Center percentage */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-slate-900">
            {activeTraining.progress}%
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltipVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-900 text-white px-3 py-2 rounded-md text-xs whitespace-nowrap shadow-lg z-50">
          <div className="font-semibold">{t("training.widget.title")}</div>
          <div className="text-slate-300">
            {getStepLabel(activeTraining.currentStep, activeTraining.progress)}
          </div>
          <div className="text-slate-400">
            {t("training.widget.progress", {
              progress: activeTraining.progress,
            })}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}
