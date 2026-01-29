import { dynamicToolGeneratorService } from "../../dynamic-tool-generator.js";
import { dynamicToolRegistry } from "../../dynamic-tool-registry.js";

export async function executeGenerateToolAction(
  userId: string,
  action: string,
  params: Record<string, any>,
  onGenerationStep?: (step: any) => void,
): Promise<any> {
  switch (action) {
    case "generate": {
      if (!params.objective) {
        throw new Error(
          "Missing 'objective' parameter - describe what the tool should do",
        );
      }

      const result = await dynamicToolGeneratorService.generateTool(
        userId,
        {
          objective: params.objective,
          context: params.context,
          suggestedSecrets:
            params.suggestedSecrets || params.required_secrets,
        },
        onGenerationStep,
      );

      if (result.success && result.tool) {
        await dynamicToolRegistry.addToCache(result.tool);

        return {
          action: "generate",
          success: true,
          tool: {
            id: result.tool.id,
            name: result.tool.name,
            displayName: result.tool.displayName,
            description: result.tool.description,
            category: result.tool.category,
            requiredSecrets: result.tool.requiredSecrets,
          },
          executionResult: result.executionResult,
          iterations: result.iterations,
          message: `Successfully created tool '${result.tool.displayName}'. It's now available for use.`,
        };
      }

      return {
        action: "generate",
        success: false,
        error: result.error,
        logs: result.logs,
        iterations: result.iterations,
      };
    }

    case "list": {
      const tools = await dynamicToolGeneratorService.listTools(
        userId,
        params.category,
        params.enabled_only !== false,
      );

      return {
        action: "list",
        tools: tools.map((t) => ({
          id: t.id,
          name: t.name,
          displayName: t.displayName,
          description: t.description,
          category: t.category,
          usageCount: t.usageCount,
          lastUsedAt: t.lastUsedAt,
          enabled: t.enabled,
          isVerified: t.isVerified,
        })),
        count: tools.length,
      };
    }

    case "get": {
      if (!params.tool_id && !params.name) {
        throw new Error("Missing 'tool_id' or 'name' parameter");
      }

      const tool = await dynamicToolGeneratorService.getTool(
        userId,
        params.tool_id || params.name,
      );

      if (!tool) {
        return { action: "get", found: false, error: "Tool not found" };
      }

      return {
        action: "get",
        found: true,
        tool: {
          id: tool.id,
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description,
          category: tool.category,
          tags: tool.tags,
          requiredSecrets: tool.requiredSecrets,
          inputSchema: tool.inputSchema,
          usageCount: tool.usageCount,
          lastUsedAt: tool.lastUsedAt,
          enabled: tool.enabled,
          isVerified: tool.isVerified,
          version: tool.version,
          code: tool.code,
        },
      };
    }

    case "execute": {
      if (!params.tool_id && !params.name) {
        throw new Error("Missing 'tool_id' or 'name' parameter");
      }

      const toolParams = params.params || params.tool_params || {};
      const result = await dynamicToolGeneratorService.executeTool(
        userId,
        params.tool_id || params.name,
        toolParams,
      );

      return {
        action: "execute",
        success: result.success,
        result: result.result,
        error: result.error,
      };
    }

    case "delete": {
      if (!params.tool_id) {
        throw new Error("Missing 'tool_id' parameter");
      }

      const deleted = await dynamicToolGeneratorService.deleteTool(
        userId,
        params.tool_id,
      );

      if (deleted) {
        dynamicToolRegistry.removeFromCache(userId, params.tool_id);
      }

      return {
        action: "delete",
        success: deleted,
        message: deleted ? "Tool deleted successfully" : "Tool not found",
      };
    }

    case "search": {
      if (!params.query) {
        throw new Error("Missing 'query' parameter");
      }

      const tools = await dynamicToolRegistry.searchTools(userId, params.query);

      return {
        action: "search",
        query: params.query,
        tools: tools.map((t) => ({
          id: t.id,
          name: t.name,
          displayName: t.displayName,
          description: t.description,
          category: t.category,
        })),
        count: tools.length,
      };
    }

    default:
      throw new Error(`Unknown generate_tool action: ${action}`);
  }
}

export const GENERATE_TOOL_SCHEMA = {
  name: "generate_tool",
  description:
    "Generate, manage, and execute custom AI-created tools. Use 'generate' to create a new tool from a detailed objective. The AI writes Python code, tests it, and saves it for reuse. Generated tools can make HTTP requests and use API keys from secrets. Before generating, use 'secrets' tool to check if required API keys exist.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["generate", "list", "get", "execute", "delete", "search"],
        description:
          "'generate': create new tool (requires objective). 'list': show all tools. 'get': view tool details/code. 'execute': run a tool (requires tool_id/name + params). 'delete': remove a tool. 'search': find tools by keyword.",
      },
      objective: {
        type: "string",
        description:
          "For 'generate': DETAILED description of what the tool should do. GOOD: 'Get current weather for a city using OpenWeatherMap API. Input: city name. Output: temperature (Celsius), conditions, humidity.' BAD: 'Make weather tool' (too vague). Include: what it does, required inputs, expected outputs, which API to use if applicable.",
      },
      context: {
        type: "string",
        description:
          "For 'generate': additional context from conversation (e.g., user's specific requirements, error from previous attempt)",
      },
      suggestedSecrets: {
        type: "array",
        items: { type: "string" },
        description:
          "For 'generate': API key names the tool might need (e.g., ['openweathermap_api_key']). Check with 'secrets' tool first!",
      },
      tool_id: {
        type: "string",
        description:
          "For 'get', 'execute', 'delete': the tool ID (from 'list' or 'generate' response)",
      },
      name: {
        type: "string",
        description:
          "For 'get', 'execute': the tool name (alternative to tool_id)",
      },
      params: {
        type: "object",
        description:
          "For 'execute': parameters to pass to the tool. Check tool's inputSchema (via 'get') to see required params.",
      },
      query: {
        type: "string",
        description:
          "For 'search': keyword to search in tool names/descriptions",
      },
      category: {
        type: "string",
        description: "For 'list': filter by category",
      },
    },
    required: ["action"],
  },
};
