import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { NotificationSettings } from "../components/NotificationSettings";
import { createNotification } from "../services/notificationService";
import { Send, CheckCircle, AlertCircle, Info, MessageCircle } from "lucide-react";

export function NotificationTestPage() {
  const [title, setTitle] = useState("Test Notification");
  const [message, setMessage] = useState("Ceci est une notification de test");
  const [type, setType] = useState<
    "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "REMINDER"
  >("INFO");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<"browser" | "pushover" | "telegram" | null>(null);

  const handleSendNotification = async () => {
    setIsLoading(true);
    try {
      const channels = selectedChannel === "browser" 
        ? ["BROWSER_NOTIFICATION"]
        : selectedChannel === "pushover"
        ? ["PUSHOVER"]
        : selectedChannel === "telegram"
        ? ["TELEGRAM"]
        : ["IN_APP", "PUSH"];

      await createNotification({
        title,
        message,
        type,
        channels: channels as any,
      });
    } catch (error: any) {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Configure your notification channels and preferences. The system can reach you across multiple platforms.
          </p>
        </div>

        {/* Channels Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card 
            className="p-4 border-2 border-transparent hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => setSelectedChannel(selectedChannel === "browser" ? null : "browser")}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">In-App</h3>
                <p className="text-sm text-muted-foreground">
                  Notifications within the application
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-4 border-2 border-transparent hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => setSelectedChannel(selectedChannel === "browser" ? null : "browser")}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Browser</h3>
                <p className="text-sm text-muted-foreground">
                  Web notifications from your browser
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-4 border-2 border-transparent hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => setSelectedChannel(selectedChannel === "pushover" ? null : "pushover")}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Send className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Pushover</h3>
                <p className="text-sm text-muted-foreground">
                  Mobile push notifications
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-4 border-2 border-transparent hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => setSelectedChannel(selectedChannel === "telegram" ? null : "telegram")}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-sky-100 rounded-lg">
                <MessageCircle className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Telegram</h3>
                <p className="text-sm text-muted-foreground">
                  Chat and notifications via Telegram
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Channels Configuration */}
        <NotificationSettings selectedChannel={selectedChannel} />

        {/* Test Form */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Send Test Notification</h2>
          <p className="text-sm text-muted-foreground">
            {selectedChannel 
              ? `Send a test message via ${selectedChannel === "browser" ? "Browser Notifications" : selectedChannel === "pushover" ? "Pushover" : selectedChannel === "telegram" ? "Telegram" : "the selected channel"}`
              : "Select a channel above to send a test notification"
            }
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
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
                <option value="SUCCESS">Success</option>
                <option value="WARNING">Warning</option>
                <option value="ERROR">Error</option>
                <option value="REMINDER">Reminder</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Notification content"
              rows={3}
            />
          </div>

          <Button
            onClick={handleSendNotification}
            disabled={isLoading || !title || !message || !selectedChannel}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Notification
              </>
            )}
          </Button>
        </Card>
      </div>
    </div>
  );
}
