import { useState, useEffect } from "react";
import { useNotificationListener } from "../hooks/useNotificationListener";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Bell, BellOff, CheckCircle, XCircle, Send, Loader2 } from "lucide-react";
import { api } from "../services/api";

interface NotificationSettingsData {
  pushoverUserKey: string | null;
  pushoverApiToken: string | null;
  notifyOnMemoryStored: boolean;
  notifyOnCommandDetected: boolean;
}

export function NotificationSettings() {
  const { isConnected, permission, requestPermission, isSupported } =
    useNotificationListener();

  const [isRequesting, setIsRequesting] = useState(false);
  const [settings, setSettings] = useState<NotificationSettingsData | null>(null);
  const [pushoverUserKey, setPushoverUserKey] = useState("");
  const [pushoverApiToken, setPushoverApiToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/api/settings/notifications");
      setSettings(response.data);
      setPushoverUserKey(response.data.pushoverUserKey || "");
      setPushoverApiToken(response.data.pushoverApiToken || "");
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const result = await requestPermission();
      if (result === "granted") {
        alert("Notifications activées !");
      } else {
        alert("Permission refusée");
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSavePushover = async () => {
    setIsSaving(true);
    setTestResult(null);
    try {
      const response = await api.put("/api/settings/notifications", {
        pushoverUserKey: pushoverUserKey || null,
        pushoverApiToken: pushoverApiToken || null,
      });
      setSettings(response.data);
      alert("Paramètres Pushover enregistrés avec succès !");
    } catch (error: any) {
      alert(`Erreur : ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPushover = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await api.post("/api/settings/notifications/test-pushover");
      setTestResult({
        success: true,
        message: response.data.message || "Test notification envoyée !",
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.response?.data?.error || error.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p>Chargement des paramètres...</p>
        </div>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <XCircle className="h-5 w-5" />
          <p>Les notifications ne sont pas supportées par votre navigateur</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Notifications in-app</h2>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <h3 className="font-semibold">État de la connexion</h3>
              <p className="text-sm text-muted-foreground">
                {isConnected ? "Connecté" : "Déconnecté"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-3">
            {permission === "granted" ? (
              <Bell className="h-5 w-5 text-green-500" />
            ) : (
              <BellOff className="h-5 w-5 text-gray-500" />
            )}
            <div>
              <h3 className="font-semibold">Notifications du navigateur</h3>
              <p className="text-sm text-muted-foreground">
                {permission === "granted"
                  ? "Activées"
                  : permission === "denied"
                    ? "Refusées"
                    : "Non configurées"}
              </p>
            </div>
          </div>

          {permission !== "granted" && (
            <Button
              onClick={handleRequestPermission}
              disabled={isRequesting || permission === "denied"}
            >
              Activer les notifications
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Pushover Integration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Recevez des notifications sur vos appareils mobiles via Pushover
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="pushoverUserKey">Pushover User Key</Label>
            <Input
              id="pushoverUserKey"
              type="text"
              placeholder="Votre clé utilisateur Pushover (30 caractères)"
              value={pushoverUserKey}
              onChange={(e) => setPushoverUserKey(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Trouvez votre User Key sur{" "}
              <a
                href="https://pushover.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                pushover.net
              </a>
            </p>
          </div>

          <div>
            <Label htmlFor="pushoverApiToken">Pushover API Token (Optionnel)</Label>
            <Input
              id="pushoverApiToken"
              type="text"
              placeholder="Token API personnalisé (optionnel)"
              value={pushoverApiToken}
              onChange={(e) => setPushoverApiToken(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Laissez vide pour utiliser le token par défaut de l'application
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSavePushover}
              disabled={isSaving || !pushoverUserKey}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleTestPushover}
              disabled={isTesting || !settings?.pushoverUserKey}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Test en cours...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Tester
                </>
              )}
            </Button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-md ${
                testResult.success
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="text-sm">{testResult.message}</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-2">
          <h3 className="font-semibold text-sm">Comment utiliser Pushover ?</h3>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Créez un compte gratuit sur pushover.net</li>
            <li>Installez l'application Pushover sur votre appareil mobile</li>
            <li>Copiez votre User Key depuis le tableau de bord Pushover</li>
            <li>Collez-la ci-dessus et enregistrez</li>
            <li>Cliquez sur "Tester" pour vérifier que tout fonctionne</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
