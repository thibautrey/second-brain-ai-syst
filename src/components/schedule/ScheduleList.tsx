/**
 * ScheduleList Component - Display and manage scheduled tasks
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Calendar,
  Clock,
  Timer,
  PlayCircle,
  PauseCircle,
  History,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { ScheduleItem } from "./ScheduleItem";
import { ScheduleForm } from "./ScheduleForm";
import { useScheduledTasks } from "../../hooks/useScheduledTasks";
import type {
  ScheduledTask,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
} from "../../types/tools";
import { Badge } from "../ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

type FilterType =
  | "all"
  | "enabled"
  | "disabled"
  | "one_time"
  | "cron"
  | "interval";

export function ScheduleList() {
  const { t } = useTranslation();
  const {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    enableTask,
    disableTask,
    executeTask,
    deleteTask,
    setFilters,
  } = useScheduledTasks();

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    switch (filter) {
      case "all":
        setFilters({});
        break;
      case "enabled":
        setFilters({ isEnabled: true });
        break;
      case "disabled":
        setFilters({ isEnabled: false });
        break;
      case "one_time":
        setFilters({ scheduleType: "ONE_TIME" });
        break;
      case "cron":
        setFilters({ scheduleType: "CRON" });
        break;
      case "interval":
        setFilters({ scheduleType: "INTERVAL" });
        break;
    }
  };

  const handleCreateTask = async (
    data: CreateScheduledTaskInput | UpdateScheduledTaskInput,
  ) => {
    await createTask(data as CreateScheduledTaskInput);
  };

  const handleUpdateTask = async (
    data: CreateScheduledTaskInput | UpdateScheduledTaskInput,
  ) => {
    if (editingTask) {
      await updateTask(editingTask.id, data as UpdateScheduledTaskInput);
      setEditingTask(null);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    if (enabled) {
      await enableTask(id);
    } else {
      await disableTask(id);
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await executeTask(id);
    } catch (error) {
      console.error(t("schedule.errors.executeFailed"), error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t("schedule.deleteConfirm"))) {
      await deleteTask(id);
    }
  };

  // Calculate stats
  const stats = {
    total: tasks.length,
    enabled: tasks.filter((t) => t.isEnabled).length,
    disabled: tasks.filter((t) => !t.isEnabled).length,
    oneTime: tasks.filter((t) => t.scheduleType === "ONE_TIME").length,
    cron: tasks.filter((t) => t.scheduleType === "CRON").length,
    interval: tasks.filter((t) => t.scheduleType === "INTERVAL").length,
  };

  const filters: {
    key: FilterType;
    label: string;
    icon: React.ReactNode;
    count: number;
  }[] = [
    {
      key: "all",
      label: t("schedule.filters.all"),
      icon: <History className="w-4 h-4" />,
      count: stats.total,
    },
    {
      key: "enabled",
      label: t("schedule.filters.enabled"),
      icon: <PlayCircle className="w-4 h-4" />,
      count: stats.enabled,
    },
    {
      key: "disabled",
      label: t("schedule.filters.disabled"),
      icon: <PauseCircle className="w-4 h-4" />,
      count: stats.disabled,
    },
    {
      key: "one_time",
      label: t("schedule.filters.oneTime"),
      icon: <Calendar className="w-4 h-4" />,
      count: stats.oneTime,
    },
    {
      key: "cron",
      label: t("schedule.filters.cron"),
      icon: <Clock className="w-4 h-4" />,
      count: stats.cron,
    },
    {
      key: "interval",
      label: t("schedule.filters.interval"),
      icon: <Timer className="w-4 h-4" />,
      count: stats.interval,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {t("schedule.title")}
          </h2>
          <p className="mt-1 text-sm sm:text-base text-slate-600">
            {t("schedule.subtitle")}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          {t("schedule.newSchedule")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="lg:block">
        <Accordion type="single" collapsible className="lg:hidden">
          <AccordionItem value="stats" className="border-none">
            <AccordionTrigger className="p-4 bg-white border border-slate-200 rounded-lg hover:no-underline">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">
                  {t("schedule.stats.title")}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-3">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xl font-bold text-slate-900">
                      {stats.total}
                    </div>
                    <p className="text-xs text-slate-500">
                      {t("schedule.stats.total")}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xl font-bold text-green-600">
                      {stats.enabled}
                    </div>
                    <p className="text-xs text-slate-500">
                      {t("schedule.stats.enabled")}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xl font-bold text-blue-600">
                      {stats.cron}
                    </div>
                    <p className="text-xs text-slate-500">
                      {t("schedule.stats.cron")}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xl font-bold text-purple-600">
                      {stats.oneTime}
                    </div>
                    <p className="text-xs text-slate-500">
                      {t("schedule.stats.oneTime")}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        {/* Desktop View - Always visible */}
        <div className="hidden lg:grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-slate-900">
                {stats.total}
              </div>
              <p className="text-sm text-slate-500">
                {t("schedule.stats.total")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {stats.enabled}
              </div>
              <p className="text-sm text-slate-500">
                {t("schedule.stats.enabled")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{stats.cron}</div>
              <p className="text-sm text-slate-500">
                {t("schedule.stats.cron")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">
                {stats.oneTime}
              </div>
              <p className="text-sm text-slate-500">
                {t("schedule.stats.oneTime")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <Button
            key={filter.key}
            variant={activeFilter === filter.key ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange(filter.key)}
            className="flex items-center gap-2"
          >
            {filter.icon}
            {filter.label}
            <Badge variant="secondary" className="ml-1">
              {filter.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 text-red-700 border border-red-200 rounded-lg bg-red-50">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-b-2 rounded-full animate-spin border-slate-900"></div>
        </div>
      )}

      {/* Task List */}
      {!loading && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-500">{t("schedule.noTasksScheduled")}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowForm(true)}
                >
                  {t("schedule.createSchedule")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <ScheduleItem
                key={task.id}
                task={task}
                onToggle={handleToggle}
                onExecute={handleExecute}
                onEdit={setEditingTask}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <ScheduleForm
          onSubmit={handleCreateTask}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit Form Modal */}
      {editingTask && (
        <ScheduleForm
          task={editingTask}
          onSubmit={handleUpdateTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
