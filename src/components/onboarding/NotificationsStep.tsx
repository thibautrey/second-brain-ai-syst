import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Bell, Smartphone, MessageSquare, Monitor, CheckCircle } from 'lucide-react';
import { NotificationSettings } from '../NotificationSettings';
import { useTranslation } from 'react-i18next';

interface NotificationsStepProps {
  onNext: () => void;
  onSkip: () => void;
}

type ChannelType = 'browser' | 'pushover' | 'telegram' | null;

const notificationChannels = [
  {
    id: 'browser' as const,
    icon: Monitor,
    titleKey: 'onboarding.notificationsStep.channels.browser.title',
    descriptionKey: 'onboarding.notificationsStep.channels.browser.description',
    recommendedTagKey: 'onboarding.notificationsStep.channels.browser.recommendedTag',
    recommended: true,
  },
  {
    id: 'pushover' as const,
    icon: Smartphone,
    titleKey: 'onboarding.notificationsStep.channels.pushover.title',
    descriptionKey: 'onboarding.notificationsStep.channels.pushover.description',
    recommended: false,
  },
  {
    id: 'telegram' as const,
    icon: MessageSquare,
    titleKey: 'onboarding.notificationsStep.channels.telegram.title',
    descriptionKey: 'onboarding.notificationsStep.channels.telegram.description',
    recommended: false,
  },
];

export function NotificationsStep({ onNext, onSkip }: NotificationsStepProps) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>(null);
  const [hasConfigured, setHasConfigured] = useState(false);
  const { t } = useTranslation();

  const handleChannelSelect = (channel: ChannelType) => {
    setSelectedChannel(channel);
  };

  const handleConfigurationComplete = () => {
    setHasConfigured(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Bell className="mx-auto w-12 h-12 text-primary mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("onboarding.notificationsStep.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("onboarding.notificationsStep.subtitle")}
        </p>
      </div>

      {!selectedChannel ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {notificationChannels.map((channel) => {
            const Icon = channel.icon;
            return (
              <Card 
                key={channel.id} 
                className="cursor-pointer border-2 hover:border-primary/50 transition-colors"
                onClick={() => handleChannelSelect(channel.id)}
              >
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-base">
                    {t(channel.titleKey)}
                    {channel.recommended && channel.recommendedTagKey && (
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {t(channel.recommendedTagKey)}
                      </span>
                    )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                    {t(channel.descriptionKey)}
                </p>
              </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedChannel(null)}
            >
              ← {t("onboarding.notificationsStep.backToSelection")}
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {React.createElement(notificationChannels.find(c => c.id === selectedChannel)?.icon!, { className: "w-5 h-5" })}
                <span>
                  {t("onboarding.notificationsStep.setupCopy", {
                    channel: t(
                      notificationChannels.find((c) => c.id === selectedChannel)
                        ?.titleKey || "",
                    ),
                  })}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NotificationSettings selectedChannel={selectedChannel} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-center space-x-4">
        {!selectedChannel && (
          <>
            <Button variant="outline" onClick={onSkip}>
              {t("onboarding.buttons.skip")}
            </Button>
            <Button onClick={onNext}>
              {t("onboarding.buttons.continueWithoutNotifications")}
            </Button>
          </>
        )}
        
        {selectedChannel && (
          <>
            <Button variant="outline" onClick={onSkip}>
              {t("onboarding.buttons.skipChannel")}
            </Button>
            <Button onClick={onNext}>
              {hasConfigured
                ? t("onboarding.buttons.continue")
                : t("onboarding.buttons.setUpLater")}
            </Button>
          </>
        )}
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    {t("onboarding.notificationsStep.configuredNoticeTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("onboarding.notificationsStep.configuredNoticeBody")}
                  </p>
                </div>
              </div>
        </CardContent>
      </Card>
    </div>
  );
}
