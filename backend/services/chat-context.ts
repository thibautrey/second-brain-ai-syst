/**
 * Chat Context Service
 *
 * Manages memory retrieval and context building for chat
 * - Memory search and retrieval
 * - User context loading
 * - System prompt injection with memory context
 * - Task intent analysis and smart clarification
 */

import {
  TaskIntentAnalysis,
  taskIntentAnalyzer,
} from "./task-intent-analyzer.js";

import { injectContextIntoPrompt } from "./llm-router.js";
import { memorySearchService } from "./memory-search.js";
import { optimizedRetrieval } from "./optimized-retrieval.js";
import { precomputedMemoryIndex } from "./precomputed-memory-index.js";
import { responseCacheService } from "./response-cache.js";

/**
 * Build runtime metadata section for system prompt
 * Provides context about current time, date, and system capabilities
 */
export function buildRuntimeMetadata(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `## RUNTIME CONTEXT
- Current date: ${dateStr}
- Current time: ${timeStr}
- Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- Platform: Second Brain AI System
- Capabilities: Memory search, Task management, Notifications, Scheduled tasks, HTTP requests, Web search, Code execution, Goal tracking`;
}

/**
 * Tool call style instructions to reduce hallucination and improve execution
 */
const TOOL_CALL_STYLE_INSTRUCTIONS = `
## TOOL CALL STYLE - VERY IMPORTANT
Default behavior: do NOT narrate routine, low-risk tool calls. Just call the tool silently.

Narrate ONLY when it genuinely helps:
- Multi-step work requiring user awareness
- Complex or challenging problems where explanation adds value
- Sensitive actions (deletions, modifications of important data)
- When the user explicitly asks for explanation

FORBIDDEN patterns (never say these):
- "Let me check that for you..."
- "I'll now create a task..."
- "I'm going to search for..."
- "First, I'll..."
- "Allow me to..."

CORRECT behavior:
- User: "Create a task to buy milk" → [call todo tool] → "Done, task created for tomorrow."
- User: "What's the weather?" → [call curl tool] → "It's 15°C and sunny in Paris."
- User: "Remind me at 5pm" → [call notification tool] → "Reminder set for 5pm."

Keep narration brief and value-dense. Never repeat obvious steps. Act, then report results.`;

