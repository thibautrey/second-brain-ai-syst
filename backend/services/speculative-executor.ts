/**
 * Speculative Executor Service
 *
 * Predicts what users might ask next and pre-fetches data:
 * - Based on conversation patterns
 * - Based on time of day
 * - Based on recent activity
 * - Based on common follow-up patterns
 *
 * This reduces latency for follow-up questions
 */

import { responseCacheService } from "./response-cache.js";
import { precomputedMemoryIndex } from "./precomputed-memory-index.js";
import { memorySearchService } from "./memory-search.js";
import prisma from "./prisma.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SPECULATIVE_CONFIG = {
  // Max predictions to pre-fetch
  MAX_PREDICTIONS: 3,
  
  // Time window for pattern analysis (ms)
  PATTERN_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  
  // Confidence threshold for pre-fetching
  MIN_CONFIDENCE: 0.5,
  
  // Pre-fetch timeout (don't block on speculative fetches)
  PREFETCH_TIMEOUT_MS: 2000,
};

// ============================================================================
// TYPES
// ============================================================================

interface Prediction {
  query: string;
  confidence: number;
  reason: string;
  category: "follow_up" | "topic_related" | "time_based" | "pattern_based";
}

interface ConversationPattern {
  trigger: RegExp;
  followUps: string[];
}

interface TopicFollowUp {
  topic: string;
  relatedQueries: string[];
}

// ============================================================================
// FOLLOW-UP PATTERNS
// ============================================================================

// Common follow-up patterns based on conversation triggers
const CONVERSATION_PATTERNS: ConversationPattern[] = [
  {
    trigger: /meeting|réunion|rendez-vous/i,
    followUps: [
      "qui était présent",
      "quels étaient les sujets discutés",
      "quelles sont les actions à faire",
      "quand est la prochaine réunion",
    ],
  },
  {
    trigger: /project|projet/i,
    followUps: [
      "quel est l'état du projet",
      "quelle est la deadline",
      "qui travaille sur ce projet",
      "quels sont les prochains jalons",
    ],
  },
  {
    trigger: /task|tâche|todo/i,
    followUps: [
      "quelles sont mes tâches",
      "quelle est la priorité",
      "quand dois-je finir",
      "montre mes tâches",
    ],
  },
  {
    trigger: /remember|souvien|rappel/i,
    followUps: [
      "qu'est-ce que j'ai dit sur",
      "quand est-ce que",
      "qui a mentionné",
    ],
  },
  {
    trigger: /météo|weather|temps/i,
    followUps: [
      "météo demain",
      "prévisions de la semaine",
      "va-t-il pleuvoir",
    ],
  },
  {
    trigger: /plan|planifier|schedule/i,
    followUps: [
      "qu'est-ce que j'ai prévu",
      "mes événements de la semaine",
      "quand suis-je libre",
    ],
  },
];

// Topic-based follow-up suggestions
const TOPIC_FOLLOWUPS: TopicFollowUp[] = [
  {
    topic: "work",
    relatedQueries: ["mes tâches", "mes réunions", "projets en cours"],
  },
  {
    topic: "health",
    relatedQueries: ["mon dernier exercice", "mes habitudes", "mes rendez-vous médicaux"],
  },
  {
    topic: "finance",
    relatedQueries: ["mes dépenses récentes", "mon budget", "mes revenus"],
  },
  {
    topic: "learning",
    relatedQueries: ["ce que j'ai appris", "mes notes", "mes cours"],
  },
];

// ============================================================================
// SPECULATIVE EXECUTOR SERVICE
// ============================================================================

class SpeculativeExecutorService {
  // Cache for pre-fetched results
  private prefetchCache: Map<string, {
    query: string;
    results: any;
    timestamp: number;
  }> = new Map();

  // Recent queries per user (for pattern detection)
  private recentQueries: Map<string, Array<{
    query: string;
    timestamp: number;
  }>> = new Map();

