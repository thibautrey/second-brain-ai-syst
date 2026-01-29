/**
 * Task Intent Analyzer Tests
 *
 * Tests for the intelligent task intent extraction service
 * Run with: npx vitest run services/__tests__/task-intent-analyzer.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TaskIntentAnalyzer,
  type TaskIntentAnalysis,
} from "../task-intent-analyzer.js";

describe("TaskIntentAnalyzer", () => {
  let analyzer: TaskIntentAnalyzer;

  beforeEach(() => {
    analyzer = new TaskIntentAnalyzer();
  });

  describe("Monitoring Request Detection", () => {
    it("should detect 'let me know' as monitoring request", () => {
      const result = analyzer.analyze("Let me know if the weather changes");
      expect(result.isTaskRequest).toBe(true);
      expect(result.taskType).toBe("monitoring");
    });

    it("should detect 'préviens-moi' as monitoring request", () => {
      const result = analyzer.analyze("Préviens-moi si le prix baisse");
      expect(result.isTaskRequest).toBe(true);
      expect(result.taskType).toBe("monitoring");
    });

    it("should detect 'surveille' as monitoring request", () => {
      const result = analyzer.analyze("Surveille la météo pour Paris");
      expect(result.isTaskRequest).toBe(true);
    });

    it("should detect 'keep me posted' as monitoring request", () => {
      const result = analyzer.analyze("Keep me posted on any weather changes");
      expect(result.isTaskRequest).toBe(true);
    });

    it("should not detect normal questions as monitoring requests", () => {
      const result = analyzer.analyze("What's the weather like today?");
      expect(result.isTaskRequest).toBe(false);
    });
  });

  describe("Subject Identification", () => {
    it("should identify weather subject", () => {
      const result = analyzer.analyze("Let me know if the weather changes");
      expect(result.extractedEntities.subject?.type).toBe("weather");
      expect(result.extractedEntities.subject?.defaultInterval).toBe(120);
    });

    it("should identify price subject", () => {
      const result = analyzer.analyze("Alert me if the price drops below 100€");
      expect(result.extractedEntities.subject?.type).toBe("price");
      expect(result.extractedEntities.subject?.defaultInterval).toBe(60);
    });

    it("should identify availability subject", () => {
      const result = analyzer.analyze(
        "Let me know when tickets become available",
      );
      expect(result.extractedEntities.subject?.type).toBe("availability");
      expect(result.extractedEntities.subject?.defaultInterval).toBe(30);
    });

    it("should identify météo in French", () => {
      const result = analyzer.analyze("Surveille la météo");
      expect(result.extractedEntities.subject?.type).toBe("weather");
    });
  });

  describe("Location Extraction", () => {
    it("should extract location from 'for [location]'", () => {
      const result = analyzer.analyze(
        "Let me know if the weather changes for Ax-les-thermes",
      );
      expect(result.extractedEntities.location).toBe("Ax-Les-Thermes");
    });

    it("should extract location from 'à [location]'", () => {
      const result = analyzer.analyze("Surveille la météo à Paris");
      expect(result.extractedEntities.location).toBe("Paris");
    });

    it("should extract location from 'pour [location]'", () => {
      const result = analyzer.analyze(
        "Préviens-moi pour la météo de Lyon ce weekend",
      );
      expect(result.extractedEntities.location).toBeDefined();
    });

    it("should extract location from 'weather [location]'", () => {
      const result = analyzer.analyze("Monitor weather Paris");
      expect(result.extractedEntities.location).toBe("Paris");
    });
  });

  describe("Change Detection Intent", () => {
    it("should detect 'if it changes'", () => {
      const result = analyzer.analyze("Let me know if the weather changes");
      expect(result.notificationIntent.onlyOnChange).toBe(true);
      expect(result.notificationIntent.triggerOn).toBe("change");
    });

    it("should detect 'si ça change'", () => {
      const result = analyzer.analyze(
        "Préviens-moi si ça change pour la météo",
      );
      expect(result.notificationIntent.onlyOnChange).toBe(true);
    });

    it("should detect 'when different'", () => {
      const result = analyzer.analyze("Alert me when the price is different");
      expect(result.notificationIntent.onlyOnChange).toBe(true);
    });

    it("should detect 'en cas de changement'", () => {
      const result = analyzer.analyze(
        "Surveille la météo, en cas de changement préviens-moi",
      );
      expect(result.notificationIntent.onlyOnChange).toBe(true);
    });

    it("should not set onlyOnChange for general monitoring", () => {
      const result = analyzer.analyze("Keep me posted on the weather");
      expect(result.notificationIntent.onlyOnChange).toBe(false);
    });
  });

  describe("Temporal Information Extraction", () => {
    it("should extract 'ce weekend' expiration", () => {
      const result = analyzer.analyze(
        "Let me know about weather pour ce weekend",
      );
      expect(result.temporalInfo.expiresAt).toBeDefined();
      expect(result.temporalInfo.inferred).toBe(true);
      expect(result.temporalInfo.reason).toContain("Weekend");
    });

    it("should extract 'this weekend' expiration", () => {
      const result = analyzer.analyze("Monitor weather for this weekend");
      expect(result.temporalInfo.expiresAt).toBeDefined();
      expect(result.temporalInfo.inferred).toBe(true);
    });

    it("should extract 'cette semaine' expiration", () => {
      const result = analyzer.analyze("Surveille la météo cette semaine");
      expect(result.temporalInfo.expiresAt).toBeDefined();
      expect(result.temporalInfo.reason).toContain("week");
    });

    it("should extract 'until tomorrow' expiration", () => {
      const result = analyzer.analyze(
        "Alert me until tomorrow if prices change",
      );
      expect(result.temporalInfo.expiresAt).toBeDefined();
      expect(result.temporalInfo.reason).toContain("tomorrow");
    });

    it("should extract 'aujourd'hui' expiration", () => {
      const result = analyzer.analyze("Surveille les prix aujourd'hui");
      expect(result.temporalInfo.expiresAt).toBeDefined();
      expect(result.temporalInfo.reason).toContain("Today");
    });
  });

  describe("Clarification Requests", () => {
    it("should request clarification for missing location with weather", () => {
      const result = analyzer.analyze("Surveille la météo");
      expect(result.clarification?.needed).toBe(true);
      expect(result.clarification?.type).toBe("location");
      expect(result.clarification?.question).toContain("ville");
    });

    it("should not request location clarification when location is provided", () => {
      const result = analyzer.analyze("Surveille la météo à Paris");
      expect(result.clarification?.type).not.toBe("location");
    });

    it("should request expiration clarification for event references", () => {
      const result = analyzer.analyze("Surveille les prix jusqu'à mon voyage");
      expect(result.temporalInfo.needsClarification).toBe(true);
      expect(result.clarification?.needed).toBe(true);
      expect(result.clarification?.type).toBe("expiration_date");
    });
  });

  describe("Suggested Task Parameters", () => {
    it("should suggest INTERVAL schedule type for monitoring", () => {
      const result = analyzer.analyze(
        "Let me know if weather changes for Paris this weekend",
      );
      expect(result.suggestedTaskParams?.scheduleType).toBe("INTERVAL");
    });

    it("should suggest correct interval for weather", () => {
      const result = analyzer.analyze("Monitor weather for London");
      expect(result.suggestedTaskParams?.interval).toBe(120);
    });

    it("should suggest correct interval for price", () => {
      const result = analyzer.analyze("Alert me if prices change");
      expect(result.suggestedTaskParams?.interval).toBe(60);
    });

    it("should suggest crossing dedupe for change detection", () => {
      const result = analyzer.analyze("Let me know if it changes");
      expect(result.suggestedTaskParams?.dedupe?.notifyOn).toBe("crossing");
    });

    it("should include expiresAt when temporal info is available", () => {
      const result = analyzer.analyze("Monitor weather for Paris this weekend");
      expect(result.suggestedTaskParams?.expiresAt).toBeDefined();
    });
  });

  describe("Context for LLM", () => {
    it("should generate context for monitoring requests", () => {
      const result = analyzer.analyze(
        "Let me know if weather changes for Paris this weekend",
      );
      expect(result.contextForLLM).toContain("INTENT ANALYSIS");
      expect(result.contextForLLM).toContain("weather");
      expect(result.contextForLLM).toContain("Paris");
    });

    it("should indicate clarification needed in context", () => {
      const result = analyzer.analyze("Surveille la météo");
      expect(result.contextForLLM).toContain("CLARIFICATION NEEDED");
    });

    it("should be empty for non-task requests", () => {
      const result = analyzer.analyze("What's the weather?");
      expect(result.contextForLLM).toBe("");
    });
  });

  describe("Confidence Scoring", () => {
    it("should have higher confidence with more information", () => {
      const fullInfo = analyzer.analyze(
        "Let me know if the weather changes for Paris this weekend",
      );
      const partialInfo = analyzer.analyze("Surveille quelque chose");

      expect(fullInfo.confidence).toBeGreaterThan(partialInfo.confidence);
    });

    it("should increase confidence with subject detection", () => {
      const withSubject = analyzer.analyze("Alert me about weather");
      const withoutSubject = analyzer.analyze("Alert me about something");

      expect(withSubject.confidence).toBeGreaterThan(withoutSubject.confidence);
    });
  });

  describe("Real-world Examples", () => {
    it("should handle full French request correctly", () => {
      const result = analyzer.analyze(
        "Préviens-moi si la météo change pour Ax-les-Thermes ce weekend",
      );

      expect(result.isTaskRequest).toBe(true);
      expect(result.extractedEntities.subject?.type).toBe("weather");
      expect(result.extractedEntities.location).toBeDefined();
      expect(result.notificationIntent.onlyOnChange).toBe(true);
      expect(result.temporalInfo.expiresAt).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should handle full English request correctly", () => {
      const result = analyzer.analyze(
        "Let me know if the weather changes for London this weekend",
      );

      expect(result.isTaskRequest).toBe(true);
      expect(result.extractedEntities.subject?.type).toBe("weather");
      expect(result.extractedEntities.location).toBeDefined();
      expect(result.notificationIntent.onlyOnChange).toBe(true);
      expect(result.temporalInfo.expiresAt).toBeDefined();
    });

    it("should handle ticket monitoring request", () => {
      const result = analyzer.analyze(
        "Alert me when concert tickets become available",
      );

      expect(result.isTaskRequest).toBe(true);
      expect(result.extractedEntities.subject?.type).toBe("availability");
      expect(result.suggestedTaskParams?.interval).toBe(30);
    });

    it("should handle price monitoring request", () => {
      const result = analyzer.analyze(
        "Watch the price of the train ticket to Paris until Friday",
      );

      expect(result.isTaskRequest).toBe(true);
      expect(result.extractedEntities.subject?.type).toBe("price");
    });
  });
});
