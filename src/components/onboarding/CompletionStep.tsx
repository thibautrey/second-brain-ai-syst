import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, Brain, MessageSquare, Settings, Book, Zap } from 'lucide-react';

interface CompletionStepProps {
  onNext: () => void;
  onSkip: () => void;
}

const nextSteps = [
  {
    icon: MessageSquare,
    title: 'Start a Conversation',
    description: 'Open the Chat tab and start talking to your AI assistant',
    action: 'Try it now',
  },
  {
    icon: Brain,
    title: 'Explore Memory Browser',
    description: 'View how your interactions are being stored and organized',
    action: 'Browse memories',
  },
  {
    icon: Settings,
    title: 'Customize Settings',
    description: 'Fine-tune AI models, notifications, and other preferences',
    action: 'Open settings',
  },
  {
    icon: Book,
    title: 'Read Documentation',
    description: 'Learn about advanced features and capabilities',
    action: 'View docs',
  },
];

export function CompletionStep({ onNext }: CompletionStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">🎉 Setup Complete!</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Your Second Brain AI system is now configured and ready to help you capture, 
          organize, and act on information throughout your day.
        </p>
      </div>

      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">What happens next?</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p>• Your conversations and interactions will be automatically captured</p>
            <p>• AI will generate daily and weekly summaries of your activity</p>
            <p>• Proactive insights will help you stay on track with goals and habits</p>
            <p>• You can search through your entire memory history at any time</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold text-center">Suggested Next Steps</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nextSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={index} className="border-muted hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">{step.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                  <Button variant="outline" size="sm" className="w-full">
                    {step.action}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">💡 Pro Tips</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Use natural language - the AI understands context and intent</li>
          <li>• Check the Memory Browser to see how your data is organized</li>
          <li>• Explore the Settings to customize your experience</li>
          <li>• All your data is stored locally and privately</li>
        </ul>
      </div>

      <div className="text-center">
        <Button onClick={onNext} size="lg" className="px-8">
          Enter Second Brain AI
        </Button>
      </div>
    </div>
  );
}