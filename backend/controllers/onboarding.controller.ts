import { NextFunction, Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import prisma from '../services/prisma.js';
import { z } from 'zod';

// Validation schemas
const completeStepSchema = z.object({
  stepId: z.string(),
});

const finishOnboardingSchema = z.object({
  completedSteps: z.array(z.string()).optional(),
});

// Get onboarding status for current user
export const getOnboardingStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: true,
        aiProviders: {
          select: { id: true, enabled: true }
        },
        settings: {
          select: {
            notifications: {
              select: {
                enabledChannels: true,
                pushoverUserKey: true,
                telegramBotToken: true,
                emailConfig: true,
                webhookUrl: true,
              }
            }
          }
        }
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check completion status of key steps
    const hasConfiguredAI = user.aiProviders.some(provider => provider.enabled);
    const hasConfiguredNotifications = user.settings?.notifications?.enabledChannels?.length > 0;

    const stepStatus = {
      welcome: true, // Always considered complete
      'ai-config': hasConfiguredAI,
      notifications: hasConfiguredNotifications,
      'quick-tour': user.hasCompletedOnboarding, // Assume tour is last step
    };

    res.json({
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      onboardingCompletedAt: user.onboardingCompletedAt,
      stepStatus,
      suggestedNextStep: !hasConfiguredAI ? 'ai-config' 
        : !hasConfiguredNotifications ? 'notifications'
        : !user.hasCompletedOnboarding ? 'quick-tour'
        : null,
    });
  } catch (error) {
    next(error);
  }
};

// Complete a specific onboarding step
export const completeStep = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { stepId } = completeStepSchema.parse(req.body);

    // For now, just log the step completion
    // In a more sophisticated version, we might store step completion in a separate table
    console.log(`User ${userId} completed onboarding step: ${stepId}`);

    res.json({
      success: true,
      message: `Step ${stepId} completed successfully`,
      stepId,
    });
  } catch (error) {
    next(error);
  }
};

// Complete onboarding process
export const finishOnboarding = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { completedSteps } = finishOnboardingSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: new Date(),
      },
      select: {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: true,
      },
    });

    res.json({
      message: 'Onboarding completed successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// Reset onboarding (for testing or if user wants to see it again)
export const resetOnboarding = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        hasCompletedOnboarding: false,
        onboardingCompletedAt: null,
      },
      select: {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: true,
      },
    });

    res.json({
      message: 'Onboarding reset successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// Skip onboarding (mark as completed without going through steps)
export const skipOnboarding = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: new Date(),
      },
      select: {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: true,
      },
    });

    res.json({
      message: 'Onboarding skipped successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};