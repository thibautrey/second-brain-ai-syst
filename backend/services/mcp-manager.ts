/**
 * MCP Server Manager Service
 *
 * Manages Model Context Protocol (MCP) server connections.
 * Handles server lifecycle, tool discovery, and execution.
 */

import { spawn, ChildProcess } from "child_process";
import prisma from "./prisma.js";
import { MCPTransportType } from "@prisma/client";

// ==================== Types ====================

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion?: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

export interface MCPServerConnection {
  serverId: string;
  process?: ChildProcess;
  isConnected: boolean;
  tools: MCPTool[];
  serverInfo?: MCPServerInfo;
}

export interface MCPCallResult {
  success: boolean;
  content?: any;
  error?: string;
}

// ==================== Marketplace Catalog ====================

export interface MarketplaceToolDefinition {
  slug: string;
  name: string;
  description: string;
  category:
    | "productivity"
    | "communication"
    | "development"
    | "ai"
    | "data"
    | "automation";
  icon: string;
  author: string;
  version: string;
  mcpConfig?: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    installCommand?: string;
  };
  configSchema?: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  tags: string[];
  rating: number;
  installs: number;
}

// Embedded marketplace catalog (static list)
export const MARKETPLACE_CATALOG: MarketplaceToolDefinition[] = [
  {
    slug: "github",
    name: "GitHub",
    description:
      "Interact with GitHub repositories, issues, pull requests, and more",
    category: "development",
    icon: "🐙",
    author: "Anthropic",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: "" },
    },
    configSchema: {
      type: "object",
      properties: {
        GITHUB_TOKEN: {
          type: "string",
          description: "GitHub Personal Access Token",
          secret: true,
        },
      },
      required: ["GITHUB_TOKEN"],
    },
    tags: ["git", "code", "repositories", "issues"],
    rating: 4.8,
    installs: 15000,
  },
  {
    slug: "slack",
    name: "Slack",
    description: "Send messages, read channels, and manage Slack workspaces",
    category: "communication",
    icon: "💬",
    author: "Anthropic",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
      env: { SLACK_BOT_TOKEN: "", SLACK_TEAM_ID: "" },
    },
    configSchema: {
      type: "object",
      properties: {
        SLACK_BOT_TOKEN: {
          type: "string",
          description: "Slack Bot OAuth Token (xoxb-...)",
          secret: true,
        },
        SLACK_TEAM_ID: {
          type: "string",
          description: "Slack Team/Workspace ID",
        },
      },
      required: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
    },
    tags: ["messaging", "chat", "team"],
    rating: 4.6,
    installs: 12000,
  },
  {
    slug: "filesystem",
    name: "Filesystem",
    description: "Read, write, and manage files on the local filesystem",
    category: "productivity",
    icon: "📁",
    author: "Anthropic",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    },
    configSchema: {
      type: "object",
      properties: {
        allowedPaths: {
          type: "array",
          description: "List of allowed directory paths",
          items: { type: "string" },
        },
      },
      required: ["allowedPaths"],
    },
    tags: ["files", "storage", "local"],
    rating: 4.5,
    installs: 18000,
  },
  {
    slug: "postgres",
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases",
    category: "data",
    icon: "🐘",
    author: "Anthropic",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
      env: { DATABASE_URL: "" },
    },
    configSchema: {
      type: "object",
      properties: {
        DATABASE_URL: {
          type: "string",
          description: "PostgreSQL connection string",
          secret: true,
        },
      },
      required: ["DATABASE_URL"],
    },
    tags: ["database", "sql", "query"],
    rating: 4.7,
    installs: 9000,
  },
  {
    slug: "brave-search",
    name: "Brave Search",
    description: "Search the web using Brave Search API",
    category: "ai",
    icon: "🔍",
    author: "Anthropic",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: "" },
    },
    configSchema: {
      type: "object",
      properties: {
        BRAVE_API_KEY: {
          type: "string",
          description: "Brave Search API Key",
          secret: true,
        },
      },
      required: ["BRAVE_API_KEY"],
    },
    tags: ["search", "web", "research"],
    rating: 4.4,
    installs: 7500,
  },
  {
    slug: "memory",
    name: "Memory",
    description: "Persistent memory storage using a knowledge graph",
    category: "ai",
    icon: "🧠",
    author: "Anthropic",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
    },
    configSchema: {
      type: "object",
      properties: {},
    },
    tags: ["memory", "knowledge", "graph"],
    rating: 4.3,
    installs: 6000,
  },
  {
    slug: "puppeteer",
    name: "Puppeteer",
    description: "Browser automation and web scraping",
    category: "automation",
    icon: "🎭",
    author: "Anthropic",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    },
    configSchema: {
      type: "object",
      properties: {
        headless: {
          type: "boolean",
          description: "Run browser in headless mode",
          default: true,
        },
      },
    },
    tags: ["browser", "automation", "scraping"],
    rating: 4.5,
    installs: 8500,
  },
  {
    slug: "google-maps",
    name: "Google Maps",
    description: "Search places, get directions, and geocoding",
    category: "data",
    icon: "🗺️",
    author: "Anthropic",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-google-maps"],
      env: { GOOGLE_MAPS_API_KEY: "" },
    },
    configSchema: {
      type: "object",
      properties: {
        GOOGLE_MAPS_API_KEY: {
          type: "string",
          description: "Google Maps API Key",
          secret: true,
        },
      },
      required: ["GOOGLE_MAPS_API_KEY"],
    },
    tags: ["maps", "location", "directions"],
    rating: 4.6,
    installs: 5500,
  },
  {
    slug: "linear",
    name: "Linear",
    description: "Manage Linear issues, projects, and workflows",
    category: "productivity",
    icon: "📋",
    author: "Community",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@linear/mcp-server"],
      env: { LINEAR_API_KEY: "" },
    },
    configSchema: {
      type: "object",
      properties: {
        LINEAR_API_KEY: {
          type: "string",
          description: "Linear API Key",
          secret: true,
        },
      },
      required: ["LINEAR_API_KEY"],
    },
    tags: ["project-management", "issues", "tasks"],
    rating: 4.4,
    installs: 4000,
  },
  {
    slug: "notion",
    name: "Notion",
    description: "Read and write Notion pages, databases, and blocks",
    category: "productivity",
    icon: "📝",
    author: "Community",
    version: "1.0.0",
    mcpConfig: {
      command: "npx",
      args: ["-y", "@notionhq/mcp-server"],
      env: { NOTION_API_KEY: "" },
    },
    configSchema: {
      type: "object",
      properties: {
        NOTION_API_KEY: {
          type: "string",
          description: "Notion Integration Token",
          secret: true,
        },
      },
      required: ["NOTION_API_KEY"],
    },
    tags: ["notes", "wiki", "database"],
    rating: 4.5,
    installs: 11000,
  },
];

