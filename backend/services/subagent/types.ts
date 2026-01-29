/**
 * SubAgent Types
 *
 * Defines interfaces for the sub-agent architecture.
 * Sub-agents are isolated, focused agents spawned by the main agent
 * to handle complex subtasks without polluting the main context.
 */

/**
 * Configuration for spawning a sub-agent
 */
export interface SubAgentConfig {
  /** Unique identifier for this sub-agent run */
  id: string;
  /** Parent flow ID for tracing */
  parentFlowId: string;
  /** The specific task to accomplish */
  task: string;
  /** Human-readable description of what this sub-agent does */
  taskDescription: string;
  /** Subset of tools available to this sub-agent */
  tools: string[];
  /** Maximum iterations for the sub-agent (default: 10, max: 15) */
  maxIterations: number;
  /** Prompt mode - minimal for most tasks, none for simple execution */
  promptMode: "minimal" | "none";
  /** Sub-agents cannot spawn other sub-agents */
  canSpawnSubagents: false;
  /** Optional timeout in milliseconds (default: 120000 = 2 minutes) */
  timeout?: number;
  /** Optional context from parent to seed the sub-agent */
  parentContext?: string;
}

/**
 * Result returned by a sub-agent after completion
 */
export interface SubAgentResult {
  /** Whether the task was completed successfully */
  success: boolean;
  /** The final result/response from the sub-agent */
  result: string;
  /** List of tools that were used during execution */
  toolsUsed: string[];
  /** Number of LLM iterations used */
  iterations: number;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Sub-agent flow ID for debugging */
  flowId: string;
}

/**
 * Internal message format for sub-agent conversation
 */
export interface SubAgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

/**
 * Sub-agent execution status for tracking
 */
export interface SubAgentStatus {
  id: string;
  parentFlowId: string;
  status: "running" | "completed" | "failed" | "timeout";
  currentIteration: number;
  maxIterations: number;
  toolsUsed: string[];
  startTime: Date;
  endTime?: Date;
}

/**
 * Predefined sub-agent templates for common tasks
 */
export interface SubAgentTemplate {
  id: string;
  name: string;
  description: string;
  defaultTools: string[];
  maxIterations: number;
  promptMode: "minimal" | "none";
}

/**
 * Predefined templates for common sub-agent tasks
 */
export const SUBAGENT_TEMPLATES: SubAgentTemplate[] = [
  {
    id: "research",
    name: "Research Agent",
    description: "Search and gather information from multiple sources",
    defaultTools: ["brave_search", "curl", "user_context"],
    maxIterations: 10,
    promptMode: "minimal",
  },
  {
    id: "scheduler",
    name: "Scheduler Agent",
    description: "Create and manage scheduled tasks and reminders",
    defaultTools: ["scheduled_task", "notification", "todo"],
    maxIterations: 5,
    promptMode: "minimal",
  },
  {
    id: "data_processor",
    name: "Data Processor Agent",
    description: "Process and analyze data using code execution",
    defaultTools: ["code_executor", "curl"],
    maxIterations: 8,
    promptMode: "minimal",
  },
  {
    id: "task_manager",
    name: "Task Manager Agent",
    description: "Manage todos and track progress",
    defaultTools: ["todo", "notification", "goals_management"],
    maxIterations: 5,
    promptMode: "minimal",
  },
];

/**
 * Get a template by ID
 */
export function getSubAgentTemplate(
  templateId: string,
): SubAgentTemplate | undefined {
  return SUBAGENT_TEMPLATES.find((t) => t.id === templateId);
}

/**
 * Validate sub-agent configuration
 */
export function validateSubAgentConfig(
  config: Partial<SubAgentConfig>,
): string[] {
  const errors: string[] = [];

  if (!config.task || config.task.trim().length === 0) {
    errors.push("Task is required and cannot be empty");
  }

  if (!config.taskDescription || config.taskDescription.trim().length === 0) {
    errors.push("Task description is required");
  }

  if (!config.tools || config.tools.length === 0) {
    errors.push("At least one tool must be specified");
  }

  if (config.maxIterations !== undefined) {
    if (config.maxIterations < 1) {
      errors.push("maxIterations must be at least 1");
    }
    if (config.maxIterations > 15) {
      errors.push("maxIterations cannot exceed 15 for sub-agents");
    }
  }

  if (config.timeout !== undefined && config.timeout < 5000) {
    errors.push("Timeout must be at least 5000ms (5 seconds)");
  }

  return errors;
}
