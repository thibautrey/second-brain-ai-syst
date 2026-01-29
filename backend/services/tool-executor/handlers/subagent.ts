import { SUBAGENT_TEMPLATES, subAgentRunner } from "../../subagent/index.js";

export async function executeSubAgentAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "spawn": {
      if (!params.task) {
        throw new Error(
          "Missing required parameter: 'task' - describe what the sub-agent should accomplish",
        );
      }
      if (!params.task_description) {
        throw new Error(
          "Missing required parameter: 'task_description' - explain the sub-agent's mission",
        );
      }
      if (!params.tools || params.tools.length === 0) {
        throw new Error(
          "Missing required parameter: 'tools' - array of tool names the sub-agent can use (e.g., ['curl', 'code_executor'])",
        );
      }
      const result = await subAgentRunner.spawn(userId, {
        task: params.task,
        taskDescription: params.task_description,
        tools: params.tools,
        maxIterations: params.max_iterations || 10,
        promptMode: params.prompt_mode || "minimal",
        timeout: params.timeout,
        parentContext: params.context,
        parentFlowId: params.parent_flow_id,
      });
      return {
        action: "spawn",
        success: result.success,
        result: result.result,
        toolsUsed: result.toolsUsed,
        iterations: result.iterations,
        executionTime: result.executionTime,
        flowId: result.flowId,
        error: result.error,
        message: result.success
          ? `Sub-agent completed task successfully in ${result.iterations} iteration(s)`
          : `Sub-agent failed: ${result.error}`,
      };
    }

    case "spawn_template": {
      if (!params.template_id) {
        throw new Error(
          "Missing required parameter: 'template_id' - use 'list_templates' to see available templates",
        );
      }
      if (!params.task) {
        throw new Error(
          "Missing required parameter: 'task' - describe what the sub-agent should accomplish",
        );
      }
      const result = await subAgentRunner.spawnFromTemplate(
        userId,
        params.template_id,
        params.task,
        {
          parentFlowId: params.parent_flow_id,
          parentContext: params.context,
          additionalTools: params.additional_tools,
        },
      );
      return {
        action: "spawn_template",
        template: params.template_id,
        success: result.success,
        result: result.result,
        toolsUsed: result.toolsUsed,
        iterations: result.iterations,
        executionTime: result.executionTime,
        flowId: result.flowId,
        error: result.error,
        message: result.success
          ? `Sub-agent (${params.template_id}) completed task successfully`
          : `Sub-agent failed: ${result.error}`,
      };
    }

    case "list_templates":
      return {
        action: "list_templates",
        templates: SUBAGENT_TEMPLATES.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          defaultTools: t.defaultTools,
          maxIterations: t.maxIterations,
        })),
        count: SUBAGENT_TEMPLATES.length,
        message:
          "Use spawn_template with a template_id to quickly spawn a pre-configured sub-agent",
      };

    case "get_status": {
      const activeSubAgents = subAgentRunner.getActiveSubAgents();
      return {
        action: "get_status",
        activeSubAgents: activeSubAgents.map((s) => ({
          id: s.id,
          parentFlowId: s.parentFlowId,
          status: s.status,
          currentIteration: s.currentIteration,
          maxIterations: s.maxIterations,
          toolsUsed: s.toolsUsed,
          startTime: s.startTime,
          runningFor: Date.now() - s.startTime.getTime(),
        })),
        count: activeSubAgents.length,
      };
    }

    default:
      throw new Error(`Unknown spawn_subagent action: ${action}`);
  }
}

export const SPAWN_SUBAGENT_TOOL_SCHEMA = {
  name: "spawn_subagent",
  description:
    "Spawn a focused sub-agent for complex subtasks. Sub-agents run in isolated contexts with limited tools and iterations. Use when: (1) A task requires multiple tool calls that don't need main context, (2) You want to delegate research or data gathering, (3) A subtask is complex enough to benefit from focused attention. Sub-agents CANNOT spawn other sub-agents and have a maximum of 15 iterations.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["spawn", "spawn_template", "list_templates", "get_status"],
        description:
          "'spawn': spawn a custom sub-agent with specific tools. 'spawn_template': use a predefined template. 'list_templates': see available templates. 'get_status': check active sub-agents.",
      },
      task: {
        type: "string",
        description:
          "The specific task for the sub-agent to accomplish. Be clear and detailed. (Required for spawn/spawn_template)",
      },
      task_description: {
        type: "string",
        description:
          "Human-readable description of the sub-agent's mission. Explains the purpose and expected outcome. (Required for spawn)",
      },
      tools: {
        type: "array",
        items: { type: "string" },
        description:
          "Array of tool names the sub-agent can use (e.g., ['curl', 'code_executor', 'browser']). (Required for spawn)",
      },
      max_iterations: {
        type: "number",
        description:
          "Maximum LLM iterations for the sub-agent (default: 10, max: 15). Lower for simple tasks.",
      },
      timeout: {
        type: "number",
        description:
          "Timeout in milliseconds (default: 120000 = 2 minutes). Increase for complex tasks.",
      },
      context: {
        type: "string",
        description:
          "Optional context from the main conversation to provide to the sub-agent.",
      },
      template_id: {
        type: "string",
        description:
          "Template ID to use (e.g., 'research', 'scheduler', 'data_processor', 'task_manager'). Use list_templates to see all.",
      },
      additional_tools: {
        type: "array",
        items: { type: "string" },
        description:
          "Additional tools to add to the template's default tools. (For spawn_template)",
      },
    },
    required: ["action"],
  },
};
