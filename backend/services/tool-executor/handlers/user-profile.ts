import { UserProfile, userProfileService } from "../../user-profile.js";

export async function executeUserProfileAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  console.log(
    `[ToolExecutor] [executeUserProfileAction] START: userId=${userId}, action=${action}`,
  );
  console.log(
    `[ToolExecutor] [executeUserProfileAction] Received params:`,
    JSON.stringify(params).substring(0, 200),
  );

  try {
    switch (action) {
      case "get":
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Executing GET action`,
        );
        const profile = await userProfileService.getUserProfile(userId);
        console.log(
          `[ToolExecutor] [executeUserProfileAction] GET returned profile with keys: ${Object.keys(profile).join(", ") || "empty"}`,
        );
        return {
          action: "get",
          profile,
          isEmpty: Object.keys(profile).length === 0,
        };

      case "update": {
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Executing UPDATE action`,
        );
        const updates: Partial<UserProfile> = {};
        const allowedFields = [
          "name",
          "firstName",
          "lastName",
          "nickname",
          "age",
          "birthdate",
          "location",
          "timezone",
          "language",
          "occupation",
          "company",
          "industry",
          "skills",
          "workStyle",
          "communicationStyle",
          "preferredName",
          "interests",
          "hobbies",
          "currentGoals",
          "longTermGoals",
          "relationships",
          "dietaryPreferences",
          "exerciseHabits",
          "sleepSchedule",
          "custom",
        ];
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Allowed fields: ${allowedFields.join(", ")}`,
        );
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Param keys received: ${Object.keys(params).join(", ")}`,
        );
        for (const field of allowedFields) {
          if (params[field] !== undefined) {
            console.log(
              `[ToolExecutor] [executeUserProfileAction] Mapping param '${field}' = ${JSON.stringify(params[field])}`,
            );
            (updates as any)[field] = params[field];
          }
        }
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Total fields to update: ${Object.keys(updates).length}`,
        );
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Update object keys: ${Object.keys(updates).join(", ") || "empty"}`,
        );
        if (Object.keys(updates).length === 0) {
          console.error(
            `[ToolExecutor] [executeUserProfileAction] ERROR: No valid profile fields in params`,
          );
          throw new Error(
            "At least one profile field must be provided for update",
          );
        }
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Calling userProfileService.mergeUserProfile with userId=${userId}`,
        );
        const updatedProfile = await userProfileService.mergeUserProfile(
          userId,
          updates,
        );
        console.log(
          `[ToolExecutor] [executeUserProfileAction] mergeUserProfile returned successfully`,
        );
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Updated profile keys: ${Object.keys(updatedProfile).join(", ") || "empty"}`,
        );
        return {
          action: "update",
          updatedFields: Object.keys(updates),
          profile: updatedProfile,
          message: `Profile updated successfully with fields: ${Object.keys(updates).join(", ")}`,
        };
      }

      case "delete_fields":
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Executing DELETE_FIELDS action`,
        );
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Fields to delete: ${JSON.stringify(params.fields)}`,
        );
        if (!params.fields || !Array.isArray(params.fields)) {
          console.error(
            `[ToolExecutor] [executeUserProfileAction] ERROR: fields array is required for delete_fields`,
          );
          throw new Error("fields array is required for delete_fields");
        }
        console.log(
          `[ToolExecutor] [executeUserProfileAction] Calling userProfileService.deleteProfileFields`,
        );
        const updatedProfile = await userProfileService.deleteProfileFields(
          userId,
          params.fields as (keyof UserProfile)[],
        );
        console.log(
          `[ToolExecutor] [executeUserProfileAction] deleteProfileFields returned successfully`,
        );
        return {
          action: "delete_fields",
          deletedFields: params.fields,
          profile: updatedProfile,
          message: `Fields deleted: ${params.fields.join(", ")}`,
        };

      default:
        console.error(
          `[ToolExecutor] [executeUserProfileAction] ERROR: Unknown action: ${action}`,
        );
        throw new Error(`Unknown user_profile action: ${action}`);
    }
  } catch (error: any) {
    console.error(
      `[ToolExecutor] [executeUserProfileAction] CAUGHT ERROR:`,
      error.message,
    );
    console.error(
      `[ToolExecutor] [executeUserProfileAction] Error stack:`,
      error.stack,
    );
    throw error;
  }
}

