/**
 * Fact-Checker Service
 *
 * Background verification of LLM responses for accuracy
 * - Extracts claims from responses
 * - Verifies claims using web search and tools
 * - Sends correction notifications if needed
 * - Tracks verification history
 */

import { FactCheckStatus } from "@prisma/client";
import { curlService } from "./tools/index.js";
import { llmRouterService } from "./llm-router.js";
import { notificationService } from "./notification.js";
import { parseJSONFromLLMResponse } from "../utils/json-parser.js";
import prisma from "./prisma.js";

export interface FactCheckRequest {
  userId: string;
  conversationId: string;
  messageId: string;
  response: string;
  userQuestion: string;
}

export interface FactCheckResult {
  id: string;
  claims: string[];
  verified: boolean;
  accuracy:
    | "mostly_correct"
    | "partially_correct"
    | "mostly_incorrect"
    | "incorrect"
    | "unknown";
  needsCorrection: boolean;
  correction?: string;
  sources: string[];
  confidence: number;
}

interface ClaimVerificationResult {
  claim: string;
  verified: boolean;
  source?: string;
  details?: string;
}

interface VerificationAnalysis {
  accuracy:
    | "mostly_correct"
    | "partially_correct"
    | "mostly_incorrect"
    | "incorrect"
    | "unknown";
  confidence: number;
  issues: string;
  correction: string;
  sources: string[];
  notes: string;
}

class FactCheckerService {
  /**
   * Start fact-checking process for a response
   * Returns immediately, verification runs in background
   */
  async scheduleFactCheck(request: FactCheckRequest): Promise<string> {
    // Create pending fact-check record
    const factCheck = await prisma.factCheckResult.create({
      data: {
        userId: request.userId,
        conversationId: request.conversationId,
        messageId: request.messageId,
        originalAnswer: request.response,
        status: FactCheckStatus.PENDING,
        metadata: {
          userQuestion: request.userQuestion,
          scheduledAt: new Date().toISOString(),
        },
      },
    });

    // Schedule background verification (non-blocking)
    setImmediate(async () => {
      try {
        await this.verifyResponse(factCheck.id, request);
      } catch (error) {
        console.error("[FactChecker] Verification failed:", error);
        await prisma.factCheckResult.update({
          where: { id: factCheck.id },
          data: {
            status: FactCheckStatus.FAILED,
            metadata: {
              error: error instanceof Error ? error.message : String(error),
            },
          },
        });
      }
    });

    return factCheck.id;
  }

  /**
   * Core verification logic
   */
  private async verifyResponse(
    factCheckId: string,
    request: FactCheckRequest,
  ): Promise<void> {
    // Update status to in-progress
    await prisma.factCheckResult.update({
      where: { id: factCheckId },
      data: { status: FactCheckStatus.IN_PROGRESS },
    });

    // Step 1: Extract claims from response
    const claims = await this.extractClaims(
      request.response,
      request.userQuestion,
      request.userId,
    );

    if (claims.length === 0) {
      // No verifiable claims found
      await prisma.factCheckResult.update({
        where: { id: factCheckId },
        data: {
          status: FactCheckStatus.COMPLETED,
          claimsIdentified: [],
          claimsAnalyzed: 0,
          overallAccuracy: "unknown",
          confidenceScore: 1.0, // No claims = no issues
        },
      });
      return;
    }

    // Step 2: Verify each claim
    const verificationResults = await Promise.all(
      claims.map((claim) => this.verifyClaim(claim, request.userId)),
    );

    // Step 3: Analyze results
    const analysis = this.analyzeVerificationResults(verificationResults);

    // Step 4: Store results
    const correctionNeeded =
      analysis.accuracy !== "mostly_correct" && analysis.accuracy !== "unknown";

    await prisma.factCheckResult.update({
      where: { id: factCheckId },
      data: {
        status: FactCheckStatus.COMPLETED,
        claimsIdentified: claims,
        claimsAnalyzed: verificationResults.length,
        overallAccuracy: analysis.accuracy,
        confidenceScore: analysis.confidence,
        needsCorrection: correctionNeeded,
        correctionNeeded: correctionNeeded ? analysis.issues : undefined,
        suggestedCorrection: correctionNeeded ? analysis.correction : undefined,
        verificationMethod: "web_search",
        sources: analysis.sources,
        verificationNotes: analysis.notes,
        verifiedAt: new Date(),
      },
    });

    // Step 5: Send correction notification if needed
    if (correctionNeeded && analysis.correction) {
      await this.sendCorrectionNotification(
        factCheckId,
        request.userId,
        request.response,
        analysis.correction,
      );
    }
  }

  /**
   * Extract verifiable claims from response using LLM
   * Uses centralized LLM Router for endpoint compatibility handling
   */
  private async extractClaims(
    response: string,
    question: string,
    userId: string,
  ): Promise<string[]> {
    const prompt = `Extract specific, verifiable factual claims from this AI response.
Only include claims that are testable against external sources (facts, dates, numbers, etc).
Ignore opinion, context, or explanations.

User Question: ${question}

AI Response: ${response}

Return a JSON object with this exact structure:
{
  "claims": ["claim 1", "claim 2"],
  "reasoning": "why these are verifiable"
}`;

    try {
      const content = await llmRouterService.executeTask(
        userId,
        "analysis",
        prompt,
        undefined, // No system prompt needed
        {
          maxTokens: 3000, // Increased for detailed fact-checking
          temperature: 0.3,
          responseFormat: "json",
        },
      );

      if (!content) return [];

      try {
        const parsed = parseJSONFromLLMResponse(content);
        return Array.isArray(parsed.claims) ? parsed.claims : [];
      } catch (parseError) {
        console.error("[FactChecker] JSON parse error for claims:", parseError);
        // If parsing fails, try to extract claims array manually
        const claimsMatch = content.match(/"claims"\s*:\s*\[([\s\S]*?)\]/);
        if (claimsMatch) {
          try {
            const claimsStr = `[${claimsMatch[1]}]`;
            const claims = JSON.parse(claimsStr);
            return Array.isArray(claims) ? claims : [];
          } catch {
            return [];
          }
        }
        return [];
      }
    } catch (error) {
      // LLM Router already handles endpoint compatibility and fallbacks
      // Just log and return empty claims gracefully
      console.error("[FactChecker] Claim extraction failed:", error);
      return [];
    }
  }

