import React from 'react';
import { Brain, MessageSquare, Bell, Zap, Shield, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useTranslation } from 'react-i18next';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

const features = [
  {
    icon: Brain,
    titleKey: 'onboarding.welcomeStep.features.memorySystem.title',
    descriptionKey: 'onboarding.welcomeStep.features.memorySystem.description',
  },
  {
    icon: MessageSquare,
    titleKey: 'onboarding.welcomeStep.features.aiConversations.title',
    descriptionKey: 'onboarding.welcomeStep.features.aiConversations.description',
  },
  {
    icon: Bell,
    titleKey: 'onboarding.welcomeStep.features.proactiveInsights.title',
    descriptionKey: 'onboarding.welcomeStep.features.proactiveInsights.description',
  },
  {
    icon: Zap,
    titleKey: 'onboarding.welcomeStep.features.smartAutomation.title',
    descriptionKey: 'onboarding.welcomeStep.features.smartAutomation.description',
  },
  {
    icon: Shield,
    titleKey: 'onboarding.welcomeStep.features.privacyFirst.title',
    descriptionKey: 'onboarding.welcomeStep.features.privacyFirst.description',
  },
  {
    icon: Clock,
    titleKey: 'onboarding.welcomeStep.features.timeSummaries.title',
    descriptionKey: 'onboarding.welcomeStep.features.timeSummaries.description',
  },
];

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Brain className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {t('onboarding.welcomeStep.title')}
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t('onboarding.welcomeStep.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Card key={index} className="border-muted">
              <CardHeader className="pb-2">
                <div className="flex items-center space-x-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base">
                    {t(feature.titleKey)}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t(feature.descriptionKey)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">
          {t('onboarding.welcomeStep.gettingStartedTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('onboarding.welcomeStep.gettingStartedCopy')}
        </p>
      </div>
    </div>
  );
}
