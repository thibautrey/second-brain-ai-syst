// Dynamic Tool Generator Service
// AI-powered autonomous tool creation system
// Generates, tests, and saves custom tools based on user needs

import { PrismaClient, GeneratedTool } from "@prisma/client";
import { codeExecutorService } from "./code-executor-wrapper.js";
import { secretsService } from "./secrets.js";
import { llmRouterService } from "./llm-router.js";

const prisma = new PrismaClient();

// Types
export interface ToolGenerationRequest {
  objective: string; // What the tool should accomplish
  context?: string; // Additional context from conversation
  suggestedSecrets?: string[]; // Secrets the AI thinks might be needed
  existingToolId?: string; // If improving an existing tool
}

export interface ToolGenerationResult {
  success: boolean;
  tool?: GeneratedTool;
  executionResult?: any;
  error?: string;
  iterations?: number;
  logs?: string[];
}

export interface GeneratedToolInput {
  name: string;
  displayName: string;
  description: string;
  code: string;
  inputSchema: object;
  outputSchema?: object;
  requiredSecrets?: string[];
  category?: string;
  tags?: string[];
}

// Prompt templates
const TOOL_GENERATION_SYSTEM_PROMPT = `You are an expert Python programmer specialized in creating reusable API integration tools.

Your task is to generate Python code that accomplishes a specific objective. The code will be executed in a sandbox with network access.

**Available modules:**
- requests, httpx (HTTP clients)
- json, re, datetime, time, calendar
- math, statistics, decimal, fractions
- collections, itertools, functools
- base64, hashlib, hmac
- urllib.parse, urllib.request
- xml.etree.ElementTree, html.parser, csv
- io, copy, textwrap, string

**Environment variables:**
API keys and secrets are available via os.environ.get('KEY_NAME').

**Important rules:**
1. The code MUST set a variable named \`result\` with the final output (JSON-serializable)
2. Use try/except for error handling and return informative error messages
3. Always validate inputs before making API calls
4. Include timeout parameters for HTTP requests (default 10 seconds)
5. Return structured data (dict or list), not raw responses

**Output format:**
Return ONLY the Python code, no markdown, no explanations.
The code should be self-contained and immediately executable.`;

const TOOL_SCHEMA_PROMPT = `Based on the Python code you generated, create a JSON schema for the tool.

Return a JSON object with:
{
  "name": "snake_case_tool_name",
  "displayName": "Human Readable Name",
  "description": "What the tool does",
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": { "type": "string", "description": "..." },
      ...
    },
    "required": ["param1"]
  },
  "outputSchema": { ... },
  "requiredSecrets": ["GOOGLE_MAPS_API_KEY"],
  "category": "maps|weather|finance|communication|data|custom",
  "tags": ["tag1", "tag2"]
}

Return ONLY valid JSON, no markdown, no explanations.`;

const ERROR_FIX_PROMPT = `The code execution failed with this error:
{error}

Stdout: {stdout}
Stderr: {stderr}

Please fix the code and return the corrected version.
Return ONLY the fixed Python code, no explanations.`;

export class DynamicToolGeneratorService {
  private maxIterations = 5;

