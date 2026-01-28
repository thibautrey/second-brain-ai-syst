import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { NotificationSettings } from "../components/NotificationSettings";
import { createNotification } from "../services/notificationService";
import { Send, CheckCircle, AlertCircle, Info, MessageCircle } from "lucide-react";

export function NotificationTestPage() {
  const { t } = useTranslation();
  const [title, setTitle] = useState(() => t("notificationTest.defaultTitle"));
  const [message, setMessage] = useState(() => t("notificationTest.defaultMessage"));
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
          <h1 className="text-4xl font-bold">
            {t("notificationTest.title")}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t("notificationTest.subtitle")}
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
                <h3 className="font-semibold">
                  {t("notificationTest.channels.inApp.title")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("notificationTest.channels.inApp.description")}
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
                <h3 className="font-semibold">
                  {t("notificationTest.channels.browser.title")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("notificationTest.channels.browser.description")}
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
                <h3 className="font-semibold">
                  {t("notificationTest.channels.pushover.title")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("notificationTest.channels.pushover.description")}
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
                <h3 className="font-semibold">
                  {t("notificationTest.channels.telegram.title")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("notificationTest.channels.telegram.description")}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Channels Configuration */}
        <NotificationSettings selectedChannel={selectedChannel} />

        {/* Test Form */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">
            {t("notificationTest.testForm.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedChannel
              ? t("notificationTest.testForm.selectedChannel", {
                  channel: t(
                    `notificationTest.channels.${selectedChannel}.title`,
                  ),
                })
              : t("notificationTest.testForm.selectChannel")}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("notificationTest.form.title")}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("notificationTest.form.titlePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t("notificationTest.form.type")}</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="INFO">
                  {t("notificationTest.form.types.info")}
                </option>
                <option value="SUCCESS">
                  {t("notificationTest.form.types.success")}
                </option>
                <option value="WARNING">
                  {t("notificationTest.form.types.warning")}
                </option>
                <option value="ERROR">
                  {t("notificationTest.form.types.error")}
                </option>
                <option value="REMINDER">
                  {t("notificationTest.form.types.reminder")}
                </option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              {t("notificationTest.form.message")}
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("notificationTest.form.messagePlaceholder")}
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
                {t("notificationTest.form.sending")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t("notificationTest.form.send")}
              </>
            )}
          </Button>
        </Card>
      </div>
    </div>
  );
}
