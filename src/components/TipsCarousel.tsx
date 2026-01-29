import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";

export interface Tip {
  id: string;
  title: string;
  description: string;
  category: string;
  targetFeature?: string;
  icon?: string;
  priority: number;
  isDismissed: boolean;
}

interface TipsCarouselProps {
  tips: Tip[];
  onDismiss: (tipId: string) => void;
  onView?: (tipId: string) => void;
}

const getIconColor = (icon?: string): string => {
  switch (icon) {
    case "lightbulb":
      return "text-yellow-500";
    case "star":
      return "text-blue-500";
    case "rocket":
      return "text-purple-500";
    case "zap":
      return "text-orange-500";
    default:
      return "text-slate-500";
  }
};

const getIconEmoji = (icon?: string): string => {
  switch (icon) {
    case "lightbulb":
      return "💡";
    case "star":
      return "⭐";
    case "rocket":
      return "🚀";
    case "zap":
      return "⚡";
    default:
      return "💬";
  }
};

export function TipsCarousel({ tips, onDismiss, onView }: TipsCarouselProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  if (!tips || tips.length === 0) {
    return null;
  }

  const currentTip = tips[currentIndex];

  // Auto-rotate tips every 8 seconds
  useEffect(() => {
    if (!autoRotate || tips.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tips.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [autoRotate, tips.length]);

  // Track view when tip changes
  useEffect(() => {
    if (currentTip && onView) {
      onView(currentTip.id);
    }
  }, [currentIndex, currentTip, onView]);

  const handlePrevious = () => {
    setAutoRotate(false);
    setCurrentIndex((prev) => (prev - 1 + tips.length) % tips.length);
  };

  const handleNext = () => {
    setAutoRotate(false);
    setCurrentIndex((prev) => (prev + 1) % tips.length);
  };

  const handleDismiss = () => {
    onDismiss(currentTip.id);
    // Move to next tip if available
    if (tips.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % tips.length);
    }
  };

  return (
    <div className="border-t border-slate-700 p-4 space-y-3 bg-slate-800">
      {/* Tip Card */}
      <div className="bg-slate-700 rounded-lg p-4 space-y-3">
        {/* Header with icon and title */}
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">
            {getIconEmoji(currentTip.icon)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {currentTip.title}
            </h3>
            <p className="text-xs text-slate-300 mt-1 line-clamp-2">
              {currentTip.description}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:bg-slate-600 rounded transition-colors"
            aria-label={t("tips.dismiss")}
            title={t("tips.dismissTitle")}
          >
            <X className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Category badge */}
        {currentTip.category && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-slate-600 text-slate-200 rounded">
              {currentTip.category}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <Button
          onClick={handlePrevious}
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
          disabled={tips.length <= 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* Indicators */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          {tips.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setAutoRotate(false);
                setCurrentIndex(index);
              }}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex ? "bg-blue-500 w-6" : "bg-slate-600 w-2"
              }`}
              aria-label={t("tips.goToTip", { index: index + 1 })}
            />
          ))}
        </div>

        <Button
          onClick={handleNext}
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
          disabled={tips.length <= 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Counter */}
      <div className="text-center text-xs text-slate-400">
        {currentIndex + 1} / {tips.length}
      </div>
    </div>
  );
}
