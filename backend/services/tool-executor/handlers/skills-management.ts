export async function executeSkillsManagementAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  const { skillManager } = await import("../../skill-manager.js");

  switch (action) {
    case "list_installed": {
      const enabledOnly = params.enabled_only === true;
      const skills = await skillManager.getInstalledSkills(
        userId,
        enabledOnly,
      );

      return {
        action: "list_installed",
        success: true,
        skills: skills.map((s: any) => ({
          slug: s.skillSlug,
          name: s.name,
          description: s.description,
          enabled: s.enabled,
          isCustom: !s.hubEntryId,
          priority: s.priority,
          usageCount: s.usageCount,
          icon:
            (s.frontmatter as any)?.metadata?.moltbot?.emoji ||
            (s.hubEntry as any)?.icon ||
            "📝",
        })),
        total: skills.length,
        message: `Found ${skills.length} installed skill(s).`,
      };
    }

    case "list_hub": {
      const category = params.category as string | undefined;
      const search = params.search as string | undefined;

      const catalog = await skillManager.getHubCatalog(
        category as any,
        search,
      );

      return {
        action: "list_hub",
        success: true,
        skills: catalog.map((s: any) => ({
          slug: s.slug,
          name: s.name,
          description: s.description,
          category: s.category,
          author: s.author,
          icon: s.icon,
          tags: s.tags,
          installs: s.installs,
        })),
        total: catalog.length,
        message: `Found ${catalog.length} skill(s) in the hub.`,
      };
    }

    case "list_custom": {
      const customSkills = await skillManager.listCustomSkills(userId);

      return {
        action: "list_custom",
        success: true,
        skills: customSkills.map((s: any) => ({
          slug: s.skillSlug,
          name: s.name,
          description: s.description,
          enabled: s.enabled,
          usageCount: s.usageCount,
          icon: (s.frontmatter as any)?.metadata?.moltbot?.emoji || "📝",
          createdAt: s.installedAt,
          updatedAt: s.updatedAt,
        })),
        total: customSkills.length,
        message: `Found ${customSkills.length} custom skill(s).`,
      };
    }

    case "get": {
      if (!params.slug) {
        throw new Error(
          "Missing required parameter: 'slug' - specify which skill to get",
        );
      }

      const skill = await skillManager.getInstalledSkill(userId, params.slug);

      if (!skill) {
        const hubSkill = await skillManager.getHubSkill(params.slug);
        if (!hubSkill) {
          throw new Error(`Skill '${params.slug}' not found.`);
        }

        return {
          action: "get",
          success: true,
          installed: false,
          skill: {
            slug: hubSkill.slug,
            name: hubSkill.name,
            description: hubSkill.description,
            category: hubSkill.category,
            author: hubSkill.author,
            icon: hubSkill.icon,
            tags: hubSkill.tags,
            sourceType: hubSkill.sourceType,
          },
          message: `Skill '${params.slug}' found in hub (not installed).`,
        };
      }

      const body = await skillManager.getSkillBody(userId, params.slug);

      return {
        action: "get",
        success: true,
        installed: true,
        skill: {
          slug: skill.skillSlug,
          name: skill.name,
          description: skill.description,
          enabled: skill.enabled,
          isCustom: !skill.hubEntryId,
          priority: skill.priority,
          usageCount: skill.usageCount,
          icon: (skill.frontmatter as any)?.metadata?.moltbot?.emoji || "📝",
          instructions: body,
        },
        message: `Successfully retrieved skill '${params.slug}'.`,
      };
    }

    case "install": {
      if (!params.slug) {
        throw new Error(
          "Missing required parameter: 'slug' - specify which skill to install from the hub",
        );
      }

      const existing = await skillManager.getInstalledSkill(
        userId,
        params.slug,
      );
      if (existing) {
        return {
          action: "install",
          success: false,
          error: `Skill '${params.slug}' is already installed.`,
          skill: {
            slug: existing.skillSlug,
            name: existing.name,
            enabled: existing.enabled,
          },
        };
      }

      const installed = await skillManager.installSkill(
        userId,
        params.slug,
        params.config,
      );

      return {
        action: "install",
        success: true,
        skill: {
          slug: installed.skillSlug,
          name: installed.name,
          description: installed.description,
          enabled: installed.enabled,
        },
        message: `Successfully installed skill '${params.slug}'.`,
      };
    }

    case "uninstall": {
      if (!params.slug) {
        throw new Error(
          "Missing required parameter: 'slug' - specify which skill to uninstall",
        );
      }

      await skillManager.uninstallSkill(userId, params.slug);

      return {
        action: "uninstall",
        success: true,
        slug: params.slug,
        message: `Successfully uninstalled skill '${params.slug}'.`,
      };
    }

    case "toggle": {
      if (!params.slug) {
        throw new Error(
          "Missing required parameter: 'slug' - specify which skill to toggle",
        );
      }
      if (params.enabled === undefined) {
        throw new Error(
          "Missing required parameter: 'enabled' - specify true or false",
        );
      }

      const toggled = await skillManager.toggleSkill(
        userId,
        params.slug,
        params.enabled,
      );

      return {
        action: "toggle",
        success: true,
        skill: {
          slug: toggled.skillSlug,
          name: toggled.name,
          enabled: toggled.enabled,
        },
        message: `Skill '${params.slug}' is now ${toggled.enabled ? "enabled" : "disabled"}.`,
      };
    }

    case "create": {
      if (!params.slug) {
        throw new Error(
          "Missing required parameter: 'slug' - unique identifier for the skill (lowercase, alphanumeric, dashes only)",
        );
      }
      if (!params.name) {
        throw new Error(
          "Missing required parameter: 'name' - human-readable name for the skill",
        );
      }
      if (!params.description) {
        throw new Error(
          "Missing required parameter: 'description' - brief description of what the skill does",
        );
      }
      if (!params.instructions) {
        throw new Error(
          "Missing required parameter: 'instructions' - markdown instructions for how to use the skill",
        );
      }

      const created = await skillManager.createCustomSkill(userId, {
        slug: params.slug,
        name: params.name,
        description: params.description,
        instructions: params.instructions,
        category: params.category as any,
        tags: params.tags,
        icon: params.icon,
      });

      return {
        action: "create",
        success: true,
        skill: {
          slug: created.skillSlug,
          name: created.name,
          description: created.description,
          enabled: created.enabled,
          icon:
            (created.frontmatter as any)?.metadata?.moltbot?.emoji || "📝",
        },
        message: `Successfully created custom skill '${params.slug}'. It is now enabled and ready to use.`,
      };
    }

    case "update": {
      if (!params.slug) {
        throw new Error(
          "Missing required parameter: 'slug' - specify which custom skill to update",
        );
      }

      const isCustom = await skillManager.isCustomSkill(userId, params.slug);
      if (!isCustom) {
        throw new Error(
          `Cannot update '${params.slug}' - only custom skills can be updated. Use 'uninstall' and 'install' for hub skills.`,
        );
      }

      const updated = await skillManager.updateCustomSkill(
        userId,
        params.slug,
        {
          name: params.name,
          description: params.description,
          instructions: params.instructions,
          category: params.category as any,
          tags: params.tags,
          icon: params.icon,
          enabled: params.enabled,
        },
      );

      return {
        action: "update",
        success: true,
        skill: {
          slug: updated.skillSlug,
          name: updated.name,
          description: updated.description,
          enabled: updated.enabled,
          icon:
            (updated.frontmatter as any)?.metadata?.moltbot?.emoji || "📝",
        },
        message: `Successfully updated custom skill '${params.slug}'.`,
      };
    }

    case "delete": {
      if (!params.slug) {
        throw new Error(
          "Missing required parameter: 'slug' - specify which custom skill to delete",
        );
      }

      const isCustom = await skillManager.isCustomSkill(userId, params.slug);
      if (!isCustom) {
        throw new Error(
          `Cannot delete '${params.slug}' - only custom skills can be deleted. Use 'uninstall' for hub skills.`,
        );
      }

      await skillManager.deleteCustomSkill(userId, params.slug);

      return {
        action: "delete",
        success: true,
        slug: params.slug,
        message: `Successfully deleted custom skill '${params.slug}'.`,
      };
    }

    default:
      throw new Error(
        `Unknown skills_management action: ${action}. Valid actions: list_installed, list_hub, list_custom, get, install, uninstall, toggle, create, update, delete`,
      );
  }
}

