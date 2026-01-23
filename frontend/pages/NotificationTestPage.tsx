import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { NotificationSettings } from "../components/NotificationSettings";
import { createNotification } from "../services/notificationService";

export function NotificationTestPage() {
  const [title, setTitle] = useState("Test Notification");
  const [message, setMessage] = useState("Ceci est une notification de test");
  const [type, setType] = useState<
    "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "REMINDER"
  >("INFO");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendNotification = async () => {
    setIsLoading(true);
    try {
      const result = await createNotification({
        title,
        message,
        type,
        channels: ["IN_APP", "PUSH"],
      });

      if (result.success) {
        alert("Notification envoyée avec succès !");
      }
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Test des Notifications</h1>
          <p className="text-muted-foreground mt-2">
            Testez le système de notifications et configurez vos préférences
          </p>
        </div>

        {/* Settings Card */}
        <NotificationSettings />

        {/* Test Form */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">
            Envoyer une notification de test
          </h2>

          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la notification"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Contenu de la notification"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="INFO">Info</option>
              <option value="SUCCESS">Succès</option>
              <option value="WARNING">Avertissement</option>
              <option value="ERROR">Erreur</option>
              <option value="REMINDER">Rappel</option>
            </select>
          </div>

          <Button
            onClick={handleSendNotification}
            disabled={isLoading || !title || !message}
            className="w-full"
          >
            {isLoading ? "Envoi..." : "Envoyer la notification"}
          </Button>
        </Card>

        {/* Instructions */}
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Assurez-vous d'avoir activé les notifications du navigateur</li>
            <li>
              Vérifiez que la connexion WebSocket est active (indicateur vert)
            </li>
            <li>Remplissez le formulaire ci-dessus et cliquez sur "Envoyer"</li>
            <li>Vous devriez recevoir une notification du navigateur</li>
            <li>
              L'IA peut également envoyer des notifications via l'endpoint POST
              /api/notifications
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
