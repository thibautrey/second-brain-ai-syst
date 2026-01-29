/**
 * Polling Writer
 *
 * Collects streaming events in memory for polling-based clients.
 */

import {
  type StreamWriter,
  type StreamEvent,
  type EnhancedStreamEventType,
  type StatusEvent,
} from "./enhanced-streaming.js";

export interface StoredStreamEvent extends Record<string, any> {
  type: EnhancedStreamEventType;
  timestamp: number;
  messageId: string;
  seq: number;
  [key: string]: any;
}

export class PollingWriter implements StreamWriter {
  private messageId: string;
  private isClosed = false;
  private seq = 0;
  private onEvent: (event: StoredStreamEvent) => void;

  constructor(messageId: string, onEvent: (event: StoredStreamEvent) => void) {
    this.messageId = messageId;
    this.onEvent = onEvent;
  }

  write(event: Partial<StreamEvent> & { type: EnhancedStreamEventType }): void {
    if (this.isClosed) return;

    const fullEvent: StreamEvent = {
      ...event,
      timestamp: Date.now(),
      messageId: this.messageId,
    } as StreamEvent;

    this.seq += 1;
    this.onEvent({ ...fullEvent, seq: this.seq });
  }

  status(message: string, phase?: StatusEvent["phase"]): void {
    this.write({ type: "status", message, phase } as StatusEvent);
  }

  textDelta(content: string): void {
    this.write({ type: "text_delta", content });
  }

  thinkingDelta(content: string): void {
    this.write({ type: "thinking_delta", content });
  }

  toolArgsPreview(
    toolId: string,
    toolName: string,
    partialArgs: string,
    parsedPreview?: Record<string, unknown>,
  ): void {
    this.write({
      type: "tool_args_delta",
      toolId,
      toolName,
      partialArgs,
      parsedPreview,
    });
  }

  error(error: string, code?: string, isRetryable = false): void {
    this.write({ type: "error", error, code, isRetryable });
  }

  end(): void {
    if (this.isClosed) return;
    this.write({ type: "end" });
    this.isClosed = true;
  }

  isOpen(): boolean {
    return !this.isClosed;
  }
}