  /**
   * Generate a new tool from an objective
   */
  async generateTool(
    userId: string,
    request: ToolGenerationRequest,
  ): Promise<ToolGenerationResult> {
    const logs: string[] = [];
    let iterations = 0;

    try {
      logs.push(`Starting tool generation for: ${request.objective}`);

      // Step 1: Check if a similar tool already exists
      const existingTool = await this.findSimilarTool(
        userId,
        request.objective,
      );
      if (existingTool) {
        logs.push(`Found existing tool: ${existingTool.name}`);
        // Could improve the existing tool instead of creating new one
        if (!request.existingToolId) {
          return {
            success: true,
            tool: existingTool,
            logs,
            iterations: 0,
          };
        }
      }

      // Step 2: Check which secrets are available
      const availableSecrets = await this.getAvailableSecrets(
        userId,
        request.suggestedSecrets,
      );
      logs.push(`Available secrets: ${availableSecrets.join(", ") || "none"}`);

      // Step 3: Generate initial code
      let code = await this.generateCode(userId, request, availableSecrets);
      logs.push(`Generated initial code (${code.length} chars)`);

      // Step 4: Iterative execution and refinement
      let lastError: string | null = null;
      let executionResult: any = null;

      while (iterations < this.maxIterations) {
        iterations++;
        logs.push(`Iteration ${iterations}/${this.maxIterations}`);

        // Get secret values for execution
        const secretValues = await secretsService.getSecretsValues(
          userId,
          availableSecrets,
        );

        // Execute the code with network access
        const result = await codeExecutorService.executeWithNetwork(
          code,
          secretValues,
          30,
        );

        if (result.success && result.result !== null) {
          logs.push(`Execution successful!`);
          executionResult = result.result;
          break;
        }

        // Execution failed - try to fix
        lastError = result.error || "Unknown error";
        logs.push(`Execution failed: ${lastError}`);

        if (iterations >= this.maxIterations) {
          return {
            success: false,
            error: `Failed after ${iterations} iterations. Last error: ${lastError}`,
            logs,
            iterations,
          };
        }

        // Generate fixed code
        code = await this.fixCode(userId, code, result);
        logs.push(`Generated fixed code`);
      }

      // Step 5: Generate tool schema
      logs.push(`Generating tool schema...`);
      const toolInput = await this.generateToolSchema(
        userId,
        request.objective,
        code,
        availableSecrets,
      );

      // Step 6: Save the tool
      logs.push(`Saving tool: ${toolInput.name}`);
      const tool = await this.saveTool(userId, toolInput, code);

      return {
        success: true,
        tool,
        executionResult,
        iterations,
        logs,
      };
    } catch (error: any) {
      logs.push(`Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        iterations,
        logs,
      };
    }
  }

  /**
   * Generate code using LLM
   */
  private async generateCode(
    userId: string,
    request: ToolGenerationRequest,
    availableSecrets: string[],
  ): Promise<string> {
    const userPrompt = `Objective: ${request.objective}

${request.context ? `Context: ${request.context}` : ""}

Available environment variables (secrets):
${availableSecrets.length > 0 ? availableSecrets.map((s) => `- ${s}`).join("\n") : "None - you may need to work without API keys or ask the user to configure them"}

Generate Python code that accomplishes this objective.`;

    const response = await llmRouterService.executeTask(
      userId,
      "chat",
      userPrompt,
      TOOL_GENERATION_SYSTEM_PROMPT,
      { temperature: 0.3 },
    );

    // Clean up code (remove markdown if present)
    let code = response;
    if (code.startsWith("```python")) {
      code = code.slice(9);
    }
    if (code.startsWith("```")) {
      code = code.slice(3);
    }
    if (code.endsWith("```")) {
      code = code.slice(0, -3);
    }

    return code.trim();
  }

  /**
   * Fix code based on execution error
   */
  private async fixCode(
    userId: string,
    originalCode: string,
    executionResult: any,
  ): Promise<string> {
    const prompt = ERROR_FIX_PROMPT.replace(
      "{error}",
      executionResult.error || "Unknown",
    )
      .replace("{stdout}", executionResult.stdout || "")
      .replace("{stderr}", executionResult.stderr || "");

    const response = await llmRouterService.executeTask(
      userId,
      "chat",
      prompt,
      `You are fixing Python code that failed to execute. Here is the original code:\n\n${originalCode}`,
      { temperature: 0.2 },
    );

    let code = response;
    if (code.startsWith("```python")) {
      code = code.slice(9);
    }
    if (code.startsWith("```")) {
      code = code.slice(3);
    }
    if (code.endsWith("```")) {
      code = code.slice(0, -3);
    }

    return code.trim();
  }

  /**
   * Generate tool schema from code
   */
  private async generateToolSchema(
    userId: string,
    objective: string,
    code: string,
    requiredSecrets: string[],
  ): Promise<GeneratedToolInput> {
    const response = await llmRouterService.executeTask(
      userId,
      "chat",
      `Objective: ${objective}\n\nCode:\n${code}`,
      TOOL_SCHEMA_PROMPT,
      { temperature: 0.1, responseFormat: "json" },
    );

    try {
      let jsonStr = response;
      // Extract JSON if wrapped in markdown
      const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const schema = JSON.parse(jsonStr);

      return {
        name: schema.name || this.generateToolName(objective),
        displayName: schema.displayName || objective.slice(0, 50),
        description: schema.description || objective,
        code,
        inputSchema: schema.inputSchema || { type: "object", properties: {} },
        outputSchema: schema.outputSchema,
        requiredSecrets: schema.requiredSecrets || requiredSecrets,
        category: schema.category || "custom",
        tags: schema.tags || [],
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        name: this.generateToolName(objective),
        displayName: objective.slice(0, 50),
        description: objective,
        code,
        inputSchema: { type: "object", properties: {} },
        requiredSecrets,
        category: "custom",
        tags: [],
      };
    }
  }

  /**
   * Save tool to database
   */
  private async saveTool(
    userId: string,
    input: GeneratedToolInput,
    code: string,
  ): Promise<GeneratedTool> {
    // Check if tool with same name exists
    const existing = await prisma.generatedTool.findUnique({
      where: {
        userId_name: { userId, name: input.name },
      },
    });

    if (existing) {
      // Update existing tool (increment version)
      return prisma.generatedTool.update({
        where: { id: existing.id },
        data: {
          displayName: input.displayName,
          description: input.description,
          code,
          previousCode: existing.code,
          inputSchema: input.inputSchema,
          outputSchema: input.outputSchema || {},
          requiredSecrets: input.requiredSecrets || [],
          category: input.category || "custom",
          tags: input.tags || [],
          version: existing.version + 1,
          isVerified: true, // We tested it successfully
          updatedAt: new Date(),
        },
      });
    }

    // Create new tool
    return prisma.generatedTool.create({
      data: {
        userId,
        name: input.name,
        displayName: input.displayName,
        description: input.description,
        code,
        inputSchema: input.inputSchema,
        outputSchema: input.outputSchema || {},
        requiredSecrets: input.requiredSecrets || [],
        category: input.category || "custom",
        tags: input.tags || [],
        isVerified: true,
      },
    });
  }

  /**
   * Find similar existing tool by semantic search
   */
  private async findSimilarTool(
    userId: string,
    objective: string,
  ): Promise<GeneratedTool | null> {
    // Simple keyword matching for now
    // TODO: Add proper semantic search using embeddings
    const keywords = objective.toLowerCase().split(/\s+/);

    const tools = await prisma.generatedTool.findMany({
      where: {
        userId,
        enabled: true,
        OR: [
          { name: { contains: keywords[0], mode: "insensitive" } },
          { description: { contains: keywords[0], mode: "insensitive" } },
          { tags: { hasSome: keywords } },
        ],
      },
    });

    // Return best match if any
    return tools[0] || null;
  }

  /**
   * Get available secrets for tool generation
   */
  private async getAvailableSecrets(
    userId: string,
    suggested?: string[],
  ): Promise<string[]> {
    const allSecrets = await secretsService.listSecrets(userId);
    const secretKeys = allSecrets.map((s) => s.key);

    if (suggested && suggested.length > 0) {
      // Return intersection of suggested and available
      return suggested.filter((s) => secretKeys.includes(s));
    }

    return secretKeys;
  }

  /**
   * Generate a tool name from objective
   */
  private generateToolName(objective: string): string {
    return objective
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join("_");
  }

  /**
   * Execute an existing generated tool
   */
  async executeTool(
    userId: string,
    toolId: string,
    params: Record<string, any>,
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const tool = await prisma.generatedTool.findFirst({
      where: { id: toolId, userId, enabled: true },
    });

    if (!tool) {
      return { success: false, error: "Tool not found" };
    }

    try {
      // Get required secrets
      const secretValues = await secretsService.getSecretsValues(
        userId,
        tool.requiredSecrets,
      );

      // Build code with parameter injection
      const paramsJson = JSON.stringify(params);
      const fullCode = `
# Injected parameters
params = ${paramsJson}

# Tool code
${tool.code}
`;

      // Execute with network access
      const result = await codeExecutorService.executeWithNetwork(
        fullCode,
        secretValues,
        tool.timeout / 1000,
      );

      // Update usage stats
      await prisma.generatedTool.update({
        where: { id: toolId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
          ...(result.success
            ? {}
            : { lastErrorAt: new Date(), lastError: result.error }),
        },
      });

      if (result.success) {
        return { success: true, result: result.result };
      }

      return { success: false, error: result.error || "Execution failed" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all generated tools for a user
   */
  async listTools(
    userId: string,
    category?: string,
    enabledOnly = true,
  ): Promise<GeneratedTool[]> {
    return prisma.generatedTool.findMany({
      where: {
        userId,
        ...(category && { category }),
        ...(enabledOnly && { enabled: true }),
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * Get a specific tool
   */
  async getTool(userId: string, toolId: string): Promise<GeneratedTool | null> {
    return prisma.generatedTool.findFirst({
      where: { id: toolId, userId },
    });
  }

  /**
   * Delete a tool
   */
  async deleteTool(userId: string, toolId: string): Promise<boolean> {
    try {
      await prisma.generatedTool.delete({
        where: { id: toolId, userId },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Toggle tool enabled status
   */
  async toggleTool(
    userId: string,
    toolId: string,
    enabled: boolean,
  ): Promise<GeneratedTool | null> {
    try {
      return await prisma.generatedTool.update({
        where: { id: toolId, userId },
        data: { enabled },
      });
    } catch {
      return null;
    }
  }
}

export const dynamicToolGeneratorService = new DynamicToolGeneratorService();
