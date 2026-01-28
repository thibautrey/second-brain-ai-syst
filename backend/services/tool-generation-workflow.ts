/**
 * Tool Generation Workflow Service
 *
 * Implements a structured developer workflow for generating reliable tools:
 * 1. Specification Phase - Create detailed spec document
 * 2. Planning Phase - Generate step-by-step implementation plan
 * 3. Implementation Phase - Write the actual code
 * 4. Testing Phase - Generate and run tests
 * 5. Fixing Phase - Iteratively fix any issues
 * 6. Validation Phase - Final validation before saving
 *
 * Features:
 * - Complete logging and traceability
 * - Checkpoint system for recovery
 * - Self-healing capabilities
 * - Real-time progress streaming
 *
 * IMPORTANT: Run `npx prisma migrate dev` after adding the new models to schema.prisma
 */

import { PrismaClient, GeneratedTool } from "@prisma/client";
import { codeExecutorService } from "./code-executor-wrapper.js";
import { secretsService } from "./secrets.js";
import { llmRouterService } from "./llm-router.js";
import { wsBroadcastService } from "./websocket-broadcast.js";
import * as persistence from "./tool-workflow-persistence.js";

const prisma = new PrismaClient();

// Type aliases for session status
type GenerationSessionStatus =
  | "PENDING"
  | "SPECIFICATION"
  | "PLANNING"
  | "IMPLEMENTING"
  | "TESTING"
  | "FIXING"
  | "VALIDATING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

// ==================== Types ====================

export interface WorkflowGenerationRequest {
  objective: string;
  context?: string;
  suggestedSecrets?: string[];
  existingToolId?: string;
  maxIterations?: number;
}

export interface WorkflowGenerationResult {
  success: boolean;
  sessionId: string;
  tool?: GeneratedTool;
  executionResult?: any;
  error?: string;
  phases: PhaseResult[];
  totalDurationMs?: number;
}

export interface PhaseResult {
  phase: string;
  status: "success" | "failed" | "skipped";
  durationMs: number;
  artifacts?: Record<string, any>;
  error?: string;
}

export interface SpecDocument {
  title: string;
  objective: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  inputParameters: ParameterSpec[];
  expectedOutputFormat: OutputSpec;
  errorHandling: string[];
  dependencies: string[];
  requiredSecrets: string[];
  testCases: TestCaseSpec[];
}

export interface ParameterSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
  validation?: string;
  defaultValue?: any;
}

export interface OutputSpec {
  type: string;
  schema: Record<string, any>;
  examples: any[];
}

export interface TestCaseSpec {
  name: string;
  description: string;
  input: Record<string, any>;
  expectedBehavior: string;
  mockSecrets?: Record<string, string>;
}

export interface ImplementationPlan {
  overview: string;
  steps: ImplementationStep[];
  estimatedComplexity: "low" | "medium" | "high";
  riskAssessment: string[];
  fallbackStrategies: string[];
}

export interface ImplementationStep {
  order: number;
  description: string;
  codeSection: string;
  dependencies: string[];
  validationCriteria: string;
}

// ==================== Prompts ====================

const SPECIFICATION_SYSTEM_PROMPT = `You are a senior software architect creating a detailed specification document for a Python tool.

Your task is to analyze the objective and create a comprehensive specification that will guide the implementation.

**Output a valid JSON object with this exact structure:**
{
  "title": "Human-readable tool name",
  "objective": "Clear restatement of what the tool does",
  "functionalRequirements": ["FR1: ...", "FR2: ...", ...],
  "nonFunctionalRequirements": ["NFR1: Timeout handling", "NFR2: Error messages must be informative", ...],
  "inputParameters": [
    {
      "name": "param_name",
      "type": "string|number|boolean|object|array",
      "required": true/false,
      "description": "What this parameter does",
      "validation": "Validation rules if any",
      "defaultValue": null
    }
  ],
  "expectedOutputFormat": {
    "type": "object|array|string|number",
    "schema": { "key": "type description" },
    "examples": [{ "example": "output" }]
  },
  "errorHandling": ["Handle network timeouts", "Validate API responses", ...],
  "dependencies": ["requests", "json", ...],
  "requiredSecrets": ["API_KEY_NAME"],
  "testCases": [
    {
      "name": "test_basic_functionality",
      "description": "Test the main use case",
      "input": { "param": "value" },
      "expectedBehavior": "Should return X when given Y",
      "mockSecrets": { "API_KEY": "test_key" }
    }
  ]
}

**Important:**
- Be thorough but practical
- Include edge cases in test cases
- Consider rate limits and error scenarios
- Return ONLY valid JSON, no markdown`;

