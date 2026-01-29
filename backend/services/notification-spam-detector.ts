/**
 * Notification Spam Detector Service
 *
 * Prevents spamming users with repetitive notifications using:
 * 1. LLM-based semantic analysis to detect similar topics
 * 2. Exponential backoff cooldowns per topic
 * 3. Automatic give-up after max attempts without user response
 */

import { LLMRouterService } from "./llm-router.js";
import type { NotificationCategory } from "@prisma/client";
import crypto from "crypto";
import { parseJSONFromLLMResponse } from "../utils/json-parser.js";
import prisma from "./prisma.js";

const llmRouter = new LLMRouterService();

// Cooldown configuration
const INITIAL_COOLDOWN_MINUTES = 60; // 1 hour
const COOLDOWN_MULTIPLIER = 2; // Double each time
const MAX_COOLDOWN_MINUTES = 10080; // 7 days max
const DEFAULT_MAX_ATTEMPTS = 5; // Give up after 5 unanswered notifications
const SIMILARITY_LOOKBACK_DAYS = 7; // Look back 7 days for similar topics
const MAX_SAMPLE_MESSAGES = 5; // Keep last 5 messages for comparison

export interface SpamCheckResult {
  allowed: boolean;
  reason: string;
  matchedTopic?: string;
  topicTrackerId?: string;
  cooldownMinutes?: number;
  nextAllowedAt?: Date;
  isGivenUp?: boolean;
  attemptCount?: number;
}

export interface NotificationAnalysis {
  topic: string;
  category: NotificationCategory;
  contentHash: string;
  isSimilarToRecent: boolean;
  similarityScore: number;
  matchedTrackerId?: string;
}

interface TopicTrackerData {
  id: string;
  topic: string;
  category: NotificationCategory;
  lastContentHash: string;
  sampleMessages: string[];
  attemptCount: number;
  cooldownMinutes: number;
  nextAllowedAt: Date;
  maxAttempts: number;
  isGivenUp: boolean;
  lastUserResponse: Date | null;
  responseCount: number;
  totalSent: number;
  totalBlocked: number;
}

class NotificationSpamDetectorService {
  /**
   * Check if a notification should be allowed or blocked
   */
  async checkNotification(
    userId: string,
    title: string,
    message: string,
    sourceType?: string,
  ): Promise<SpamCheckResult> {
    try {
      // Step 1: Analyze the notification content with AI
      const analysis = await this.analyzeNotificationContent(
        userId,
        title,
        message,
        sourceType,
      );

      // Step 2: Check if there's an existing tracker for this topic
      const existingTracker = analysis.matchedTrackerId
        ? await this.getTrackerById(analysis.matchedTrackerId)
        : await this.getTrackerByTopic(userId, analysis.topic);

      // Step 3: If no tracker exists, this is a new topic - allow it
      if (!existingTracker) {
        return {
          allowed: true,
          reason: "New topic - no previous notifications",
          matchedTopic: analysis.topic,
        };
      }

      // Step 4: Check if topic has been given up
      if (existingTracker.isGivenUp) {
        return {
          allowed: false,
          reason: `Topic "${analysis.topic}" has been abandoned after ${existingTracker.maxAttempts} unanswered notifications`,
          matchedTopic: analysis.topic,
          topicTrackerId: existingTracker.id,
          isGivenUp: true,
          attemptCount: existingTracker.attemptCount,
        };
      }

      // Step 5: Check if we're still in cooldown period
      const now = new Date();
      if (existingTracker.nextAllowedAt > now) {
        const minutesRemaining = Math.ceil(
          (existingTracker.nextAllowedAt.getTime() - now.getTime()) / 60000,
        );

        // Increment blocked count
        await this.incrementBlockedCount(existingTracker.id);

        return {
          allowed: false,
          reason: `Topic "${analysis.topic}" is in cooldown. Next allowed in ${this.formatDuration(minutesRemaining)}`,
          matchedTopic: analysis.topic,
          topicTrackerId: existingTracker.id,
          cooldownMinutes: existingTracker.cooldownMinutes,
          nextAllowedAt: existingTracker.nextAllowedAt,
          attemptCount: existingTracker.attemptCount,
        };
      }

      // Step 6: Cooldown has passed - allow but check if we should increase backoff
      return {
        allowed: true,
        reason: `Topic "${analysis.topic}" cooldown expired - notification allowed`,
        matchedTopic: analysis.topic,
        topicTrackerId: existingTracker.id,
        cooldownMinutes: existingTracker.cooldownMinutes,
        attemptCount: existingTracker.attemptCount,
      };
    } catch (error: any) {
      console.error(
        "[SpamDetector] Error checking notification:",
        error.message,
      );
      // On error, allow the notification but log it
      return {
        allowed: true,
        reason: `Spam check failed: ${error.message} - allowing notification`,
      };
    }
  }

