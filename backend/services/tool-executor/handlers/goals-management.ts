import { GoalStatus } from "@prisma/client";
import { goalsService } from "../../goals.service.js";

export async function executeGoalsManagementAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "create": {
      if (!params.title) {
        throw new Error("Missing required parameter: 'title'");
      }

      const goal = await goalsService.createGoal(userId, {
        title: params.title,
        description: params.description,
        category: params.category || "personal_growth",
        targetDate: params.target_date
          ? new Date(params.target_date)
          : undefined,
        tags: params.tags || [],
        metadata: params.metadata || {},
      });

      return {
        action: "create",
        success: true,
        goal,
        message: `Goal '${params.title}' created successfully`,
      };
    }

    case "update": {
      if (!params.goal_id) {
        throw new Error("Missing required parameter: 'goal_id'");
      }

      const updateData: any = {};
      if (params.title) updateData.title = params.title;
      if (params.description !== undefined)
        updateData.description = params.description;
      if (params.category) updateData.category = params.category;
      if (params.status) updateData.status = params.status as GoalStatus;
      if (params.progress !== undefined) updateData.progress = params.progress;
      if (params.target_date)
        updateData.targetDate = new Date(params.target_date);
      if (params.tags) updateData.tags = params.tags;
      if (params.metadata) updateData.metadata = params.metadata;

      const goal = await goalsService.updateGoal(
        params.goal_id,
        userId,
        updateData,
      );

      return {
        action: "update",
        success: true,
        goal,
        message: "Goal updated successfully",
      };
    }

    case "list": {
      const options: any = {};
      if (params.filter_status)
        options.status = params.filter_status as GoalStatus;
      if (params.filter_category) options.category = params.filter_category;
      if (params.include_archived) options.includeArchived = params.include_archived;

      const goals = await goalsService.getUserGoals(userId, options);

      return {
        action: "list",
        goals,
        count: goals.length,
        filters: options,
      };
    }

    case "get": {
      if (!params.goal_id) {
        throw new Error("Missing required parameter: 'goal_id'");
      }

      const goal = await goalsService.getGoal(params.goal_id, userId);

      if (!goal) {
        return {
          action: "get",
          success: false,
          error: "Goal not found",
        };
      }

      return {
        action: "get",
        success: true,
        goal,
      };
    }

    case "delete": {
      if (!params.goal_id) {
        throw new Error("Missing required parameter: 'goal_id'");
      }

      const deleted = await goalsService.deleteGoal(params.goal_id, userId);

      return {
        action: "delete",
        success: deleted,
        message: deleted ? "Goal deleted successfully" : "Goal not found",
      };
    }

    case "update_progress": {
      if (!params.goal_id || params.progress === undefined) {
        throw new Error(
          "Missing required parameters: 'goal_id' and 'progress'",
        );
      }

      const goal = await goalsService.updateGoal(params.goal_id, userId, {
        progress: Math.max(0, Math.min(100, params.progress)),
      });

      return {
        action: "update_progress",
        success: true,
        goal,
        message: `Goal progress updated to ${params.progress}%`,
      };
    }

    case "add_milestone": {
      if (!params.goal_id || !params.milestone_name) {
        throw new Error(
          "Missing required parameters: 'goal_id' and 'milestone_name'",
        );
      }

      const milestone = {
        name: params.milestone_name,
        completed: params.milestone_completed || false,
        date: new Date(),
      };

      const goal = await goalsService.addMilestone(
        params.goal_id,
        userId,
        milestone,
      );

      return {
        action: "add_milestone",
        success: true,
        goal,
        milestone,
        message: `Milestone '${params.milestone_name}' added to goal`,
      };
    }

    case "get_stats": {
      const stats = await goalsService.getStats(userId);

      return {
        action: "get_stats",
        success: true,
        stats,
      };
    }

    case "get_categories": {
      const categories = await goalsService.getCategories(userId);

      return {
        action: "get_categories",
        success: true,
        categories,
      };
    }

    default:
      throw new Error(`Unknown goals_management action: ${action}`);
  }
}

export const GOALS_MANAGEMENT_TOOL_SCHEMA = {
  name: "goals_management",
  description:
    "Create, update, track, and manage user goals. Monitor progress, set milestones, update status, and organize goals by category. Use for goal setting, progress tracking, milestone management, and goal lifecycle management.",
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
          "update_progress",
          "add_milestone",
          "get_stats",
          "get_categories",
        ],
        description:
          "'create': new goal. 'update': modify existing goal. 'list': get all goals (with filters). 'get': get specific goal. 'delete': remove goal. 'update_progress': set progress percentage. 'add_milestone': add milestone to goal. 'get_stats': goal statistics. 'get_categories': available categories.",
      },
      goal_id: {
        type: "string",
        description:
          "Goal ID (required for update, get, delete, update_progress, add_milestone)",
      },
      title: {
        type: "string",
        description:
          "Goal title (required for create, optional for update)",
      },
      description: {
        type: "string",
        description: "Goal description (optional)",
      },
      category: {
        type: "string",
        description:
          "Goal category (e.g., 'health', 'career', 'learning', 'personal_growth', 'finance', 'relationships')",
      },
      status: {
        type: "string",
        enum: ["ACTIVE", "COMPLETED", "PAUSED", "ARCHIVED", "ABANDONED"],
        description: "Goal status (for update)",
      },
      progress: {
        type: "number",
        description:
          "Progress percentage (0-100, for update_progress or update)",
      },
      target_date: {
        type: "string",
        description:
          "Target completion date (ISO format: YYYY-MM-DD, optional)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Goal tags (optional)",
      },
      milestone_name: {
        type: "string",
        description: "Milestone name (required for add_milestone)",
      },
      milestone_completed: {
        type: "boolean",
        description:
          "Whether milestone is completed (for add_milestone, default false)",
      },
      filter_status: {
        type: "string",
        description: "Filter by status (for list)",
      },
      filter_category: {
        type: "string",
        description: "Filter by category (for list)",
      },
      include_archived: {
        type: "boolean",
        description: "Include archived goals (for list, default false)",
      },
    },
    required: ["action"],
  },
};
