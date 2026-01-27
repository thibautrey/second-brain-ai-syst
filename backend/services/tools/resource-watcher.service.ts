/**
 * Resource Watcher Service
 *
 * Polls an external resource, evaluates a condition, and triggers a notification.
 * Designed to be used as a Scheduled Task action (TaskActionType.WATCH_RESOURCE).
 */

import { NotificationChannel, NotificationType } from "@prisma/client";
import { curlService } from "./curl.service.js";
import { notificationService } from "./notification.service.js";

type FetchSpec = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  parseAs?: "json" | "text";
};

type ConditionSpec = {
  type: "json" | "text" | "status";
  // For json
  path?: string; // dot notation, e.g., "bitcoin.eur"
  // For text
  pattern?: string;
  // Comparator
  op?:
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "eq"
    | "neq"
    | "contains"
    | "regex";
  value?: any;
};

type NotifySpec = {
  title: string;
  messageTemplate?: string; // supports {{value}}, {{url}}, {{status}}, {{match}}
  type?: NotificationType;
  channels?: NotificationChannel[];
  cooldownMinutes?: number;
  skipSpamCheck?: boolean;
};

type DedupeSpec = {
  notifyOn?: "crossing" | "every_true"; // crossing: only when condition flips from false->true
};

type WatchState = {
  lastValue?: any;
  lastConditionMet?: boolean;
  lastNotifiedAt?: string; // ISO string
  lastMatch?: string;
};

export interface WatchResourcePayload {
  fetch: FetchSpec;
  condition: ConditionSpec;
  notify: NotifySpec;
  dedupe?: DedupeSpec;
  state?: WatchState;
}

function getValueFromJson(obj: any, path?: string): any {
  if (!path) return obj;
  return path
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), obj);
}

function applyOp(value: any, op: ConditionSpec["op"], target: any): {
  result: boolean;
  match?: string;
} {
  switch (op) {
    case "lt":
      return { result: Number(value) < Number(target) };
    case "lte":
      return { result: Number(value) <= Number(target) };
    case "gt":
      return { result: Number(value) > Number(target) };
    case "gte":
      return { result: Number(value) >= Number(target) };
    case "eq":
      return { result: value == target }; // intentional loose equality for numbers/strings
    case "neq":
      return { result: value != target };
    case "contains":
      return {
        result:
          typeof value === "string" &&
          typeof target === "string" &&
          value.toLowerCase().includes(target.toLowerCase()),
      };
    case "regex": {
      const regex = new RegExp(String(target), "i");
      const match = typeof value === "string" ? value.match(regex) : null;
      return { result: !!match, match: match?.[0] };
    }
    default:
      return { result: false };
  }
}

export class ResourceWatcherService {
  async runCheck(
    userId: string,
    payload: WatchResourcePayload,
  ): Promise<{
    notified: boolean;
    value: any;
    conditionMet: boolean;
    updatedActionPayload?: any;
    updatedMetadata?: any;
  }> {
    if (!payload?.fetch?.url) {
      throw new Error("WATCH_RESOURCE: fetch.url is required");
    }
    if (!payload?.condition) {
      throw new Error("WATCH_RESOURCE: condition is required");
    }
    if (!payload?.notify?.title) {
      throw new Error("WATCH_RESOURCE: notify.title is required");
    }

    const dedupe: DedupeSpec = payload.dedupe ?? { notifyOn: "crossing" };
    const state: WatchState = payload.state ?? {};
    const now = new Date();

    // 1) Fetch
    const response = await curlService.makeRequest({
      method: payload.fetch.method ?? "GET",
      url: payload.fetch.url,
      headers: payload.fetch.headers,
      body: payload.fetch.body,
      timeout: payload.fetch.timeout,
    });

    // 2) Parse value
    let value: any;
    let matchText: string | undefined;
    const parseAs =
      payload.fetch.parseAs ??
      (payload.condition.type === "text" ? "text" : "json");

    if (payload.condition.type === "status") {
      value = response.statusCode;
    } else if (parseAs === "json") {
      const json = JSON.parse(response.body);
      value = getValueFromJson(json, payload.condition.path);
    } else {
      const text = response.body ?? "";
      value = text;
    }

    // 3) Evaluate condition
    const { op = "eq", value: target, pattern } = payload.condition;
    const compareTarget =
      payload.condition.type === "text" && pattern ? pattern : target;
    const { result: conditionMet, match } = applyOp(value, op, compareTarget);
    if (match) {
      matchText = match;
    }

    // 4) Dedupe and cooldown
    const lastNotifiedAt = state.lastNotifiedAt
      ? new Date(state.lastNotifiedAt)
      : null;
    const inCooldown =
      !!payload.notify.cooldownMinutes &&
      lastNotifiedAt &&
      now.getTime() - lastNotifiedAt.getTime() <
        payload.notify.cooldownMinutes * 60 * 1000;

    const shouldNotify =
      conditionMet &&
      !inCooldown &&
      (dedupe.notifyOn !== "crossing" ||
        state.lastConditionMet === undefined ||
        state.lastConditionMet === false);

    // 5) Notify
    if (shouldNotify) {
      const message =
        payload.notify.messageTemplate
          ?.replace("{{value}}", String(value))
          ?.replace("{{url}}", payload.fetch.url)
          ?.replace("{{status}}", String(response.statusCode))
          ?.replace("{{match}}", matchText ?? "")
          ?? `Condition met for ${payload.fetch.url}: value=${value}`;

      await notificationService.sendNotification(userId, {
        title: payload.notify.title,
        message,
        type: payload.notify.type ?? NotificationType.INFO,
        channels: payload.notify.channels,
        skipSpamCheck: payload.notify.skipSpamCheck ?? false,
      });
    }

    const nextState: WatchState = {
      lastValue: value,
      lastConditionMet: conditionMet,
      lastNotifiedAt: shouldNotify ? now.toISOString() : state.lastNotifiedAt,
      lastMatch: matchText ?? state.lastMatch,
    };

    return {
      notified: shouldNotify,
      value,
      conditionMet,
      updatedActionPayload: {
        ...payload,
        state: nextState,
      },
      updatedMetadata: {
        ...(payload as any).metadata,
        state: nextState,
      },
    };
  }
}

export const resourceWatcherService = new ResourceWatcherService();
