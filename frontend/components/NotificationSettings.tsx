import { useState } from "react";
import { useNotificationListener } from "../hooks/useNotificationListener";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Bell, BellOff, CheckCircle, XCircle } from "lucide-react";

export function NotificationSettings() {
  const { isConnected, permission, requestPermission, isSupported } =
    useNotificationListener();

  const [isRequesting, setIsRequesting] = useState(false);

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
    <Card className="p-6 space-y-4">
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
  );
}
