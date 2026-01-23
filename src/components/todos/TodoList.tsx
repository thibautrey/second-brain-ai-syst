/**
 * TodoList Component - Display and manage todos
 */

import { useState } from "react";
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
    if (confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) {
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
      label: "Toutes",
      icon: <ListTodo className="w-4 h-4" />,
      count: stats?.total,
    },
    {
      key: "pending",
      label: "À faire",
      icon: <Circle className="w-4 h-4" />,
      count: stats?.pending,
    },
    {
      key: "in_progress",
      label: "En cours",
      icon: <Clock className="w-4 h-4" />,
      count: stats?.inProgress,
    },
    {
      key: "completed",
      label: "Terminées",
      icon: <CheckCircle2 className="w-4 h-4" />,
      count: stats?.completed,
    },
    {
      key: "overdue",
      label: "En retard",
      icon: <AlertCircle className="w-4 h-4" />,
      count: stats?.overdue,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Tâches</h2>
          <p className="text-slate-600 mt-1">
            Gérez vos tâches et suivez votre progression
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle tâche
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
              <p className="text-sm text-slate-500">À faire</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {stats.inProgress}
              </div>
              <p className="text-sm text-slate-500">En cours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
              <p className="text-sm text-slate-500">Terminées</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">
                {stats.overdue}
              </div>
              <p className="text-sm text-slate-500">En retard</p>
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
                <p className="text-slate-500">Aucune tâche trouvée</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowForm(true)}
                >
                  Créer une tâche
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
