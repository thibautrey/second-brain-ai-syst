// Dynamic Tool Generator Service
// AI-powered autonomous tool creation system
// Generates, tests, and saves custom tools based on user needs
//
// NOTE: For complex tool generation with full developer workflow,
// use ToolGenerationWorkflowService from tool-generation-workflow.ts
// This service maintains backward compatibility for simple generation.

import { GeneratedTool, PrismaClient } from "@prisma/client";
import {
  detectSecretsInCode,
  mergeAndCompleteSecrets,
  validateSecretsDeclaration,
} from "./secret-detector.js";

import { codeExecutorService } from "./code-executor-wrapper.js";
import { llmRouterService } from "./llm-router.js";
import { secretsService } from "./secrets.js";
import { toolGenerationWorkflowService } from "./tool-generation-workflow.js";
import { toolHealerService } from "./tool-healer.js";
import { wsBroadcastService } from "./websocket-broadcast.js";

const prisma = new PrismaClient();

// Types
export interface ToolGenerationRequest {
  objective: string; // What the tool should accomplish
  context?: string; // Additional context from conversation
  suggestedSecrets?: string[]; // Secrets the AI thinks might be needed
  existingToolId?: string; // If improving an existing tool
  useWorkflow?: boolean; // Use the new structured workflow (default: true)
}

export interface ToolGenerationResult {
  success: boolean;
  tool?: GeneratedTool;
  executionResult?: any;
  error?: string;
  iterations?: number;
  logs?: string[];
  sessionId?: string; // Session ID for workflow tracking
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
   * Emit a tool generation step to the user via WebSocket and optional callback
   */
  private emitStep(
    userId: string,
    step: {
      phase:
        | "starting"
        | "checking"
        | "generating"
        | "executing"
        | "fixing"
        | "schema"
        | "saving"
        | "completed"
        | "error";
      message: string;
      iteration?: number;
      maxIterations?: number;
      details?: Record<string, any>;
    },
    onStep?: (step: any) => void,
  ): void {
    // Emit via WebSocket for background processes
    wsBroadcastService.sendToUser(userId, {
      type: "tool:generation:step",
      timestamp: Date.now(),
      data: step,
    });
    // Call optional callback for SSE streaming in chat
    if (onStep) {
      onStep(step);
    }
  }

  /**
   * Generate a new tool from an objective
   * Uses the new structured workflow by default for better reliability.
   *
   * @param userId User ID
   * @param request Tool generation request
   * @param onStep Optional callback for each generation step (for SSE streaming)
   */
  async generateTool(
    userId: string,
    request: ToolGenerationRequest,
    onStep?: (step: any) => void,
  ): Promise<ToolGenerationResult> {
    // Use new structured workflow by default
    const useWorkflow = request.useWorkflow !== false;

    if (useWorkflow) {
      return this.generateToolWithWorkflow(userId, request, onStep);
    }

    // Legacy generation (kept for backward compatibility)
    return this.generateToolLegacy(userId, request, onStep);
  }

  /**
   * Generate tool using the new structured workflow
   * This provides better reliability through:
   * - Specification document
   * - Implementation plan
   * - Comprehensive testing
   * - Full logging and traceability
   */
  private async generateToolWithWorkflow(
    userId: string,
    request: ToolGenerationRequest,
    onStep?: (step: any) => void,
  ): Promise<ToolGenerationResult> {
    try {
      const result = await toolGenerationWorkflowService.startWorkflow(
        userId,
        {
          objective: request.objective,
          context: request.context,
          suggestedSecrets: request.suggestedSecrets,
          existingToolId: request.existingToolId,
        },
        onStep,
      );

      return {
        success: result.success,
        tool: result.tool,
        executionResult: result.phases.find((p) => p.phase === "testing")
          ?.artifacts?.executionResult,
        error: result.error,
        iterations: result.phases.filter((p) => p.phase === "fixing").length,
        logs: result.phases.map((p) => `${p.phase}: ${p.status}`),
        sessionId: result.sessionId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        logs: [`Error: ${error.message}`],
      };
    }
  }

