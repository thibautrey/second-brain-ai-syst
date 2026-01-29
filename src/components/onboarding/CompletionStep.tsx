import {
  Book,
  Brain,
  CheckCircle,
  MessageSquare,
  Settings,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

import { Button } from "../ui/button";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface CompletionStepProps {
  onNext: () => void;
  onSkip: () => void;
}

const nextSteps = [
  {
    id: "conversation",
    icon: MessageSquare,
    titleKey: "onboarding.completionStep.nextSteps.conversation.title",
    descriptionKey:
      "onboarding.completionStep.nextSteps.conversation.description",
    actionKey: "onboarding.completionStep.nextSteps.conversation.action",
    route: "/dashboard/chat",
  },
  {
    id: "memory",
    icon: Brain,
    titleKey: "onboarding.completionStep.nextSteps.memory.title",
    descriptionKey: "onboarding.completionStep.nextSteps.memory.description",
    actionKey: "onboarding.completionStep.nextSteps.memory.action",
    route: "/dashboard/memories",
  },
  {
    id: "settings",
    icon: Settings,
    titleKey: "onboarding.completionStep.nextSteps.settings.title",
    descriptionKey: "onboarding.completionStep.nextSteps.settings.description",
    actionKey: "onboarding.completionStep.nextSteps.settings.action",
    route: "/dashboard/settings",
  },
  {
    id: "docs",
    icon: Book,
    titleKey: "onboarding.completionStep.nextSteps.docs.title",
    descriptionKey: "onboarding.completionStep.nextSteps.docs.description",
    actionKey: "onboarding.completionStep.nextSteps.docs.action",
    route: "/docs",
  },
];

export function CompletionStep({ onNext }: CompletionStepProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold">
          {t("onboarding.completionStep.title")}
        </h2>
        <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
          {t("onboarding.completionStep.subtitle")}
        </p>
      </div>

      <Card className="bg-linear-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center mb-4 space-x-2">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">
              {t("onboarding.completionStep.nextSectionTitle")}
            </h3>
          </div>
          <div className="space-y-2 text-sm">
            {(
              t("onboarding.completionStep.summaryBullets", {
                returnObjects: true,
              }) as string[]
            ).map((line: string) => (
              <p key={line}>• {line}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold text-center">
          {t("onboarding.completionStep.suggestedTitle")}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {nextSteps.map((step) => {
            const Icon = step.icon;
            const handleClick = () => {
              if (step.route === "/docs") {
                window.open(step.route, "_blank");
              } else {
                navigate(step.route);
              }
            };
            return (
              <Card
                key={step.id}
                className="transition-colors border-muted hover:border-primary/50"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">
                      {t(step.titleKey)}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {t(step.descriptionKey)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleClick}
                  >
                    {t(step.actionKey)}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="p-4 rounded-lg bg-muted/50">
        <h4 className="mb-2 font-medium">
          {t("onboarding.completionStep.proTipsTitle")}
        </h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {(
            t("onboarding.completionStep.proTips", {
              returnObjects: true,
            }) as string[]
          ).map((tip: string) => (
            <li key={tip}>• {tip}</li>
          ))}
        </ul>
      </div>

      <div className="text-center">
        <Button onClick={onNext} size="lg" className="px-8">
          {t("onboarding.completionStep.enterButton")}
        </Button>
      </div>
    </div>
  );
}
