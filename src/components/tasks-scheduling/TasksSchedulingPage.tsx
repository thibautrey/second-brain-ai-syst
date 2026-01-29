/**
 * TasksSchedulingPage Component - Unified Tasks and Scheduling management
 * 
 * This component combines the previously separate "Tâches" (manual tasks)
 * and "Planifications" (automated scheduled tasks) into a single elegant interface.
 * 
 * Features:
 * - Tabbed interface for manual tasks and automated scheduling
 * - Unified statistics and filtering for both types of tasks
 * - Consistent UI/UX experience across task management types
 * - Single navigation entry point for better user experience
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  CheckSquare,
  Calendar,
  Clock,
  Timer,
  PlayCircle,
  PauseCircle,
  History,
  Circle,
  CheckCircle2,
  AlertCircle,
  ListTodo,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { TodoItem } from "../todos/TodoItem";
import { TodoForm } from "../todos/TodoForm";
import { ScheduleItem } from "../schedule/ScheduleItem";
import { ScheduleForm } from "../schedule/ScheduleForm";
import { useTodos } from "../../hooks/useTodos";
import { useScheduledTasks } from "../../hooks/useScheduledTasks";
import type { 
  Todo, 
  CreateTodoInput, 
  UpdateTodoInput,
  ScheduledTask,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput
} from "../../types/tools";

type TodoFilterType = "all" | "pending" | "in_progress" | "completed" | "overdue";
type ScheduleFilterType = "all" | "enabled" | "disabled" | "one_time" | "cron" | "interval";

export function TasksSchedulingPage() {
  const { t } = useTranslation();
  const { tab } = useParams();
  
  // Determine which tab to show based on original route
  const [activeMainTab, setActiveMainTab] = useState(() => {
    if (tab === "schedule") return "schedule";
    return "todos"; // Default to todos, also handles "tasks-scheduling"
  });
  
  // Todos state
  const {
    todos,
    stats: todoStats,
    loading: todosLoading,
    error: todosError,
    createTodo,
    updateTodo,
    completeTodo,
    deleteTodo,
    setFilters: setTodoFilters,
  } = useTodos({ filters: { includeCompleted: true } });

  // Scheduled tasks state
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    createTask,
    updateTask,
    enableTask,
    disableTask,
    executeTask,
    deleteTask,
    setFilters: setScheduleFilters,
  } = useScheduledTasks();

  // UI state
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [activeTodoFilter, setActiveTodoFilter] = useState<TodoFilterType>("all");
  const [activeScheduleFilter, setActiveScheduleFilter] = useState<ScheduleFilterType>("all");

  // Todo handlers
  const handleTodoFilterChange = (filter: TodoFilterType) => {
    setActiveTodoFilter(filter);
    switch (filter) {
      case "all":
        setTodoFilters({ includeCompleted: true });
        break;
      case "pending":
        setTodoFilters({ status: "PENDING", includeCompleted: false });
        break;
      case "in_progress":
        setTodoFilters({ status: "IN_PROGRESS", includeCompleted: false });
        break;
      case "completed":
        setTodoFilters({ status: "COMPLETED", includeCompleted: true });
        break;
      case "overdue":
        setTodoFilters({ includeCompleted: false });
        break;
    }
  };

  const handleCreateTodo = async (data: CreateTodoInput | UpdateTodoInput) => {
    await createTodo(data as CreateTodoInput);
    setShowTodoForm(false);
  };

  const handleUpdateTodo = async (data: CreateTodoInput | UpdateTodoInput) => {
    if (editingTodo) {
      await updateTodo(editingTodo.id, data as UpdateTodoInput);
      setEditingTodo(null);
    }
  };

  const handleCompleteTodo = async (id: string) => {
    await completeTodo(id);
  };

  const handleDeleteTodo = async (id: string) => {
    if (confirm(t("todos.deleteConfirm"))) {
      await deleteTodo(id);
    }
  };

  // Schedule handlers
  const handleScheduleFilterChange = (filter: ScheduleFilterType) => {
    setActiveScheduleFilter(filter);
    switch (filter) {
      case "all":
        setScheduleFilters({});
        break;
      case "enabled":
        setScheduleFilters({ isEnabled: true });
        break;
      case "disabled":
        setScheduleFilters({ isEnabled: false });
        break;
      case "one_time":
        setScheduleFilters({ scheduleType: "ONE_TIME" });
        break;
      case "cron":
        setScheduleFilters({ scheduleType: "CRON" });
        break;
      case "interval":
        setScheduleFilters({ scheduleType: "INTERVAL" });
        break;
    }
  };

  const handleCreateTask = async (data: CreateScheduledTaskInput | UpdateScheduledTaskInput) => {
    await createTask(data as CreateScheduledTaskInput);
    setShowScheduleForm(false);
  };

  const handleUpdateTask = async (data: CreateScheduledTaskInput | UpdateScheduledTaskInput) => {
    if (editingTask) {
      await updateTask(editingTask.id, data as UpdateScheduledTaskInput);
      setEditingTask(null);
    }
  };

  const handleToggleTask = async (id: string, enabled: boolean) => {
    if (enabled) {
      await enableTask(id);
    } else {
      await disableTask(id);
    }
  };

  const handleExecuteTask = async (id: string) => {
    try {
      await executeTask(id);
    } catch (error) {
      console.error("Failed to execute task:", error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm(t("schedule.deleteConfirm"))) {
      await deleteTask(id);
    }
  };

  // Filter data
  const filteredTodos =
    activeTodoFilter === "overdue"
      ? todos.filter(
          (t) =>
            t.dueDate &&
            new Date(t.dueDate) < new Date() &&
            t.status !== "COMPLETED",
        )
      : todos;

  // Calculate schedule stats
  const scheduleStats = {
    total: tasks.length,
    enabled: tasks.filter((t) => t.isEnabled).length,
    disabled: tasks.filter((t) => !t.isEnabled).length,
    oneTime: tasks.filter((t) => t.scheduleType === "ONE_TIME").length,
    cron: tasks.filter((t) => t.scheduleType === "CRON").length,
    interval: tasks.filter((t) => t.scheduleType === "INTERVAL").length,
  };

  // Filter definitions
  const todoFilters: {
    key: TodoFilterType;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      key: "all",
      label: t("todos.filters.all"),
      icon: <ListTodo className="w-4 h-4" />,
      count: todoStats?.total,
    },
    {
      key: "pending",
      label: t("todos.filters.pending"),
      icon: <Circle className="w-4 h-4" />,
      count: todoStats?.pending,
    },
    {
      key: "in_progress",
      label: t("todos.filters.inProgress"),
      icon: <Clock className="w-4 h-4" />,
      count: todoStats?.inProgress,
    },
    {
      key: "completed",
      label: t("todos.filters.completed"),
      icon: <CheckCircle2 className="w-4 h-4" />,
      count: todoStats?.completed,
    },
    {
      key: "overdue",
      label: t("todos.filters.overdue"),
      icon: <AlertCircle className="w-4 h-4" />,
      count: todoStats?.overdue,
    },
  ];

  const scheduleFilters: {
    key: ScheduleFilterType;
    label: string;
    icon: React.ReactNode;
    count: number;
  }[] = [
    {
      key: "all",
      label: t("schedule.filters.all"),
      icon: <History className="w-4 h-4" />,
      count: scheduleStats.total,
    },
    {
      key: "enabled",
      label: t("schedule.filters.enabled"),
      icon: <PlayCircle className="w-4 h-4" />,
      count: scheduleStats.enabled,
    },
    {
      key: "disabled",
      label: t("schedule.filters.disabled"),
      icon: <PauseCircle className="w-4 h-4" />,
      count: scheduleStats.disabled,
    },
    {
      key: "one_time",
      label: t("schedule.filters.oneTime"),
      icon: <Timer className="w-4 h-4" />,
      count: scheduleStats.oneTime,
    },
    {
      key: "cron",
      label: t("schedule.filters.cron"),
      icon: <Calendar className="w-4 h-4" />,
      count: scheduleStats.cron,
    },
    {
      key: "interval",
      label: t("schedule.filters.interval"),
      icon: <Clock className="w-4 h-4" />,
      count: scheduleStats.interval,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            {t("tasksScheduling.title")}
          </h2>
          <p className="text-slate-600 mt-1">
            {t("tasksScheduling.subtitle")}
          </p>
        </div>
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="todos" className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            {t("tasksScheduling.tabs.todos")}
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t("tasksScheduling.tabs.schedule")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-6">
          {/* Todo Header Actions */}
          <div className="flex justify-end">
            <Button onClick={() => setShowTodoForm(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              {t("tasksScheduling.actions.newTodo")}
            </Button>
          </div>

          {/* Todo Stats Cards */}
          {todoStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-slate-900">
                    {todoStats.pending}
                  </div>
                  <p className="text-sm text-slate-500">
                    {t("todos.stats.pending")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">
                    {todoStats.inProgress}
                  </div>
                  <p className="text-sm text-slate-500">
                    {t("todos.stats.inProgress")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {todoStats.completed}
                  </div>
                  <p className="text-sm text-slate-500">
                    {t("todos.stats.completed")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">
                    {todoStats.overdue}
                  </div>
                  <p className="text-sm text-slate-500">
                    {t("todos.stats.overdue")}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Todo Filters */}
          <div className="flex flex-wrap gap-2">
            {todoFilters.map((filter) => (
              <Button
                key={filter.key}
                variant={activeTodoFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => handleTodoFilterChange(filter.key)}
                className="flex items-center gap-2"
              >
                {filter.icon}
                {filter.label}
                {filter.count !== undefined && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {filter.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {/* Todo List */}
          <div className="space-y-3">
            {todosLoading && (
              <p className="text-center text-slate-500 py-8">
                {t("common.loading")}
              </p>
            )}
            {todosError && (
              <p className="text-center text-red-500 py-8">
                {t("tasksScheduling.errors.todoLoad", { error: todosError })}
              </p>
            )}
            {!todosLoading && !todosError && filteredTodos.length === 0 && (
              <p className="text-center text-slate-500 py-8">
                {t("todos.noTodosFound")}
              </p>
            )}
            {!todosLoading &&
              !todosError &&
              filteredTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onComplete={handleCompleteTodo}
                  onDelete={handleDeleteTodo}
                  onEdit={setEditingTodo}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          {/* Schedule Header Actions */}
          <div className="flex justify-end">
            <Button onClick={() => setShowScheduleForm(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              {t("tasksScheduling.actions.newSchedule")}
            </Button>
          </div>

          {/* Schedule Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-slate-900">
                  {scheduleStats.total}
                </div>
                <p className="text-sm text-slate-500">
                  {t("schedule.stats.total")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">
                  {scheduleStats.enabled}
                </div>
                <p className="text-sm text-slate-500">
                  {t("schedule.stats.enabled")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">
                  {scheduleStats.disabled}
                </div>
                <p className="text-sm text-slate-500">
                  {t("schedule.stats.disabled")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">
                  {scheduleStats.cron}
                </div>
                <p className="text-sm text-slate-500">
                  {t("schedule.stats.cron")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Filters */}
          <div className="flex flex-wrap gap-2">
            {scheduleFilters.map((filter) => (
              <Button
                key={filter.key}
                variant={activeScheduleFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => handleScheduleFilterChange(filter.key)}
                className="flex items-center gap-2"
              >
                {filter.icon}
                {filter.label}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {filter.count}
                </Badge>
              </Button>
            ))}
          </div>

          {/* Schedule List */}
          <div className="space-y-3">
            {tasksLoading && (
              <p className="text-center text-slate-500 py-8">
                {t("common.loading")}
              </p>
            )}
            {tasksError && (
              <p className="text-center text-red-500 py-8">
                {t("tasksScheduling.errors.scheduleLoad", { error: tasksError })}
              </p>
            )}
            {!tasksLoading && !tasksError && tasks.length === 0 && (
              <p className="text-center text-slate-500 py-8">
                {t("schedule.noTasksScheduled")}
              </p>
            )}
            {!tasksLoading &&
              !tasksError &&
              tasks.map((task) => (
                <ScheduleItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggleTask}
                  onExecute={handleExecuteTask}
                  onDelete={handleDeleteTask}
                  onEdit={setEditingTask}
                />
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Todo Form Modal */}
      {showTodoForm && (
        <TodoForm
          onSubmit={handleCreateTodo}
          onClose={() => setShowTodoForm(false)}
        />
      )}

      {/* Schedule Form Modal */}
      {showScheduleForm && (
        <ScheduleForm
          onSubmit={handleCreateTask}
          onClose={() => setShowScheduleForm(false)}
        />
      )}

      {/* Edit Todo Form Modal */}
      {editingTodo && (
        <TodoForm
          todo={editingTodo}
          onSubmit={handleUpdateTodo}
          onClose={() => setEditingTodo(null)}
        />
      )}

      {/* Edit Schedule Form Modal */}
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
