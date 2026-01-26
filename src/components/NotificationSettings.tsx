import { useState, useEffect } from "react";
import { useNotificationListener } from "../hooks/useNotificationListener";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Bell, BellOff, CheckCircle, XCircle, Send, Loader2, AlertCircle } from "lucide-react";
import { apiGet, apiPost, apiPut } from "../services/api";

interface NotificationSettingsData {
  pushoverUserKey: string | null;
  pushoverApiToken: string | null;
  notifyOnMemoryStored: boolean;
  notifyOnCommandDetected: boolean;
}

type ChannelType = "browser" | "pushover";

interface NotificationSettingsProps {
  selectedChannel: ChannelType | null;
}

export function NotificationSettings({ selectedChannel }: NotificationSettingsProps) {
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
      const data = await apiGet<NotificationSettingsData>("/settings/notifications");
      setSettings(data);
      setPushoverUserKey(data.pushoverUserKey || "");
      setPushoverApiToken(data.pushoverApiToken || "");
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      await requestPermission();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSavePushover = async () => {
    setIsSaving(true);
    setTestResult(null);
    try {
      const data = await apiPut<NotificationSettingsData>("/settings/notifications", {
        pushoverUserKey: pushoverUserKey || null,
        pushoverApiToken: pushoverApiToken || null,
      });
      setSettings(data);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPushover = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const data = await apiPost<{ success: boolean; message: string }>("/settings/notifications/test-pushover");
      setTestResult({
        success: true,
        message: data.message || "Test notification sent!",
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message,
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
          <p>Loading settings...</p>
        </div>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card className="p-6 bg-yellow-50 border-yellow-200">
        <div className="flex items-center gap-3 text-yellow-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>Browser notifications are not supported in your browser</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Browser Notifications Configuration */}
      {selectedChannel === "browser" && (
        <Card className="p-6 space-y-4 border-2 animate-in fade-in">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">Browser Notifications</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Receive notifications directly in your browser
              </p>
            </div>
            <div className="flex-shrink-0">
              {isConnected ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <XCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Offline</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {permission === "granted" ? (
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">Enabled</p>
                    <p className="text-xs text-muted-foreground">You will receive browser notifications</p>
                  </div>
                </div>
              ) : permission === "denied" ? (
                <div className="flex items-center gap-3">
                  <BellOff className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-sm">Blocked</p>
                    <p className="text-xs text-muted-foreground">Please enable notifications in browser settings</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <BellOff className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-sm">Not configured</p>
                    <p className="text-xs text-muted-foreground">Click below to enable</p>
                  </div>
                </div>
              )}
            </div>

            {permission !== "granted" && (
              <Button
                onClick={handleRequestPermission}
                disabled={isRequesting || permission === "denied"}
                size="sm"
              >
                {isRequesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  "Enable"
                )}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Pushover Configuration */}
      {selectedChannel === "pushover" && (
        <Card className="p-6 space-y-4 border-2 animate-in fade-in">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">Pushover</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Receive push notifications on your mobile devices
              </p>
            </div>
            {settings?.pushoverUserKey && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Configured</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="pushoverUserKey">User Key</Label>
              <Input
                id="pushoverUserKey"
                type="password"
                placeholder="Your 30-character Pushover user key"
                value={pushoverUserKey}
                onChange={(e) => setPushoverUserKey(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Get your User Key from{" "}
                <a
                  href="https://pushover.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline font-medium"
                >
                  pushover.net
                </a>
              </p>
            </div>

            <div>
              <Label htmlFor="pushoverApiToken">API Token (Optional)</Label>
              <Input
                id="pushoverApiToken"
                type="password"
                placeholder="Custom API token (leave blank to use default)"
                value={pushoverApiToken}
                onChange={(e) => setPushoverApiToken(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Optional: Use a custom application token for branded notifications
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSavePushover}
                disabled={isSaving || !pushoverUserKey}
                size="sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg flex items-center gap-2 ${
                  testResult.success
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="text-sm">{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <h4 className="font-medium text-sm text-blue-900 mb-2">How to set up Pushover</h4>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Create a free account on pushover.net</li>
              <li>Install the Pushover app on your phone</li>
              <li>Copy your User Key from your Pushover dashboard</li>
              <li>Paste it above and click Save</li>
              <li>Click Test to verify everything works</li>
            </ol>
          </div>
        </Card>
      )}
    </div>
  );
}
