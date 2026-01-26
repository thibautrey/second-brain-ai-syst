/**
 * ScheduleForm Component - Create or edit a scheduled task
 */

import React, { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import type {
  ScheduledTask,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
  ScheduleType,
  TaskActionType,
} from "../../types/tools";

interface ScheduleFormProps {
  task?: ScheduledTask;
  onSubmit: (
    data: CreateScheduledTaskInput | UpdateScheduledTaskInput,
  ) => Promise<void>;
  onClose: () => void;
}

const scheduleTypes: {
  value: ScheduleType;
  label: string;
  description: string;
}[] = [
  {
    value: "ONE_TIME",
    label: "Exécution unique",
    description: "Exécuté une seule fois à la date spécifiée",
  },
  {
    value: "CRON",
    label: "Expression Cron",
    description: "Exécuté selon une expression cron (ex: 0 9 * * *)",
  },
  {
    value: "INTERVAL",
    label: "Intervalle",
    description: "Exécuté périodiquement selon un intervalle en minutes",
  },
];

const actionTypes: {
  value: TaskActionType;
  label: string;
  description: string;
}[] = [
  {
    value: "SEND_NOTIFICATION",
    label: "Envoyer notification",
    description: "Envoie une notification push",
  },
  {
    value: "CREATE_TODO",
    label: "Créer une tâche",
    description: "Crée automatiquement une nouvelle tâche",
  },
  {
    value: "GENERATE_SUMMARY",
    label: "Générer un résumé",
    description: "Génère un résumé des mémoires",
  },
  {
    value: "RUN_AGENT",
    label: "Exécuter un agent",
    description: "Lance un agent autonome",
  },
  {
    value: "WEBHOOK",
    label: "Appeler un webhook",
    description: "Envoie une requête HTTP",
  },
  {
    value: "CUSTOM",
    label: "Action personnalisée",
    description: "Action personnalisée avec payload libre",
  },
];

const cronExamples = [
  { label: "Chaque jour à 9h", value: "0 9 * * *" },
  { label: "Chaque lundi à 8h", value: "0 8 * * 1" },
  { label: "Toutes les heures", value: "0 * * * *" },
  { label: "Le 1er du mois à minuit", value: "0 0 1 * *" },
];

export function ScheduleForm({ task, onSubmit, onClose }: ScheduleFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: task?.name || "",
    description: task?.description || "",
    scheduleType: task?.scheduleType || ("ONE_TIME" as ScheduleType),
    cronExpression: task?.cronExpression || "",
    executeAt: task?.executeAt
      ? new Date(task.executeAt).toISOString().slice(0, 16)
      : "",
    interval: task?.interval?.toString() || "60",
    actionType: task?.actionType || ("SEND_NOTIFICATION" as TaskActionType),
    actionPayload: JSON.stringify(task?.actionPayload || {}, null, 2),
    maxRuns: task?.maxRuns?.toString() || "",
    expiresAt: task?.expiresAt
      ? new Date(task.expiresAt).toISOString().split("T")[0]
      : "",
  });

  const isEditing = !!task;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      let actionPayload: Record<string, unknown> = {};
      try {
        actionPayload = JSON.parse(formData.actionPayload || "{}");
      } catch {
        alert("Le payload doit être un JSON valide");
        setLoading(false);
        return;
      }

      const data: CreateScheduledTaskInput | UpdateScheduledTaskInput = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        scheduleType: formData.scheduleType,
        cronExpression:
          formData.scheduleType === "CRON"
            ? formData.cronExpression
            : undefined,
        executeAt:
          formData.scheduleType === "ONE_TIME" && formData.executeAt
            ? new Date(formData.executeAt).toISOString()
            : undefined,
        interval:
          formData.scheduleType === "INTERVAL"
            ? parseInt(formData.interval)
            : undefined,
        actionType: formData.actionType,
        actionPayload,
        maxRuns: formData.maxRuns ? parseInt(formData.maxRuns) : undefined,
        expiresAt: formData.expiresAt
          ? new Date(formData.expiresAt).toISOString()
          : undefined,
      };

      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setLoading(false);
    }
  }

  // Generate default payload based on action type
  function getDefaultPayload(actionType: TaskActionType): string {
    switch (actionType) {
      case "SEND_NOTIFICATION":
        return JSON.stringify(
          { title: "Rappel", message: "Votre notification" },
          null,
          2,
        );
      case "CREATE_TODO":
        return JSON.stringify(
          { title: "Nouvelle tâche", priority: "MEDIUM" },
          null,
          2,
        );
      case "GENERATE_SUMMARY":
        return JSON.stringify(
          { timeScale: "daily", type: "reflection" },
          null,
          2,
        );
      case "RUN_AGENT":
        return JSON.stringify({ agentId: "", params: {} }, null, 2);
      case "WEBHOOK":
        return JSON.stringify(
          { url: "https://example.com/webhook", method: "POST", body: {} },
          null,
          2,
        );
      default:
        return "{}";
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 overflow-auto py-0 sm:py-8">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-lg sm:mx-4 my-0 sm:my-auto max-h-[90vh] sm:max-h-none flex flex-col">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-slate-50 sm:bg-white rounded-t-lg sm:rounded-t-none">
          <h3 className="text-base sm:text-lg font-semibold">
            {isEditing
              ? "Modifier la tâche planifiée"
              : "Nouvelle tâche planifiée"}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 space-y-4 overflow-y-auto flex-1"
        >
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nom *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="ex: Rappel quotidien"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Description de la tâche..."
              rows={2}
            />
          </div>

          {/* Schedule Type */}
          <div className="space-y-2">
            <Label>Type de planification *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {scheduleTypes.map((type) => (
                <label
                  key={type.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.scheduleType === type.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="scheduleType"
                    value={type.value}
                    checked={formData.scheduleType === type.value}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scheduleType: e.target.value as ScheduleType,
                      })
                    }
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">{type.label}</div>
                    <div className="text-xs text-slate-500">
                      {type.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Schedule Details based on type */}
          {formData.scheduleType === "ONE_TIME" && (
            <div className="space-y-2">
              <Label htmlFor="executeAt">Date et heure d'exécution *</Label>
              <Input
                id="executeAt"
                type="datetime-local"
                value={formData.executeAt}
                onChange={(e) =>
                  setFormData({ ...formData, executeAt: e.target.value })
                }
                required
              />
            </div>
          )}

          {formData.scheduleType === "CRON" && (
            <div className="space-y-2">
              <Label htmlFor="cronExpression">Expression Cron *</Label>
              <Input
                id="cronExpression"
                value={formData.cronExpression}
                onChange={(e) =>
                  setFormData({ ...formData, cronExpression: e.target.value })
                }
                placeholder="0 9 * * *"
                required
              />
              <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
                {cronExamples.map((ex) => (
                  <button
                    key={ex.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, cronExpression: ex.value })
                    }
                    className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 whitespace-nowrap"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {formData.scheduleType === "INTERVAL" && (
            <div className="space-y-2">
              <Label htmlFor="interval">Intervalle (minutes) *</Label>
              <Input
                id="interval"
                type="number"
                min="1"
                value={formData.interval}
                onChange={(e) =>
                  setFormData({ ...formData, interval: e.target.value })
                }
                required
              />
              <p className="text-xs text-slate-500">
                60 = 1 heure, 1440 = 1 jour
              </p>
            </div>
          )}

          {/* Action Type */}
          <div className="space-y-2">
            <Label>Action à exécuter *</Label>
            <select
              value={formData.actionType}
              onChange={(e) => {
                const newType = e.target.value as TaskActionType;
                setFormData({
                  ...formData,
                  actionType: newType,
                  actionPayload: getDefaultPayload(newType),
                });
              }}
              className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            >
              {actionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              {
                actionTypes.find((t) => t.value === formData.actionType)
                  ?.description
              }
            </p>
          </div>

          {/* Action Payload */}
          <div className="space-y-2">
            <Label htmlFor="actionPayload">Payload (JSON)</Label>
            <Textarea
              id="actionPayload"
              value={formData.actionPayload}
              onChange={(e) =>
                setFormData({ ...formData, actionPayload: e.target.value })
              }
              placeholder="{}"
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          {/* Optional limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxRuns">Nombre max d'exécutions</Label>
              <Input
                id="maxRuns"
                type="number"
                min="1"
                value={formData.maxRuns}
                onChange={(e) =>
                  setFormData({ ...formData, maxRuns: e.target.value })
                }
                placeholder="Illimité"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Date d'expiration</Label>
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiresAt: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t bg-slate-50 sm:bg-white p-3 sm:p-4 -m-3 sm:-m-4 mt-auto">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()} className="w-full sm:w-auto">
              {loading
                ? "Enregistrement..."
                : isEditing
                  ? "Mettre à jour"
                  : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
