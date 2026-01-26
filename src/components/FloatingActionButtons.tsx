/**
 * Floating Action Buttons Component
 *
 * Combines the chat and continuous listening buttons in the bottom-right corner.
 * Both buttons appear as animated bubbles with smooth interactions.
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Trash2,
  Loader2,
  Bot,
  User,
  MessageSquare,
  X,
  Minimize2,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { useChatMessages } from "../hooks/useChatMessages";
import { useContinuousListening } from "../contexts/ContinuousListeningContext";
import { cn } from "../lib/utils";

export function FloatingActionButtons() {
  const { messages, isLoading, error, sendMessage, clearMessages } =
    useChatMessages();
  const { state, actions } = useContinuousListening();
  const [input, setInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isChatOpen]);

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

  const handleMicClick = () => {
    if (state.isConnected) {
      actions.stopListening();
    } else {
      actions.startListening();
    }
  };

  const unreadCount = messages.filter(
    (m) => m.role === "assistant" && !isChatOpen,
  ).length;

  // Determine the status dot color for mic button
  const getStatusDotColor = () => {
    if (state.state === "error") return "bg-red-500";
    if (state.state === "connecting") return "bg-yellow-500 animate-pulse";
    if (state.isSpeechDetected) return "bg-green-500";
    if (state.isConnected) return "bg-blue-500";
    return "bg-slate-400";
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence mode="wait">
        {isChatOpen ? (
          // Chat Window
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
            }}
            className="mb-4 flex flex-col w-[380px] h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white"
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Bot className="w-5 h-5" />
                </motion.div>
                <h3 className="font-semibold">Second Brain</h3>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearMessages}
                    className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChatOpen(false)}
                  className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center justify-center h-full text-slate-400"
                >
                  <motion.div
                    animate={{
                      y: [0, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                  >
                    <Bot className="w-12 h-12 mb-3 opacity-50" />
                  </motion.div>
                  <p className="text-sm">Commencez une conversation...</p>
                  <p className="text-xs mt-1 text-center px-4">
                    Je peux accéder à vos mémoires pour des réponses
                    personnalisées
                  </p>
                </motion.div>
              ) : (
                messages.map((msg, index) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "flex-row-reverse" : "",
                    )}
                  >
                    {/* Avatar */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                        delay: index * 0.05,
                      }}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-600 shadow-sm border border-slate-200",
                      )}
                    >
                      {msg.role === "user" ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </motion.div>

                    {/* Message bubble */}
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm",
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-white text-slate-900 border border-slate-200 rounded-bl-md",
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm">
                        {msg.content}
                      </p>
                      {msg.isStreaming && (
                        <motion.span
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="inline-block w-2 h-4 ml-1 bg-current"
                        />
                      )}
                    </motion.div>
                  </motion.div>
                ))
              )}

              {/* Loading indicator */}
              {isLoading && messages[messages.length - 1]?.content === "" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-slate-400"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <Loader2 className="w-4 h-4" />
                  </motion.div>
                  <span className="text-sm">Réflexion en cours...</span>
                </motion.div>
              )}

              {/* Error display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onSubmit={handleSubmit}
              className="p-3 border-t border-slate-200 bg-white"
            >
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Écrivez votre message..."
                  disabled={isLoading}
                  rows={1}
                  className={cn(
                    "flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "placeholder:text-slate-400 bg-slate-50",
                  )}
                  style={{ minHeight: "40px", maxHeight: "80px" }}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-3 rounded-xl bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Action Buttons Container */}
      <div className="flex flex-col items-end gap-3">
        {/* Microphone Button - Shows when chat is closed */}
        <AnimatePresence>
          {!isChatOpen && (
            <motion.button
              initial={{ opacity: 0, scale: 0, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0, x: 20 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
              }}
              onClick={handleMicClick}
              disabled={state.state === "connecting"}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-colors",
                state.isConnected
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-slate-600 hover:bg-slate-700",
                state.state === "connecting" && "cursor-wait opacity-60",
              )}
              aria-label={
                state.isConnected ? "Arrêter l'écoute" : "Démarrer l'écoute"
              }
              title={
                state.isConnected
                  ? "Écoute active - Cliquez pour arrêter"
                  : "Cliquez pour activer l'écoute"
              }
            >
              <AnimatePresence mode="wait">
                {state.isConnected ? (
                  <motion.div
                    key="mic-on"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Mic className="w-6 h-6 text-white" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mic-off"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MicOff className="w-6 h-6 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status Indicator Dot */}
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  "absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white transition-colors",
                  getStatusDotColor(),
                )}
              />

              {/* Pulse animation when listening */}
              {state.isConnected && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-blue-600"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "loop",
                  }}
                />
              )}

              {/* Speech detection pulse */}
              {state.isSpeechDetected && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-green-500"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.6, 0, 0.6],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    repeatType: "loop",
                  }}
                />
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Chat Toggle Button */}
        <motion.button
          onClick={() => setIsChatOpen(!isChatOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-colors",
            isChatOpen
              ? "bg-slate-700 hover:bg-slate-800"
              : "bg-blue-600 hover:bg-blue-700",
          )}
        >
          <AnimatePresence mode="wait">
            {isChatOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <X className="w-6 h-6 text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageSquare className="w-6 h-6 text-white" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notification badge */}
          {!isChatOpen && unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
            >
              <span className="text-white text-xs font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </motion.div>
          )}

          {/* Pulse animation when closed */}
          {!isChatOpen && (
            <motion.div
              className="absolute inset-0 rounded-full bg-blue-600"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "loop",
              }}
            />
          )}
        </motion.button>
      </div>
    </div>
  );
}
