/**
 * Tool Validation Service
 *
 * Provides automatic validation of tool call arguments using TypeBox schemas.
 * Uses pi-ai's validateToolCall for cross-provider compatible validation.
 *
 * Features:
 * - Automatic type coercion (string "42" → number 42)
 * - Detailed error messages sent back to LLM for retry
 * - Type-safe validated arguments
 * - Validation errors include path and expected type
 * - Support for both built-in (TypeBox) and generated (JSON Schema) tools
 */

import {
  validateToolCall,
  validateToolArguments,
  type Tool,
  type ToolCall,
} from "@mariozechner/pi-ai";
import Ajv, { type ErrorObject } from "ajv";
import {
  getTypeBoxTools,
  toolSchemas,
  type ToolDefinition,
} from "./tool-schemas-typebox.js";

// Initialize AJV for JSON Schema validation (used for generated tools)
const ajv = new Ajv({
  allErrors: true, // Report all errors, not just the first
  coerceTypes: true, // Coerce types (string "42" → number 42)
  useDefaults: true, // Apply default values from schema
  removeAdditional: false, // Keep additional properties (don't silently remove)
});

// Re-export the schemas and types for convenience
export {
  toolSchemas,
  getTypeBoxTools,
  type ToolDefinition,
} from "./tool-schemas-typebox.js";

/**
 * Validation error with detailed information for LLM feedback
 */
export class ToolValidationError extends Error {
  public toolName: string;
  public validationErrors: string[];
  public arguments: unknown;

  constructor(toolName: string, errors: string[], args: unknown) {
    const message = `Validation failed for tool "${toolName}": ${errors.join("; ")}`;
    super(message);
    this.name = "ToolValidationError";
    this.toolName = toolName;
    this.validationErrors = errors;
    this.arguments = args;
  }

  /**
   * Format error for LLM retry - includes what went wrong and how to fix it
   */
  toRetryMessage(): string {
    return [
      `⚠️ Tool validation error for "${this.toolName}":`,
      "",
      "Errors:",
      ...this.validationErrors.map((e) => `  - ${e}`),
      "",
      "Received arguments:",
      JSON.stringify(this.arguments, null, 2),
      "",
      "Please fix the arguments and try again.",
    ].join("\n");
  }
}

/**
 * Validate tool call arguments against TypeBox schema
 *
 * @param toolName Name of the tool being called
 * @param args Arguments provided by the LLM
 * @returns Validated and coerced arguments
 * @throws ToolValidationError if validation fails
 */
export function validateToolArgs<T = any>(
  toolName: string,
  args: Record<string, unknown>,
): T {
  // Get all tools with TypeBox schemas
  const tools = getTypeBoxTools();

  // Find the tool
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    throw new ToolValidationError(
      toolName,
      [
        `Unknown tool: "${toolName}". Available tools: ${tools.map((t) => t.name).join(", ")}`,
      ],
      args,
    );
  }

  // Create a mock ToolCall for validation (matches pi-ai's ToolCall interface)
  const mockToolCall: ToolCall = {
    type: "toolCall",
    id: "validation-check",
    name: toolName,
    arguments: args,
  };

  try {
    // Use pi-ai's validateToolCall which handles TypeBox validation
    const validated = validateToolCall(tools, mockToolCall);
    return validated as T;
  } catch (error) {
    // Parse the error message to extract validation details
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Format validation errors for better readability
    const errors = parseValidationErrors(errorMessage);

    throw new ToolValidationError(toolName, errors, args);
  }
}

/**
 * Validate tool call using the full ToolCall structure (as received from LLM)
 *
 * @param toolCall The tool call from the LLM
 * @returns Validated and coerced arguments
 * @throws ToolValidationError if validation fails
 */
export function validateLLMToolCall<T = any>(toolCall: ToolCall): T {
  const tools = getTypeBoxTools();

  try {
    const validated = validateToolCall(tools, toolCall);
    return validated as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errors = parseValidationErrors(errorMessage);
    throw new ToolValidationError(toolCall.name, errors, toolCall.arguments);
  }
}

/**
 * Check if a tool exists and has a TypeBox schema
 */
export function hasTypeBoxSchema(toolName: string): boolean {
  return toolName in toolSchemas;
}

/**
 * Get the TypeBox schema for a specific tool
 */
export function getToolSchema(toolName: string) {
  return (toolSchemas as Record<string, unknown>)[toolName];
}

/**
 * Parse validation error messages into a clean list
 */
function parseValidationErrors(errorMessage: string): string[] {
  // Common patterns in AJV error messages
  const errors: string[] = [];

  // Handle "must have required property" errors
  const requiredMatch = errorMessage.match(
    /must have required property '(\w+)'/g,
  );
  if (requiredMatch) {
    requiredMatch.forEach((m) => {
      const prop = m.match(/must have required property '(\w+)'/)?.[1];
      if (prop) errors.push(`Missing required property: "${prop}"`);
    });
  }

  // Handle "must be" type errors
  const typeMatch = errorMessage.match(/\/(\w+) must be (\w+)/g);
  if (typeMatch) {
    typeMatch.forEach((m) => {
      const parts = m.match(/\/(\w+) must be (\w+)/);
      if (parts) {
        errors.push(`Property "${parts[1]}" must be ${parts[2]}`);
      }
    });
  }

  // Handle "must be equal to one of the allowed values"
  const enumMatch = errorMessage.match(
    /\/(\w+) must be equal to one of the allowed values/g,
  );
  if (enumMatch) {
    enumMatch.forEach((m) => {
      const prop = m.match(/\/(\w+) must be/)?.[1];
      if (prop)
        errors.push(
          `Property "${prop}" has invalid value (check allowed values)`,
        );
    });
  }

  // Handle "additional properties" errors
  if (errorMessage.includes("must NOT have additional properties")) {
    const propMatch = errorMessage.match(/additional properties: (\w+)/);
    if (propMatch) {
      errors.push(`Unknown property: "${propMatch[1]}"`);
    } else {
      errors.push("Contains unknown/additional properties");
    }
  }

  // If no specific errors were parsed, use the raw message
  if (errors.length === 0) {
    errors.push(errorMessage);
  }

  return errors;
}