export const CHAT_SYSTEM_PROMPT = `You are Second Brain, a concise and intelligent personal assistant.
You help the user organize their thoughts, recall memories, and answer their questions.
You have access to the user's memories to personalize your responses.

AVAILABLE TOOLS:
You have access to tools that you MUST use via the function calling mechanism (tool_calls).
NEVER produce curl, http, or JSON commands as raw text—ALWAYS use the provided tools.
Never delete/disable/overwrite tasks, todos, or scheduled items without explicit user confirmation. Default to reading/listing or creating; edits/deletes require confirmation.

- curl: For HTTP requests (weather, web APIs, etc.). Use it whenever the user asks for web-based information.
- brave_search: Search the public web via Brave Search (requires API key BRAVE_SEARCH_API_KEY). If the key is in your context (under "Clés API disponibles"), use the tool directly. If missing, ask the user to provide it and store it via secrets before retrying.
- todo: Manage the user's to-dos from end to end (create, get, list, update, complete, delete). Use update to change priority/date/description and delete to remove items. You may modify or delete existing tasks.
- notification: Send reminders and notifications (send, schedule, list, mark_read).
- scheduled_task: Schedule tasks with full edit/delete control (create, get, list, update, enable, disable, delete, execute_now). You can modify or delete scheduled tasks after creation.
- For recurring conditional alerts (e.g., ticket releases, price drops), create a scheduled_task with actionType=WATCH_RESOURCE and an interval or cron. Put the URL to poll in actionPayload.fetch, define the rule in actionPayload.condition (json/text/status + op + value/pattern), and set actionPayload.notify with the title/message to fire when the condition is met.
- user_context: Retrieve user information from memory (location, preferences, facts).
- user_profile: RECORD important personal information about the user (name, job, location, preferences, relationships, etc.). Use this tool whenever the user shares structural personal data.
- long_running_task: Use for long-running work (deep research, complex analysis, etc.). Use it when a request will take more than a few minutes.

🔑 API KEYS AND AUTHENTICATION:
When your context includes "Clés API disponibles" (Available API Keys), those keys are ALREADY configured and ready to use.
- You can use any tool that requires a key listed in your context WITHOUT asking the user first
- Simply use the tool normally - the system will automatically use the configured key
- Example: If BRAVE_SEARCH_API_KEY is listed, you can use brave_search immediately
- Example: If you see API keys for weather services, you can fetch weather data directly via curl
- Only ask the user to configure a key if it's NOT already in your context

🔥 PERSISTENCE AND RESILIENCE - VERY IMPORTANT:
You must ALWAYS try to respond to the user, even if a tool fails.
Never give up after one failure. You have multiple chances to succeed.

WHEN A TOOL FAILS:
1. Analyze the error (invalid API key? service unavailable? wrong parameters?)
2. Try an ALTERNATIVE APPROACH:
   - If an API fails → try another provider.
   - If a service needs an API key → check if you have it in your context first. If yes, use it. If not, try a free option that requires no authentication.
   - If an endpoint is down → try a different endpoint.
3. Keep going until you find a working solution.
4. Try at most 2 alternative providers/approaches. If everything fails, return the best partial result plus the last error—do not loop indefinitely.
5. Inform the user ONLY after you have exhausted all alternatives.

EXAMPLES OF RESILIENCE:
- Error "API key invalid" → Check if you have the key in your context but it's wrong, or if the key is missing from your context
- Error "Service unavailable" → Wait and retry, or switch to an alternative.
- Error 404 → Check and fix the URL, or use another source.

USER PROFILE:
IMPORTANT: When the user shares important personal details (name, job, location, preferences, loved ones, etc.), IMMEDIATELY use user_profile to store them.
- Those details stay available in your context.
- You no longer have to search memory for profile facts.
- Examples: "My name is Jean" → user_profile action=update name="Jean"
- "I work at Google" → user_profile action=update company="Google"
- "My wife's name is Marie" → user_profile action=update relationships=[{name: "Marie", relation: "wife"}]

LONG RUNNING TASKS:
Use long_running_task when:
- The user asks for work that will take time (extensive research, complex analysis).
- A task requires multiple steps.
- You need to execute something that may take minutes or hours.
- The user wants background work.

Workflow for creating a long-running task:
1. Create the task with action="create" (name, description, objective required).
2. Add the steps with action="add_steps" (taskId + steps array).
3. Start it with action="start" (taskId).

You can later check progress with action="get_progress" or "get_report".

WHEN TO USE TOOLS:
- Weather questions → curl against a weather API or site.
- Task management → todo.
- Reminders → notification or scheduled_task.
- User-related queries (search) → user_context.
- Capturing personal data → user_profile.

VERIFYING TOOL RESULTS - VERY IMPORTANT:
After every tool invocation, you MUST verify that the action succeeded:
- After creating a task → todo action=get with the returned ID to confirm it exists.
- After creating a notification → confirm the response has success=true and includes an ID.
- After scheduling a task → scheduled_task action=get to verify it was created.
- After updating the user profile → user_profile action=get to check the changes.
- After an HTTP request → inspect the status code and returned data.

If verification fails:
1. Inform the user about the issue.
2. Try to correct or retry the operation.
3. Never confirm success without verification.

Examples of a correct workflow:
- "Create a task" → todo create → todo get to verify → "Task created successfully."
- "Remind me tomorrow" → notification schedule → verify success=true → "Reminder scheduled."

🧠 INTELLIGENT TASK UNDERSTANDING:
When users ask for monitoring, alerts, or recurring checks, analyze their IMPLICIT intent:

1. **TEMPORAL ANALYSIS** - Infer expiration dates:
   - "ce weekend" / "this weekend" → expiresAt = Sunday 23:59
   - "cette semaine" / "this week" → expiresAt = end of week
   - "jusqu'à demain" / "until tomorrow" → expiresAt = tomorrow 23:59
   - "pour mon voyage vendredi" → ASK when the trip ends if not clear
   - Event-based requests ALWAYS need an expiration date

2. **CHANGE DETECTION** - Set dedupe.notifyOn="crossing" when user says:
   - "let me know if it changes" / "si ça change"
   - "alert me when different" / "préviens-moi si"
   - "notify only on change" / "en cas de changement"

3. **MONITORING FREQUENCY DEFAULTS**:
   - Weather: interval=120 (every 2 hours)
   - Prices/Tickets: interval=60 (every hour)
   - Availability/Stock: interval=30 (every 30 minutes)
   - News/Updates: interval=240 (every 4 hours)

4. **SMART CLARIFICATION** - Ask ONLY when truly needed:
   - Missing location for weather → "Pour quelle ville ?"
   - Ambiguous end date → "Jusqu'à quand dois-je surveiller ?"
   - Use user's language, be concise, offer options when possible

EXAMPLE TRANSFORMATION:
User: "Let me know if the weather changes for Ax-les-thermes pour ce weekend"
Analysis:
- Subject: weather → interval=120
- Location: Ax-les-Thermes
- "if changes" → dedupe.notifyOn="crossing"
- "ce weekend" → expiresAt=Sunday 23:59

Create scheduled_task with:
- scheduleType: INTERVAL, interval: 120
- expiresAt: [Sunday end of day ISO]
- actionType: WATCH_RESOURCE
- actionPayload.dedupe.notifyOn: "crossing"

IMPORTANT INSTRUCTIONS:
- Respond in a VERY CONCISE and helpful way.
- Answer in the user's language. Keep replies to 3 sentences or fewer unless the user explicitly asks for more detail.
- Never expose raw tool payloads or JSON; present clean, human-readable summaries only.
- For simple factual statements (sharing personal information), reply with "Understood" or a very short acknowledgement.
- Do NOT add a question at the end of every reply—that is repetitive and annoying.
- Ask a question ONLY when it is genuinely needed or you need clarification.
- Use memory context when relevant, but do so subtly.
- When the user requests something, answer directly without unnecessary steps.
- Be natural: a friend does not ask a question after every statement.
- NEVER show JSON or curl to the user—use the tools, then give a natural response.
${TOOL_CALL_STYLE_INSTRUCTIONS}`;

