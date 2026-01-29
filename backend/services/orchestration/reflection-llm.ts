/**
 * Reflection LLM Service
 *
 * Analyzes tool execution results and decides the next step
 * (answer, alternative tools, retry, ask user, give up).
 */

import {
  piAiProviderService,
  type PiAiProviderConfig,
} from "../pi-ai-provider.js";
import { WorkerAgentResult } from "./worker-agent.js";

export type ReflectionDecision =
  | "answer"
  | "retry"
  | "alternative"
  | "ask_user"
  | "give_up";

export interface ToolSuggestion {
  toolName: string;
  params: Record<string, any>;
  reasoning: string;
}

export interface ReflectionResponse {
  decision: ReflectionDecision;
  reasoning: string;
  confidence: number;
  suggestedTools?: ToolSuggestion[];
  partialResponse?: string;
  clarificationQuestion?: string;
}

export interface ReflectionRequest {
  userQuestion: string;
  toolResults: WorkerAgentResult[];
  failedAttempts: WorkerAgentResult[];
  previousReflections: ReflectionResponse[];
  attemptNumber: number;
  maxAttempts: number;
  providerConfig: PiAiProviderConfig;
}

class ReflectionLLMService {
  async reflect(request: ReflectionRequest): Promise<ReflectionResponse> {
    const systemPrompt = this.buildReflectionPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    const response = await piAiProviderService.createChatCompletion(
      request.providerConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.3,
        maxTokens: 900,
      },
    );

    // Validate response content
    if (!response.content || typeof response.content !== "string") {
      console.error("[ReflectionLLM] Invalid response from LLM", {
        hasContent: !!response.content,
        contentType: typeof response.content,
        contentLength: response.content?.length,
      });
      // Return default reflection on empty response
      return {
        decision: "give_up",
        reasoning: "Model did not provide a valid response",
        confidence: 0,
      };
    }

    // Try to parse JSON from model response, fallback to default structure
    let parsed: any;
    try {
      // Extract JSON from markdown code blocks if present
      let contentToParse = response.content.trim();
      const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        contentToParse = jsonMatch[1].trim();
      }
      parsed = JSON.parse(contentToParse);
    } catch (parseError: any) {
      console.warn(
        "[ReflectionLLM] Failed to parse JSON, using response as reasoning",
        {
          parseError: parseError.message,
          content: response.content.substring(0, 500),
        },
      );
      parsed = {
        decision: "answer",
        reasoning: response.content,
        confidence: 50,
      };
    }

    return this.validateReflection(parsed);
  }

  private buildReflectionPrompt(request: ReflectionRequest): string {
    return `You are a reflection agent analyzing tool execution results.

Your role:
- Decide if we can answer now or need another step.
- Suggest alternative tools instead of repeating identical failures.
- Ask the user for clarification if required.
- Stop gracefully when attempts are exhausted.

Decision types:
- "answer": We have enough information to respond.
- "alternative": Try different tools/approaches.
- "retry": Retry a tool with better parameters (only if parameters will change).
- "ask_user": Ask the user a clarifying question.
- "give_up": Explain transparently that we could not complete the task.

Current attempt ${request.attemptNumber + 1} of ${request.maxAttempts}.`;
  }

  private buildUserPrompt(request: ReflectionRequest): string {
    const successfulTools = request.toolResults.filter(
      (r) => r.status === "success",
    );
    const failedTools = request.toolResults.filter(
      (r) => r.status === "failed" || r.status === "timeout",
    );

    return [
      `User question: "${request.userQuestion}"`,
      "",
      `Successful tools (${successfulTools.length}):`,
      successfulTools
        .map((t) => `- ${t.toolName}: ${JSON.stringify(t.data).slice(0, 400)}`)
        .join("\n"),
      "",
      `Failed/timeout tools (${failedTools.length}):`,
      failedTools
        .map((t) => {
          let errorInfo = `- ${t.toolName}: ${t.error}`;
          // Include params that were sent so LLM can correct them
          if (t.params) {
            errorInfo += `\n  Params sent: ${JSON.stringify(t.params)}`;
          }
          // Add hint for validation errors
          if (
            t.error?.includes("Validation failed") ||
            t.error?.includes("unknown/additional properties")
          ) {
            errorInfo += `\n  → HINT: Check the tool schema - use list_fields or get action to see valid parameters.`;
          }
          return errorInfo;
        })
        .join("\n"),
      "",
      "Previous reflections:",
      request.previousReflections
        .map((r, i) => `${i + 1}. ${r.decision} -> ${r.reasoning}`)
        .join("\n"),
      "",
      "Respond with a JSON object containing fields: decision, reasoning, confidence (0-100), suggestedTools (array), partialResponse (optional), clarificationQuestion (optional).",
    ].join("\n");
  }

  private validateReflection(reflection: any): ReflectionResponse {
    // Check for required fields
    if (!reflection.decision) {
      console.error("[ReflectionLLM] Missing decision field", {
        hasDecision: !!reflection.decision,
        hasReasoning: !!reflection.reasoning,
        reflectionKeys: reflection ? Object.keys(reflection) : "null",
      });
      throw new Error("Invalid reflection response: missing decision field");
    }

    if (!reflection.reasoning) {
      console.error("[ReflectionLLM] Missing reasoning field", {
        hasDecision: !!reflection.decision,
        hasReasoning: !!reflection.reasoning,
        reflectionKeys: reflection ? Object.keys(reflection) : "null",
      });
      throw new Error("Invalid reflection response: missing reasoning field");
    }

    const validDecisions: ReflectionDecision[] = [
      "answer",
      "retry",
      "alternative",
      "ask_user",
      "give_up",
    ];

    if (!validDecisions.includes(reflection.decision)) {
      throw new Error(`Invalid decision: ${reflection.decision}`);
    }

    return {
      decision: reflection.decision,
      reasoning: reflection.reasoning,
      confidence: reflection.confidence ?? 50,
      suggestedTools: reflection.suggestedTools,
      partialResponse: reflection.partialResponse,
      clarificationQuestion: reflection.clarificationQuestion,
    };
  }
}

export const reflectionLLMService = new ReflectionLLMService();
