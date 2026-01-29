import {
  CheckCircle,
  Globe,
  MessageCircle,
  Radio,
  Send,
  Smartphone,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NotificationSettings } from "../components/NotificationSettings";
import { Textarea } from "../components/ui/textarea";
import { createNotification } from "../services/notificationService";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type ChannelType = "browser" | "pushover" | "telegram";

interface ChannelCardProps {
  type: ChannelType;
  icon: React.ReactNode;
  title: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
  color: string;
}

function ChannelCard({
  icon,
  title,
  description,
  isSelected,
  onClick,
  color,
}: ChannelCardProps) {
  return (
    <Card
      className={`p-5 cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected
          ? `border-2 border-${color}-500 bg-${color}-50/50 shadow-md`
          : "border-2 border-transparent hover:border-gray-200"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div
          className={`p-3 rounded-xl ${
            isSelected ? `bg-${color}-100` : "bg-gray-100"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{title}</h3>
            {isSelected && (
              <CheckCircle className={`h-4 w-4 text-${color}-600`} />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </Card>
  );
}

export function ChannelsPage() {
  const { t } = useTranslation();
  const [title, setTitle] = useState(() => t("channels.defaultTitle"));
  const [message, setMessage] = useState(() => t("channels.defaultMessage"));
  const [type, setType] = useState<
    "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "REMINDER"
  >("INFO");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(
    null,
  );

  const handleSendNotification = async () => {
    setIsLoading(true);
    try {
      const channels =
        selectedChannel === "browser"
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
      console.error("Failed to send notification:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChannel = (channel: ChannelType) => {
    setSelectedChannel(selectedChannel === channel ? null : channel);
  };

  const channels = [
    {
      type: "browser" as ChannelType,
      icon: <Globe className="h-6 w-6 text-blue-600" />,
      title: t("channels.browser.title"),
      description: t("channels.browser.description"),
      color: "blue",
    },
    {
      type: "pushover" as ChannelType,
      icon: <Smartphone className="h-6 w-6 text-orange-600" />,
      title: t("channels.pushover.title"),
      description: t("channels.pushover.description"),
      color: "orange",
    },
    {
      type: "telegram" as ChannelType,
      icon: <MessageCircle className="h-6 w-6 text-sky-600" />,
      title: t("channels.telegram.title"),
      description: t("channels.telegram.description"),
      color: "sky",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Radio className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{t("channels.title")}</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            {t("channels.subtitle")}
          </p>
        </div>

        {/* Channel Selection */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {t("channels.selectChannel")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.type}
                type={channel.type}
                icon={channel.icon}
                title={channel.title}
                description={channel.description}
                isSelected={selectedChannel === channel.type}
                onClick={() => toggleChannel(channel.type)}
                color={channel.color}
              />
            ))}
          </div>
        </div>

        {/* Channel Configuration */}
        {selectedChannel && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <h2 className="text-xl font-semibold">
              {t("channels.configureChannel", {
                channel: t(`channels.${selectedChannel}.title`),
              })}
            </h2>
            <NotificationSettings selectedChannel={selectedChannel} />
          </div>
        )}

        {/* Test Form */}
        {selectedChannel && (
          <Card className="p-6 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">
                {t("channels.testForm.title")}
              </h2>
            </div>

            <p className="text-sm text-muted-foreground">
              {t("channels.testForm.description", {
                channel: t(`channels.${selectedChannel}.title`),
              })}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t("channels.form.title")}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("channels.form.titlePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">{t("channels.form.type")}</Label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="INFO">{t("channels.form.types.info")}</option>
                  <option value="SUCCESS">
                    {t("channels.form.types.success")}
                  </option>
                  <option value="WARNING">
                    {t("channels.form.types.warning")}
                  </option>
                  <option value="ERROR">
                    {t("channels.form.types.error")}
                  </option>
                  <option value="REMINDER">
                    {t("channels.form.types.reminder")}
                  </option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{t("channels.form.message")}</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("channels.form.messagePlaceholder")}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSendNotification}
              disabled={isLoading || !title || !message}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  {t("channels.form.sending")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {t("channels.form.send")}
                </>
              )}
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!selectedChannel && (
          <Card className="p-8 text-center border-dashed">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-gray-100 rounded-full">
                <Radio className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {t("channels.emptyState.title")}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {t("channels.emptyState.description")}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
