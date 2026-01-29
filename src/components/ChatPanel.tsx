/**
 * Chat Panel Component
 *
 * Simple chat interface with message stream and tool call display
 */

import { Bot, Loader2, Send, Trash2, User } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "./ui/button";
import { MarkdownContent } from "./MarkdownContent";
import { MessageToolHistory } from "./Chat/MessageToolHistory";
import { ToolActivityDisplay } from "./Chat/ToolActivityDisplay";
import { cn } from "../lib/utils";
import { useChatMessages } from "../hooks/useChatMessages";
import { useTranslation } from "react-i18next";

export function ChatPanel() {
  const { t } = useTranslation();
  const {
    messages,
    isLoading,
    error,
    currentToolCall,
    currentToolGeneration,
    activeToolCalls,
    thinkingPhase,
    thinkingContent,
    statusMessage,
    sendMessage,
    clearMessages,
  } = useChatMessages();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get thinking data from the current streaming message
  const currentMessage = messages[messages.length - 1];
  const thinkingData =
    currentMessage?.role === "assistant" ? currentMessage.thinking : undefined;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    messages,
    currentToolCall,
    currentToolGeneration,
    activeToolCalls,
    thinkingPhase,
    thinkingContent,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-white rounded-lg shadow border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">
            {t("chat.panelTitle")}
          </h3>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            className="text-slate-500 hover:text-slate-700"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t("common.clear")}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Bot className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">{t("chat.emptyTitle")}</p>
            <p className="mt-1 text-xs">{t("chat.accessMemories")}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "flex-row-reverse" : "",
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-600",
                )}
              >
                {msg.role === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              {/* Message bubble */}
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-4 py-2",
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-900",
                )}
              >
                <div className="text-sm">
                  <MarkdownContent content={msg.content} />
                </div>
                {msg.isStreaming && !msg.content && (
                  <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                )}

                {/* Tool history for assistant messages (only show when not streaming) */}
                {msg.role === "assistant" &&
                  !msg.isStreaming &&
                  msg.toolCalls &&
                  msg.toolCalls.length > 0 && (
                    <MessageToolHistory toolCalls={msg.toolCalls} />
                  )}
              </div>
            </div>
          ))
        )}

        {/* Real-time Tool Activity Display - Shows during processing */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-slate-200 text-slate-600">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1 max-w-[75%]">
              <ToolActivityDisplay
                activeToolCalls={activeToolCalls}
                currentToolGeneration={currentToolGeneration}
                thinkingPhase={thinkingPhase}
                thinkingContent={thinkingContent}
                thinkingData={thinkingData}
                statusMessage={statusMessage}
              />
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.inputPlaceholder")}
            disabled={isLoading}
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "placeholder:text-slate-400",
            )}
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
