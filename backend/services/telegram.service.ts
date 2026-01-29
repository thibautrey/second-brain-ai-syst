/**
 * Telegram Service
 *
 * Handles Telegram bot integration for:
 * 1. Sending notifications to users via their configured bots
 * 2. Receiving messages from users via long polling
 * 3. Auto-discovery of chat IDs via /start command
 * 4. Routing incoming messages to the chat system for AI interaction
 */

import axios from "axios";
import prisma from "./prisma.js";
import {
  encrypt,
  decrypt,
  generateSecureCode,
  formatVerificationCode,
} from "../utils/encryption.js";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const VERIFICATION_CODE_EXPIRY_MINUTES = 10;

// Polling state per bot token
interface PollingState {
  isPolling: boolean;
  lastUpdateId: number;
  abortController: AbortController | null;
}

const pollingStates = new Map<string, PollingState>();

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: "private" | "group" | "supergroup" | "channel";
    title?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  disable_notification?: boolean;
  reply_markup?: any;
}

class TelegramService {
  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(
    botToken: string,
    chatId: string,
    text: string,
    options: SendMessageOptions = {},
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${TELEGRAM_API_BASE}${botToken}/sendMessage`,
        {
          chat_id: chatId,
          text,
          ...options,
        },
      );

      if (response.data.ok) {
        console.log(`[TelegramService] Message sent to chat ${chatId}`);
        return true;
      } else {
        console.error(
          `[TelegramService] Failed to send message:`,
          response.data.description,
        );
        return false;
      }
    } catch (error: any) {
      console.error(
        `[TelegramService] Error sending message:`,
        error.response?.data?.description || error.message,
      );
      return false;
    }
  }

  /**
   * Send typing/action status to chat
   */
  async sendChatAction(
    botToken: string,
    chatId: string,
    action:
      | "typing"
      | "upload_photo"
      | "record_video"
      | "record_voice"
      | "upload_video"
      | "upload_voice"
      | "upload_document"
      | "find_location"
      | "record_video_note",
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${TELEGRAM_API_BASE}${botToken}/sendChatAction`,
        {
          chat_id: chatId,
          action,
        },
      );

      if (response.data.ok) {
        return true;
      }