  /**
   * Legacy generation method (kept for backward compatibility)
   */
  private async generateToolLegacy(
    userId: string,
    request: ToolGenerationRequest,
    onStep?: (step: any) => void,
  ): Promise<ToolGenerationResult> {
    const logs: string[] = [];
    let iterations = 0;

    try {
      logs.push(`Starting tool generation for: ${request.objective}`);
      this.emitStep(
        userId,
        {
          phase: "starting",
          message: `Démarrage de la génération d'outil: ${request.objective}`,
        },
        onStep,
      );

      // Step 1: Check if a similar tool already exists
      this.emitStep(
        userId,
        {
          phase: "checking",
          message: "Recherche d'outils similaires existants...",
        },
        onStep,
      );
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
      this.emitStep(
        userId,
        {
          phase: "checking",
          message:
            availableSecrets.length > 0
              ? `Secrets disponibles: ${availableSecrets.join(", ")}`
              : "Aucun secret configuré - génération sans clé API",
          details: { secrets: availableSecrets },
        },
        onStep,
      );

      // Step 3: Generate initial code
      this.emitStep(
        userId,
        {
          phase: "generating",
          message: "Génération du code Python...",
          iteration: 1,
          maxIterations: this.maxIterations,
        },
        onStep,
      );
      let code = await this.generateCode(userId, request, availableSecrets);
      logs.push(`Generated initial code (${code.length} chars)`);

      // Step 4: Iterative execution and refinement
      let lastError: string | null = null;
      let executionResult: any = null;

      while (iterations < this.maxIterations) {
        iterations++;
        logs.push(`Iteration ${iterations}/${this.maxIterations}`);

        this.emitStep(
          userId,
          {
            phase: "executing",
            message: `Test d'exécution (tentative ${iterations}/${this.maxIterations})...`,
            iteration: iterations,
            maxIterations: this.maxIterations,
          },
          onStep,
        );

        // Get secret values for execution
        const secretValues = await secretsService.getSecretsValues(
          userId,
          availableSecrets,
        );

        // Execute the code with network access
        // Allow up to 60 seconds for API calls with retries for network failures
        const result = await codeExecutorService.executeWithNetwork(
          code,
          secretValues,
          60, // Increase to 60 seconds for slow APIs
          3, // Retry up to 3 times on network failures
        );

        if (result.success && result.result !== null) {
          logs.push(`Execution successful!`);
          this.emitStep(
            userId,
            {
              phase: "executing",
              message: "✓ Exécution réussie!",
              iteration: iterations,
              maxIterations: this.maxIterations,
              details: { success: true },
            },
            onStep,
          );
          executionResult = result.result;
          break;
        }

        // Execution failed - try to fix
        lastError = result.error || "Unknown error";
        logs.push(`Execution failed: ${lastError}`);

        this.emitStep(
          userId,
          {
            phase: "fixing",
            message: `Erreur détectée, correction en cours...`,
            iteration: iterations,
            maxIterations: this.maxIterations,
            details: { error: lastError.substring(0, 100) },
          },
          onStep,
        );

        if (iterations >= this.maxIterations) {
          this.emitStep(
            userId,
            {
              phase: "error",
              message: `Échec après ${iterations} tentatives`,
              details: { lastError },
            },
            onStep,
          );
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
      this.emitStep(
        userId,
        {
          phase: "schema",
          message: "Génération du schéma de l'outil...",
        },
        onStep,
      );
      const toolInput = await this.generateToolSchema(
        userId,
        request.objective,
        code,
        availableSecrets,
      );

      // Step 6: Save the tool
      logs.push(`Saving tool: ${toolInput.name}`);
      this.emitStep(
        userId,
        {
          phase: "saving",
          message: `Sauvegarde de l'outil: ${toolInput.displayName}...`,
          details: { name: toolInput.name, category: toolInput.category },
        },
        onStep,
      );
      const tool = await this.saveTool(userId, toolInput, code);

      this.emitStep(
        userId,
        {
          phase: "completed",
          message: `✓ Outil "${toolInput.displayName}" créé avec succès!`,
          details: {
            toolId: tool.id,
            name: tool.name,
            displayName: tool.displayName,
            iterations,
          },
        },
        onStep,
      );

      return {
        success: true,
        tool,
        executionResult,
        iterations,
        logs,
      };
    } catch (error: any) {
      logs.push(`Error: ${error.message}`);
      this.emitStep(
        userId,
        {
          phase: "error",
          message: `Erreur: ${error.message}`,
          details: { error: error.message },
        },
        onStep,
      );
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
   * NOW WITH AUTOMATIC SECRET DETECTION AND VALIDATION
   */
  private async generateToolSchema(
    userId: string,
    objective: string,
    code: string,
    requiredSecrets: string[],
  ): Promise<GeneratedToolInput> {
    // Step 1: Detect all secrets actually used in the code
    const detectedSecrets = detectSecretsInCode(code);

    // Step 2: Validate completeness
    const validation = validateSecretsDeclaration(code, requiredSecrets);

    // Step 3: Log any issues
    if (validation.missingSecrets.length > 0) {
      console.warn(
        `⚠️  Missing secret declarations: ${validation.missingSecrets.join(", ")}`,
      );
    }

    // Step 4: Get LLM schema with detected secrets as context
    const response = await llmRouterService.executeTask(
      userId,
      "chat",
      `Objective: ${objective}\n\nCode:\n${code}\n\nSecretsDetectedInCode: ${detectedSecrets.join(", ") || "none"}`,
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

      // Step 5: ENFORCE complete secret declarations
      // Merge LLM response with detected secrets
      const completeSecrets = mergeAndCompleteSecrets(
        code,
        schema.requiredSecrets || requiredSecrets || [],
      );

      // Step 6: Final validation - ensure all detected secrets are declared
      const finalValidation = validateSecretsDeclaration(code, completeSecrets);
      if (!finalValidation.valid) {
        console.error(
          `❌ FATAL: Found secrets in code but not declared: ${finalValidation.missingSecrets.join(", ")}`,
        );
        // FORCE include missing secrets
        const finalSecrets = [
          ...completeSecrets,
          ...finalValidation.missingSecrets,
        ];
        schema.requiredSecrets = finalSecrets;
      } else {
        schema.requiredSecrets = completeSecrets;
      }

      return {
        name: schema.name || this.generateToolName(objective),
        displayName: schema.displayName || objective.slice(0, 50),
        description: schema.description || objective,
        code,
        inputSchema: schema.inputSchema || { type: "object", properties: {} },
        outputSchema: schema.outputSchema,
        requiredSecrets: schema.requiredSecrets || completeSecrets,
        category: schema.category || "custom",
        tags: schema.tags || [],
      };
    } catch {
      // Fallback if JSON parsing fails - still use detected secrets
      const completeSecrets = mergeAndCompleteSecrets(code, requiredSecrets);
      return {
        name: this.generateToolName(objective),
        displayName: objective.slice(0, 50),
        description: objective,
        code,
        inputSchema: { type: "object", properties: {} },
        requiredSecrets: completeSecrets,
        category: "custom",
        tags: [],
      };
    }
  }

  /**
   * Save tool to database
   * INCLUDES STRICT SECRET VALIDATION
   */
  private async saveTool(
    userId: string,
    input: GeneratedToolInput,
    code: string,
  ): Promise<GeneratedTool> {
    // CRITICAL VALIDATION: Ensure all secrets in code are declared
    const validation = validateSecretsDeclaration(
      code,
      input.requiredSecrets || [],
    );

    if (!validation.valid) {
      // FORCE add missing secrets
      const completedSecrets = [
        ...(input.requiredSecrets || []),
        ...validation.missingSecrets,
      ];
      input.requiredSecrets = completedSecrets;

      console.warn(
        `🔧 Auto-corrected tool: Added missing secrets ${validation.missingSecrets.join(", ")} to requiredSecrets`,
      );
    }

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
   * Enhanced to use multiple keywords and common synonyms
   */
  private async findSimilarTool(
    userId: string,
    objective: string,
  ): Promise<GeneratedTool | null> {
    // Stop words to ignore (French and English)
    const stopWords = new Set([
      // French
      "le",
      "la",
      "les",
      "un",
      "une",
      "des",
      "de",
      "du",
      "au",
      "aux",
      "ce",
      "cette",
      "ces",
      "mon",
      "ma",
      "mes",
      "ton",
      "ta",
      "tes",
      "son",
      "sa",
      "ses",
      "notre",
      "nos",
      "votre",
      "vos",
      "leur",
      "leurs",
      "je",
      "tu",
      "il",
      "elle",
      "on",
      "nous",
      "vous",
      "ils",
      "elles",
      "me",
      "te",
      "se",
      "lui",
      "y",
      "en",
      "et",
      "ou",
      "mais",
      "donc",
      "car",
      "ni",
      "que",
      "qui",
      "quoi",
      "est",
      "sont",
      "être",
      "avoir",
      "faire",
      "peut",
      "peux",
      "pouvez",
      "pour",
      "avec",
      "sans",
      "dans",
      "sur",
      "sous",
      "par",
      "chez",
      "a",
      "à",
      "ai",
      "as",
      "avez",
      "avons",
      "ont",
      "ne",
      "pas",
      "plus",
      "moins",
      "très",
      "bien",
      "mal",
      "quel",
      "quelle",
      "quels",
      "quelles",
      "comment",
      "pourquoi",
      "quand",
      "donner",
      "donne",
      "donnez",
      "récupérer",
      "récupère",
      "obtenir",
      "obtiens",
      // English
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "can",
      "may",
      "might",
      "must",
      "shall",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "him",
      "her",
      "us",
      "them",
      "my",
      "your",
      "his",
      "her",
      "its",
      "our",
      "their",
      "this",
      "that",
      "these",
      "those",
      "what",
      "which",
      "who",
      "whom",
      "where",
      "when",
      "why",
      "how",
      "and",
      "or",
      "but",
      "if",
      "then",
      "else",
      "because",
      "so",
      "to",
      "of",
      "in",
      "on",
      "at",
      "by",
      "for",
      "with",
      "from",
      "about",
      "get",
      "give",
      "make",
      "take",
      "find",
      "show",
      "tell",
      "want",
    ]);

    // Common synonyms for tool discovery (bidirectional)
    const synonymGroups: string[][] = [
      [
        "météo",
        "meteo",
        "weather",
        "temps",
        "climat",
        "forecast",
        "prévision",
        "prevision",
      ],
      ["recherche", "search", "find", "chercher", "trouver", "lookup"],
      ["traduction", "translate", "translation", "traduire", "translator"],
      ["calcul", "calculate", "calculator", "computation", "math", "compute"],
      ["email", "mail", "courriel", "message", "envoyer"],
      ["news", "current events", "bulletin", "articles", "info", "information"],
      ["prix", "price", "cost", "tarif", "cout", "coût"],
      [
        "bourse",
        "stock",
        "stocks",
        "finance",
        "market",
        "marché",
        "action",
        "actions",
      ],
      ["cryptomonnaie", "crypto", "bitcoin", "cryptocurrency", "blockchain"],
      [
        "localisation",
        "location",
        "gps",
        "position",
        "géolocalisation",
        "geolocalisation",
      ],
      [
        "carte",
        "map",
        "maps",
        "itinéraire",
        "itineraire",
        "direction",
        "directions",
      ],
    ];

    // Build synonym map for quick lookup
    const synonymMap = new Map<string, string[]>();
    for (const group of synonymGroups) {
      for (const word of group) {
        synonymMap.set(word.toLowerCase(), group);
      }
    }

    // Extract meaningful keywords from objective
    const rawKeywords = objective
      .toLowerCase()
      .replace(/[^a-zà-ÿ0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    // Expand keywords with synonyms
    const expandedKeywords = new Set<string>();
    for (const keyword of rawKeywords) {
      expandedKeywords.add(keyword);
      const synonyms = synonymMap.get(keyword);
      if (synonyms) {
        for (const synonym of synonyms) {
          expandedKeywords.add(synonym);
        }
      }
    }

    const keywordsArray = Array.from(expandedKeywords);

    if (keywordsArray.length === 0) {
      return null;
    }

    // Build OR conditions for all meaningful keywords
    const orConditions: any[] = [];
    for (const keyword of keywordsArray) {
      orConditions.push({ name: { contains: keyword, mode: "insensitive" } });
      orConditions.push({
        displayName: { contains: keyword, mode: "insensitive" },
      });
      orConditions.push({
        description: { contains: keyword, mode: "insensitive" },
      });
    }
    // Also check tags
    orConditions.push({ tags: { hasSome: keywordsArray } });

    const tools = await prisma.generatedTool.findMany({
      where: {
        userId,
        enabled: true,
        OR: orConditions,
      },
    });

    if (tools.length === 0) {
      return null;
    }

    // Score tools by how many keywords they match
    const scoredTools = tools.map((tool) => {
      let score = 0;
      const toolText =
        `${tool.name} ${tool.displayName} ${tool.description} ${(tool.tags || []).join(" ")}`.toLowerCase();

      for (const keyword of keywordsArray) {
        if (toolText.includes(keyword)) {
          score++;
          // Bonus for name/displayName match (more significant)
          if (
            tool.name.toLowerCase().includes(keyword) ||
            tool.displayName.toLowerCase().includes(keyword)
          ) {
            score += 2;
          }
        }
      }

      // Bonus for verified tools
      if (tool.isVerified) {
        score += 1;
      }

      // Bonus for frequently used tools
      if (tool.usageCount > 5) {
        score += 1;
      }

      return { tool, score };
    });

    // Sort by score descending and return best match
    scoredTools.sort((a, b) => b.score - a.score);

    // Only return if score is meaningful (at least 1 match)
    if (scoredTools[0].score > 0) {
      console.log(
        `[DynamicToolGenerator] Found similar tool "${scoredTools[0].tool.name}" with score ${scoredTools[0].score} for objective: "${objective}"`,
      );
      return scoredTools[0].tool;
    }

    return null;
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
   * Now includes execution logging for health tracking and self-healing
   */
  async executeTool(
    userId: string,
    toolId: string,
    params: Record<string, any>,
    triggeredBy = "user_chat",
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const startTime = Date.now();

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

      // Execute with network access with retries
      const result = await codeExecutorService.executeWithNetwork(
        fullCode,
        secretValues,
        tool.timeout / 1000,
        3, // Retry up to 3 times on network failures
      );

      const executionTimeMs = Date.now() - startTime;

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

      // Log execution for health tracking
      await toolHealerService.logExecution(
        toolId,
        userId,
        result.success,
        result.result,
        result.error || undefined,
        executionTimeMs,
        triggeredBy,
        params,
      );

      if (result.success) {
        return { success: true, result: result.result };
      }

      return { success: false, error: result.error || "Execution failed" };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;

      // Log the error
      await toolHealerService.logExecution(
        toolId,
        userId,
        false,
        null,
        error.message,
        executionTimeMs,
        triggeredBy,
        params,
      );

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
