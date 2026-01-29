// Dynamic Tool Registry Service
// Manages loading, caching, and execution of AI-generated tools
// Provides tool schemas for LLM function calling

import { GeneratedTool, PrismaClient } from "@prisma/client";

import { codeExecutorService } from "./code-executor-wrapper.js";
import { secretsService } from "./secrets.js";

const prisma = new PrismaClient();

// Types for function calling schemas
export interface FunctionParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: FunctionParameter;
  properties?: Record<string, FunctionParameter>;
  required?: string[];
}

export interface FunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, FunctionParameter>;
    required?: string[];
  };
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  toolUsed: string;
}

// Cache for loaded tools
interface ToolCache {
  tools: Map<string, GeneratedTool>;
  lastRefresh: number;
  userId: string;
}

const CACHE_TTL = 60000; // 1 minute cache TTL

class DynamicToolRegistry {
  private cache: Map<string, ToolCache> = new Map();

  /**
   * Load all enabled tools for a user
   */
  async loadTools(
    userId: string,
    forceRefresh = false,
  ): Promise<GeneratedTool[]> {
    const cached = this.cache.get(userId);
    const now = Date.now();

    if (!forceRefresh && cached && now - cached.lastRefresh < CACHE_TTL) {
      return Array.from(cached.tools.values());
    }

    const tools = await prisma.generatedTool.findMany({
      where: {
        userId,
        enabled: true,
      },
    });

    // Update cache
    const toolMap = new Map<string, GeneratedTool>();
    for (const tool of tools) {
      toolMap.set(tool.id, tool);
      toolMap.set(tool.name, tool); // Also index by name for lookup
    }

    this.cache.set(userId, {
      tools: toolMap,
      lastRefresh: now,
      userId,
    });

    return tools;
  }

  /**
   * Get a specific tool by ID or name
   */
  async getTool(
    userId: string,
    toolIdOrName: string,
  ): Promise<GeneratedTool | null> {
    await this.loadTools(userId);
    const cached = this.cache.get(userId);
    return cached?.tools.get(toolIdOrName) || null;
  }

  /**
   * Generate function calling schemas for all enabled tools
   */
  async getToolSchemas(userId: string): Promise<FunctionSchema[]> {
    const tools = await this.loadTools(userId);

    return tools.map((tool) => this.toolToSchema(tool));
  }

  /**
   * Convert a GeneratedTool to OpenAI function schema format
   */
  toolToSchema(tool: GeneratedTool): FunctionSchema {
    const inputSchema = tool.inputSchema as any;

    return {
      name: `generated_${tool.name}`,
      description: `[Generated Tool] ${tool.description}`,
      parameters: {
        type: "object",
        properties: inputSchema.properties || {},
        required: inputSchema.required || [],
      },
    };
  }