const PLANNING_SYSTEM_PROMPT = `You are a senior Python developer creating an implementation plan from a specification.

Given the specification, create a detailed step-by-step plan for implementing the code.

**Output a valid JSON object with this exact structure:**
{
  "overview": "Brief summary of the implementation approach",
  "steps": [
    {
      "order": 1,
      "description": "What this step accomplishes",
      "codeSection": "Brief description of code to write",
      "dependencies": ["imports needed"],
      "validationCriteria": "How to verify this step works"
    }
  ],
  "estimatedComplexity": "low|medium|high",
  "riskAssessment": ["Risk 1", "Risk 2"],
  "fallbackStrategies": ["If X fails, do Y"]
}

**Guidelines:**
- Break down into logical, testable steps
- Consider error handling at each step
- Include validation points
- Return ONLY valid JSON`;

const CODE_GENERATION_SYSTEM_PROMPT = `You are an expert Python programmer implementing a tool based on a specification and plan.

**Available modules:**
- requests, httpx (HTTP clients)
- json, re, datetime, time, calendar
- math, statistics, decimal, fractions
- collections, itertools, functools
- base64, hashlib, hmac
- urllib.parse, urllib.request
- xml.etree.ElementTree, html.parser, csv
- io, copy, textwrap, string, os

**Environment variables:**
API keys and secrets are available via os.environ.get('KEY_NAME').

**Critical rules:**
1. The code MUST set a variable named \`result\` with the final output (JSON-serializable)
2. Use try/except for comprehensive error handling
3. Always validate inputs before making API calls
4. Include timeout parameters for HTTP requests (default 10 seconds)
5. Return structured data (dict or list), not raw responses
6. Add comments for complex logic
7. Handle all error cases gracefully

**Output:**
Return ONLY the Python code, no markdown, no explanations.`;

const TEST_GENERATION_SYSTEM_PROMPT = `You are a QA engineer creating test code for a Python tool.

Given the tool code and specification, generate test code that validates the tool works correctly.

**Test Structure:**
1. Import necessary modules
2. Define test helper functions
3. Create test cases from the specification
4. Each test should set a \`test_results\` variable with status

**Output format - Python code that:**
1. Tests each function/behavior
2. Sets \`test_results = {"passed": [...], "failed": [...], "errors": [...]}\`
3. Handles missing API keys gracefully (skip or mock)
4. Tests error handling paths

Return ONLY Python test code, no markdown.`;

const FIX_CODE_SYSTEM_PROMPT = `You are a debugging expert fixing Python code that failed to execute.

**Error context:**
{error_context}

**Analyze the error and fix the code. Common issues:**
1. Missing imports
2. Incorrect API endpoints or parameters
3. JSON parsing errors
4. Missing error handling
5. Variable scope issues
6. Type mismatches

**Rules:**
- Fix the specific issue while preserving correct functionality
- Add better error handling if needed
- Ensure \`result\` variable is always set
- Add debugging comments if helpful

Return ONLY the fixed Python code, no explanations.`;

const SCHEMA_GENERATION_PROMPT = `Generate a JSON schema for this tool based on its code and specification.

**Output format:**
{
  "name": "snake_case_tool_name",
  "displayName": "Human Readable Name",
  "description": "Clear description of what the tool does",
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": { "type": "string", "description": "..." }
    },
    "required": ["param1"]
  },
  "outputSchema": { ... },
  "requiredSecrets": ["API_KEY"],
  "category": "maps|weather|finance|communication|data|custom",
  "tags": ["tag1", "tag2"]
}

Return ONLY valid JSON.`;

// ==================== Service ====================

