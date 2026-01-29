/**
 * Task Intent Analyzer Service
 *
 * Analyzes user messages to extract implicit task creation intents.
 * Detects monitoring requests, temporal boundaries, change detection patterns,
 * and provides intelligent clarification when needed.
 */

// ==================== Types ====================

export interface TemporalInfo {
  startDate?: Date;
  expiresAt?: Date;
  inferred: boolean;
  reason?: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  eventName?: string;
}

export interface NotificationIntent {
  triggerOn: "always" | "change" | "threshold" | "pattern";
  onlyOnChange: boolean;
  threshold?: {
    operator: "lt" | "gt" | "lte" | "gte" | "eq" | "neq" | "contains";
    value: any;
  };
}

export interface MonitoringSubject {
  type: "weather" | "price" | "availability" | "news" | "generic";
  keywords?: string[];
  defaultInterval: number; // minutes
  defaultConditionPath?: string;
  apiTemplate?: string;
}

export interface ExtractedEntities {
  location?: string;
  subject?: MonitoringSubject;
  target?: string;
  eventName?: string;
  quantity?: number;
  url?: string;
}

export interface SuggestedTaskParams {
  scheduleType: "ONE_TIME" | "CRON" | "INTERVAL";
  interval?: number;
  expiresAt?: Date;
  actionType: string;
  dedupe?: {
    notifyOn: "crossing" | "every_true";
  };
}

export interface ClarificationRequest {
  needed: boolean;
  type:
    | "expiration_date"
    | "location"
    | "frequency"
    | "threshold"
    | "confirmation";
  question: string;
  options?: string[];
  context?: string;
}

export interface TaskIntentAnalysis {
  // Original input
  originalMessage: string;

  // Is this a task creation request?
  isTaskRequest: boolean;
  taskType?: "monitoring" | "reminder" | "recurring_action" | "one_time";

  // Extracted information
  extractedEntities: ExtractedEntities;
  temporalInfo: TemporalInfo;
  notificationIntent: NotificationIntent;

  // Suggested parameters for task creation
  suggestedTaskParams?: SuggestedTaskParams;

  // Clarification needed?
  clarification?: ClarificationRequest;

  // Confidence in the analysis (0-1)
  confidence: number;

  // Context to inject into LLM prompt
  contextForLLM: string;
}

// ==================== Configuration ====================

const MONITORING_SUBJECTS: Record<string, MonitoringSubject> = {
  weather: {
    type: "weather",
    keywords: [
      "météo",
      "weather",
      "temps",
      "pluie",
      "rain",
      "soleil",
      "sun",
      "température",
      "temperature",
      "neige",
      "snow",
      "orage",
      "storm",
      "vent",
      "wind",
      "prévisions",
      "forecast",
    ],
    defaultInterval: 120, // 2 hours
    defaultConditionPath: "weather.0.main",
    apiTemplate:
      "https://api.openweathermap.org/data/2.5/weather?q={{location}}&appid={{OPENWEATHER_API_KEY}}&units=metric&lang=fr",
  },
  price: {
    type: "price",
    keywords: [
      "prix",
      "price",
      "coût",
      "cost",
      "tarif",
      "rate",
      "billet",
      "ticket",
      "vol",
      "flight",
      "train",
      "euro",
      "€",
      "$",
    ],
    defaultInterval: 60, // 1 hour
  },
  availability: {
    type: "availability",
    keywords: [
      "disponible",
      "available",
      "stock",
      "places",
      "seats",
      "tickets",
      "billets",
      "réservation",
      "booking",
      "libre",
      "free",
      "complet",
      "sold out",
    ],
    defaultInterval: 30, // 30 minutes
  },
  news: {
    type: "news",
    keywords: [
      "news",
      "actualités",
      "nouvelles",
      "article",
      "annonce",
      "announcement",
      "update",
      "mise à jour",
    ],
    defaultInterval: 240, // 4 hours
  },
};

