/**
 * ScheduleItem Component - Display a single scheduled task
 */

import {
  Play,
  Trash2,
  Edit2,
  Clock,
  Calendar,
  Timer,
  Bell,
  CheckSquare,
  FileText,
  Bot,
  Globe,
  Cog,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import type {
  ScheduledTask,
  ScheduleType,
  TaskActionType,
} from "../../types/tools";

interface ScheduleItemProps {
  task: ScheduledTask;
  onToggle: (id: string, enabled: boolean) => void;
  onExecute: (id: string) => void;
  onEdit: (task: ScheduledTask) => void;
  onDelete: (id: string) => void;
}

const scheduleTypeIcons: Record<ScheduleType, React.ReactNode> = {
  ONE_TIME: <Calendar className="w-4 h-4" />,
  CRON: <Clock className="w-4 h-4" />,
  INTERVAL: <Timer className="w-4 h-4" />,
};

const actionTypeIcons: Record<TaskActionType, React.ReactNode> = {
  SEND_NOTIFICATION: <Bell className="w-4 h-4" />,
  CREATE_TODO: <CheckSquare className="w-4 h-4" />,
  GENERATE_SUMMARY: <FileText className="w-4 h-4" />,
  RUN_AGENT: <Bot className="w-4 h-4" />,
  WEBHOOK: <Globe className="w-4 h-4" />,
  CUSTOM: <Cog className="w-4 h-4" />,
};

export function ScheduleItem({
  task,
  onToggle,
  onExecute,
  onEdit,
  onDelete,
}: ScheduleItemProps) {
  const { t, i18n } = useTranslation();
  const scheduleTypeLabels: Record<ScheduleType, string> = {
    ONE_TIME: t("schedule.item.scheduleType.oneTime"),
    CRON: t("schedule.item.scheduleType.cron"),
    INTERVAL: t("schedule.item.scheduleType.interval"),
  };

  const actionTypeLabels: Record<TaskActionType, string> = {
    SEND_NOTIFICATION: t("schedule.item.actionType.notification"),
    CREATE_TODO: t("schedule.item.actionType.createTodo"),
    GENERATE_SUMMARY: t("schedule.item.actionType.generateSummary"),
    RUN_AGENT: t("schedule.item.actionType.runAgent"),
    WEBHOOK: t("schedule.item.actionType.webhook"),
    CUSTOM: t("schedule.item.actionType.custom"),
  };

  const formatNextRun = (dateString?: string): string => {
    if (!dateString) return t("schedule.item.nextRun.unscheduled");
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) return t("schedule.item.nextRun.past");
    if (diffMins < 60)
      return t("schedule.item.nextRun.inMinutes", { count: diffMins });
    if (diffHours < 24)
      return t("schedule.item.nextRun.inHours", { count: diffHours });
    if (diffDays === 1) return t("schedule.item.nextRun.tomorrow");
    if (diffDays <= 7)
      return t("schedule.item.nextRun.inDays", { count: diffDays });
    return date.toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSchedule = (item: ScheduledTask): string => {
    switch (item.scheduleType) {
      case "ONE_TIME":
        return item.executeAt
          ? new Date(item.executeAt).toLocaleString(i18n.language)
          : t("schedule.item.schedule.missingDate");
      case "CRON":
        return item.cronExpression || t("schedule.item.schedule.missingCron");
      case "INTERVAL":
        if (!item.interval)
          return t("schedule.item.schedule.missingInterval");
        if (item.interval < 60)
          return t("schedule.item.schedule.everyMinutes", {
            count: item.interval,
          });
        if (item.interval < 1440)
          return t("schedule.item.schedule.everyHours", {
            count: Math.floor(item.interval / 60),
          });
        return t("schedule.item.schedule.everyDays", {
          count: Math.floor(item.interval / 1440),
        });
      default:
        return t("schedule.item.schedule.unknown");
    }
  };
  return (
    <div
      className={`group flex flex-col sm:flex-row sm:items-start gap-4 p-3 sm:p-4 rounded-lg border transition-all hover:shadow-sm ${
        task.isEnabled
          ? "bg-white border-slate-200 hover:border-slate-300"
          : "bg-slate-50 border-slate-200 opacity-75"
      }`}
    >
      {/* Toggle */}
      <div className="shrink-0 pt-0 sm:pt-1 flex items-center justify-between sm:block">
        <span className="sm:hidden text-sm font-medium text-slate-600">
          {t("schedule.item.activeLabel")}
        </span>
        <Switch
          checked={task.isEnabled}
          onCheckedChange={(checked) => onToggle(task.id, checked)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <h4
            className={`font-medium ${task.isEnabled ? "text-slate-900" : "text-slate-500"}`}
          >
            {task.name}
          </h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="flex items-center gap-1 flex-shrink-0">
              {actionTypeIcons[task.actionType]}
              <span className="hidden sm:inline">{actionTypeLabels[task.actionType]}</span>
              <span className="sm:hidden text-xs">{actionTypeLabels[task.actionType]?.split(" ")[0]}</span>
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1 flex-shrink-0">
              {scheduleTypeIcons[task.scheduleType]}
              <span className="hidden sm:inline">{scheduleTypeLabels[task.scheduleType]}</span>
              <span className="sm:hidden text-xs">{scheduleTypeLabels[task.scheduleType]?.split(" ")[0]}</span>
            </Badge>
          </div>
        </div>

        {task.description && (
          <p className="mt-1 text-sm text-slate-600 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500 overflow-x-auto pb-1">
          {/* Schedule info */}
          <span className="flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <span className="truncate">{formatSchedule(task)}</span>
          </span>

          {/* Next run */}
          {task.isEnabled && task.nextRunAt && (
            <span className="flex items-center gap-1 text-blue-600 flex-shrink-0">
              <Calendar className="w-3 h-3" />
              <span className="hidden sm:inline">
                {t("schedule.item.nextRun.label")}
              </span>
              {formatNextRun(task.nextRunAt)}
            </span>
          )}

          {/* Run count */}
          {task.runCount > 0 && (
            <span className="text-slate-400 flex-shrink-0">
              {t("schedule.item.runCount", { count: task.runCount })}
              {task.maxRuns && `/${task.maxRuns}`}
            </span>
          )}

          {/* Last run */}
          {task.lastRunAt && (
            <span className="text-slate-400 flex-shrink-0 hidden sm:inline">
              {t("schedule.item.lastRun", {
                date: new Date(task.lastRunAt).toLocaleString(i18n.language),
              })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity justify-end sm:justify-start">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onExecute(task.id)}
          title={t("schedule.item.actions.executeNow")}
        >
          <Play className="w-4 h-4 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(task)}
        >
          <Edit2 className="w-4 h-4 text-slate-500" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-red-50"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}