  /**
   * Predict likely follow-up queries based on current query
   */
  predictFollowUps(
    userId: string,
    currentQuery: string,
    userTopics?: string[]
  ): Prediction[] {
    const predictions: Prediction[] = [];

    // 1. Pattern-based predictions
    for (const pattern of CONVERSATION_PATTERNS) {
      if (pattern.trigger.test(currentQuery)) {
        for (const followUp of pattern.followUps.slice(0, 2)) {
          predictions.push({
            query: followUp,
            confidence: 0.7,
            reason: `Pattern match: ${pattern.trigger.source}`,
            category: "follow_up",
          });
        }
        break; // Use first matching pattern
      }
    }

    // 2. Topic-based predictions
    if (userTopics && userTopics.length > 0) {
      for (const topic of userTopics.slice(0, 2)) {
        const topicFollowUp = TOPIC_FOLLOWUPS.find(t => 
          topic.toLowerCase().includes(t.topic) ||
          t.topic.includes(topic.toLowerCase())
        );
        
        if (topicFollowUp) {
          for (const related of topicFollowUp.relatedQueries.slice(0, 1)) {
            if (!predictions.some(p => p.query === related)) {
              predictions.push({
                query: related,
                confidence: 0.6,
                reason: `Topic related: ${topic}`,
                category: "topic_related",
              });
            }
          }
        }
      }
    }

    // 3. Time-based predictions
    const timePredictions = this.getTimeBasedPredictions();
    for (const pred of timePredictions) {
      if (!predictions.some(p => p.query === pred.query)) {
        predictions.push(pred);
      }
    }

    // 4. User pattern-based predictions
    const patternPredictions = this.getUserPatternPredictions(userId);
    for (const pred of patternPredictions) {
      if (!predictions.some(p => p.query === pred.query)) {
        predictions.push(pred);
      }
    }

    // Sort by confidence and limit
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, SPECULATIVE_CONFIG.MAX_PREDICTIONS);
  }

  /**
   * Get time-based predictions (what users typically ask at this time)
   */
  private getTimeBasedPredictions(): Prediction[] {
    const hour = new Date().getHours();
    const predictions: Prediction[] = [];

    // Morning (6-10)
    if (hour >= 6 && hour < 10) {
      predictions.push({
        query: "qu'est-ce que j'ai prévu aujourd'hui",
        confidence: 0.5,
        reason: "Morning routine query",
        category: "time_based",
      });
    }
    
    // Lunch (11-14)
    if (hour >= 11 && hour < 14) {
      predictions.push({
        query: "mes réunions de l'après-midi",
        confidence: 0.4,
        reason: "Lunch time planning",
        category: "time_based",
      });
    }
    
    // Evening (17-20)
    if (hour >= 17 && hour < 20) {
      predictions.push({
        query: "résumé de ma journée",
        confidence: 0.5,
        reason: "End of day reflection",
        category: "time_based",
      });
    }

    // Night (20-23)
    if (hour >= 20 && hour < 23) {
      predictions.push({
        query: "qu'est-ce que j'ai demain",
        confidence: 0.5,
        reason: "Evening planning",
        category: "time_based",
      });
    }

    return predictions;
  }

  /**
   * Get predictions based on user's historical patterns
   */
  private getUserPatternPredictions(userId: string): Prediction[] {
    const recentUserQueries = this.recentQueries.get(userId) || [];
    const predictions: Prediction[] = [];

    // Look for repeated patterns
    const queryCounts: Record<string, number> = {};
    for (const { query } of recentUserQueries) {
      const normalized = query.toLowerCase().trim();
      queryCounts[normalized] = (queryCounts[normalized] || 0) + 1;
    }

    // Predict frequently asked queries
    const frequentQueries = Object.entries(queryCounts)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    for (const [query, count] of frequentQueries) {
      predictions.push({
        query,
        confidence: Math.min(0.8, 0.4 + (count * 0.1)),
        reason: `Frequently asked (${count} times)`,
        category: "pattern_based",
      });
    }

    return predictions;
  }

  /**
   * Record a user query for pattern analysis
   */
  recordQuery(userId: string, query: string): void {
    const userQueries = this.recentQueries.get(userId) || [];
    
    userQueries.push({
      query,
      timestamp: Date.now(),
    });

    // Keep only recent queries
    const cutoff = Date.now() - SPECULATIVE_CONFIG.PATTERN_WINDOW_MS;
    const filtered = userQueries.filter(q => q.timestamp > cutoff);
    
    this.recentQueries.set(userId, filtered.slice(-50)); // Keep last 50
  }

  /**
   * Pre-fetch data for predicted queries (non-blocking)
   */
  async speculativeFetch(
    userId: string,
    currentQuery: string,
    userTopics?: string[]
  ): Promise<void> {
    const predictions = this.predictFollowUps(userId, currentQuery, userTopics);

    // Pre-fetch in parallel with timeout
    const prefetchPromises = predictions
      .filter(p => p.confidence >= SPECULATIVE_CONFIG.MIN_CONFIDENCE)
      .map(async (prediction) => {
        const cacheKey = `${userId}:${prediction.query}`;
        
        // Skip if already cached
        const existing = this.prefetchCache.get(cacheKey);
        if (existing && Date.now() - existing.timestamp < 5 * 60 * 1000) {
          return;
        }

        try {
          // Pre-fetch with timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Prefetch timeout")), SPECULATIVE_CONFIG.PREFETCH_TIMEOUT_MS)
          );

          const fetchPromise = memorySearchService.semanticSearch(userId, prediction.query, 5);
          
          const results = await Promise.race([fetchPromise, timeoutPromise]);
          
          this.prefetchCache.set(cacheKey, {
            query: prediction.query,
            results,
            timestamp: Date.now(),
          });
        } catch (error) {
          // Ignore prefetch errors - they're speculative
        }
      });

    // Don't await - this is speculative
    Promise.all(prefetchPromises).catch(() => {});
  }

  /**
   * Check if we have pre-fetched results for a query
   */
  getPrefetchedResults(userId: string, query: string): any | null {
    const cacheKey = `${userId}:${query.toLowerCase().trim()}`;
    const cached = this.prefetchCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.results;
    }

    // Also check for similar queries (fuzzy match)
    for (const [key, value] of this.prefetchCache) {
      if (key.startsWith(`${userId}:`) && Date.now() - value.timestamp < 5 * 60 * 1000) {
        const cachedQuery = key.replace(`${userId}:`, "");
        if (this.isSimilarQuery(query, cachedQuery)) {
          return value.results;
        }
      }
    }

    return null;
  }

  /**
   * Simple similarity check for queries
   */
  private isSimilarQuery(query1: string, query2: string): boolean {
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));
    
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) overlap++;
    }

    const similarity = overlap / Math.max(words1.size, words2.size);
    return similarity >= 0.6;
  }

  /**
   * Clean up old prefetch cache entries
   */
  cleanupPrefetchCache(): void {
    const now = Date.now();
    const expiry = 5 * 60 * 1000; // 5 minutes

    for (const [key, value] of this.prefetchCache) {
      if (now - value.timestamp > expiry) {
        this.prefetchCache.delete(key);
      }
    }
  }

  /**
   * Get statistics about speculative execution
   */
  getStats(): {
    prefetchCacheSize: number;
    trackedUsers: number;
    totalPredictions: number;
  } {
    return {
      prefetchCacheSize: this.prefetchCache.size,
      trackedUsers: this.recentQueries.size,
      totalPredictions: Array.from(this.recentQueries.values())
        .reduce((sum, queries) => sum + queries.length, 0),
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.prefetchCache.clear();
    this.recentQueries.clear();
  }
}

// Export singleton instance
export const speculativeExecutor = new SpeculativeExecutorService();
