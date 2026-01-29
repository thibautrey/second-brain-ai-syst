import { achievementsService } from "../../achievements.service.js";

export async function executeAchievementsManagementAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "create": {
      if (!params.title || !params.description) {
        throw new Error(
          "Missing required parameters: 'title' and 'description'",
        );
      }

      const achievement = await achievementsService.createAchievement(
        userId,
        {
          title: params.title,
          description: params.description,
          category: params.category || "personal_growth",
          icon: params.icon,
          significance: params.significance || "normal",
          criteria: params.criteria || {},
          isHidden: params.is_hidden !== false,
          metadata: params.metadata || {},
        },
      );

      return {
        action: "create",
        success: true,
        achievement,
        message: `Achievement '${params.title}' created successfully`,
      };
    }

    case "update": {
      if (!params.achievement_id) {
        throw new Error("Missing required parameter: 'achievement_id'");
      }

      const updateData: any = {};
      if (params.title) updateData.title = params.title;
      if (params.description) updateData.description = params.description;
      if (params.category) updateData.category = params.category;
      if (params.icon !== undefined) updateData.icon = params.icon;
      if (params.significance) updateData.significance = params.significance;
      if (params.criteria) updateData.criteria = params.criteria;
      if (params.is_hidden !== undefined)
        updateData.isHidden = params.is_hidden;
      if (params.metadata) updateData.metadata = params.metadata;

      const achievement = await achievementsService.updateAchievement(
        params.achievement_id,
        userId,
        updateData,
      );

      return {
        action: "update",
        success: true,
        achievement,
        message: "Achievement updated successfully",
      };
    }

    case "list": {
      const options: any = {};
      if (params.filter_category) options.category = params.filter_category;
      if (params.unlocked_only) options.unlockedOnly = params.unlocked_only;
      if (params.include_hidden)
        options.includeHidden = params.include_hidden;

      const achievements = await achievementsService.getUserAchievements(
        userId,
        options,
      );

      return {
        action: "list",
        achievements,
        count: achievements.length,
        filters: options,
      };
    }

    case "get": {
      if (!params.achievement_id) {
        throw new Error(
          "Missing required parameter: 'achievement_id'",
        );
      }

      const achievement = await achievementsService.getAchievement(
        params.achievement_id,
        userId,
      );

      if (!achievement) {
        return {
          action: "get",
          success: false,
          error: "Achievement not found",
        };
      }

      return {
        action: "get",
        success: true,
        achievement,
      };
    }

    case "delete": {
      if (!params.achievement_id) {
        throw new Error(
          "Missing required parameter: 'achievement_id'",
        );
      }

      const deleted = await achievementsService.deleteAchievement(
        params.achievement_id,
        userId,
      );

      return {
        action: "delete",
        success: deleted,
        message: deleted
          ? "Achievement deleted successfully"
          : "Achievement not found",
      };
    }

    case "unlock": {
      if (!params.achievement_id) {
        throw new Error(
          "Missing required parameter: 'achievement_id'",
        );
      }

      const achievement = await achievementsService.unlockAchievement(
        params.achievement_id,
        userId,
      );

      return {
        action: "unlock",
        success: true,
        achievement,
        message: `Achievement '${achievement.title}' unlocked! 🎉`,
      };
    }

    case "get_stats": {
      const stats = await achievementsService.getStats(userId);

      return {
        action: "get_stats",
        success: true,
        stats,
      };
    }

    case "get_categories": {
      const categories = await achievementsService.getCategories(userId);

      return {
        action: "get_categories",
        success: true,
        categories,
      };
    }

    default:
      throw new Error(
        `Unknown achievements_management action: ${action}`,
      );
  }
}

export const ACHIEVEMENTS_MANAGEMENT_TOOL_SCHEMA = {
  name: "achievements_management",
  description:
    "Create, unlock, and manage user achievements. Track accomplishments, celebrate milestones, and organize achievements by category. Use for achievement creation, unlocking, progress tracking, and celebration.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "create",
          "update",
          "list",
          "get",
          "delete",
          "unlock",
          "get_stats",
          "get_categories",
        ],
        description:
          "'create': new achievement. 'update': modify existing achievement. 'list': get all achievements (with filters). 'get': get specific achievement. 'delete': remove achievement. 'unlock': unlock achievement for user. 'get_stats': achievement statistics. 'get_categories': available categories.",
      },
      achievement_id: {
        type: "string",
        description:
          "Achievement ID (required for update, get, delete, unlock)",
      },
      title: {
        type: "string",
        description:
          "Achievement title (required for create, optional for update)",
      },
      description: {
        type: "string",
        description:
          "Achievement description (required for create, optional for update)",
      },
      category: {
        type: "string",
        description:
          "Achievement category (e.g., 'consistency', 'milestone', 'personal_growth', 'skill_mastery', 'social', 'health')",
      },
      icon: {
        type: "string",
        description:
          "Achievement icon (emoji or icon identifier, optional)",
      },
      significance: {
        type: "string",
        enum: ["minor", "normal", "major", "milestone"],
        description: "Achievement significance level (default: normal)",
      },
      criteria: {
        type: "object",
        description:
          "Achievement criteria (flexible JSON object describing unlock conditions)",
      },
      is_hidden: {
        type: "boolean",
        description:
          "Whether achievement is hidden until unlocked (default true for create)",
      },
      filter_category: {
        type: "string",
        description: "Filter by category (for list)",
      },
      unlocked_only: {
        type: "boolean",
        description:
          "Show only unlocked achievements (for list, default false)",
      },
      include_hidden: {
        type: "boolean",
        description:
          "Include hidden achievements (for list, default false)",
      },
    },
    required: ["action"],
  },
};