  /**
   * Execute a generated tool
   */
  async executeTool(
    userId: string,
    toolIdOrName: string,
    params: Record<string, any>,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Get tool
    const tool = await this.getTool(userId, toolIdOrName);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolIdOrName}`,
        executionTime: Date.now() - startTime,
        toolUsed: toolIdOrName,
      };
    }

    if (!tool.enabled) {
      return {
        success: false,
        error: `Tool is disabled: ${tool.name}`,
        executionTime: Date.now() - startTime,
        toolUsed: tool.name,
      };
    }

    try {
      // Get required secrets
      const secretValues = await secretsService.getSecretsValues(
        userId,
        tool.requiredSecrets,
      );

      // Check if all required secrets are available
      const missingSecrets = tool.requiredSecrets.filter(
        (s) => !secretValues[s],
      );
      if (missingSecrets.length > 0) {
        return {
          success: false,
          error: `Missing required secrets: ${missingSecrets.join(", ")}. Please configure them in Settings > Secrets.`,
          executionTime: Date.now() - startTime,
          toolUsed: tool.name,
        };
      }

      // Build code with parameter injection
      const paramsJson = JSON.stringify(params);
      const fullCode = `
import json

# Injected parameters
params = ${paramsJson}

# Tool code
${tool.code}
`;

      // Execute with network access with retries
      const result = await codeExecutorService.executeWithNetwork(
        fullCode,
        secretValues,
        Math.ceil(tool.timeout / 1000),
        3, // Retry up to 3 times on network failures
      );

      // Update usage stats
      await prisma.generatedTool.update({
        where: { id: tool.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
          ...(result.success
            ? {}
            : { lastErrorAt: new Date(), lastError: result.error }),
        },
      });

      // Invalidate cache to reflect updated stats
      this.invalidateCache(userId);

      if (result.success) {
        return {
          success: true,
          data: result.result,
          executionTime: Date.now() - startTime,
          toolUsed: tool.name,
        };
      }

      return {
        success: false,
        error: result.error || "Tool execution failed",
        executionTime: Date.now() - startTime,
        toolUsed: tool.name,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        toolUsed: tool.name,
      };
    }
  }

  /**
   * Check if a tool call is for a generated tool
   */
  isGeneratedToolCall(toolName: string): boolean {
    return toolName.startsWith("generated_");
  }

  /**
   * Extract the actual tool name from a generated tool call
   */
  extractToolName(generatedToolName: string): string {
    if (generatedToolName.startsWith("generated_")) {
      return generatedToolName.slice(10); // Remove "generated_" prefix
    }
    return generatedToolName;
  }

  /**
   * Invalidate cache for a user
   */
  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Add a newly created tool to the cache
   */
  async addToCache(tool: GeneratedTool): Promise<void> {
    const cached = this.cache.get(tool.userId);
    if (cached) {
      cached.tools.set(tool.id, tool);
      cached.tools.set(tool.name, tool);
    }
  }

  /**
   * Remove a tool from cache
   */
  removeFromCache(userId: string, toolIdOrName: string): void {
    const cached = this.cache.get(userId);
    if (cached) {
      const tool = cached.tools.get(toolIdOrName);
      if (tool) {
        cached.tools.delete(tool.id);
        cached.tools.delete(tool.name);
      }
    }
  }

  /**
   * Get tool usage statistics
   */
  async getToolStats(
    userId: string,
  ): Promise<{ total: number; active: number; totalUsage: number }> {
    const tools = await prisma.generatedTool.findMany({
      where: { userId },
      select: {
        enabled: true,
        usageCount: true,
      },
    });

    return {
      total: tools.length,
      active: tools.filter((t) => t.enabled).length,
      totalUsage: tools.reduce((sum, t) => sum + t.usageCount, 0),
    };
  }

  /**
   * Get most used tools
   */
  async getMostUsedTools(userId: string, limit = 5): Promise<GeneratedTool[]> {
    return prisma.generatedTool.findMany({
      where: { userId, enabled: true },
      orderBy: { usageCount: "desc" },
      take: limit,
    });
  }

  /**
   * Search tools by keyword with enhanced matching
   * Uses multiple keywords and common synonyms for better discovery
   */
  async searchTools(userId: string, query: string): Promise<GeneratedTool[]> {
    // Stop words to ignore (French and English)
    const stopWords = new Set([
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
      "je",
      "tu",
      "il",
      "elle",
      "on",
      "nous",
      "vous",
      "ils",
      "elles",
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
      "par",
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "to",
      "of",
      "in",
      "on",
      "at",
      "by",
      "for",
      "with",
      "from",
      "get",
      "give",
      "make",
      "take",
      "find",
      "show",
    ]);

    // Common synonyms for tool discovery
    const synonymGroups: string[][] = [
      ["météo", "meteo", "weather", "temps", "climat", "forecast", "prévision"],
      ["recherche", "search", "find", "chercher", "trouver"],
      ["traduction", "translate", "translation", "traduire"],
      ["calcul", "calculate", "calculator", "math", "compute"],
      ["email", "mail", "courriel", "message"],
      ["news", "current events", "bulletin", "articles", "info"],
      ["prix", "price", "cost", "tarif"],
      ["bourse", "stock", "stocks", "finance", "market"],
      ["crypto", "bitcoin", "cryptocurrency"],
      ["localisation", "location", "gps", "position"],
      ["carte", "map", "maps", "itinéraire", "direction"],
    ];

    // Build synonym map
    const synonymMap = new Map<string, string[]>();
    for (const group of synonymGroups) {
      for (const word of group) {
        synonymMap.set(word.toLowerCase(), group);
      }
    }

    // Extract meaningful keywords
    const rawKeywords = query
      .toLowerCase()
      .replace(/[^a-zà-ÿ0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    // Expand with synonyms
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

    // If no meaningful keywords, fall back to simple search
    if (keywordsArray.length === 0) {
      return prisma.generatedTool.findMany({
        where: {
          userId,
          enabled: true,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { displayName: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
      });
    }

    // Build OR conditions for all keywords
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
    orConditions.push({ tags: { hasSome: keywordsArray } });

    return prisma.generatedTool.findMany({
      where: {
        userId,
        enabled: true,
        OR: orConditions,
      },
    });
  }
}

export const dynamicToolRegistry = new DynamicToolRegistry();