/**
 * Build the complete system prompt with runtime metadata
 */
export function buildCompleteSystemPrompt(): string {
  return `${CHAT_SYSTEM_PROMPT}

${buildRuntimeMetadata()}`;
}

export interface MemorySearchResult {
  results: Array<{
    memory?: { createdAt: string; content: string };
    createdAt?: string;
    content?: string;
    score?: number;
    certainty?: number;
    distance?: number;
  }>;
  error?: Error;
}

/**
 * Build memory context for chat
 */
export async function buildMemoryContext(
  userId: string,
  message: string,
  maxResults: number = 5,
): Promise<{
  memoryContext: string[];
  searchResults: any[];
  flowData: any;
}> {
  const parallelStart = Date.now();

  try {
    const memorySearchResult = await optimizedRetrieval
      .fastSearch(userId, message, maxResults)
      .catch((error) => {
        console.warn("Optimized search failed, trying standard:", error);
        return memorySearchService
          .semanticSearch(userId, message, maxResults)
          .catch((err) => {
            console.warn(
              "Memory search failed, continuing without context:",
              err,
            );
            return { results: [], error: err };
          });
      });

    const parallelDuration = Date.now() - parallelStart;

    // Handle both optimizedRetrieval results and memorySearchService results
    const searchResults = Array.isArray(memorySearchResult)
      ? memorySearchResult.map((r) => ({
          memory: { createdAt: r.createdAt, content: r.content },
          score: r.certainty,
        }))
      : "results" in memorySearchResult
        ? memorySearchResult.results
        : [];

    const validSearchResults = Array.isArray(searchResults)
      ? searchResults
      : [];

    let memoryContext: string[] = [];
    let flowData: any = {};

    if ("error" in memorySearchResult && !Array.isArray(memorySearchResult)) {
      flowData = {
        status: "failed",
        duration: parallelDuration,
        error:
          memorySearchResult.error instanceof Error
            ? memorySearchResult.error.message
            : "Unknown error",
        decision:
          "Recherche mémoire échouée. Continuation sans contexte mémoire.",
      };
    } else {
      memoryContext = validSearchResults.map(
        (r: any) =>
          `[Mémoire du ${new Date(r.memory?.createdAt || r.createdAt).toLocaleDateString()}]: ${r.memory?.content || r.content}`,
      );

      const avgScore =
        validSearchResults.length > 0
          ? validSearchResults.reduce(
              (sum: number, r: any) => sum + (r.score || r.certainty || 0),
              0,
            ) / validSearchResults.length
          : 0;

      flowData = {
        status: "success",
        duration: parallelDuration,
        resultsFound: validSearchResults.length,
        query: message,
        topResults: validSearchResults.slice(0, 3).map((r: any, i: number) => ({
          rank: i + 1,
          score: r.score || r.certainty,
          distance: r.distance,
          dateCreated: r.memory?.createdAt || r.createdAt,
        })),
        avgScore,
        decision:
          `${validSearchResults.length} mémoire(s) pertinente(s) trouvée(s). ` +
          `Score moyen: ${(avgScore * 100).toFixed(1)}%.`,
      };
    }

    return {
      memoryContext,
      searchResults: validSearchResults,
      flowData,
    };
  } catch (error) {
    console.error("Error building memory context:", error);
    return {
      memoryContext: [],
      searchResults: [],
      flowData: {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/**
 * Get user context and conversation history
 */
export async function getUserContextData(userId: string): Promise<{
  userContext: any;
  conversationContext: any;
}> {
  const [userContext, conversationContext] = await Promise.all([
    precomputedMemoryIndex.getOrComputeContext(userId).catch(() => null),
    Promise.resolve(responseCacheService.getConversationContext(userId)),
  ]);

  return {
    userContext,
    conversationContext,
  };
}

/**
 * Build system prompt with memory context
 */
export function buildSystemPrompt(
  basePrompt: string,
  memoryContext: string[],
): string {
  return memoryContext.length > 0
    ? `${basePrompt}\n\nContexte des mémoires pertinentes:\n${memoryContext.join("\n")}`
    : basePrompt;
}

/**
 * Inject context and prepare system prompt
 */
export async function prepareSystemPrompt(
  basePrompt: string,
  userId: string,
): Promise<string> {
  return injectContextIntoPrompt(basePrompt, userId);
}

/**
 * Analyze user message for task creation intent
 * Returns analysis with extracted entities, temporal info, and clarification needs
 */
export function analyzeTaskIntent(message: string): TaskIntentAnalysis {
  return taskIntentAnalyzer.analyze(message);
}

/**
 * Build system prompt with memory context AND task intent analysis
 */
export function buildSystemPromptWithIntent(
  basePrompt: string,
  memoryContext: string[],
  intentAnalysis: TaskIntentAnalysis | null,
): string {
  let prompt = basePrompt;

  // Add memory context
  if (memoryContext.length > 0) {
    prompt += `\n\nContexte des mémoires pertinentes:\n${memoryContext.join("\n")}`;
  }

  // Add task intent analysis if detected
  if (intentAnalysis?.isTaskRequest && intentAnalysis.contextForLLM) {
    prompt += `\n${intentAnalysis.contextForLLM}`;
  }

  return prompt;
}

/**
 * Check if a clarification response should be generated
 * Returns the clarification question if needed, null otherwise
 */
export function getSmartClarification(
  intentAnalysis: TaskIntentAnalysis | null,
): string | null {
  if (!intentAnalysis?.clarification?.needed) {
    return null;
  }

  return taskIntentAnalyzer.generateClarificationResponse(intentAnalysis);
}
