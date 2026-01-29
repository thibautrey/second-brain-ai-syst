/**
 * TodoList Component - Display and manage todos
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  ListTodo,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { TodoItem } from "./TodoItem";
import { TodoForm } from "./TodoForm";
import { useTodos } from "../../hooks/useTodos";
import type { Todo, CreateTodoInput, UpdateTodoInput } from "../../types/tools";

type FilterType = "all" | "pending" | "in_progress" | "completed" | "overdue";

export function TodoList() {
  const { t } = useTranslation();
  const {
    todos,
    stats,
    loading,
    error,
    createTodo,
    updateTodo,
    completeTodo,
    deleteTodo,
    setFilters,
  } = useTodos({ filters: { includeCompleted: true } });

  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    switch (filter) {
      case "all":
        setFilters({ includeCompleted: true });
        break;
      case "pending":
        setFilters({ status: "PENDING", includeCompleted: false });
        break;
      case "in_progress":
        setFilters({ status: "IN_PROGRESS", includeCompleted: false });
        break;
      case "completed":
        setFilters({ status: "COMPLETED", includeCompleted: true });
        break;
      case "overdue":
        // Will be filtered client-side
        setFilters({ includeCompleted: false });
        break;
    }
  };

  const handleCreateTodo = async (data: CreateTodoInput | UpdateTodoInput) => {
    await createTodo(data as CreateTodoInput);
  };

  const handleUpdateTodo = async (data: CreateTodoInput | UpdateTodoInput) => {
    if (editingTodo) {
      await updateTodo(editingTodo.id, data as UpdateTodoInput);
      setEditingTodo(null);
    }
  };

  const handleComplete = async (id: string) => {
    await completeTodo(id);
  };

  const handleDelete = async (id: string) => {
    if (confirm(t("todos.deleteConfirm"))) {
      await deleteTodo(id);
    }
  };

  const filteredTodos =
    activeFilter === "overdue"
      ? todos.filter(
          (t) =>
            t.dueDate &&
            new Date(t.dueDate) < new Date() &&
            t.status !== "COMPLETED",
        )
      : todos;

  const filters: {
    key: FilterType;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      key: "all",
      label: t("todos.filters.all"),
      icon: <ListTodo className="w-4 h-4" />,
      count: stats?.total,
    },
    {
      key: "pending",
      label: t("todos.filters.pending"),
      icon: <Circle className="w-4 h-4" />,
      count: stats?.pending,
    },
    {
      key: "in_progress",
      label: t("todos.filters.inProgress"),
      icon: <Clock className="w-4 h-4" />,
      count: stats?.inProgress,
    },
    {
      key: "completed",
      label: t("todos.filters.completed"),
      icon: <CheckCircle2 className="w-4 h-4" />,
      count: stats?.completed,
    },
    {
      key: "overdue",
      label: t("todos.filters.overdue"),
      icon: <AlertCircle className="w-4 h-4" />,
      count: stats?.overdue,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            {t("todos.title")}
          </h2>
          <p className="text-slate-600 mt-1">
            {t("todos.subtitle")}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          {t("todos.newTodo")}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-slate-900">
                {stats.pending}
              </div>
              <p className="text-sm text-slate-500">
                {t("todos.stats.pending")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {stats.inProgress}
              </div>
              <p className="text-sm text-slate-500">
                {t("todos.stats.inProgress")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
              <p className="text-sm text-slate-500">
                {t("todos.stats.completed")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">
                {stats.overdue}
              </div>
              <p className="text-sm text-slate-500">
                {t("todos.stats.overdue")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
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
            {filter.count !== undefined && (
              <Badge variant="secondary" className="ml-1">
                {filter.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      )}

      {/* Todo List */}
      {!loading && (
        <div className="space-y-3">
          {filteredTodos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ListTodo className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">{t("todos.noTodosFound")}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowForm(true)}
                >
                  {t("todos.createTodo")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onComplete={handleComplete}
                onEdit={setEditingTodo}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <TodoForm
          onSubmit={handleCreateTodo}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit Form Modal */}
      {editingTodo && (
        <TodoForm
          todo={editingTodo}
          onSubmit={handleUpdateTodo}
          onClose={() => setEditingTodo(null)}
        />
      )}
    </div>
  );
}
