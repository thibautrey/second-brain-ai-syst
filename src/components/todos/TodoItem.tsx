/**
 * TodoItem Component - Display a single todo item
 */

import {
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Edit2,
  AlertCircle,
  Tag,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { Todo, TodoPriority } from "../../types/tools";

interface TodoItemProps {
  todo: Todo;
  onComplete: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

const priorityColors: Record<TodoPriority, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const priorityLabels: Record<TodoPriority, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `En retard de ${Math.abs(diffDays)} jour${Math.abs(diffDays) > 1 ? "s" : ""}`;
  } else if (diffDays === 0) {
    return "Aujourd'hui";
  } else if (diffDays === 1) {
    return "Demain";
  } else if (diffDays <= 7) {
    return `Dans ${diffDays} jours`;
  }
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

export function TodoItem({
  todo,
  onComplete,
  onEdit,
  onDelete,
}: TodoItemProps) {
  const isCompleted = todo.status === "COMPLETED";
  const hasOverdue = todo.dueDate && !isCompleted && isOverdue(todo.dueDate);

  return (
    <div
      className={`group flex items-start gap-3 p-4 rounded-lg border transition-all hover:shadow-sm ${
        isCompleted
          ? "bg-slate-50 border-slate-200 opacity-75"
          : hasOverdue
            ? "bg-red-50 border-red-200"
            : "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => !isCompleted && onComplete(todo.id)}
        className={`shrink-0 mt-0.5 ${
          isCompleted ? "text-green-500" : "text-slate-400 hover:text-green-500"
        }`}
        disabled={isCompleted}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`font-medium ${
              isCompleted ? "text-slate-500 line-through" : "text-slate-900"
            }`}
          >
            {todo.title}
          </h4>
          <Badge className={priorityColors[todo.priority]}>
            {priorityLabels[todo.priority]}
          </Badge>
        </div>

        {todo.description && (
          <p className="mt-1 text-sm text-slate-600 line-clamp-2">
            {todo.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Due date */}
          {todo.dueDate && (
            <span
              className={`inline-flex items-center gap-1 text-xs ${
                hasOverdue ? "text-red-600 font-medium" : "text-slate-500"
              }`}
            >
              {hasOverdue ? (
                <AlertCircle className="w-3 h-3" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
              {formatDate(todo.dueDate)}
            </span>
          )}

          {/* Category */}
          {todo.category && (
            <Badge variant="outline" className="text-xs">
              {todo.category}
            </Badge>
          )}

          {/* Tags */}
          {todo.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-400" />
              {todo.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-xs text-slate-500">
                  #{tag}
                </span>
              ))}
              {todo.tags.length > 3 && (
                <span className="text-xs text-slate-400">
                  +{todo.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(todo)}
        >
          <Edit2 className="w-4 h-4 text-slate-500" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-red-50"
          onClick={() => onDelete(todo.id)}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}