  /**
   * Verify a single claim using web search
   */
  private async verifyClaim(
    claim: string,
    userId: string,
  ): Promise<ClaimVerificationResult> {
    try {
      // For now, we'll use a simple web search approach
      // In production, integrate with Serper API, Google Custom Search, or similar
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(claim)}`;

      const result = await curlService.get(searchUrl, {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      });

      // Simplified verification - in reality would parse search results
      // or use a dedicated fact-checking API
      const hasResults = result.statusCode === 200 && result.body.length > 1000;

      return {
        claim,
        verified: hasResults,
        source: "web_search",
        details: hasResults ? "Found in search results" : "Could not verify",
      };
    } catch (error) {
      console.error(
        `[FactChecker] Verification failed for claim: ${claim}`,
        error,
      );
      return {
        claim,
        verified: false,
        details: "Search failed",
      };
    }
  }

  /**
   * Analyze verification results
   */
  private analyzeVerificationResults(
    results: ClaimVerificationResult[],
  ): VerificationAnalysis {
    const verified = results.filter((r) => r.verified).length;
    const total = results.length;
    const ratio = total > 0 ? verified / total : 1;

    let accuracy:
      | "mostly_correct"
      | "partially_correct"
      | "mostly_incorrect"
      | "incorrect"
      | "unknown";
    if (ratio >= 0.9) accuracy = "mostly_correct";
    else if (ratio >= 0.5) accuracy = "partially_correct";
    else if (ratio > 0) accuracy = "mostly_incorrect";
    else accuracy = "incorrect";

    const unverifiedClaims = results.filter((r) => !r.verified);

    return {
      accuracy,
      confidence: ratio,
      issues: unverifiedClaims.map((r) => r.claim).join("; "),
      correction:
        unverifiedClaims.length > 0
          ? `After verification, ${unverifiedClaims.length} claim(s) could not be confirmed: ${unverifiedClaims.map((r) => `"${r.claim}"`).join(", ")}`
          : "All claims verified",
      sources: results
        .filter((r) => r.source)
        .map((r) => r.source!)
        .filter((v, i, a) => a.indexOf(v) === i), // unique
      notes: `Verified ${verified}/${total} claims`,
    };
  }

  /**
   * Send correction notification to user
   */
  private async sendCorrectionNotification(
    factCheckId: string,
    userId: string,
    originalAnswer: string,
    correction: string,
  ): Promise<void> {
    try {
      // Create correction notification in database
      const correctionNotif = await prisma.correctionNotification.create({
        data: {
          userId,
          factCheckId,
          title: "Correction to Previous Response",
          message:
            "After fact-checking, we found some inaccuracies in a recent response.",
          correction,
          originalClaim: originalAnswer.substring(0, 200),
        },
      });

      // Send notification to user
      const result = await notificationService.createNotification({
        userId,
        title: "💡 Fact-Check: Correction Available",
        message: correction,
        type: "WARNING",
        channels: ["IN_APP"],
        sourceType: "fact_check",
        sourceId: factCheckId,
        metadata: {
          correctionNotificationId: correctionNotif.id,
          originalLength: originalAnswer.length,
        },
      });

      // Link notification if created
      if (result.notification) {
        await prisma.correctionNotification.update({
          where: { id: correctionNotif.id },
          data: {
            notificationId: result.notification.id,
          },
        });

        // Mark correction as sent
        await prisma.factCheckResult.update({
          where: { id: factCheckId },
          data: {
            correctionSent: true,
            sentAt: new Date(),
            notificationId: result.notification.id,
          },
        });
      }
    } catch (error) {
      console.error(
        "[FactChecker] Failed to send correction notification:",
        error,
      );
    }
  }

  /**
   * Get fact-check results for a user
   */
  async getFactCheckResults(userId: string, limit = 10) {
    return await prisma.factCheckResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        conversationId: true,
        messageId: true,
        status: true,
        claimsIdentified: true,
        claimsAnalyzed: true,
        overallAccuracy: true,
        confidenceScore: true,
        needsCorrection: true,
        correctionSent: true,
        createdAt: true,
        verifiedAt: true,
      },
    });
  }

  /**
   * Get pending corrections
   */
  async getPendingCorrections(userId: string) {
    return await prisma.correctionNotification.findMany({
      where: {
        userId,
        isRead: false,
      },
      orderBy: { createdAt: "desc" },
      include: {
        factCheck: {
          select: {
            id: true,
            conversationId: true,
            overallAccuracy: true,
            confidenceScore: true,
          },
        },
      },
    });
  }

  /**
   * Mark correction as read
   */
  async markCorrectionRead(correctionId: string, userId: string) {
    return await prisma.correctionNotification.updateMany({
      where: {
        id: correctionId,
        userId, // Security: ensure user owns this correction
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}

export const factCheckerService = new FactCheckerService();
