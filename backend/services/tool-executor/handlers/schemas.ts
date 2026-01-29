import { ACHIEVEMENTS_MANAGEMENT_TOOL_SCHEMA } from "./achievements-management.js";
import { BROWSER_TOOL_SCHEMA } from "./browser.js";
import { CODE_EXECUTOR_TOOL_SCHEMA } from "./code-executor.js";
import { CURL_TOOL_SCHEMA } from "./curl.js";
import { GENERATE_TOOL_SCHEMA } from "./generate-tool.js";
import { GOALS_MANAGEMENT_TOOL_SCHEMA } from "./goals-management.js";
import { LONG_RUNNING_TASK_TOOL_SCHEMA } from "./long-running-task.js";
import { NOTIFICATION_TOOL_SCHEMA } from "./notification.js";
import { READ_SKILL_TOOL_SCHEMA } from "./read-skill.js";
import { READ_TOOL_CODE_SCHEMA } from "./read-tool-code.js";
import { SCHEDULED_TASK_TOOL_SCHEMA } from "./scheduled-task.js";
import { SECRETS_TOOL_SCHEMA } from "./secrets.js";
import { SKILLS_MANAGEMENT_TOOL_SCHEMA } from "./skills-management.js";
import { SPAWN_SUBAGENT_TOOL_SCHEMA } from "./subagent.js";
import { TODO_TOOL_SCHEMA } from "./todo.js";
import { USER_CONTEXT_TOOL_SCHEMA } from "./user-context.js";
import { USER_PROFILE_TOOL_SCHEMA } from "./user-profile.js";

export const BUILTIN_TOOL_SCHEMAS = [
  TODO_TOOL_SCHEMA,
  NOTIFICATION_TOOL_SCHEMA,
  SCHEDULED_TASK_TOOL_SCHEMA,
  CURL_TOOL_SCHEMA,
  USER_CONTEXT_TOOL_SCHEMA,
  LONG_RUNNING_TASK_TOOL_SCHEMA,
  USER_PROFILE_TOOL_SCHEMA,
  CODE_EXECUTOR_TOOL_SCHEMA,
  GENERATE_TOOL_SCHEMA,
  SECRETS_TOOL_SCHEMA,
  GOALS_MANAGEMENT_TOOL_SCHEMA,
  ACHIEVEMENTS_MANAGEMENT_TOOL_SCHEMA,
  SPAWN_SUBAGENT_TOOL_SCHEMA,
  READ_TOOL_CODE_SCHEMA,
  BROWSER_TOOL_SCHEMA,
  READ_SKILL_TOOL_SCHEMA,
  SKILLS_MANAGEMENT_TOOL_SCHEMA,
];