// Patterns for detecting change-based notifications
const CHANGE_DETECTION_PATTERNS = [
  /if\s+(it\s+)?change[sd]?/i,
  /si\s+(ça|cela|il|elle)\s+change/i,
  /when\s+(it\s+)?(is\s+)?different/i,
  /en\s+cas\s+de\s+changement/i,
  /only\s+(if|when)\s+(it'?s?\s+)?(new|different)/i,
  /let\s+me\s+know\s+if/i,
  /préviens[- ]?moi\s+si/i,
  /alert\s+(me\s+)?(if|when)/i,
  /notify\s+(me\s+)?(if|when)/i,
  /tell\s+me\s+(if|when)/i,
  /dis[- ]?moi\s+si/i,
];

// Patterns for detecting monitoring requests
const MONITORING_REQUEST_PATTERNS = [
  /let\s+me\s+know/i,
  /préviens[- ]?moi/i,
  /alert(e)?(\s+me)?/i,
  /notify(\s+me)?/i,
  /surveille/i,
  /watch/i,
  /monitor/i,
  /keep\s+(me\s+)?(posted|updated|informed)/i,
  /tiens[- ]?moi\s+(au\s+courant|informé)/i,
  /check\s+(regularly|periodically)/i,
  /vérifie\s+(régulièrement)?/i,
];

// Temporal patterns with their resolution functions
interface TemporalPattern {
  pattern: RegExp;
  resolve: () => { expiresAt: Date; reason: string };
}

const TEMPORAL_PATTERNS: TemporalPattern[] = [
  {
    pattern: /ce\s+week[- ]?end|this\s+weekend/i,
    resolve: () => ({
      expiresAt: getNextSundayEnd(),
      reason: "Weekend detected - expires Sunday 23:59",
    }),
  },
  {
    pattern: /cette\s+semaine|this\s+week/i,
    resolve: () => ({
      expiresAt: getEndOfWeek(),
      reason: "This week detected - expires end of week",
    }),
  },
  {
    pattern: /jusqu'?[àa]\s+demain|until\s+tomorrow/i,
    resolve: () => ({
      expiresAt: getTomorrowEnd(),
      reason: "Tomorrow detected - expires tomorrow 23:59",
    }),
  },
  {
    pattern: /pour\s+(les\s+)?prochains?\s+(\d+)\s+jours?/i,
    resolve: () => ({
      expiresAt: addDays(new Date(), 3),
      reason: "Next few days detected",
    }),
  },
  {
    pattern: /for\s+the\s+next\s+(\d+)\s+days?/i,
    resolve: () => ({
      expiresAt: addDays(new Date(), 3),
      reason: "Next few days detected",
    }),
  },
  {
    pattern: /aujourd'?hui|today/i,
    resolve: () => ({
      expiresAt: getTodayEnd(),
      reason: "Today detected - expires tonight 23:59",
    }),
  },
  {
    pattern: /demain|tomorrow/i,
    resolve: () => ({
      expiresAt: getTomorrowEnd(),
      reason: "Tomorrow detected - expires tomorrow 23:59",
    }),
  },
];

// Location extraction patterns
const LOCATION_PATTERNS = [
  // "for [location]", "à [location]", "pour [location]"
  /(?:for|à|pour|in|at|near)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-'\s]{2,30}?)(?:\s+(?:ce|this|pour|for|jusqu|until|today|tomorrow|demain|aujourd)|\s*[,.]|\s*$)/i,
  // Location at the end
  /(?:météo|weather|temps)\s+(?:de\s+|d'|à\s+|pour\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-'\s]{2,30})/i,
];

// Event patterns that need date clarification
const EVENT_PATTERNS = [
  /pour\s+(le|la|l'|mon|ma|mes)\s+([a-zÀ-ÿ\s]{2,30})/i,
  /for\s+(my|the)\s+([a-z\s]{2,30})/i,
  /until\s+(my|the)\s+([a-z\s]{2,30})/i,
  /jusqu'?[àa]\s+(mon|ma|mes|le|la|l')\s+([a-zÀ-ÿ\s]{2,30})/i,
];

// ==================== Utility Functions ====================

function getNextSundayEnd(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const sunday = new Date(now);
  sunday.setDate(sunday.getDate() + daysUntilSunday);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

function getEndOfWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilEndOfWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilEndOfWeek);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
}

