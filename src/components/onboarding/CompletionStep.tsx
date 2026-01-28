import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, Brain, MessageSquare, Settings, Book, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CompletionStepProps {
  onNext: () => void;
  onSkip: () => void;
}

const nextSteps = [
  {
    icon: MessageSquare,
    titleKey: 'onboarding.completionStep.nextSteps.conversation.title',
    descriptionKey: 'onboarding.completionStep.nextSteps.conversation.description',
    actionKey: 'onboarding.completionStep.nextSteps.conversation.action',
  },
  {
    icon: Brain,
    titleKey: 'onboarding.completionStep.nextSteps.memory.title',
    descriptionKey: 'onboarding.completionStep.nextSteps.memory.description',
    actionKey: 'onboarding.completionStep.nextSteps.memory.action',
  },
  {
    icon: Settings,
    titleKey: 'onboarding.completionStep.nextSteps.settings.title',
    descriptionKey: 'onboarding.completionStep.nextSteps.settings.description',
    actionKey: 'onboarding.completionStep.nextSteps.settings.action',
  },
  {
    icon: Book,
    titleKey: 'onboarding.completionStep.nextSteps.docs.title',
    descriptionKey: 'onboarding.completionStep.nextSteps.docs.description',
    actionKey: 'onboarding.completionStep.nextSteps.docs.action',
  },
];

export function CompletionStep({ onNext }: CompletionStepProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {t("onboarding.completionStep.title")}
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("onboarding.completionStep.subtitle")}
        </p>
      </div>

      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">
              {t("onboarding.completionStep.nextSectionTitle")}
            </h3>
          </div>
          <div className="space-y-2 text-sm">
            {t<string[]>("onboarding.completionStep.summaryBullets", {
              returnObjects: true,
            }).map((line) => (
              <p key={line}>• {line}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold text-center">
          {t("onboarding.completionStep.suggestedTitle")}
        </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nextSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={index} className="border-muted hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">
                      {t(step.titleKey)}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t(step.descriptionKey)}
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    {t(step.actionKey)}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">{t("onboarding.completionStep.proTipsTitle")}</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          {t<string[]>("onboarding.completionStep.proTips", { returnObjects: true }).map(
            (tip) => (
              <li key={tip}>• {tip}</li>
            ),
          )}
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
