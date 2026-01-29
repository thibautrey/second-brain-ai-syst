import { ArrowLeft, ArrowRight, CheckCircle, Circle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import React, { useState } from "react";

import { AIConfigStep } from "./AIConfigStep";
import { Button } from "../ui/button";
import { CompletionStep } from "./CompletionStep";
import { EmbeddingSelectionStep } from "./EmbeddingSelectionStep";
import { ModelSelectionStep } from "./ModelSelectionStep";
import { NotificationsStep } from "./NotificationsStep";
import { Progress } from "../ui/progress";
import { WelcomeStep } from "./WelcomeStep";
import { apiPost } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface OnboardingStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  component: React.ComponentType<any>;
  skippable: boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    titleKey: "onboarding.steps.welcome.title",
    descriptionKey: "onboarding.steps.welcome.description",
    component: WelcomeStep,
    skippable: false,
  },
  {
    id: "ai-config",
    titleKey: "onboarding.steps.aiConfig.title",
    descriptionKey: "onboarding.steps.aiConfig.description",
    component: AIConfigStep,
    skippable: false,
  },
  {
    id: "model-selection",
    titleKey: "onboarding.steps.modelSelection.title",
    descriptionKey: "onboarding.steps.modelSelection.description",
    component: ModelSelectionStep,
    skippable: true,
  },
  {
    id: "embedding-selection",
    titleKey: "onboarding.steps.embeddingSelection.title",
    descriptionKey: "onboarding.steps.embeddingSelection.description",
    component: EmbeddingSelectionStep,
    skippable: false,
  },
  {
    id: "channels",
    titleKey: "onboarding.steps.channels.title",
    descriptionKey: "onboarding.steps.channels.description",
    component: NotificationsStep,
    skippable: true,
  },
  {
    id: "completion",
    titleKey: "onboarding.steps.completion.title",
    descriptionKey: "onboarding.steps.completion.description",
    component: CompletionStep,
    skippable: false,
  },
];

export function OnboardingWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const { completeOnboarding } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const progress = ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const handleModelsDiscovered = (
    models: Array<{ id: string; name: string }>,
  ) => {
    setDiscoveredModels(models);
  };

  const handleNext = async () => {
    const stepId = currentStep.id;

    // Mark current step as completed
    if (!completedSteps.includes(stepId)) {
      const newCompleted = [...completedSteps, stepId];
      setCompletedSteps(newCompleted);

      try {
        await apiPost("/onboarding/complete-step", { stepId });
      } catch (error) {
        console.error("Failed to save step completion:", error);
      }
    }

    // Move to next step or complete onboarding
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      await handleComplete();
    }
  };

  const handleSkip = async () => {
    if (currentStep.skippable) {
      await handleNext();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await apiPost("/onboarding/finish", {});
      await completeOnboarding();
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">
              {t("onboarding.welcomeStep.title")}
            </h1>
            <span className="text-sm text-muted-foreground">
              {t("onboarding.progress", {
                current: currentStepIndex + 1,
                total: ONBOARDING_STEPS.length,
              })}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center mb-8 space-x-4">
          {ONBOARDING_STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = index === currentStepIndex;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                      isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : isCurrent
                          ? "border-primary text-primary"
                          : "border-muted-foreground text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`text-xs mt-1 text-center max-w-[80px] ${
                      isCurrent
                        ? "text-primary font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>{t(currentStep.titleKey)}</CardTitle>
            <CardDescription>{t(currentStep.descriptionKey)}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep.id === "ai-config" && (
              <currentStep.component
                onNext={handleNext}
                onSkip={handleSkip}
                onModelsDiscovered={handleModelsDiscovered}
              />
            )}
            {currentStep.id === "model-selection" && (
              <currentStep.component
                onNext={handleNext}
                onSkip={handleSkip}
                discoveredModels={discoveredModels}
              />
            )}
            {currentStep.id === "embedding-selection" && (
              <currentStep.component
                onNext={handleNext}
                onSkip={handleSkip}
                discoveredModels={discoveredModels}
              />
            )}
            {currentStep.id !== "ai-config" &&
              currentStep.id !== "model-selection" &&
              currentStep.id !== "embedding-selection" && (
                <currentStep.component
                  onNext={handleNext}
                  onSkip={handleSkip}
                />
              )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("onboarding.buttons.back")}
              </Button>

              <div className="flex items-center space-x-2">
                {currentStep.skippable && (
                  <Button variant="ghost" onClick={handleSkip}>
                    {t("onboarding.buttons.skip")}
                  </Button>
                )}
                <Button onClick={handleNext} disabled={isCompleting}>
                  {currentStepIndex === ONBOARDING_STEPS.length - 1
                    ? isCompleting
                      ? t("onboarding.buttons.completing")
                      : t("onboarding.buttons.complete")
                    : t("onboarding.buttons.continue")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
