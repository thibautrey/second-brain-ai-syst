import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Bell, Smartphone, MessageSquare, Monitor, CheckCircle } from 'lucide-react';
import { NotificationSettings } from '../NotificationSettings';

interface NotificationsStepProps {
  onNext: () => void;
  onSkip: () => void;
}

type ChannelType = 'browser' | 'pushover' | 'telegram' | null;

const notificationChannels = [
  {
    id: 'browser' as const,
    icon: Monitor,
    title: 'Browser Notifications',
    description: 'Get notifications directly in your browser while using the app',
    recommended: true,
  },
  {
    id: 'pushover' as const,
    icon: Smartphone,
    title: 'Pushover (Mobile)',
    description: 'Receive push notifications on your phone via the Pushover app',
    recommended: false,
  },
  {
    id: 'telegram' as const,
    icon: MessageSquare,
    title: 'Telegram Bot',
    description: 'Get notifications through a private Telegram bot',
    recommended: false,
  },
];

export function NotificationsStep({ onNext, onSkip }: NotificationsStepProps) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>(null);
  const [hasConfigured, setHasConfigured] = useState(false);

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
        <h2 className="text-xl font-semibold mb-2">Set Up Notifications</h2>
        <p className="text-muted-foreground">
          Choose how you'd like to receive notifications from your Second Brain AI.
          You can configure multiple channels or skip this step for now.
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
                    {channel.title}
                    {channel.recommended && (
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Recommended
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center">
                    {channel.description}
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
              ← Back to channel selection
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {React.createElement(notificationChannels.find(c => c.id === selectedChannel)?.icon!, { className: "w-5 h-5" })}
                <span>{notificationChannels.find(c => c.id === selectedChannel)?.title} Setup</span>
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
              Skip for Now
            </Button>
            <Button onClick={onNext}>
              Continue Without Notifications
            </Button>
          </>
        )}
        
        {selectedChannel && (
          <>
            <Button variant="outline" onClick={onSkip}>
              Skip This Channel
            </Button>
            <Button onClick={onNext}>
              {hasConfigured ? 'Continue' : 'Set Up Later'}
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
              <p className="text-sm font-medium">You can configure notifications later</p>
              <p className="text-xs text-muted-foreground">
                All notification settings can be changed in the Settings page after setup is complete.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}