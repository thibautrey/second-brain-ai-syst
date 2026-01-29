import { memorySearchService } from "../../memory-search.js";

export async function executeUserContextAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "get_location": {
      const queries = [
        "location address city country where I live",
        "I live in based in located in",
        "home address residence city country",
      ];

      let allResults: any[] = [];
      for (const query of queries) {
        const result = await memorySearchService.semanticSearch(
          userId,
          query,
          2,
        );
        allResults.push(...result.results);
      }

      const seen = new Set();
      const uniqueResults = allResults
        .filter((r) => {
          if (seen.has(r.memory.id)) return false;
          seen.add(r.memory.id);
          return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return {
        action: "get_location",
        found: uniqueResults.length > 0,
        results: uniqueResults.map((r) => ({
          content: r.memory.content,
          score: r.score,
          date: r.memory.createdAt,
        })),
        hint:
          uniqueResults.length === 0
            ? "No location found in memories. Ask the user or check user_profile tool."
            : undefined,
      };
    }

    case "get_preferences": {
      const baseQuery = params.topic
        ? `preferences about ${params.topic} likes ${params.topic} favorite ${params.topic}`
        : "preferences likes dislikes favorite prefer";
      const result = await memorySearchService.semanticSearch(
        userId,
        baseQuery,
        params.limit || 5,
      );
      return {
        action: "get_preferences",
        topic: params.topic || "general",
        found: result.results.length > 0,
        results: result.results.map((r) => ({
          content: r.memory.content,
          score: r.score,
          date: r.memory.createdAt,
        })),
      };
    }

    case "search_facts": {
      if (!params.query) {
        throw new Error(
          "Missing required parameter 'query' for search_facts action. " +
            "Provide a descriptive query about what you want to find (e.g., 'job occupation work', 'family members wife husband').",
        );
      }
      const result = await memorySearchService.semanticSearch(
        userId,
        params.query,
        params.limit || 5,
      );
      return {
        action: "search_facts",
        query: params.query,
        found: result.results.length > 0,
        resultsCount: result.results.length,
        results: result.results.map((r) => ({
          content: r.memory.content,
          score: r.score,
          date: r.memory.createdAt,
        })),
      };
    }

  default:
      throw new Error(
        `Unknown user_context action: ${action}. Valid actions are: get_location, get_preferences, search_facts`,
      );
  }
}

export const USER_CONTEXT_TOOL_SCHEMA = {
  name: "user_context",
  description:
    "Retrieve user context information from memory - location, preferences, and facts about the user. Use this to understand user's location, preferences, or search for specific information about them.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get_location", "get_preferences", "search_facts"],
        description:
          "The action to perform - get_location: retrieve user's location info, get_preferences: get user preferences (optionally on a topic), search_facts: search for specific facts",
      },
      topic: {
        type: "string",
        description:
          "Topic for preferences (optional, used with get_preferences action)",
      },
      query: {
        type: "string",
        description:
          "Search query for facts (required for search_facts action)",
      },
      limit: {
        type: "number",
        description:
          "Number of results to return (optional, default: 5, used with search_facts)",
      },
    },
    required: ["action"],
  },
};
