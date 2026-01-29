import { dynamicToolRegistry } from "../../dynamic-tool-registry.js";
import {
  tryValidateGeneratedToolArgs,
  isValidGeneratedToolSchema,
  type GeneratedToolSchema,
} from "../../tool-validation.js";

export async function executeGeneratedTool(
  userId: string,
  toolName: string,
  params: Record<string, any>,
  skipValidation = false,
): Promise<any> {
  const tool = await dynamicToolRegistry.getTool(userId, toolName);

  if (!tool) {
    throw new Error(`Generated tool not found: ${toolName}`);
  }

  let validatedParams = params;
  if (!skipValidation && tool.inputSchema) {
    const schema = tool.inputSchema as unknown;

    if (isValidGeneratedToolSchema(schema)) {
      const validationResult = tryValidateGeneratedToolArgs(
        toolName,
        schema as GeneratedToolSchema,
        params,
      );

      if (!validationResult.success) {
        const errorMessage = [
          `⚠️ Validation error for generated tool "${toolName}":`,
          "",
          "Errors:",
          ...validationResult.errors.map((e) => `  - ${e}`),
          "",
          "Received arguments:",
          JSON.stringify(params, null, 2),
          "",
          "Please fix the arguments and try again.",
        ].join("\n");

        throw new Error(errorMessage);
      }

      validatedParams = validationResult.data;
    }
  }

  const result = await dynamicToolRegistry.executeTool(
    userId,
    toolName,
    validatedParams,
  );

  if (result.success) {
    return {
      action: "execute",
      tool: toolName,
      success: true,
      result: result.data,
      executionTime: result.executionTime,
    };
  }

  throw new Error(result.error || "Tool execution failed");
}
