import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";

interface Task {
  task: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  result?: string;
  error?: string;
}

interface SelfHealResponse {
  success: boolean;
  toolId: string;
  toolName: string;
  tasks: Task[];
  completedAt: string;
  hasErrors: boolean;
}

interface SelfHealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolId: string;
  toolName: string;
}

async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<any> {
  const token = localStorage.getItem("token");

  const response = await fetch(`/api${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(
      "Server returned non-JSON response. API endpoints may not be implemented.",
    );
  }

  return response.json();
}

export function SelfHealDialog({
  open,
  onOpenChange,
  toolId,
  toolName,
}: SelfHealDialogProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [healed, setHealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startHealing = async () => {
    setLoading(true);
    setError(null);
    setTasks([]);
    setHealed(false);

    try {
      const response = await fetchWithAuth(
        `/generated-tools/${toolId}/self-heal`,
        {
          method: "POST",
        },
      );

      const data: SelfHealResponse = response;

      setTasks(data.tasks);
      setHealed(!data.hasErrors);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la récupération");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "in-progress":
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      case "pending":
        return <Clock className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600">
            Complété
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Échoué</Badge>;
      case "in-progress":
        return <Badge variant="secondary">En cours</Badge>;
      case "pending":
        return <Badge variant="outline">En attente</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            Auto-réparation de l'outil
          </DialogTitle>
          <DialogDescription>
            Diagnostique et répare les problèmes du tool "{toolName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error display */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-red-800">
                  <AlertTriangle className="w-5 h-5" />
                  <p>{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status summary */}
          {tasks.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {tasks.filter((t) => t.status === "completed").length}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">Complétées</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {tasks.filter((t) => t.status === "in-progress").length}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">En cours</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {tasks.filter((t) => t.status === "failed").length}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">Échouées</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tasks trace */}
          {tasks.length > 0 && (
            <div className="overflow-hidden border rounded-lg">
              <div className="h-[400px] w-full overflow-y-auto">
                <div className="p-4 space-y-3">
                  {tasks.map((task, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-start justify-between gap-3 pb-2 border-b last:border-0">
                        <div className="flex items-center flex-1 min-w-0 gap-3">
                          {getStatusIcon(task.status)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {task.task}
                            </p>
                          </div>
                        </div>
                        <div className="ml-2 whitespace-nowrap">
                          {getStatusBadge(task.status)}
                        </div>
                      </div>

                      {/* Task result or error */}
                      {task.result && (
                        <p className="p-2 text-xs text-gray-600 rounded ml-7 bg-green-50">
                          ✓ {task.result}
                        </p>
                      )}
                      {task.error && (
                        <p className="p-2 text-xs text-red-700 rounded ml-7 bg-red-50">
                          ✗ {task.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Success message */}
          {healed && tasks.length > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <p>L'outil a été inspectionné et est en bon état !</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No tasks yet */}
          {tasks.length === 0 && !loading && (
            <Card>
              <CardContent className="pt-6 text-center">
                <Zap className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600">
                  Cliquez sur le bouton ci-dessous pour commencer
                  l'auto-réparation
                </p>
              </CardContent>
            </Card>
          )}

          {/* Loading state */}
          {loading && (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="inline-flex items-center gap-2 text-gray-600">
                  <div className="w-4 h-4 border-2 border-gray-300 rounded-full border-t-gray-600 animate-spin" />
                  Analyse en cours...
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button
            onClick={startHealing}
            disabled={loading}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            {loading ? "Réparation en cours..." : "Commencer l'auto-réparation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
