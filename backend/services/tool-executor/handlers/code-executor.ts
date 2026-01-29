import { codeExecutorService } from "../../code-executor-wrapper.js";

export async function executeCodeExecutorAction(
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "execute":
      if (!params.code) {
        throw new Error("Missing 'code' parameter");
      }
      const result = await codeExecutorService.executeCode(
        params.code,
        params.timeout,
      );
      return {
        action: "execute",
        success: result.success,
        result: result.result,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error,
        execution_time_ms: result.execution_time_ms,
        truncated: result.truncated,
        formatted_output: codeExecutorService.formatResult(result),
      };

    case "validate":
      if (!params.code) {
        throw new Error("Missing 'code' parameter");
      }
      return codeExecutorService.validateCode(params.code);

    case "get_limits":
      return codeExecutorService.getLimits();

    case "get_examples":
      return codeExecutorService.getExamples();

    default:
      throw new Error(`Unknown code_executor action: ${action}`);
  }
}

export const CODE_EXECUTOR_TOOL_SCHEMA = {
  name: "code_executor",
  description:
    "Execute Python code in a secure sandbox. Use for calculations, data processing, algorithms, statistics. CRITICAL: You MUST use print() to output results - return values are NOT captured. Example: Instead of 'result = 42 * 17\\nresult', write 'result = 42 * 17\\nprint(result)'. Available modules: math, random, datetime, json, re, itertools, functools, collections, string, decimal, fractions, statistics, operator, copy, textwrap, unicodedata. No filesystem or network access.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["execute", "validate", "get_limits", "get_examples"],
        description:
          "'execute': run Python code (use print() for output!). 'validate': check syntax without running. 'get_limits': see constraints. 'get_examples': see code examples.",
      },
      code: {
        type: "string",
        description:
          "Python code to execute - REQUIRED for execute/validate. IMPORTANT: Use print() for ALL output. WRONG: 'x = 5 + 3\\nx' (returns nothing). RIGHT: 'x = 5 + 3\\nprint(x)' (outputs 8). For multiple values: 'print(f\"Sum: {a+b}, Product: {a*b}\")'.",
      },
      timeout: {
        type: "number",
        description:
          "Max execution time in seconds (default: 30, max: 30). Increase for complex calculations.",
      },
    },
    required: ["action"],
  },
};