function getTodayEnd(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

function getTomorrowEnd(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  return tomorrow;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(23, 59, 59, 999);
  return result;
}

// ==================== Main Service ====================

export class TaskIntentAnalyzer {
  /**
   * Analyze a user message to extract task creation intent
   */
  analyze(message: string): TaskIntentAnalysis {
    const analysis: TaskIntentAnalysis = {
      originalMessage: message,
      isTaskRequest: false,
      extractedEntities: {},
      temporalInfo: { inferred: false },
      notificationIntent: {
        triggerOn: "always",
        onlyOnChange: false,
      },
      confidence: 0,
      contextForLLM: "",
    };

    // 1. Check if this is a monitoring request
    const isMonitoring = this.isMonitoringRequest(message);
    if (!isMonitoring) {
      return analysis;
    }

    analysis.isTaskRequest = true;
    analysis.taskType = "monitoring";
    analysis.confidence = 0.6;

    // 2. Extract subject (weather, price, availability, etc.)
    const subject = this.identifySubject(message);
    analysis.extractedEntities.subject = subject;
    if (subject.type !== "generic") {
      analysis.confidence += 0.1;
    }

    // 3. Extract location
    const location = this.extractLocation(message);
    if (location) {
      analysis.extractedEntities.location = location;
      analysis.confidence += 0.1;
    }

    // 4. Detect change-based notification intent
    const onlyOnChange = this.detectChangeIntent(message);
    analysis.notificationIntent = {
      triggerOn: onlyOnChange ? "change" : "always",
      onlyOnChange,
    };
    if (onlyOnChange) {
      analysis.confidence += 0.1;
    }

    // 5. Extract temporal information
    analysis.temporalInfo = this.extractTemporalInfo(message);
    if (analysis.temporalInfo.expiresAt) {
      analysis.confidence += 0.1;
    }

    // 6. Check for events that need date clarification
    const eventInfo = this.detectEventReference(message);
    if (eventInfo.hasEvent && !analysis.temporalInfo.expiresAt) {
      analysis.temporalInfo.needsClarification = true;
      analysis.temporalInfo.eventName = eventInfo.eventName;
      analysis.clarification = {
        needed: true,
        type: "expiration_date",
        question: this.generateClarificationQuestion(
          "expiration_date",
          eventInfo.eventName,
          subject.type,
        ),
        context: `Event "${eventInfo.eventName}" mentioned but no end date specified`,
      };
    }

    // 7. Check if location is needed but missing
    if (
      subject.type === "weather" &&
      !location &&
      !analysis.clarification?.needed
    ) {
      analysis.clarification = {
        needed: true,
        type: "location",
        question: this.generateClarificationQuestion(
          "location",
          undefined,
          subject.type,
        ),
        context: "Weather monitoring requested but location not specified",
      };
      analysis.confidence -= 0.2;
    }

    // 8. Build suggested task parameters
    analysis.suggestedTaskParams = this.buildSuggestedParams(analysis);

    // 9. Build context for LLM
    analysis.contextForLLM = this.buildContextForLLM(analysis);

    return analysis;
  }

  /**
   * Check if message is a monitoring request
   */
  private isMonitoringRequest(message: string): boolean {
    return MONITORING_REQUEST_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Identify the subject being monitored
   */
  private identifySubject(message: string): MonitoringSubject {
    const lowerMessage = message.toLowerCase();

    for (const [key, subject] of Object.entries(MONITORING_SUBJECTS)) {
      if (subject.keywords?.some((kw) => lowerMessage.includes(kw))) {
        return subject;
      }
    }

    return {
      type: "generic",
      defaultInterval: 60,
    };
  }

  /**
   * Extract location from message
   */
  private extractLocation(message: string): string | undefined {
    for (const pattern of LOCATION_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        // Clean up the location
        let location = match[1].trim();
        // Remove trailing common words
        location = location
          .replace(/\s+(pour|for|this|ce|jusqu|until).*$/i, "")
          .trim();
        // Capitalize properly
        location = location
          .split(/[\s-]+/)
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join("-");

        if (location.length >= 2) {
          return location;
        }
      }
    }
    return undefined;
  }

  /**
   * Detect if user wants notifications only on change
   */
  private detectChangeIntent(message: string): boolean {
    return CHANGE_DETECTION_PATTERNS.some((pattern) => pattern.test(message));
  }

  /**
   * Extract temporal information from message
   */
  private extractTemporalInfo(message: string): TemporalInfo {
    for (const { pattern, resolve } of TEMPORAL_PATTERNS) {
      if (pattern.test(message)) {
        const { expiresAt, reason } = resolve();
        return {
          expiresAt,
          inferred: true,
          reason,
        };
      }
    }

    // Check for explicit dates (ISO format or common formats)
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    ];

    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        try {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            date.setHours(23, 59, 59, 999);
            return {
              expiresAt: date,
              inferred: false,
              reason: "Explicit date found in message",
            };
          }
        } catch {
          // Invalid date, continue
        }
      }
    }

    return { inferred: false };
  }

  /**
   * Detect event references that might need date clarification
   */
  private detectEventReference(message: string): {
    hasEvent: boolean;
    eventName?: string;
  } {
    for (const pattern of EVENT_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[2]) {
        const eventName = match[2].trim();
        // Filter out common non-event words
        const nonEventWords = [
          "weekend",
          "semaine",
          "week",
          "jour",
          "day",
          "mois",
          "month",
        ];
        if (
          !nonEventWords.some((w) => eventName.toLowerCase().includes(w)) &&
          eventName.length > 2
        ) {
          return { hasEvent: true, eventName };
        }
      }
    }
    return { hasEvent: false };
  }

  /**
   * Generate a clarification question
   */
  private generateClarificationQuestion(
    type: ClarificationRequest["type"],
    eventName?: string,
    subjectType?: string,
  ): string {
    switch (type) {
      case "expiration_date":
        if (eventName) {
          return `Quand est prévu(e) "${eventName}" ? Je pourrai arrêter la surveillance après cette date.`;
        }
        return "Jusqu'à quand dois-je surveiller cela ?";

      case "location":
        if (subjectType === "weather") {
          return "Pour quelle ville ou région voulez-vous que je surveille la météo ?";
        }
        return "Pour quel endroit dois-je effectuer cette surveillance ?";

      case "frequency":
        return "À quelle fréquence voulez-vous que je vérifie ? (ex: toutes les heures, toutes les 30 minutes)";

      case "threshold":
        return "À partir de quel seuil voulez-vous être alerté ?";

      case "confirmation":
        return "Voulez-vous que je crée cette surveillance ?";

      default:
        return "Pouvez-vous préciser votre demande ?";
    }
  }

  /**
   * Build suggested task parameters based on analysis
   */
  private buildSuggestedParams(
    analysis: TaskIntentAnalysis,
  ): SuggestedTaskParams {
    const subject = analysis.extractedEntities.subject;
    const interval = subject?.defaultInterval || 60;

    const params: SuggestedTaskParams = {
      scheduleType: "INTERVAL",
      interval,
      actionType: "WATCH_RESOURCE",
    };

    if (analysis.temporalInfo.expiresAt) {
      params.expiresAt = analysis.temporalInfo.expiresAt;
    }

    if (analysis.notificationIntent.onlyOnChange) {
      params.dedupe = { notifyOn: "crossing" };
    }

    return params;
  }

  /**
   * Build context string to inject into LLM prompt
   */
  private buildContextForLLM(analysis: TaskIntentAnalysis): string {
    if (!analysis.isTaskRequest) {
      return "";
    }

    const lines: string[] = [
      "",
      "📊 INTENT ANALYSIS (monitoring request detected):",
    ];

    // Subject
    const subjectType = analysis.extractedEntities.subject?.type || "generic";
    lines.push(`- Subject: ${subjectType}`);

    // Location
    if (analysis.extractedEntities.location) {
      lines.push(`- Location: ${analysis.extractedEntities.location}`);
    } else if (subjectType === "weather") {
      lines.push(`- Location: ⚠️ NOT SPECIFIED (ask user)`);
    }

    // Change detection
    lines.push(
      `- Notify on change only: ${analysis.notificationIntent.onlyOnChange ? "YES (use dedupe.notifyOn='crossing')" : "NO"}`,
    );

    // Expiration
    if (analysis.temporalInfo.expiresAt) {
      lines.push(
        `- Auto-expiration: ${analysis.temporalInfo.expiresAt.toISOString()}`,
      );
      lines.push(`  (Reason: ${analysis.temporalInfo.reason})`);
    } else if (analysis.temporalInfo.needsClarification) {
      lines.push(
        `- Auto-expiration: ⚠️ NEEDS CLARIFICATION (event: "${analysis.temporalInfo.eventName}")`,
      );
    }

    // Suggested interval
    const interval = analysis.suggestedTaskParams?.interval || 60;
    lines.push(`- Suggested check interval: ${interval} minutes`);

    // Clarification needed
    if (analysis.clarification?.needed) {
      lines.push("");
      lines.push(`⚠️ CLARIFICATION NEEDED (${analysis.clarification.type}):`);
      lines.push(`Ask the user: "${analysis.clarification.question}"`);
    } else {
      lines.push("");
      lines.push("✅ All required information available - create the task.");
    }

    // Confidence
    lines.push("");
    lines.push(`Confidence: ${Math.round(analysis.confidence * 100)}%`);

    return lines.join("\n");
  }

  /**
   * Generate a smart clarification response for the user
   */
  generateClarificationResponse(analysis: TaskIntentAnalysis): string | null {
    if (!analysis.clarification?.needed) {
      return null;
    }

    const subject =
      analysis.extractedEntities.subject?.type || "cette information";
    const location = analysis.extractedEntities.location;

    let response = "";

    switch (analysis.clarification.type) {
      case "expiration_date":
        response = `Je peux surveiller ${subject === "weather" ? "la météo" : subject}`;
        if (location) {
          response += ` pour ${location}`;
        }
        response += `. ${analysis.clarification.question}`;
        break;

      case "location":
        response = analysis.clarification.question;
        break;

      default:
        response = analysis.clarification.question;
    }

    return response;
  }
}

// Export singleton
export const taskIntentAnalyzer = new TaskIntentAnalyzer();
