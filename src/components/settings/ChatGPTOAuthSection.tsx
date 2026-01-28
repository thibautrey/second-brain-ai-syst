/**
 * ChatGPT OAuth Integration Component
 * Allows users to connect their ChatGPT account for API access
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link2,
  Link2Off,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { useChatGPTOAuth } from "../../hooks/useChatGPTOAuth";

interface ChatGPTOAuthSectionProps {
  className?: string;
}

export function ChatGPTOAuthSection({ className }: ChatGPTOAuthSectionProps) {
  const { t } = useTranslation();
  const {
    status,
    isLoading,
    error,
    initiateOAuth,
    disconnect,
    toggleEnabled,
    testConnection,
    refreshStatus,
  } = useChatGPTOAuth();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setTestResult(null);
    try {
      await initiateOAuth();
      // User will be redirected to OpenAI
    } catch (err) {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setTestResult(null);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection();
      setTestResult(result);
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      await toggleEnabled(enabled);
    } catch {
      // Error is handled in hook
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg">
                {t("settings.chatgptOAuth.title", "ChatGPT Account")}
              </CardTitle>
              <CardDescription>
                {t(
                  "settings.chatgptOAuth.description",
                  "Use your ChatGPT subscription quota for API access",
                )}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshStatus}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-700 rounded-lg bg-red-50">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Connection status */}
        {!status?.isConnected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-50">
              <h4 className="font-medium text-slate-900 mb-2">
                {t("settings.chatgptOAuth.notConnected.title", "Not Connected")}
              </h4>
              <p className="text-sm text-slate-600 mb-4">
                {t(
                  "settings.chatgptOAuth.notConnected.description",
                  "Connect your ChatGPT account to use your subscription quota instead of providing an API key. This is useful if you have a ChatGPT Plus or Team subscription.",
                )}
              </p>
              <ul className="text-sm text-slate-600 space-y-1 mb-4">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {t(
                    "settings.chatgptOAuth.benefits.useSubscription",
                    "Use your existing ChatGPT subscription",
                  )}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {t(
                    "settings.chatgptOAuth.benefits.noApiKey",
                    "No need to manage separate API keys",
                  )}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {t(
                    "settings.chatgptOAuth.benefits.secure",
                    "Secure OAuth 2.0 authentication",
                  )}
                </li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("settings.chatgptOAuth.connecting", "Connecting...")}
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  {t("settings.chatgptOAuth.connect", "Connect ChatGPT Account")}
                  <ExternalLink className="w-3 h-3 ml-2" />
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected status */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-green-50">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">
                    {t("settings.chatgptOAuth.connected", "Connected")}
                  </p>
                  {status.accountId && (
                    <p className="text-sm text-green-700">
                      {t("settings.chatgptOAuth.accountId", "Account")}: {status.accountId.slice(0, 8)}...
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Enable/Disable toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <Label className="font-medium">
                  {t("settings.chatgptOAuth.useOAuth", "Use ChatGPT OAuth")}
                </Label>
                <p className="text-sm text-slate-500">
                  {t(
                    "settings.chatgptOAuth.useOAuthDescription",
                    "When enabled, uses your ChatGPT account for API requests",
                  )}
                </p>
              </div>
              <Switch
                checked={status.isEnabled}
                onCheckedChange={handleToggleEnabled}
              />
            </div>

            {/* Test connection */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
                size="sm"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {t("settings.chatgptOAuth.testConnection", "Test Connection")}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isDisconnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Link2Off className="w-4 h-4 mr-2" />
                )}
                {t("settings.chatgptOAuth.disconnect", "Disconnect")}
              </Button>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  testResult.success
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="text-sm">{testResult.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Info note */}
        <div className="p-3 text-sm rounded-lg bg-blue-50 text-blue-700">
          <p>
            <strong>{t("settings.chatgptOAuth.note", "Note")}:</strong>{" "}
            {t(
              "settings.chatgptOAuth.noteDescription",
              "ChatGPT OAuth provides an alternative to API keys. You can still configure regular API providers above, and choose which method to use per task.",
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default ChatGPTOAuthSection;
