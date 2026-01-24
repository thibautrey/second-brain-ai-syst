/**
 * Chat Service
 */
import { API_BASE_URL, API_ENDPOINTS } from './config';
import { authService } from './auth';
import { ChatMessage, ChatRequest } from '../types';

export class ChatService {
  private static instance: ChatService;

  private constructor() {}

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async sendMessage(
    message: string,
    messages: ChatMessage[],
    conversationId?: string,
    onToken?: (token: string) => void,
    onComplete?: (fullMessage: string) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const token = await authService.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const request: ChatRequest = {
        message,
        messages: messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
        conversationId,
      };

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHAT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullMessage = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              if (onComplete) {
                onComplete(fullMessage);
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'token' && parsed.data) {
                fullMessage += parsed.data;
                if (onToken) {
                  onToken(parsed.data);
                }
              } else if (parsed.type === 'error') {
                throw new Error(parsed.data);
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines
            }
          }
        }
      }

      if (onComplete) {
        onComplete(fullMessage);
      }
    } catch (error: any) {
      if (onError) {
        onError(error);
      } else {
        throw error;
      }
    }
  }
}

export const chatService = ChatService.getInstance();