// ==================== MCP Manager Service ====================

class MCPManagerService {
  private connections: Map<string, MCPServerConnection> = new Map();

  // ==================== MCP Server CRUD ====================

  async listMCPServers(userId: string) {
    return prisma.mCPServer.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getMCPServer(userId: string, serverId: string) {
    return prisma.mCPServer.findFirst({
      where: { id: serverId, userId },
    });
  }

  async createMCPServer(
    userId: string,
    data: {
      name: string;
      description?: string;
      transportType?: MCPTransportType;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      enabled?: boolean;
    },
  ) {
    return prisma.mCPServer.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        transportType: data.transportType || "STDIO",
        command: data.command,
        args: data.args || [],
        env: data.env || {},
        url: data.url,
        enabled: data.enabled ?? true,
      },
    });
  }

  async updateMCPServer(
    userId: string,
    serverId: string,
    data: {
      name?: string;
      description?: string;
      transportType?: MCPTransportType;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      enabled?: boolean;
    },
  ) {
    // Disconnect if already connected
    await this.disconnectServer(serverId);

    return prisma.mCPServer.update({
      where: { id: serverId, userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.transportType && { transportType: data.transportType }),
        ...(data.command !== undefined && { command: data.command }),
        ...(data.args && { args: data.args }),
        ...(data.env && { env: data.env }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });
  }

  async deleteMCPServer(userId: string, serverId: string) {
    // Disconnect first
    await this.disconnectServer(serverId);

    return prisma.mCPServer.delete({
      where: { id: serverId, userId },
    });
  }

  // ==================== Connection Management ====================

  async connectServer(serverId: string): Promise<MCPServerConnection> {
    const server = await prisma.mCPServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new Error("MCP Server not found");
    }

    // Check if already connected
    if (this.connections.has(serverId)) {
      return this.connections.get(serverId)!;
    }

    const connection: MCPServerConnection = {
      serverId,
      isConnected: false,
      tools: [],
    };

    try {
      if (server.transportType === "STDIO" && server.command) {
        // Spawn the MCP server process
        const env = {
          ...process.env,
          ...(server.env as Record<string, string>),
        };

        const proc = spawn(server.command, server.args || [], {
          env,
          stdio: ["pipe", "pipe", "pipe"],
        });

        connection.process = proc;

        // TODO: Implement JSON-RPC communication protocol
        // For now, just mark as connected
        connection.isConnected = true;

        // Simulate tool discovery (in real implementation, query the server)
        connection.serverInfo = {
          name: server.name,
          version: "1.0.0",
          capabilities: { tools: true },
        };

        proc.on("error", (error) => {
          console.error(`MCP Server ${server.name} error:`, error);
          this.handleDisconnect(serverId, error.message);
        });

        proc.on("exit", (code) => {
          console.log(`MCP Server ${server.name} exited with code ${code}`);
          this.handleDisconnect(serverId);
        });
      } else if (
        server.transportType === "HTTP" ||
        server.transportType === "SSE"
      ) {
        // HTTP/SSE transport - would connect via fetch/EventSource
        connection.isConnected = true;
        connection.serverInfo = {
          name: server.name,
          version: "1.0.0",
          capabilities: { tools: true },
        };
      }

      // Update database status
      await prisma.mCPServer.update({
        where: { id: serverId },
        data: {
          isConnected: true,
          lastConnected: new Date(),
          lastError: null,
          serverInfo: connection.serverInfo as any,
        },
      });

      this.connections.set(serverId, connection);
      return connection;
    } catch (error: any) {
      // Update error status
      await prisma.mCPServer.update({
        where: { id: serverId },
        data: {
          isConnected: false,
          lastError: error.message,
        },
      });

      throw error;
    }
  }

  async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);

    if (connection) {
      if (connection.process) {
        connection.process.kill();
      }

      this.connections.delete(serverId);

      await prisma.mCPServer.update({
        where: { id: serverId },
        data: { isConnected: false },
      });
    }
  }

  private async handleDisconnect(
    serverId: string,
    error?: string,
  ): Promise<void> {
    this.connections.delete(serverId);

    await prisma.mCPServer.update({
      where: { id: serverId },
      data: {
        isConnected: false,
        lastError: error,
      },
    });
  }

  // ==================== Tool Execution ====================

  async callTool(
    serverId: string,
    toolName: string,
    params: Record<string, any>,
  ): Promise<MCPCallResult> {
    const connection = this.connections.get(serverId);

    if (!connection || !connection.isConnected) {
      return {
        success: false,
        error: "MCP Server not connected",
      };
    }

    try {
      // TODO: Implement actual JSON-RPC call to the MCP server
      // For now, return a placeholder
      console.log(`Calling MCP tool ${toolName} on server ${serverId}`, params);

      return {
        success: true,
        content: { message: "Tool execution placeholder" },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== Tool Configuration ====================

  async getUserToolConfigs(userId: string) {
    return prisma.userToolConfig.findMany({
      where: { userId },
    });
  }

  async getToolConfig(userId: string, toolId: string) {
    return prisma.userToolConfig.findUnique({
      where: { userId_toolId: { userId, toolId } },
    });
  }

  async upsertToolConfig(
    userId: string,
    toolId: string,
    data: {
      enabled?: boolean;
      config?: Record<string, any>;
      rateLimit?: number;
      timeout?: number;
    },
  ) {
    return prisma.userToolConfig.upsert({
      where: { userId_toolId: { userId, toolId } },
      create: {
        userId,
        toolId,
        enabled: data.enabled ?? true,
        config: data.config || {},
        rateLimit: data.rateLimit,
        timeout: data.timeout,
      },
      update: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.config && { config: data.config }),
        ...(data.rateLimit !== undefined && { rateLimit: data.rateLimit }),
        ...(data.timeout !== undefined && { timeout: data.timeout }),
      },
    });
  }

  // ==================== Marketplace ====================

  getMarketplaceCatalog(): MarketplaceToolDefinition[] {
    return MARKETPLACE_CATALOG;
  }

  getMarketplaceTool(slug: string): MarketplaceToolDefinition | undefined {
    return MARKETPLACE_CATALOG.find((t) => t.slug === slug);
  }

  async getInstalledMarketplaceTools(userId: string) {
    return prisma.marketplaceTool.findMany({
      where: { userId },
    });
  }

  async installMarketplaceTool(
    userId: string,
    toolSlug: string,
    config: Record<string, any> = {},
  ) {
    const toolDef = this.getMarketplaceTool(toolSlug);
    if (!toolDef) {
      throw new Error("Tool not found in marketplace");
    }

    // Create marketplace tool record
    const installed = await prisma.marketplaceTool.create({
      data: {
        userId,
        toolSlug,
        config,
        enabled: true,
      },
    });

    // If it has MCP config, also create an MCP server entry
    if (toolDef.mcpConfig) {
      await this.createMCPServer(userId, {
        name: toolDef.name,
        description: toolDef.description,
        transportType: "STDIO",
        command: toolDef.mcpConfig.command,
        args: toolDef.mcpConfig.args,
        env: {
          ...toolDef.mcpConfig.env,
          ...config,
        },
        enabled: true,
      });
    }

    return installed;
  }

  async uninstallMarketplaceTool(userId: string, toolSlug: string) {
    const toolDef = this.getMarketplaceTool(toolSlug);

    // Remove associated MCP server if exists
    if (toolDef) {
      const mcpServer = await prisma.mCPServer.findFirst({
        where: { userId, name: toolDef.name },
      });

      if (mcpServer) {
        await this.deleteMCPServer(userId, mcpServer.id);
      }
    }

    return prisma.marketplaceTool.delete({
      where: { userId_toolSlug: { userId, toolSlug } },
    });
  }

  async updateMarketplaceToolConfig(
    userId: string,
    toolSlug: string,
    config: Record<string, any>,
    enabled?: boolean,
  ) {
    return prisma.marketplaceTool.update({
      where: { userId_toolSlug: { userId, toolSlug } },
      data: {
        config,
        ...(enabled !== undefined && { enabled }),
      },
    });
  }
}

export const mcpManagerService = new MCPManagerService();