  /**
   * Record that a notification was sent (call after successful send)
   */
  async recordNotificationSent(
    userId: string,
    title: string,
    message: string,
    notificationId: string,
    sourceType?: string,
  ): Promise<string | null> {
    try {
      const analysis = await this.analyzeNotificationContent(
        userId,
        title,
        message,
        sourceType,
      );

      let tracker = analysis.matchedTrackerId
        ? await this.getTrackerById(analysis.matchedTrackerId)
        : await this.getTrackerByTopic(userId, analysis.topic);

      if (tracker) {
        // Update existing tracker with exponential backoff
        const newCooldown = Math.min(
          tracker.cooldownMinutes * COOLDOWN_MULTIPLIER,
          MAX_COOLDOWN_MINUTES,
        );
        const newAttemptCount = tracker.attemptCount + 1;
        const nextAllowed = new Date(Date.now() + newCooldown * 60000);

        // Check if we should give up
        const shouldGiveUp =
          newAttemptCount >= tracker.maxAttempts && tracker.responseCount === 0;

        // Update sample messages (keep last N)
        const newSamples = [...tracker.sampleMessages, message].slice(
          -MAX_SAMPLE_MESSAGES,
        );

        await prisma.notificationTopicTracker.update({
          where: { id: tracker.id },
          data: {
            attemptCount: newAttemptCount,
            cooldownMinutes: newCooldown,
            nextAllowedAt: nextAllowed,
            isGivenUp: shouldGiveUp,
            lastContentHash: analysis.contentHash,
            sampleMessages: newSamples,
            totalSent: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        // Link notification to tracker
        await prisma.notification.update({
          where: { id: notificationId },
          data: { topicTrackerId: tracker.id },
        });

        if (shouldGiveUp) {
          console.log(
            `[SpamDetector] Topic "${analysis.topic}" for user ${userId} has been given up after ${newAttemptCount} attempts`,
          );
        }

        return tracker.id;
      } else {
        // Create or update tracker using upsert to handle race conditions
        const nextAllowed = new Date(
          Date.now() + INITIAL_COOLDOWN_MINUTES * 60000,
        );

        const newTracker = await prisma.notificationTopicTracker.upsert({
          where: { userId_topic: { userId, topic: analysis.topic } },
          update: {
            attemptCount: { increment: 1 },
            totalSent: { increment: 1 },
            sampleMessages: { push: message },
            updatedAt: new Date(),
          },
          create: {
            userId,
            topic: analysis.topic,
            category: analysis.category,
            lastContentHash: analysis.contentHash,
            sampleMessages: [message],
            attemptCount: 1,
            cooldownMinutes: INITIAL_COOLDOWN_MINUTES,
            nextAllowedAt: nextAllowed,
            maxAttempts: DEFAULT_MAX_ATTEMPTS,
            isGivenUp: false,
            totalSent: 1,
            totalBlocked: 0,
          },
        });

        // Link notification to tracker
        await prisma.notification.update({
          where: { id: notificationId },
          data: { topicTrackerId: newTracker.id },
        });

        return newTracker.id;
      }
    } catch (error: any) {
      console.error(
        "[SpamDetector] Error recording notification:",
        error.message,
      );
      return null;
    }
  }

  /**
   * Record that a user responded/interacted with a notification topic
   * This resets the cooldown and prevents giving up
   */
  async recordUserResponse(
    userId: string,
    topicOrNotificationId: string,
  ): Promise<void> {
    try {
      // Try to find by notification ID first
      const notification = await prisma.notification.findUnique({
        where: { id: topicOrNotificationId },
        select: { topicTrackerId: true },
      });

      let trackerId = notification?.topicTrackerId || topicOrNotificationId;

      // Update the tracker
      await prisma.notificationTopicTracker.updateMany({
        where: {
          OR: [{ id: trackerId }, { userId, topic: topicOrNotificationId }],
        },
        data: {
          lastUserResponse: new Date(),
          responseCount: { increment: 1 },
          // Reset cooldown on response
          cooldownMinutes: INITIAL_COOLDOWN_MINUTES,
          attemptCount: 0,
          isGivenUp: false,
          nextAllowedAt: new Date(), // Allow immediately
        },
      });

      console.log(
        `[SpamDetector] User response recorded for topic/notification: ${topicOrNotificationId}`,
      );
    } catch (error: any) {
      console.error(
        "[SpamDetector] Error recording user response:",
        error.message,
      );
    }
  }

  /**
   * Revive a given-up topic (user explicitly wants to hear about it again)
   */
  async reviveTopic(userId: string, topic: string): Promise<boolean> {
    try {
      const result = await prisma.notificationTopicTracker.updateMany({
        where: { userId, topic },
        data: {
          isGivenUp: false,
          attemptCount: 0,
          cooldownMinutes: INITIAL_COOLDOWN_MINUTES,
          nextAllowedAt: new Date(),
        },
      });

      return result.count > 0;
    } catch (error: any) {
      console.error("[SpamDetector] Error reviving topic:", error.message);
      return false;
    }
  }

  /**
   * Get all topic trackers for a user
   */
  async getUserTopicTrackers(
    userId: string,
    includeGivenUp: boolean = true,
  ): Promise<TopicTrackerData[]> {
    const trackers = await prisma.notificationTopicTracker.findMany({
      where: {
        userId,
        ...(includeGivenUp ? {} : { isGivenUp: false }),
      },
      orderBy: { updatedAt: "desc" },
    });

    return trackers as TopicTrackerData[];
  }

  /**
   * Analyze notification content using LLM to extract topic and category
   */
  private async analyzeNotificationContent(
    userId: string,
    title: string,
    message: string,
    sourceType?: string,
  ): Promise<NotificationAnalysis> {
    // Get recent trackers for comparison
    const recentTrackers = await this.getRecentTrackers(
      userId,
      SIMILARITY_LOOKBACK_DAYS,
    );

    const trackersContext =
      recentTrackers.length > 0
        ? `\nRecent notification topics for this user:\n${recentTrackers
            .map(
              (t, i) =>
                `${i + 1}. Topic: "${t.topic}" (Category: ${t.category})\n   Sample messages: ${t.sampleMessages.slice(0, 2).join(" | ")}`,
            )
            .join("\n")}`
        : "";

    const systemPrompt = `You are a notification spam detector. Analyze the notification and:
1. Extract a concise topic identifier (e.g., "health_hydration", "goal_exercise", "reminder_meeting")
2. Categorize it into one of these categories: HEALTH, MENTAL, PRODUCTIVITY, GOALS, HABITS, RELATIONSHIPS, LEARNING, FINANCIAL, SYSTEM, GENERAL
3. Determine if this notification is semantically similar to any recent topics (same underlying subject/intent, even if worded differently)

Rules for topic identification:
- Topics should be specific but not unique to exact wording (e.g., "drink water" and "stay hydrated" = same topic "health_hydration")
- Use snake_case for topics
- Keep topics under 30 characters
- Prefix with category shorthand when helpful (health_, goal_, habit_, etc.)
${trackersContext}

Respond ONLY with JSON:
{
  "topic": "string",
  "category": "HEALTH|MENTAL|PRODUCTIVITY|GOALS|HABITS|RELATIONSHIPS|LEARNING|FINANCIAL|SYSTEM|GENERAL",
  "isSimilarToRecent": boolean,
  "similarityScore": 0.0-1.0,
  "matchedTopic": "string or null if not similar",
  "matchedTrackerId": "string or null if not similar"
}`;

    const userMessage = `Notification to analyze:
Title: ${title}
Message: ${message}
Source: ${sourceType || "unknown"}

Analyze this notification and identify its topic.`;

    try {
      const response = await llmRouter.executeTask(
        userId,
        "analysis",
        userMessage,
        systemPrompt,
        { temperature: 0.3, responseFormat: "json" },
      );

      let parsed;
      try {
        parsed = parseJSONFromLLMResponse(response);
      } catch (parseError) {
        console.error("[SpamDetector] JSON parse error:", parseError);
        console.error(
          "[SpamDetector] Response content:",
          response.substring(0, 500),
        );
        throw parseError;
      }

      const contentHash = this.hashContent(title + message);

      return {
        topic: parsed.topic || "general_notification",
        category: this.validateCategory(parsed.category),
        contentHash,
        isSimilarToRecent: parsed.isSimilarToRecent || false,
        similarityScore: parsed.similarityScore || 0,
        matchedTrackerId: parsed.matchedTrackerId || undefined,
      };
    } catch (error: any) {
      console.error("[SpamDetector] LLM analysis failed:", error.message);
      // Fallback to basic analysis
      return {
        topic: this.extractBasicTopic(title, sourceType),
        category: "GENERAL",
        contentHash: this.hashContent(title + message),
        isSimilarToRecent: false,
        similarityScore: 0,
      };
    }
  }

  /**
   * Get recent topic trackers for comparison
   */
  private async getRecentTrackers(
    userId: string,
    days: number,
  ): Promise<TopicTrackerData[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return prisma.notificationTopicTracker.findMany({
      where: {
        userId,
        updatedAt: { gte: cutoff },
        isGivenUp: false,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }) as Promise<TopicTrackerData[]>;
  }

  private async getTrackerById(id: string): Promise<TopicTrackerData | null> {
    return prisma.notificationTopicTracker.findUnique({
      where: { id },
    }) as Promise<TopicTrackerData | null>;
  }

  private async getTrackerByTopic(
    userId: string,
    topic: string,
  ): Promise<TopicTrackerData | null> {
    return prisma.notificationTopicTracker.findUnique({
      where: { userId_topic: { userId, topic } },
    }) as Promise<TopicTrackerData | null>;
  }

  private async incrementBlockedCount(trackerId: string): Promise<void> {
    await prisma.notificationTopicTracker.update({
      where: { id: trackerId },
      data: { totalBlocked: { increment: 1 } },
    });
  }

  private hashContent(content: string): string {
    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .substring(0, 32);
  }

  private validateCategory(category: string): NotificationCategory {
    const validCategories: NotificationCategory[] = [
      "HEALTH",
      "MENTAL",
      "PRODUCTIVITY",
      "GOALS",
      "HABITS",
      "RELATIONSHIPS",
      "LEARNING",
      "FINANCIAL",
      "SYSTEM",
      "GENERAL",
    ];
    return validCategories.includes(category as NotificationCategory)
      ? (category as NotificationCategory)
      : "GENERAL";
  }

  private extractBasicTopic(title: string, sourceType?: string): string {
    // Simple fallback topic extraction
    const prefix = sourceType
      ? sourceType.toLowerCase().replace(":", "_")
      : "general";
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(" ")
      .slice(0, 3)
      .join("_");
    return `${prefix}_${cleanTitle}`.substring(0, 30);
  }

  private formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? "s" : ""}`;
    }
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
}

export const notificationSpamDetector = new NotificationSpamDetectorService();