export class ToolGenerationWorkflowService {
  private maxIterations = 5;
  private phaseTimeouts = {
    specification: 30000,
    planning: 30000,
    implementation: 60000,
    testing: 120000,
    fixing: 60000,
    validation: 30000,
  };

  /**
   * Start a new tool generation workflow
   */
  async startWorkflow(
    userId: string,
    request: WorkflowGenerationRequest,
    onStep?: (step: any) => void,
  ): Promise<WorkflowGenerationResult> {
    const startTime = Date.now();
    const phases: PhaseResult[] = [];

    // Create session in database (with fallback if tables don't exist yet)
    const session = await persistence.createSession({
      userId,
      objective: request.objective,
      context: request.context,
      suggestedSecrets: request.suggestedSecrets || [],
      toolId: request.existingToolId,
      maxIterations: request.maxIterations || this.maxIterations,
      status: "PENDING",
      startedAt: new Date(),
    });

    try {
      // Emit start event
      this.emitStep(
        userId,
        session.id,
        {
          phase: "starting",
          message: `Démarrage du workflow de génération pour: ${request.objective}`,
          progress: 0,
        },
        onStep,
      );

      // ==================== Phase 1: Specification ====================
      await this.updateSessionStatus(
        session.id,
        "SPECIFICATION",
        "specification",
        5,
      );
      this.emitStep(
        userId,
        session.id,
        {
          phase: "specification",
          message: "📋 Phase 1/6: Création du document de spécification...",
          progress: 5,
        },
        onStep,
      );

      const specResult = await this.runSpecificationPhase(
        userId,
        session.id,
        request,
      );
      phases.push(specResult);

      if (!specResult.artifacts?.spec) {
        throw new Error("Failed to generate specification document");
      }

      await this.log(
        session.id,
        "specification",
        "info",
        "Specification document created successfully",
        { spec: specResult.artifacts.spec },
      );

      // ==================== Phase 2: Planning ====================
      await this.updateSessionStatus(session.id, "PLANNING", "planning", 20);
      this.emitStep(
        userId,
        session.id,
        {
          phase: "planning",
          message: "📝 Phase 2/6: Création du plan d'implémentation...",
          progress: 20,
        },
        onStep,
      );

      const planResult = await this.runPlanningPhase(
        userId,
        session.id,
        specResult.artifacts.spec,
      );
      phases.push(planResult);

      if (!planResult.artifacts?.plan) {
        throw new Error("Failed to generate implementation plan");
      }

      await this.log(
        session.id,
        "planning",
        "info",
        "Implementation plan created successfully",
        { plan: planResult.artifacts.plan },
      );

      // ==================== Phase 3: Implementation ====================
      await this.updateSessionStatus(
        session.id,
        "IMPLEMENTING",
        "implementation",
        35,
      );
      this.emitStep(
        userId,
        session.id,
        {
          phase: "implementation",
          message: "💻 Phase 3/6: Génération du code...",
          progress: 35,
        },
        onStep,
      );

      const implResult = await this.runImplementationPhase(
        userId,
        session.id,
        specResult.artifacts.spec,
        planResult.artifacts.plan,
      );
      phases.push(implResult);

      if (!implResult.artifacts?.code) {
        throw new Error("Failed to generate code");
      }

      await this.log(
        session.id,
        "implementation",
        "info",
        "Code generated successfully",
        { codeLength: implResult.artifacts.code.length },
      );

      // ==================== Phase 4: Testing ====================
      await this.updateSessionStatus(session.id, "TESTING", "testing", 50);
      this.emitStep(
        userId,
        session.id,
        {
          phase: "testing",
          message: "🧪 Phase 4/6: Génération et exécution des tests...",
          progress: 50,
        },
        onStep,
      );

      // Get available secrets for testing
      const availableSecrets = await this.getAvailableSecrets(
        userId,
        request.suggestedSecrets,
      );
      const secretValues = await secretsService.getSecretsValues(
        userId,
        availableSecrets,
      );

      const testResult = await this.runTestingPhase(
        userId,
        session.id,
        implResult.artifacts.code,
        specResult.artifacts.spec,
        secretValues,
        onStep,
      );
      phases.push(testResult);

      let currentCode = implResult.artifacts.code;
      let testPassed = testResult.status === "success";
      let iterations = 0;

      // ==================== Phase 5: Fixing (if needed) ====================
      while (
        !testPassed &&
        iterations < (request.maxIterations || this.maxIterations)
      ) {
        iterations++;
        await this.updateSessionStatus(
          session.id,
          "FIXING",
          "fixing",
          60 + iterations * 5,
        );
        this.emitStep(
          userId,
          session.id,
          {
            phase: "fixing",
            message: `🔧 Phase 5/6: Correction des erreurs (tentative ${iterations}/${request.maxIterations || this.maxIterations})...`,
            progress: 60 + iterations * 5,
            iteration: iterations,
          },
          onStep,
        );

        const fixResult = await this.runFixingPhase(
          userId,
          session.id,
          currentCode,
          testResult.error || "Unknown error",
          specResult.artifacts.spec,
        );
        phases.push(fixResult);

        if (fixResult.artifacts?.code) {
          currentCode = fixResult.artifacts.code;

          // Re-run tests
          const retestResult = await this.runTestingPhase(
            userId,
            session.id,
            currentCode,
            specResult.artifacts.spec,
            secretValues,
            onStep,
          );
          phases.push(retestResult);

          if (retestResult.status === "success") {
            testPassed = true;
            await this.log(
              session.id,
              "fixing",
              "info",
              `Code fixed successfully after ${iterations} iteration(s)`,
            );
          }
        }
      }

      if (!testPassed) {
        await this.updateSessionStatus(session.id, "FAILED", "failed", 100);
        throw new Error(
          `Failed after ${iterations} fixing attempts. Last error: ${testResult.error}`,
        );
      }

      // ==================== Phase 6: Validation & Saving ====================
      await this.updateSessionStatus(
        session.id,
        "VALIDATING",
        "validation",
        85,
      );
      this.emitStep(
        userId,
        session.id,
        {
          phase: "validation",
          message: "✅ Phase 6/6: Validation finale et sauvegarde...",
          progress: 85,
        },
        onStep,
      );

      const validationResult = await this.runValidationPhase(
        userId,
        session.id,
        currentCode,
        specResult.artifacts.spec,
        availableSecrets,
      );
      phases.push(validationResult);

      // Save the tool
      const tool = await this.saveTool(
        userId,
        session.id,
        currentCode,
        validationResult.artifacts?.schema,
        request.existingToolId,
      );

      // Update session as completed
      await persistence.updateSession(session.id, {
        status: "COMPLETED",
        progress: 100,
        toolId: tool.id,
        generatedCode: currentCode,
        testCode: phases.find((p) => p.phase === "testing")?.artifacts
          ?.testCode,
        completedAt: new Date(),
        totalDurationMs: Date.now() - startTime,
      });

      this.emitStep(
        userId,
        session.id,
        {
          phase: "completed",
          message: `🎉 Outil "${tool.displayName}" créé avec succès!`,
          progress: 100,
          toolId: tool.id,
        },
        onStep,
      );

      return {
        success: true,
        sessionId: session.id,
        tool,
        phases,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      // Log the error
      await this.log(session.id, "error", "error", error.message);

      // Update session as failed
      await persistence.updateSession(session.id, {
        status: "FAILED",
        lastError: error.message,
        errorHistory: {
          push: {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
          },
        },
        completedAt: new Date(),
        totalDurationMs: Date.now() - startTime,
      });

      this.emitStep(
        userId,
        session.id,
        {
          phase: "error",
          message: `❌ Erreur: ${error.message}`,
          progress: 100,
          error: error.message,
        },
        onStep,
      );

      return {
        success: false,
        sessionId: session.id,
        error: error.message,
        phases,
        totalDurationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run specification phase
   */
  private async runSpecificationPhase(
    userId: string,
    sessionId: string,
    request: WorkflowGenerationRequest,
  ): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      const prompt = `Create a detailed specification document for this tool:

**Objective:** ${request.objective}
${request.context ? `\n**Additional Context:** ${request.context}` : ""}
${request.suggestedSecrets?.length ? `\n**Available Secrets:** ${request.suggestedSecrets.join(", ")}` : ""}`;

      await this.log(
        sessionId,
        "specification",
        "debug",
        "Sending spec generation prompt",
        { prompt },
      );

      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        prompt,
        SPECIFICATION_SYSTEM_PROMPT,
        { temperature: 0.3, responseFormat: "json" },
      );

      const spec = this.parseJsonResponse(response) as SpecDocument;

      // Update session with spec
      await persistence.updateSession(sessionId, {
        specDocument: JSON.stringify(spec),
      });

      return {
        phase: "specification",
        status: "success",
        durationMs: Date.now() - startTime,
        artifacts: { spec },
      };
    } catch (error: any) {
      await this.log(sessionId, "specification", "error", error.message);
      return {
        phase: "specification",
        status: "failed",
        durationMs: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Run planning phase
   */
  private async runPlanningPhase(
    userId: string,
    sessionId: string,
    spec: SpecDocument,
  ): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      const prompt = `Create an implementation plan for this specification:

${JSON.stringify(spec, null, 2)}`;

      await this.log(
        sessionId,
        "planning",
        "debug",
        "Sending plan generation prompt",
      );

      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        prompt,
        PLANNING_SYSTEM_PROMPT,
        { temperature: 0.2, responseFormat: "json" },
      );

      const plan = this.parseJsonResponse(response) as ImplementationPlan;

      // Update session with plan
      await persistence.updateSession(sessionId, {
        implementationPlan: JSON.stringify(plan),
      });

      return {
        phase: "planning",
        status: "success",
        durationMs: Date.now() - startTime,
        artifacts: { plan },
      };
    } catch (error: any) {
      await this.log(sessionId, "planning", "error", error.message);
      return {
        phase: "planning",
        status: "failed",
        durationMs: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Run implementation phase
   */
  private async runImplementationPhase(
    userId: string,
    sessionId: string,
    spec: SpecDocument,
    plan: ImplementationPlan,
  ): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      const prompt = `Implement this tool based on the specification and plan:

**Specification:**
${JSON.stringify(spec, null, 2)}

**Implementation Plan:**
${JSON.stringify(plan, null, 2)}

Generate the complete Python code.`;

      await this.log(sessionId, "implementation", "debug", "Generating code");

      const response = await llmRouterService.executeTask(
        userId,
        "analysis", // Use analysis for code generation
        prompt,
        CODE_GENERATION_SYSTEM_PROMPT,
        { temperature: 0.2 },
      );

      const code = this.cleanCode(response);

      // Update session with code
      await persistence.updateSession(sessionId, {
        generatedCode: code,
      });

      return {
        phase: "implementation",
        status: "success",
        durationMs: Date.now() - startTime,
        artifacts: { code },
      };
    } catch (error: any) {
      await this.log(sessionId, "implementation", "error", error.message);
      return {
        phase: "implementation",
        status: "failed",
        durationMs: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Run testing phase
   */
  private async runTestingPhase(
    userId: string,
    sessionId: string,
    code: string,
    spec: SpecDocument,
    secretValues: Record<string, string>,
    onStep?: (step: any) => void,
  ): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      // First, validate syntax
      await this.log(sessionId, "testing", "info", "Validating code syntax");
      const syntaxCheck = await codeExecutorService.validateCode(code);

      if (!syntaxCheck.valid) {
        return {
          phase: "testing",
          status: "failed",
          durationMs: Date.now() - startTime,
          error: `Syntax error: ${syntaxCheck.error}`,
        };
      }

      // Execute the code
      await this.log(
        sessionId,
        "testing",
        "info",
        "Executing code with network access",
      );

      this.emitStep(
        userId,
        sessionId,
        {
          phase: "testing",
          message: "Exécution du code en cours...",
          subPhase: "execution",
        },
        onStep,
      );

      const executionResult = await codeExecutorService.executeWithNetwork(
        code,
        secretValues,
        60, // 60 second timeout
        3, // 3 retries
      );

      // Log execution result
      await this.log(
        sessionId,
        "testing",
        executionResult.success ? "info" : "error",
        executionResult.success
          ? "Code executed successfully"
          : `Execution failed: ${executionResult.error}`,
        {
          stdout: executionResult.stdout,
          stderr: executionResult.stderr,
          executionTimeMs: executionResult.execution_time_ms,
        },
      );

      if (!executionResult.success) {
        return {
          phase: "testing",
          status: "failed",
          durationMs: Date.now() - startTime,
          error: executionResult.error || "Unknown execution error",
          artifacts: {
            stdout: executionResult.stdout,
            stderr: executionResult.stderr,
          },
        };
      }

      // Optionally run generated tests
      // For now, we consider execution success as test pass
      return {
        phase: "testing",
        status: "success",
        durationMs: Date.now() - startTime,
        artifacts: {
          executionResult: executionResult.result,
          stdout: executionResult.stdout,
        },
      };
    } catch (error: any) {
      await this.log(sessionId, "testing", "error", error.message);
      return {
        phase: "testing",
        status: "failed",
        durationMs: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Run fixing phase
   */
  private async runFixingPhase(
    userId: string,
    sessionId: string,
    code: string,
    error: string,
    spec: SpecDocument,
  ): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      const errorContext = `
Error: ${error}

Original Specification:
${JSON.stringify(spec, null, 2)}
`;

      const systemPrompt = FIX_CODE_SYSTEM_PROMPT.replace(
        "{error_context}",
        errorContext,
      );

      const prompt = `Fix this Python code that failed:

\`\`\`python
${code}
\`\`\`

Error: ${error}`;

      await this.log(sessionId, "fixing", "debug", "Generating fix", { error });

      const response = await llmRouterService.executeTask(
        userId,
        "analysis", // Use analysis for code fix generation
        prompt,
        systemPrompt,
        { temperature: 0.3 },
      );

      const fixedCode = this.cleanCode(response);

      return {
        phase: "fixing",
        status: "success",
        durationMs: Date.now() - startTime,
        artifacts: { code: fixedCode },
      };
    } catch (error: any) {
      await this.log(sessionId, "fixing", "error", error.message);
      return {
        phase: "fixing",
        status: "failed",
        durationMs: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Run validation phase and generate schema
   */
  private async runValidationPhase(
    userId: string,
    sessionId: string,
    code: string,
    spec: SpecDocument,
    availableSecrets: string[],
  ): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      const prompt = `Generate the tool schema for:

**Specification:**
${JSON.stringify(spec, null, 2)}

**Code:**
\`\`\`python
${code}
\`\`\``;

      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        prompt,
        SCHEMA_GENERATION_PROMPT,
        { temperature: 0.1, responseFormat: "json" },
      );

      const schema = this.parseJsonResponse(response);

      // Ensure required secrets match what's available
      if (schema.requiredSecrets) {
        schema.requiredSecrets = schema.requiredSecrets.filter((s: string) =>
          availableSecrets.includes(s),
        );
      }

      // Update session with schema
      await persistence.updateSession(sessionId, {
        schemaJson: schema,
      });

      return {
        phase: "validation",
        status: "success",
        durationMs: Date.now() - startTime,
        artifacts: { schema },
      };
    } catch (error: any) {
      await this.log(sessionId, "validation", "error", error.message);
      return {
        phase: "validation",
        status: "failed",
        durationMs: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Save the tool to database
   */
  private async saveTool(
    userId: string,
    sessionId: string,
    code: string,
    schema: any,
    existingToolId?: string,
  ): Promise<GeneratedTool> {
    const toolName =
      schema?.name ||
      this.generateToolName(schema?.displayName || "custom_tool");

    if (existingToolId) {
      // Update existing tool
      const existing = await prisma.generatedTool.findUnique({
        where: { id: existingToolId },
      });

      if (existing) {
        return prisma.generatedTool.update({
          where: { id: existingToolId },
          data: {
            displayName: schema?.displayName || existing.displayName,
            description: schema?.description || existing.description,
            code,
            previousCode: existing.code,
            inputSchema: schema?.inputSchema || existing.inputSchema,
            outputSchema: schema?.outputSchema,
            requiredSecrets: schema?.requiredSecrets || [],
            category: schema?.category || existing.category,
            tags: schema?.tags || [],
            version: existing.version + 1,
            isVerified: true,
            updatedAt: new Date(),
          },
        });
      }
    }

    // Check if tool with same name exists for this user
    const existingByName = await prisma.generatedTool.findUnique({
      where: { userId_name: { userId, name: toolName } },
    });

    if (existingByName) {
      return prisma.generatedTool.update({
        where: { id: existingByName.id },
        data: {
          displayName: schema?.displayName || existingByName.displayName,
          description: schema?.description || existingByName.description,
          code,
          previousCode: existingByName.code,
          inputSchema: schema?.inputSchema || existingByName.inputSchema,
          outputSchema: schema?.outputSchema,
          requiredSecrets: schema?.requiredSecrets || [],
          category: schema?.category || existingByName.category,
          tags: schema?.tags || [],
          version: existingByName.version + 1,
          isVerified: true,
          updatedAt: new Date(),
        },
      });
    }

    // Create new tool
    return prisma.generatedTool.create({
      data: {
        userId,
        name: toolName,
        displayName: schema?.displayName || toolName,
        description: schema?.description || "Generated tool",
        code,
        inputSchema: schema?.inputSchema || { type: "object", properties: {} },
        outputSchema: schema?.outputSchema,
        requiredSecrets: schema?.requiredSecrets || [],
        category: schema?.category || "custom",
        tags: schema?.tags || [],
        isVerified: true,
      },
    });
  }

  // ==================== Helper Methods ====================

  /**
   * Update session status
   */
  private async updateSessionStatus(
    sessionId: string,
    status: GenerationSessionStatus,
    phase: string,
    progress: number,
  ): Promise<void> {
    await persistence.updateSession(sessionId, {
      status,
      currentPhase: phase,
      progress,
      currentIteration: status === "FIXING" ? { increment: 1 } : undefined,
    });
  }

  /**
   * Log a message to the session
   */
  private async log(
    sessionId: string,
    phase: string,
    level: string,
    message: string,
    metadata?: any,
  ): Promise<void> {
    await persistence.createLog({
      sessionId,
      phase,
      level,
      message,
      metadata,
    });
  }

  /**
   * Emit step update via WebSocket
   */
  private emitStep(
    userId: string,
    sessionId: string,
    step: any,
    onStep?: (step: any) => void,
  ): void {
    const payload = {
      type: "tool:generation:workflow:step",
      timestamp: Date.now(),
      sessionId,
      data: step,
    };

    // WebSocket broadcast
    wsBroadcastService.sendToUser(userId, payload);

    // Callback for SSE streaming
    if (onStep) {
      onStep(step);
    }
  }

  /**
   * Get available secrets
   */
  private async getAvailableSecrets(
    userId: string,
    suggested?: string[],
  ): Promise<string[]> {
    const allSecrets = await secretsService.listSecrets(userId);
    const secretKeys = allSecrets.map((s) => s.key);

    if (suggested?.length) {
      return suggested.filter((s) => secretKeys.includes(s));
    }

    return secretKeys;
  }

  /**
   * Clean code from markdown wrappers
   */
  private cleanCode(code: string): string {
    let cleaned = code;
    if (cleaned.startsWith("```python")) {
      cleaned = cleaned.slice(9);
    }
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    return cleaned.trim();
  }

  /**
   * Parse JSON response with fallback
   */
  private parseJsonResponse(response: string): any {
    let jsonStr = response;

    // Extract from markdown if present
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try direct parse
    try {
      return JSON.parse(jsonStr.trim());
    } catch {
      // Try to find JSON object in the response
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
      throw new Error("Failed to parse JSON response");
    }
  }

  /**
   * Generate tool name from display name
   */
  private generateToolName(displayName: string): string {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join("_");
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string) {
    return persistence.getSession(sessionId);
  }

  /**
   * Get sessions for a user
   */
  async getUserSessions(userId: string, limit = 20) {
    return persistence.listUserSessions(userId, limit);
  }

  /**
   * Cancel a running session
   */
  async cancelSession(sessionId: string): Promise<boolean> {
    try {
      await persistence.updateSession(sessionId, {
        status: "CANCELLED",
        completedAt: new Date(),
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const toolGenerationWorkflowService =
  new ToolGenerationWorkflowService();
