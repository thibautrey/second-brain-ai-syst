export async function executeReadSkillAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  const { skillManager } = await import("../../skill-manager.js");

  switch (action) {
    case "read": {
      if (!params.skill_id && !params.location) {
        throw new Error(
          "Missing required parameter: 'skill_id' or 'location' - specify which skill to read",
        );
      }

      let skillSlug = params.skill_id;
      if (params.location) {
        if (params.location.startsWith("skill:")) {
          skillSlug = params.location.replace("skill:", "");
        } else {
          skillSlug = params.location;
        }
      }

      const body = await skillManager.getSkillBody(userId, skillSlug);

      if (!body) {
        throw new Error(
          `Skill not found: ${skillSlug}. Use the skills listed in available_skills.`,
        );
      }

      return {
        action: "read",
        skill_id: skillSlug,
        success: true,
        instructions: body,
        message: `Successfully read skill instructions for '${skillSlug}'. Follow these instructions for the current task.`,
      };
    }

  default:
    throw new Error(`Unknown read_skill action: ${action}`);
  }
}

export const READ_SKILL_TOOL_SCHEMA = {
  name: "read_skill",
  description:
    "Read skill instructions for specialized workflows. Use when a skill from the available_skills list applies to the user's request. Read the skill's instructions BEFORE proceeding with the task to ensure you follow the correct workflow. Skills contain step-by-step guides for common tasks.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["read"],
        description: "'read': retrieve the skill instructions",
      },
      skill_id: {
        type: "string",
        description:
          "The skill ID/slug to read (e.g., 'weather-monitor', 'task-manager'). Use the skill ID from available_skills list.",
      },
      location: {
        type: "string",
        description:
          "Alternative to skill_id: the skill location in format 'skill:slug' (e.g., 'skill:weather-monitor')",
      },
    },
    required: ["action"],
  },
};