export const USER_PROFILE_TOOL_SCHEMA = {
  name: "user_profile",
  description:
    "Manage the user's permanent profile - store important information about them (name, job, location, goals, etc.). This data is ALWAYS available to you without memory search. IMPORTANT: When the user shares personal information, IMMEDIATELY use this tool to save it. Array fields (skills, interests, hobbies, goals, relationships) are MERGED with existing data. To REPLACE an array entirely, use 'delete_fields' first then 'update'.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get", "update", "delete_fields"],
        description:
          "'get': retrieve current profile. 'update': add/modify fields (arrays are MERGED). 'delete_fields': remove specific fields (use to clear arrays before replacing).",
      },
      name: {
        type: "string",
        description: "User's full name",
      },
      firstName: {
        type: "string",
        description: "User's first name",
      },
      lastName: {
        type: "string",
        description: "User's last name",
      },
      nickname: {
        type: "string",
        description: "User's nickname",
      },
      preferredName: {
        type: "string",
        description: "How the user wants to be addressed",
      },
      age: {
        type: "number",
        description: "User's age",
      },
      birthdate: {
        type: "string",
        description: "User's birthdate (ISO format, e.g., '1990-05-15')",
      },
      location: {
        type: "string",
        description: "User's location (city, country)",
      },
      timezone: {
        type: "string",
        description:
          "User's timezone (e.g., 'Europe/Paris', 'America/New_York')",
      },
      language: {
        type: "string",
        description: "User's preferred language",
      },
      occupation: {
        type: "string",
        description: "User's job/occupation",
      },
      company: {
        type: "string",
        description: "User's company/employer",
      },
      industry: {
        type: "string",
        description: "User's industry",
      },
      skills: {
        type: "array",
        items: { type: "string" },
        description:
          "User's skills - MERGED with existing (to replace, delete_fields first)",
      },
      workStyle: {
        type: "string",
        description: "User's work style preferences",
      },
      communicationStyle: {
        type: "string",
        description:
          "How user prefers AI to communicate (e.g., 'concise', 'detailed', 'casual', 'formal')",
      },
      interests: {
        type: "array",
        items: { type: "string" },
        description: "User's interests - MERGED with existing",
      },
      hobbies: {
        type: "array",
        items: { type: "string" },
        description: "User's hobbies - MERGED with existing",
      },
      currentGoals: {
        type: "array",
        items: { type: "string" },
        description:
          "User's current goals - MERGED with existing (duplicates auto-ignored)",
      },
      longTermGoals: {
        type: "array",
        items: { type: "string" },
        description: "User's long-term goals - MERGED with existing",
      },
      relationships: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Person's name" },
            relation: {
              type: "string",
              description:
                "Relationship type (e.g., 'wife', 'colleague', 'friend', 'boss')",
            },
            notes: {
              type: "string",
              description: "Additional notes about this person",
            },
          },
          required: ["name", "relation"],
        },
        description:
          "Important people in user's life - MERGED by name (existing person updated, new person added)",
      },
      dietaryPreferences: {
        type: "string",
        description:
          "User's dietary preferences/restrictions (e.g., 'vegetarian', 'no gluten')",
      },
      exerciseHabits: {
        type: "string",
        description: "User's exercise habits",
      },
      sleepSchedule: {
        type: "string",
        description: "User's typical sleep schedule",
      },
      custom: {
        type: "object",
        description:
          "Any other important information as key-value pairs (MERGED with existing custom data)",
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description:
          "For 'delete_fields': array of field names to remove (e.g., ['skills', 'hobbies'] to clear those arrays)",
      },
    },
    required: ["action"],
  },
};
