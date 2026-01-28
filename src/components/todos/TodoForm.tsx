/**
 * TodoForm Component - Create or edit a todo
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import type {
  Todo,
  CreateTodoInput,
  UpdateTodoInput,
  TodoPriority,
} from "../../types/tools";

interface TodoFormProps {
  todo?: Todo;
  onSubmit: (data: CreateTodoInput | UpdateTodoInput) => Promise<void>;
  onClose: () => void;
}

export function TodoForm({ todo, onSubmit, onClose }: TodoFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: todo?.title || "",
    description: todo?.description || "",
    priority: todo?.priority || ("MEDIUM" as TodoPriority),
    category: todo?.category || "",
    tags: todo?.tags.join(", ") || "",
    dueDate: todo?.dueDate
      ? new Date(todo.dueDate).toISOString().split("T")[0]
      : "",
    reminderAt: todo?.reminderAt
      ? new Date(todo.reminderAt).toISOString().slice(0, 16)
      : "",
  });

  const isEditing = !!todo;
  const priorities: { value: TodoPriority; label: string }[] = [
    { value: "LOW", label: t("todos.form.priorities.low") },
    { value: "MEDIUM", label: t("todos.form.priorities.medium") },
    { value: "HIGH", label: t("todos.form.priorities.high") },
    { value: "URGENT", label: t("todos.form.priorities.urgent") },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      const data: CreateTodoInput | UpdateTodoInput = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        category: formData.category.trim() || undefined,
        tags: formData.tags
          ? formData.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
        dueDate: formData.dueDate
          ? new Date(formData.dueDate).toISOString()
          : undefined,
        reminderAt: formData.reminderAt
          ? new Date(formData.reminderAt).toISOString()
          : undefined,
      };
      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error("Failed to save todo:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {isEditing ? t("todos.form.editTitle") : t("todos.form.newTitle")}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("todos.form.titleLabel")}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder={t("todos.form.titlePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("todos.form.descriptionLabel")}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={t("todos.form.descriptionPlaceholder")}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">{t("todos.form.priorityLabel")}</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as TodoPriority,
                  })
                }
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              >
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t("todos.form.categoryLabel")}</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                placeholder={t("todos.form.categoryPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">{t("todos.form.tagsLabel")}</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              placeholder={t("todos.form.tagsPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">{t("todos.form.dueDateLabel")}</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminderAt">{t("todos.form.reminderLabel")}</Label>
              <Input
                id="reminderAt"
                type="datetime-local"
                value={formData.reminderAt}
                onChange={(e) =>
                  setFormData({ ...formData, reminderAt: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading || !formData.title.trim()}>
              {loading
                ? t("common.saving")
                : isEditing
                  ? t("todos.form.update")
                  : t("common.create")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
