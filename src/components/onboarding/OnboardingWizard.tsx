import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { CheckCircle, Circle, ArrowRight, ArrowLeft } from 'lucide-react';
import { WelcomeStep } from './WelcomeStep';
import { AIConfigStep } from './AIConfigStep';
import { NotificationsStep } from './NotificationsStep';
import { CompletionStep } from './CompletionStep';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../services/api';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<{ onNext: () => void; onSkip: () => void }>;
  skippable: boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Learn about your Second Brain AI System',
    component: WelcomeStep,
    skippable: false,
  },
  {
    id: 'ai-config',
    title: 'AI Configuration',
    description: 'Set up your AI models and providers',
    component: AIConfigStep,
    skippable: false,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Configure how you want to be notified',
    component: NotificationsStep,
    skippable: true,
  },
  {
    id: 'completion',
    title: 'All Set!',
    description: 'Your system is ready to use',
    component: CompletionStep,
    skippable: false,
  },
];

export function OnboardingWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const { completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const progress = ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const handleNext = async () => {
    const stepId = currentStep.id;
    
    // Mark current step as completed
    if (!completedSteps.includes(stepId)) {
      const newCompleted = [...completedSteps, stepId];
      setCompletedSteps(newCompleted);
      
      try {
        await apiPost('/onboarding/complete-step', { stepId });
      } catch (error) {
        console.error('Failed to save step completion:', error);
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
      await apiPost('/onboarding/finish', {});
      await completeOnboarding();
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Welcome to Second Brain AI</h1>
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
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
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                      ? 'border-primary text-primary'
                      : 'border-muted-foreground text-muted-foreground'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-xs mt-1 text-center max-w-[80px] ${
                    isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}>
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
            <CardTitle>{currentStep.title}</CardTitle>
            <CardDescription>{currentStep.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <currentStep.component onNext={handleNext} onSkip={handleSkip} />
            
            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center space-x-2">
                {currentStep.skippable && (
                  <Button variant="ghost" onClick={handleSkip}>
                    Skip for now
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  disabled={isCompleting}
                >
                  {currentStepIndex === ONBOARDING_STEPS.length - 1 ? (
                    isCompleting ? 'Completing...' : 'Complete Setup'
                  ) : (
                    'Continue'
                  )}
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
