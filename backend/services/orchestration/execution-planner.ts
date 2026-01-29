/**
 * Execution Planner - uses LLM to propose an initial tool plan.
 *
 * The planner is intentionally lightweight: it gives the LLM the list of
 * available tools and the user question, then asks for a JSON plan describing
 * which tools to call and with which arguments.
 */

import { randomBytes } from "crypto";
import {
  piAiProviderService,
  type PiAiProviderConfig,
} from "../pi-ai-provider.js";
import type { ToolFunctionDefinition } from "../../config/chat-config.js";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ExecutionPlan {
  toolCalls: ToolCall[];
  priority: "high" | "medium" | "low";
  parallelizable: boolean;
  estimatedDuration: number;
  confidence: number;
}

export class ExecutionPlanner {
  constructor(private providerConfig: PiAiProviderConfig) {}

  async createPlan(
    userQuestion: string,
    intentAnalysis: any,
    availableTools: ToolFunctionDefinition[],
  ): Promise<ExecutionPlan> {
    try {
      const toolsForPrompt = availableTools
        .slice(0, 12) // keep prompt concise
        .map((t) => ({
          name: t.name,
          description: t.description,
          required: t.parameters?.required ?? [],
        }));

      const systemPrompt = `You are a planning agent. Propose a minimal set of tool calls (1-3) to answer the user.
Return ONLY valid JSON with fields: toolCalls (array of {id,name,arguments}), priority ("high"|"medium"|"low"), parallelizable (boolean), estimatedDuration (ms), confidence (0-100).
Never repeat the same tool with identical parameters across reflections. Prefer fewer, higher-quality calls.`;

      const userPrompt = JSON.stringify(
        {
          question: userQuestion,
          intent: intentAnalysis,
          availableTools: toolsForPrompt,
        },
        null,
        2,
      );

      const completion = await piAiProviderService.createChatCompletion(
        this.providerConfig,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.4, maxTokens: 800 },
      );

      // Validate response content
      if (!completion.content || typeof completion.content !== "string") {
        console.error("[ExecutionPlanner] Invalid response from LLM", {
          hasContent: !!completion.content,
          contentType: typeof completion.content,
          contentLength: completion.content?.length,
        });
        throw new Error(
          `Invalid LLM response: expected string content, got ${typeof completion.content}`,
        );
      }

      // Try parsing JSON with better error handling
      let parsed: any;
      try {
        parsed = JSON.parse(completion.content);
      } catch (parseError: any) {
        console.error(
          "[ExecutionPlanner] Failed to parse LLM response as JSON",
          {
            error: parseError.message,
            content: completion.content.substring(0, 500),
            contentLength: completion.content.length,
          },
        );
        // Return a fallback plan if JSON parsing fails
        throw new Error(
          `Failed to parse execution plan JSON: ${parseError.message}`,
        );
      }

      const toolCalls: ToolCall[] = (parsed.toolCalls || []).map(
        (call: any) => ({
          id: call.id || randomBytes(8).toString("hex"),
          name: call.name,
          arguments: call.arguments || {},
        }),
      );

      return {
        toolCalls,
        priority: parsed.priority || "medium",
        parallelizable: parsed.parallelizable ?? true,
        estimatedDuration: parsed.estimatedDuration || 5000,
        confidence: parsed.confidence || 60,
      };
    } catch (error) {
      console.error(
        "[ExecutionPlanner] Failed to build plan, using fallback:",
        error,
      );
      return {
        toolCalls: [],
        priority: "medium",
        parallelizable: true,
        estimatedDuration: 3000,
        confidence: 30,
      };
    }
  }
}