      console.error(
        `[TelegramService] Failed to send chat action:`,
        response.data.description,
      );
      return false;
    } catch (error: any) {
      console.error(
        `[TelegramService] Error sending chat action:`,
        error.response?.data?.description || error.message,
      );
      return false;
    }
  }

  /**
   * Send a notification to a user via their configured Telegram bot
   */
  async sendNotification(
    userId: string,
    title: string,
    message: string,
    actionUrl?: string,
  ): Promise<boolean> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings?.telegramBotToken || !settings?.telegramChatId) {
        console.log(
          `[TelegramService] Telegram not configured for user ${userId}`,
        );
        return false;
      }

      if (!settings.telegramEnabled) {
        console.log(`[TelegramService] Telegram disabled for user ${userId}`);
        return false;
      }

      // Format message with title
      let formattedMessage = `<b>${this.escapeHtml(title)}</b>\n\n${this.escapeHtml(message)}`;

      // Add action URL if provided
      if (actionUrl) {
        formattedMessage += `\n\n<a href="${actionUrl}">Open</a>`;
      }

      return this.sendMessage(
        settings.telegramBotToken,
        settings.telegramChatId,
        formattedMessage,
        { parse_mode: "HTML" },
      );
    } catch (error: any) {
      console.error(
        `[TelegramService] Error sending notification:`,
        error.message,
      );
      return false;
    }
  }

  /**
   * Generate a unique verification code for Telegram setup
   * Format: XXXX-XXXX-XXXX (12 alphanumeric characters)
   */
  async generateVerificationCode(
    userId: string,
    botToken: string,
  ): Promise<string> {
    // Generate random 12-character code
    const code = generateSecureCode(12);
    const formattedCode = formatVerificationCode(code);

    // Delete any existing unused verification codes for this user
    await prisma.telegramVerification.deleteMany({
      where: {
        userId,
        isUsed: false,
      },
    });

    // Encrypt bot token before storing
    const encryptedBotToken = encrypt(botToken);

    // Create new verification code
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + VERIFICATION_CODE_EXPIRY_MINUTES,
    );

    await prisma.telegramVerification.create({
      data: {
        userId,
        verificationCode: code,
        encryptedBotToken,
        expiresAt,
      },
    });

    console.log(
      `[TelegramService] Generated verification code ${formattedCode} for user ${userId}, expires at ${expiresAt.toISOString()}`,
    );

    return formattedCode;
  }

  /**
   * Verify a code from /start command
   * Returns userId if valid, null if invalid/expired
   */
  async verifyStartCode(
    code: string,
    botToken: string,
  ): Promise<{ valid: boolean; userId?: string; error?: string }> {
    try {
      // Remove any dashes from the code (user might type with or without)
      const cleanCode = code.replace(/-/g, "");

      const verification = await prisma.telegramVerification.findUnique({
        where: { verificationCode: cleanCode },
      });

      if (!verification) {
        console.warn(
          `[TelegramService] Verification failed: code ${code} not found`,
        );
        return {
          valid: false,
          error: "Code de vérification invalide",
        };
      }

      // Check if already used
      if (verification.isUsed) {
        console.warn(
          `[TelegramService] Verification failed: code ${code} already used`,
        );
        return {
          valid: false,
          error: "Ce code a déjà été utilisé",
        };
      }

      // Check if expired
      if (new Date() > verification.expiresAt) {
        console.warn(
          `[TelegramService] Verification failed: code ${code} expired at ${verification.expiresAt.toISOString()}`,
        );
        return {
          valid: false,
          error:
            "Ce code a expiré. Veuillez générer un nouveau code dans les paramètres.",
        };
      }

      // Decrypt and check if bot token matches
      try {
        const decryptedToken = decrypt(verification.encryptedBotToken);
        if (decryptedToken !== botToken) {
          console.warn(
            `[TelegramService] Verification failed: bot token mismatch for code ${code}`,
          );
          return {
            valid: false,
            error: "Token du bot incorrect",
          };
        }
      } catch (error) {
        console.error(
          `[TelegramService] Error decrypting bot token for code ${code}:`,
          error,
        );
        return {
          valid: false,
          error: "Erreur de vérification - clé de chiffrement invalide",
        };
      }

      // Mark as used
      await prisma.telegramVerification.update({
        where: { verificationCode: cleanCode },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });

      console.log(
        `[TelegramService] Verification successful for code ${code}, user ${verification.userId}`,
      );

      return {
        valid: true,
        userId: verification.userId,
      };
    } catch (error: any) {
      console.error(`[TelegramService] Error verifying code:`, error);
      return {
        valid: false,
        error: "Erreur lors de la vérification du code",
      };
    }
  }

  /**
   * Cleanup expired verification codes
   */
  async cleanupExpiredCodes(): Promise<number> {
    try {
      const result = await prisma.telegramVerification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        console.log(
          `[TelegramService] Cleaned up ${result.count} expired verification codes`,
        );
      }

      return result.count;
    } catch (error: any) {
      console.error(`[TelegramService] Error cleaning up codes:`, error);
      return 0;
    }
  }

  /**
   * Validate a bot token by calling getMe
   */
  async validateBotToken(botToken: string): Promise<{
    valid: boolean;
    botUsername?: string;
    error?: string;
  }> {
    // Basic validation of token format
    if (!botToken || typeof botToken !== "string") {
      return {
        valid: false,
        error: "Bot token is required and must be a string",
      };
    }

    if (botToken.trim().length === 0) {
      return {
        valid: false,
        error: "Bot token cannot be empty",
      };
    }

    // Telegram bot tokens should contain a colon
    if (!botToken.includes(":")) {
      return {
        valid: false,
        error:
          "Invalid bot token format. Token should be in format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
      };
    }

    try {
      const response = await axios.get(`${TELEGRAM_API_BASE}${botToken}/getMe`);

      if (response.data.ok) {
        return {
          valid: true,
          botUsername: response.data.result.username,
        };
      } else {
        return {
          valid: false,
          error: response.data.description,
        };
      }
    } catch (error: any) {
      // Better error handling for HTTP errors
      if (error.response?.status === 404) {
        return {
          valid: false,
          error:
            "Invalid bot token. Token not found on Telegram servers. Please verify your bot token is correct.",
        };
      }
      return {
        valid: false,
        error: error.response?.data?.description || error.message,
      };
    }
  }

  /**
   * Get updates from Telegram using long polling
   */
  async getUpdates(
    botToken: string,
    offset?: number,
    timeout: number = 30,
  ): Promise<TelegramUpdate[] | { error: string; code?: number }> {
    try {
      const response = await axios.get(
        `${TELEGRAM_API_BASE}${botToken}/getUpdates`,
        {
          params: {
            offset,
            timeout,
            allowed_updates: ["message"],
          },
          timeout: (timeout + 10) * 1000, // Add buffer for network latency
        },
      );

      if (response.data.ok) {
        return response.data.result;
      }

      return { error: response.data.description, code: response.status };
    } catch (error: any) {
      // Check for authorization errors
      if (error.response?.status === 401) {
        return {
          error: "Unauthorized",
          code: 401,
        };
      }

      // Don't log timeout errors as they're expected
      if (error.code !== "ECONNABORTED") {
        console.error(
          `[TelegramService] Error getting updates:`,
          error.response?.data?.description || error.message,
        );
      }
      return { error: error.message, code: error.response?.status };
    }
  }

  /**
   * Disable Telegram for a user and notify them
   */
  private async disableTelegramForUser(
    userId: string,
    reason: string,
  ): Promise<void> {
    try {
      // Disable Telegram in user settings
      await prisma.userSettings.update({
        where: { userId },
        data: {
          telegramEnabled: false,
        },
      });

      console.log(
        `[TelegramService] Disabled Telegram for user ${userId}. Reason: ${reason}`,
      );

      // Send a notification to the user via the notification service
      try {
        const { notificationService } = await import("./notification.js");

        await notificationService.createNotification({
          userId,
          title: "🔌 Telegram Bot Disconnected",
          message: `Your Telegram bot has been disconnected due to: ${reason}\n\nTo reconnect, please go to your settings and re-enter your bot token.`,
          type: "WARNING",
          channels: ["IN_APP"],
          skipSpamCheck: true, // This is critical, so skip spam check
        });
      } catch (notifError: any) {
        console.error(
          `[TelegramService] Failed to send notification about Telegram failure:`,
          notifError.message,
        );
      }
    } catch (error: any) {
      console.error(
        `[TelegramService] Error disabling Telegram for user:`,
        error.message,
      );
    }
  }

  /**
   * Start polling for a specific user's bot
   */
  async startPolling(userId: string): Promise<void> {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings?.telegramBotToken) {
      console.log(
        `[TelegramService] No bot token configured for user ${userId}`,
      );
      return;
    }

    const botToken = settings.telegramBotToken;

    // Check if already polling for this token
    if (pollingStates.has(botToken) && pollingStates.get(botToken)!.isPolling) {
      console.log(`[TelegramService] Already polling for bot token`);
      return;
    }

    const state: PollingState = {
      isPolling: true,
      lastUpdateId: 0,
      abortController: new AbortController(),
    };
    pollingStates.set(botToken, state);

    console.log(`[TelegramService] Starting polling for user ${userId}`);

    // Start polling loop
    this.pollLoop(userId, botToken, state);
  }

  /**
   * Stop polling for a specific user's bot
   */
  stopPolling(botToken: string): void {
    const state = pollingStates.get(botToken);
    if (state) {
      state.isPolling = false;
      state.abortController?.abort();
      pollingStates.delete(botToken);
      console.log(`[TelegramService] Stopped polling for bot`);
    }
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    for (const [botToken] of pollingStates) {
      this.stopPolling(botToken);
    }
  }

  /**
   * Polling loop for receiving messages
   */
  private async pollLoop(
    userId: string,
    botToken: string,
    state: PollingState,
  ): Promise<void> {
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;

    while (state.isPolling) {
      try {
        const result = await this.getUpdates(
          botToken,
          state.lastUpdateId ? state.lastUpdateId + 1 : undefined,
          30,
        );

        // Check if result is an error object
        if (
          typeof result === "object" &&
          "error" in result &&
          !Array.isArray(result)
        ) {
          const errorResult = result as { error: string; code?: number };

          // Handle authorization errors
          if (errorResult.code === 401) {
            console.error(
              `[TelegramService] Authorization failed for user ${userId}. Disabling Telegram.`,
            );

            // Disable Telegram for this user
            await this.disableTelegramForUser(
              userId,
              "Authorization failed - invalid bot token",
            );

            // Stop polling
            state.isPolling = false;
            pollingStates.delete(botToken);
            return;
          }

          // For other errors, track consecutive errors
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(
              `[TelegramService] Too many consecutive errors for user ${userId}. Disabling Telegram.`,
            );

            await this.disableTelegramForUser(
              userId,
              `Connection failed: ${errorResult.error}`,
            );
            state.isPolling = false;
            pollingStates.delete(botToken);
            return;
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        // Reset error counter on successful update fetch
        consecutiveErrors = 0;

        // Process updates
        const updates = result as TelegramUpdate[];
        for (const update of updates) {
          state.lastUpdateId = update.update_id;

          if (update.message) {
            await this.handleIncomingMessage(userId, botToken, update.message);
          }
        }
      } catch (error: any) {
        if (state.isPolling) {
          consecutiveErrors++;

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(
              `[TelegramService] Unrecoverable polling error for user ${userId}. Disabling Telegram.`,
            );

            await this.disableTelegramForUser(
              userId,
              `Polling error: ${error.message}`,
            );
            state.isPolling = false;
            pollingStates.delete(botToken);
            return;
          }

          console.error(`[TelegramService] Polling error:`, error.message);
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }
  }

  /**
   * Handle incoming message from Telegram
   */
  private async handleIncomingMessage(
    userId: string,
    botToken: string,
    message: TelegramMessage,
  ): Promise<void> {
    const chatId = message.chat.id.toString();
    const text = message.text || "";

    console.log(
      `[TelegramService] Received message from ${message.from.first_name}: ${text.substring(0, 50)}...`,
    );

    // Handle /start command - auto-register chat ID
    if (text === "/start" || text.startsWith("/start ")) {
      await this.handleStartCommand(userId, botToken, chatId, message);
      return;
    }

    // Handle /stop command - disable notifications
    if (text === "/stop") {
      await this.handleStopCommand(userId, botToken, chatId);
      return;
    }

    // Handle /status command
    if (text === "/status") {
      await this.handleStatusCommand(userId, botToken, chatId);
      return;
    }

    // For regular messages, forward to AI chat system
    await this.routeToAIChat(userId, botToken, chatId, text, message);
  }

  /**
   * Handle /start command - register chat ID with verification
   */
  private async handleStartCommand(
    userId: string,
    botToken: string,
    chatId: string,
    message: TelegramMessage,
  ): Promise<void> {
    try {
      const text = message.text || "";
      const parts = text.split(" ");

      // Check if verification code was provided: /start XXXX-XXXX
      if (parts.length > 1) {
        const providedCode = parts[1].toUpperCase();

        console.log(
          `[TelegramService] Attempting to verify code ${providedCode} for chat ${chatId}`,
        );

        // Verify the code
        const verification = await this.verifyStartCode(providedCode, botToken);

        if (!verification.valid) {
          await this.sendMessage(
            botToken,
            chatId,
            `❌ <b>Vérification échouée</b>\n\n${verification.error}\n\n` +
              `Pour configurer Telegram :\n` +
              `1. Allez dans vos paramètres Second Brain AI\n` +
              `2. Configurez votre bot Telegram\n` +
              `3. Copiez le code de vérification\n` +
              `4. Envoyez : <code>/start VOTRE-CODE</code>`,
            { parse_mode: "HTML" },
          );
          return;
        }

        // Code is valid! Associate this chat with the verified user
        await prisma.userSettings.update({
          where: { userId: verification.userId },
          data: {
            telegramChatId: chatId,
            telegramEnabled: true,
          },
        });

        const welcomeMessage = `🎉 <b>Bienvenue sur Second Brain AI!</b>

Votre compte Telegram est maintenant connecté et prêt à recevoir des notifications.

<b>Commandes disponibles :</b>
• /start CODE - Connecter/reconnecter votre compte
• /stop - Désactiver les notifications
• /status - Vérifier l'état de la connexion

Vous pouvez aussi m'envoyer des messages pour discuter avec votre assistant IA !

Votre Chat ID : <code>${chatId}</code>`;

        await this.sendMessage(botToken, chatId, welcomeMessage, {
          parse_mode: "HTML",
        });

        console.log(
          `[TelegramService] ✅ Successfully registered chat ID ${chatId} for user ${verification.userId}`,
        );
      } else {
        // No code provided - send instructions
        await this.sendMessage(
          botToken,
          chatId,
          `👋 <b>Bienvenue !</b>

Pour connecter votre compte Second Brain AI :

1. Allez dans vos <b>paramètres</b> sur le site web
2. Configurez votre <b>bot Telegram</b>
3. Copiez le <b>code de vérification</b> affiché
4. Revenez ici et envoyez :

<code>/start VOTRE-CODE-ICI</code>

Exemple : <code>/start AB12-CD34</code>

Le code expire après ${VERIFICATION_CODE_EXPIRY_MINUTES} minutes.`,
          { parse_mode: "HTML" },
        );

        console.log(
          `[TelegramService] Sent verification instructions to chat ${chatId}`,
        );
      }
    } catch (error: any) {
      console.error(`[TelegramService] Error handling /start:`, error.message);
      await this.sendMessage(
        botToken,
        chatId,
        "❌ Désolé, une erreur s'est produite. Veuillez réessayer.",
      );
    }
  }

  /**
   * Handle /stop command - disable notifications
   */
  private async handleStopCommand(
    userId: string,
    botToken: string,
    chatId: string,
  ): Promise<void> {
    try {
      await prisma.userSettings.update({
        where: { userId },
        data: {
          telegramEnabled: false,
        },
      });

      await this.sendMessage(
        botToken,
        chatId,
        "🔕 Notifications have been disabled. Use /start to re-enable them.",
      );
    } catch (error: any) {
      console.error(`[TelegramService] Error handling /stop:`, error.message);
    }
  }

  /**
   * Handle /status command
   */
  private async handleStatusCommand(
    userId: string,
    botToken: string,
    chatId: string,
  ): Promise<void> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      const status = settings?.telegramEnabled ? "✅ Enabled" : "❌ Disabled";

      await this.sendMessage(
        botToken,
        chatId,
        `<b>Connection Status</b>\n\nNotifications: ${status}\nChat ID: <code>${chatId}</code>`,
        { parse_mode: "HTML" },
      );
    } catch (error: any) {
      console.error(`[TelegramService] Error handling /status:`, error.message);
    }
  }

  /**
   * Route message to AI chat system
   */
  private async routeToAIChat(
    userId: string,
    botToken: string,
    chatId: string,
    text: string,
    message: TelegramMessage,
  ): Promise<void> {
    try {
      // Import chat controller dynamically to avoid circular dependencies
      const { processTelegramMessage } =
        await import("../controllers/chat.controller.js");

      // Signal typing status so user knows we're working
      await this.sendChatAction(botToken, chatId, "typing");

      // Process the message and get AI response
      const response = await processTelegramMessage(userId, text);

      // Send response back to Telegram
      if (response) {
        await this.sendMessage(botToken, chatId, response, {
          parse_mode: "HTML",
        });
      }
    } catch (error: any) {
      console.error(
        `[TelegramService] Error routing to AI chat:`,
        error.message,
      );

      // Send error message to user
      await this.sendMessage(
        botToken,
        chatId,
        "❌ Sorry, I couldn't process your message. Please try again later.",
      );
    }
  }

  /**
   * Start polling for all users with configured Telegram bots
   */
  async startAllPolling(): Promise<void> {
    const usersWithTelegram = await prisma.userSettings.findMany({
      where: {
        telegramBotToken: { not: null },
        telegramEnabled: true,
      },
      select: {
        userId: true,
        telegramBotToken: true,
      },
    });

    console.log(
      `[TelegramService] Starting polling for ${usersWithTelegram.length} users`,
    );

    for (const settings of usersWithTelegram) {
      await this.startPolling(settings.userId);
    }
  }

  /**
   * Escape HTML special characters for Telegram HTML parse mode
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Send a test notification to verify setup
   */
  async sendTestNotification(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings?.telegramBotToken) {
        return {
          success: false,
          message: "Telegram bot token not configured",
        };
      }

      if (!settings.telegramChatId) {
        return {
          success: false,
          message: "Chat ID not found. Please send /start to your bot first.",
        };
      }

      const success = await this.sendMessage(
        settings.telegramBotToken,
        settings.telegramChatId,
        "🎉 <b>Test Notification</b>\n\nYour Telegram integration is working correctly!",
        { parse_mode: "HTML" },
      );

      return {
        success,
        message: success
          ? "Test notification sent successfully!"
          : "Failed to send notification",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

export const telegramService = new TelegramService();
