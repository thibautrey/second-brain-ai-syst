import { useEffect, useState } from "react";
import * as trainingAPI from "../../services/training-api";

interface ActiveTraining {
  id: string;
  progress: number;
  currentStep: string | null;
  status: string;
}

export function TrainingProgressWidget() {
  const [activeTraining, setActiveTraining] = useState<ActiveTraining | null>(
    null,
  );
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    const checkActiveSessions = async () => {
      try {
        const sessions = await trainingAPI.getActiveTrainingSessions();

        if (sessions && sessions.length > 0) {
          const session = sessions[0];
          setActiveTraining({
            id: session.id,
            progress: session.progress,
            currentStep: session.currentStep,
            status: session.status,
          });
        } else {
          setActiveTraining(null);
        }
      } catch (error) {
        console.error("Failed to check active training sessions:", error);
      }
    };

    // Check immediately
    checkActiveSessions();

    // Poll every 2 seconds
    const interval = setInterval(checkActiveSessions, 2000);

    return () => clearInterval(interval);
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
      initializing: "Initializing...",
      "loading-samples": "Loading samples...",
      "extracting-embeddings": "Extracting embeddings...",
      "computing-centroid": "Computing centroid...",
      "computing-statistics": "Computing statistics...",
      "saving-results": "Saving results...",
      completed: "Completed!",
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
          <div className="font-semibold">Training Session</div>
          <div className="text-slate-300">
            {getStepLabel(activeTraining.currentStep, activeTraining.progress)}
          </div>
          <div className="text-slate-400">
            Progress: {activeTraining.progress}%
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}