export const SKILLS_MANAGEMENT_TOOL_SCHEMA = {
  name: "skills_management",
  description:
    "Manage skills - list, install, create, update, and delete skills. Skills are reusable instruction sets that guide how to accomplish specific tasks. Use 'list_installed' to see what skills the user has. Use 'create' to make new custom skills for recurring workflows. Custom skills can be updated/deleted; hub skills can only be installed/uninstalled.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "list_installed",
          "list_hub",
          "list_custom",
          "get",
          "install",
          "uninstall",
          "toggle",
          "create",
          "update",
          "delete",
        ],
        description:
          "'list_installed': show user's installed skills. 'list_hub': browse skills in the hub. 'list_custom': show only user-created custom skills. 'get': get full details of a skill including instructions. 'install': install a skill from the hub. 'uninstall': remove an installed skill. 'toggle': enable/disable a skill. 'create': create a new custom skill (requires slug, name, description, instructions). 'update': modify a custom skill. 'delete': permanently remove a custom skill.",
      },
      slug: {
        type: "string",
        description:
          "Skill identifier. For 'create': must be lowercase with only letters, numbers, dashes. For other actions: the slug of the target skill.",
      },
      name: {
        type: "string",
        description:
          "Human-readable skill name (for 'create' and 'update'). Example: 'Daily Standup Assistant'",
      },
      description: {
        type: "string",
        description:
          "Brief description of what the skill does (for 'create' and 'update'). Example: 'Help prepare and run daily standup meetings with automated notes'",
      },
      instructions: {
        type: "string",
        description:
          "Markdown instructions for the skill (for 'create' and 'update'). This is what the AI reads when the skill is activated. Include step-by-step workflows, which tools to use, and any important guidelines. Can include headers, lists, code blocks.",
      },
      icon: {
        type: "string",
        description:
          "Emoji icon for the skill (for 'create' and 'update'). Example: '📅', '🎯', '💡'",
      },
      category: {
        type: "string",
        enum: [
          "PRODUCTIVITY",
          "DEVELOPMENT",
          "WRITING",
          "RESEARCH",
          "AUTOMATION",
          "ANALYSIS",
          "COMMUNICATION",
          "CREATIVITY",
          "HEALTH",
          "FINANCE",
          "LEARNING",
          "OTHER",
        ],
        description:
          "Skill category (for 'create', 'update', and 'list_hub' filter)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Tags for categorizing the skill (for 'create' and 'update'). Example: ['meetings', 'agile', 'notes']",
      },
      enabled: {
        type: "boolean",
        description:
          "For 'toggle': true to enable, false to disable. For 'update': new enabled state.",
      },
      enabled_only: {
        type: "boolean",
        description:
          "For 'list_installed': if true, only show enabled skills (default: false)",
      },
      search: {
        type: "string",
        description:
          "For 'list_hub': search query to filter skills by name, description, or tags",
      },
      config: {
        type: "object",
        description: "For 'install': optional configuration to pass to the skill",
      },
    },
    required: ["action"],
  },
};
