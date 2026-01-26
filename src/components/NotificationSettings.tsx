import { useState, useEffect } from "react";
import { useNotificationListener } from "../hooks/useNotificationListener";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Bell, BellOff, CheckCircle, XCircle, Send, Loader2, AlertCircle, MessageCircle, ExternalLink, Copy, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";

interface NotificationSettingsData {
  pushoverUserKey: string | null;
  pushoverApiToken: string | null;
  notifyOnMemoryStored: boolean;
  notifyOnCommandDetected: boolean;
}

interface TelegramSettingsData {
  hasBotToken: boolean;
  telegramChatId: string | null;
  telegramEnabled: boolean;
}

type ChannelType = "browser" | "pushover" | "telegram";

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

  // Telegram state
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettingsData | null>(null);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isDisconnectingTelegram, setIsDisconnectingTelegram] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadTelegramSettings();
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

  const loadTelegramSettings = async () => {
    try {
      const data = await apiGet<TelegramSettingsData>("/settings/telegram");
      setTelegramSettings(data);
    } catch (error) {
      console.error("Failed to load Telegram settings:", error);
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

  // Telegram handlers
  const handleSaveTelegram = async () => {
    setIsSavingTelegram(true);
    setTelegramTestResult(null);
    try {
      const data = await apiPut<TelegramSettingsData>("/settings/telegram", {
        telegramBotToken: telegramBotToken || null,
        telegramEnabled: true,
      });
      setTelegramSettings(data);
      setTelegramBotToken(""); // Clear the input after saving
      setShowBotToken(false);
    } catch (error: any) {
      setTelegramTestResult({
        success: false,
        message: error.message,
      });
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramTestResult(null);
    try {
      const data = await apiPost<{ success: boolean; message: string }>("/settings/telegram/test");
      setTelegramTestResult({
        success: true,
        message: data.message || "Test notification sent!",
      });
    } catch (error: any) {
      setTelegramTestResult({
        success: false,
        message: error.message || "Failed to send test notification",
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!confirm("Are you sure you want to disconnect Telegram? You will stop receiving notifications.")) {
      return;
    }
    setIsDisconnectingTelegram(true);
    try {
      await apiDelete("/settings/telegram");
      setTelegramSettings({
        hasBotToken: false,
        telegramChatId: null,
        telegramEnabled: false,
      });
      setTelegramTestResult(null);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsDisconnectingTelegram(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

      {/* Telegram Configuration */}
      {selectedChannel === "telegram" && (
        <Card className="p-6 space-y-4 border-2 animate-in fade-in">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Telegram
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Receive notifications and chat with AI via Telegram
              </p>
            </div>
            {telegramSettings?.hasBotToken && telegramSettings?.telegramChatId && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            )}
          </div>

          {/* Connection Status */}
          {telegramSettings?.hasBotToken && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Bot Token</span>
                <span className="text-green-600 text-sm">✓ Configured</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Chat ID</span>
                {telegramSettings.telegramChatId ? (
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-gray-200 px-2 py-1 rounded">
                      {telegramSettings.telegramChatId}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard(telegramSettings.telegramChatId!)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-yellow-600 text-sm">⚠ Waiting for /start</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <span className={telegramSettings.telegramEnabled ? "text-green-600 text-sm" : "text-gray-500 text-sm"}>
                  {telegramSettings.telegramEnabled ? "✓ Enabled" : "○ Disabled"}
                </span>
              </div>
            </div>
          )}

          {/* Setup Form */}
          {!telegramSettings?.hasBotToken && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="telegramBotToken">Bot Token</Label>
                <Input
                  id="telegramBotToken"
                  type={showBotToken ? "text" : "password"}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  className="mt-2 font-mono text-sm"
                />
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="showToken"
                    checked={showBotToken}
                    onChange={(e) => setShowBotToken(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="showToken" className="text-xs text-muted-foreground">
                    Show token
                  </label>
                </div>
              </div>

              <Button
                onClick={handleSaveTelegram}
                disabled={isSavingTelegram || !telegramBotToken}
                size="sm"
              >
                {isSavingTelegram ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Connect Bot"
                )}
              </Button>
            </div>
          )}

          {/* Actions when connected */}
          {telegramSettings?.hasBotToken && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleTestTelegram}
                disabled={isTestingTelegram || !telegramSettings.telegramChatId}
                size="sm"
                variant="outline"
              >
                {isTestingTelegram ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test
                  </>
                )}
              </Button>
              <Button
                onClick={handleDisconnectTelegram}
                disabled={isDisconnectingTelegram}
                size="sm"
                variant="destructive"
              >
                {isDisconnectingTelegram ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Disconnect
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Test Result */}
          {telegramTestResult && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 ${
                telegramTestResult.success
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {telegramTestResult.success ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="text-sm">{telegramTestResult.message}</span>
            </div>
          )}

          {/* Setup Instructions */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-3">
            <h4 className="font-medium text-sm text-blue-900">How to set up Telegram</h4>
            
            <div className="space-y-2">
              <p className="text-xs text-blue-800 font-medium">Step 1: Create your bot</p>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside ml-2">
                <li>Open Telegram and search for <strong>@BotFather</strong></li>
                <li>Send <code className="bg-blue-100 px-1 rounded">/newbot</code> to create a new bot</li>
                <li>Choose a name for your bot (e.g., "My Second Brain")</li>
                <li>Choose a username ending in "bot" (e.g., "my_brain_bot")</li>
                <li>Copy the token provided by BotFather</li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-blue-800 font-medium">Step 2: Connect the bot</p>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside ml-2">
                <li>Paste your bot token above and click "Connect Bot"</li>
                <li>Open your bot in Telegram (click the link BotFather gave you)</li>
                <li>Send <code className="bg-blue-100 px-1 rounded">/start</code> to your bot</li>
                <li>Your chat will be automatically connected!</li>
              </ol>
            </div>

            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
            >
              Open BotFather
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Waiting for /start notice */}
          {telegramSettings?.hasBotToken && !telegramSettings?.telegramChatId && (
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Waiting for connection</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Open your bot in Telegram and send <code className="bg-yellow-100 px-1 rounded">/start</code> to complete the setup.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
