import React from 'react';
import { Brain, MessageSquare, Bell, Zap, Shield, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

const features = [
  {
    icon: Brain,
    title: 'Memory System',
    description: 'Automatically captures and organizes your interactions, creating a searchable personal knowledge base.',
  },
  {
    icon: MessageSquare,
    title: 'AI Conversations',
    description: 'Chat with AI models that have access to your personal context and memory.',
  },
  {
    icon: Bell,
    title: 'Proactive Insights',
    description: 'Get helpful suggestions and reminders based on your patterns and goals.',
  },
  {
    icon: Zap,
    title: 'Smart Automation',
    description: 'Execute tasks and workflows with AI agents that understand your preferences.',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'All your data stays local and private. You control what gets stored and processed.',
  },
  {
    icon: Clock,
    title: 'Time-based Summaries',
    description: 'Automatic daily, weekly, and monthly summaries help you track progress and insights.',
  },
];

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Brain className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Your Personal AI Operating System</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Second Brain AI is designed to be your cognitive companion — capturing, organizing, and helping you act on information throughout your life.
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
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Getting Started</h3>
        <p className="text-sm text-muted-foreground">
          We'll help you configure the essential settings to get your Second Brain AI system up and running.
          This includes setting up AI providers, notification preferences, and giving you a quick tour of the features.
        </p>
      </div>
    </div>
  );
}