/**
 * Soft validation - returns result or null instead of throwing
 * Useful for optional validation scenarios
 */
export function tryValidateToolArgs<T = any>(
  toolName: string,
  args: Record<string, unknown>,
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = validateToolArgs<T>(toolName, args);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ToolValidationError) {
      return { success: false, errors: error.validationErrors };
    }
    return { success: false, errors: [String(error)] };
  }
}

/**
 * Create a validation middleware for tool execution
 * Returns a function that validates and executes
 */
export function withValidation<T, R>(
  toolName: string,
  handler: (args: T) => Promise<R>,
): (args: Record<string, unknown>) => Promise<R> {
  return async (args: Record<string, unknown>) => {
    const validated = validateToolArgs<T>(toolName, args);
    return handler(validated);
  };
}

/**
 * Get all available tools with their TypeBox schemas as pi-ai Tools
 */
export function getAllTools(): Tool[] {
  return getTypeBoxTools();
}

/**
 * Format a ToolValidationError for the LLM response
 * This is used when we want to let the LLM retry with corrected arguments
 */
export function formatValidationErrorForLLM(
  error: ToolValidationError,
): string {
  return error.toRetryMessage();
}

// ==================== Generated Tool Validation (JSON Schema with AJV) ====================

/**
 * JSON Schema structure for generated tools (stored in database)
 */
export interface GeneratedToolSchema {
  type: "object";
  properties: Record<string, any>;
  required?: string[];
}

/**
 * Validate arguments for a generated tool using its JSON Schema
 *
 * @param toolName Name of the generated tool (for error messages)
 * @param schema The JSON Schema from the tool's inputSchema
 * @param args Arguments to validate
 * @returns Validated arguments (with coerced types and defaults applied)
 * @throws ToolValidationError if validation fails
 */
export function validateGeneratedToolArgs<T = any>(
  toolName: string,
  schema: GeneratedToolSchema,
  args: Record<string, unknown>,
): T {
  // Compile schema (AJV caches compiled schemas automatically)
  const validate = ajv.compile(schema);

  // Clone args to avoid mutating the original (coerceTypes modifies in place)
  const argsCopy = JSON.parse(JSON.stringify(args));

  const valid = validate(argsCopy);

  if (!valid && validate.errors) {
    const errors = formatAjvErrors(validate.errors);
    throw new ToolValidationError(toolName, errors, args);
  }

  return argsCopy as T;
}

/**
 * Soft validation for generated tools - returns result or errors
 *
 * @param toolName Name of the generated tool
 * @param schema The JSON Schema from the tool's inputSchema
 * @param args Arguments to validate
 * @returns Success with validated data, or failure with error messages
 */
export function tryValidateGeneratedToolArgs<T = any>(
  toolName: string,
  schema: GeneratedToolSchema,
  args: Record<string, unknown>,
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = validateGeneratedToolArgs<T>(toolName, schema, args);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ToolValidationError) {
      return { success: false, errors: error.validationErrors };
    }
    return { success: false, errors: [String(error)] };
  }
}

/**
 * Format AJV errors into human-readable messages for LLM
 */
function formatAjvErrors(errors: ErrorObject[]): string[] {
  return errors.map((err) => {
    const path = err.instancePath
      ? err.instancePath.replace(/^\//, "")
      : "root";

    switch (err.keyword) {
      case "required":
        return `Missing required property: "${err.params.missingProperty}"`;

      case "type":
        return `Property "${path}" must be ${err.params.type}, got ${typeof err.data}`;

      case "enum":
        const allowed = (err.params.allowedValues as string[]).join(", ");
        return `Property "${path}" must be one of: [${allowed}]`;

      case "minLength":
        return `Property "${path}" must have at least ${err.params.limit} characters`;

      case "maxLength":
        return `Property "${path}" must have at most ${err.params.limit} characters`;

      case "minimum":
        return `Property "${path}" must be >= ${err.params.limit}`;

      case "maximum":
        return `Property "${path}" must be <= ${err.params.limit}`;

      case "pattern":
        return `Property "${path}" must match pattern: ${err.params.pattern}`;

      case "additionalProperties":
        return `Unknown property: "${err.params.additionalProperty}"`;

      case "format":
        return `Property "${path}" must be a valid ${err.params.format}`;

      default:
        return `${path}: ${err.message || "validation failed"}`;
    }
  });
}

/**
 * Check if a generated tool schema is valid
 */
export function isValidGeneratedToolSchema(
  schema: unknown,
): schema is GeneratedToolSchema {
  if (!schema || typeof schema !== "object") return false;
  const s = schema as any;
  return s.type === "object" && typeof s.properties === "object";
}
