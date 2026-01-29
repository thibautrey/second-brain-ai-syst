/**
 * Transcription Context Buffer Service
 *
 * Manages continuous transcription context across audio chunks to provide
 * meaningful context for the noise filter and other processing stages.
 *
 * Key features:
 * - Accumulates transcriptions per session with timestamps
 * - Concatenates recent chunks to provide full context
 * - Implements sliding window to stay within token limits
 * - Tracks conversation continuity across chunks
 * - Provides context summary when rotating out old content
 */

// ==================== Types ====================

export interface TranscriptionChunk {
  text: string;
  timestamp: number;
  duration: number;
  confidence: number;
  isPartial?: boolean;
}

export interface ContextWindow {
  /** All chunks in the current window */
  chunks: TranscriptionChunk[];
  /** Concatenated text of all chunks */
  fullText: string;
  /** Summary of rotated-out content (when context exceeded limits) */
  previousContextSummary?: string;
  /** Total token count of current window */
  tokenCount: number;
  /** When the window started */
  windowStartTime: number;
  /** Count of chunks that were rotated out */
  rotatedChunksCount: number;
}

export interface ChunkAnalysisContext {
  /** Is this chunk likely a continuation of the previous? */
  isContinuation: boolean;
  /** How much time passed since last chunk */
  timeSinceLastChunk: number;
  /** The previous chunk text (if exists) */
  previousChunkText?: string;
  /** Full context with all recent chunks */
  fullContext: string;
  /** Summary of older context that was rotated out */
  olderContextSummary?: string;
  /** Number of chunks in current context */
  chunkCount: number;
  /** Total conversation duration in seconds */
  conversationDuration: number;
}

export interface ContextBufferConfig {
  /** Maximum tokens before rotating out old content */
  maxTokens: number;
  /** Maximum time window in seconds (default: 300 = 5 minutes) */
  maxTimeWindowSeconds: number;
  /** Minimum tokens to keep after rotation */
  minTokensAfterRotation: number;
  /** Time threshold to consider a new conversation (seconds) */
  newConversationThresholdSeconds: number;
}

// ==================== Default Config ====================

const DEFAULT_CONFIG: ContextBufferConfig = {
  maxTokens: 2000, // ~2000 tokens allows for good context while leaving room for prompts
  maxTimeWindowSeconds: 300, // 5 minutes
  minTokensAfterRotation: 500, // Keep at least 500 tokens after rotation
  newConversationThresholdSeconds: 60, // 1 minute of silence = new conversation
};

// ==================== Transcription Context Buffer ====================

export class TranscriptionContextBuffer {
  private config: ContextBufferConfig;
  private chunks: TranscriptionChunk[] = [];
  private previousContextSummary?: string;
  private rotatedChunksCount: number = 0;
  private windowStartTime: number = Date.now();

  constructor(config: Partial<ContextBufferConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a new transcription chunk to the buffer
   */
  addChunk(chunk: TranscriptionChunk): ChunkAnalysisContext {
    const now = Date.now();
    const lastChunk = this.chunks[this.chunks.length - 1];
    const timeSinceLastChunk = lastChunk 
      ? (chunk.timestamp - lastChunk.timestamp) / 1000 
      : 0;

    // Check if this is a new conversation (long silence)
    if (timeSinceLastChunk > this.config.newConversationThresholdSeconds) {
      console.log(`[ContextBuffer] Long silence detected (${timeSinceLastChunk.toFixed(1)}s) - starting new conversation context`);
      this.startNewConversation();
    }

    // Add the chunk
    this.chunks.push(chunk);

    // Check if we need to rotate out old content
    this.rotateIfNeeded();

    // Build the context for analysis
    return this.buildAnalysisContext(chunk, lastChunk, timeSinceLastChunk);
  }

  /**
   * Get the current context window
   */
  getContextWindow(): ContextWindow {
    const fullText = this.chunks.map(c => c.text).join(' ');
    const tokenCount = this.countTokens(fullText);

    return {
      chunks: [...this.chunks],
      fullText,
      previousContextSummary: this.previousContextSummary,
      tokenCount,
      windowStartTime: this.windowStartTime,
      rotatedChunksCount: this.rotatedChunksCount,
    };
  }

  /**
   * Get context specifically for the noise filter
   */
  getNoiseFilterContext(): {
    recentTranscripts: string[];
    fullContext: string;
    isChunkContinuation: boolean;
    conversationDuration: number;
    chunkCount: number;
    previousContextSummary?: string;
  } {
    const recentTranscripts = this.chunks
      .slice(-5) // Last 5 chunks
      .map(c => c.text);

    const fullContext = this.buildFullContextString();

    const lastChunk = this.chunks[this.chunks.length - 1];
    const secondLastChunk = this.chunks[this.chunks.length - 2];
    
    const isChunkContinuation = secondLastChunk && lastChunk
      ? (lastChunk.timestamp - secondLastChunk.timestamp) / 1000 < 5
      : false;

    const conversationDuration = this.chunks.length > 0
      ? (this.chunks[this.chunks.length - 1].timestamp - this.windowStartTime) / 1000
      : 0;

    return {
      recentTranscripts,
      fullContext,
      isChunkContinuation,
      conversationDuration,
      chunkCount: this.chunks.length,
      previousContextSummary: this.previousContextSummary,
    };
  }

  /**
   * Build a full context string for LLM analysis
   */
  buildFullContextString(): string {
    let context = '';

    // Add summary of rotated content if exists
    if (this.previousContextSummary) {
      context += `[Résumé du contexte précédent: ${this.previousContextSummary}]\n\n`;
    }

    // Add recent chunks with timestamps
    if (this.chunks.length > 0) {
      context += 'Transcriptions récentes (chunks audio continus):\n';
      
      for (let i = 0; i < this.chunks.length; i++) {
        const chunk = this.chunks[i];
        const isLast = i === this.chunks.length - 1;
        const marker = isLast ? '→ [ACTUEL]' : `[Chunk ${i + 1}]`;
        
        // Calculate time offset from start
        const timeOffset = ((chunk.timestamp - this.windowStartTime) / 1000).toFixed(1);
        
        context += `${marker} (+${timeOffset}s): "${chunk.text}"${chunk.isPartial ? ' [partiel]' : ''}\n`;
      }
    }

    return context.trim();
  }

  /**
   * Build analysis context for a new chunk
   */
  private buildAnalysisContext(
    currentChunk: TranscriptionChunk,
    lastChunk: TranscriptionChunk | undefined,
    timeSinceLastChunk: number
  ): ChunkAnalysisContext {
    // Determine if this is likely a continuation
    // Short time gap and incomplete sentence in previous chunk = continuation
    const isContinuation = lastChunk 
      ? timeSinceLastChunk < 5 && this.looksIncomplete(lastChunk.text)
      : false;

    const conversationDuration = this.chunks.length > 0
      ? (currentChunk.timestamp - this.windowStartTime) / 1000
      : 0;

    return {
      isContinuation,
      timeSinceLastChunk,
      previousChunkText: lastChunk?.text,
      fullContext: this.buildFullContextString(),
      olderContextSummary: this.previousContextSummary,
      chunkCount: this.chunks.length,
      conversationDuration,
    };
  }

  /**
   * Check if text looks like an incomplete sentence/fragment
   */
  private looksIncomplete(text: string): boolean {
    const trimmed = text.trim();
    
    // Check for incomplete sentence markers
    const incompletePatterns = [
      /\.{3,}$/, // Ends with ...
      /[,;:]$/, // Ends with comma, semicolon, colon
      /\bet\s*$/, // Ends with "et"
      /\bde\s*$/, // Ends with "de"
      /\bque\s*$/, // Ends with "que"
      /\bpour\s*$/, // Ends with "pour"
      /\band\s*$/i, // Ends with "and"
      /\bthe\s*$/i, // Ends with "the"
      /\bto\s*$/i, // Ends with "to"
      /[a-zàâäéèêëïîôùûüç]$/i, // Ends with a lowercase letter (mid-word cut)
    ];

    // Check for complete sentence markers
    const completePatterns = [
      /[.!?]$/, // Ends with sentence-ending punctuation
      /[.!?]["']$/, // Ends with punctuation + quote
    ];

    // If ends with complete marker, not incomplete
    for (const pattern of completePatterns) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }

    // If matches incomplete pattern, it's incomplete
    for (const pattern of incompletePatterns) {
      if (pattern.test(trimmed)) {
        return true;
      }
    }

    // Default: assume complete if 10+ words
    const wordCount = trimmed.split(/\s+/).length;
    return wordCount < 5;
  }

  /**
   * Start a new conversation context
   */
  private startNewConversation(): void {
    // Generate summary of old context if substantial
    if (this.chunks.length > 2) {
      this.previousContextSummary = this.generateContextSummary();
    }

    this.rotatedChunksCount += this.chunks.length;
    this.chunks = [];
    this.windowStartTime = Date.now();
  }

  /**
   * Rotate out old content if we exceed limits
   */
  private rotateIfNeeded(): void {
    const fullText = this.chunks.map(c => c.text).join(' ');
    const tokenCount = this.countTokens(fullText);

    if (tokenCount > this.config.maxTokens) {
      console.log(`[ContextBuffer] Token limit exceeded (${tokenCount}/${this.config.maxTokens}) - rotating old content`);
      
      // Generate summary of content we're about to rotate out
      const currentSummary = this.generateContextSummary();
      
      // Merge with existing summary if present
      if (this.previousContextSummary) {
        this.previousContextSummary = `${this.previousContextSummary} | ${currentSummary}`;
        // Truncate if summary gets too long
        if (this.previousContextSummary.length > 500) {
          this.previousContextSummary = this.previousContextSummary.slice(-500);
        }
      } else {
        this.previousContextSummary = currentSummary;
      }

      // Remove oldest chunks until we're under the limit
      while (this.chunks.length > 1) {
        const newFullText = this.chunks.slice(1).map(c => c.text).join(' ');
        const newTokenCount = this.countTokens(newFullText);
        
        if (newTokenCount <= this.config.minTokensAfterRotation) {
          break; // Don't remove more chunks
        }
        
        this.rotatedChunksCount++;
        this.chunks.shift();

        if (newTokenCount <= this.config.maxTokens * 0.7) {
          break; // Good enough
        }
      }

      console.log(`[ContextBuffer] After rotation: ${this.chunks.length} chunks, ~${this.countTokens(this.chunks.map(c => c.text).join(' '))} tokens`);
    }

    // Also check time window
    if (this.chunks.length > 0) {
      const oldestChunk = this.chunks[0];
      const windowDuration = (Date.now() - oldestChunk.timestamp) / 1000;
      
      if (windowDuration > this.config.maxTimeWindowSeconds) {
        console.log(`[ContextBuffer] Time window exceeded (${windowDuration.toFixed(0)}s) - removing old chunks`);
        
        const cutoffTime = Date.now() - (this.config.maxTimeWindowSeconds * 1000);
        const oldChunks = this.chunks.filter(c => c.timestamp < cutoffTime);
        
        if (oldChunks.length > 0) {
          // Generate summary for old chunks
          const oldSummary = this.summarizeChunks(oldChunks);
          if (this.previousContextSummary) {
            this.previousContextSummary = `${this.previousContextSummary} | ${oldSummary}`;
          } else {
            this.previousContextSummary = oldSummary;
          }
          
          this.rotatedChunksCount += oldChunks.length;
          this.chunks = this.chunks.filter(c => c.timestamp >= cutoffTime);
        }
      }
    }
  }

  /**
   * Generate a simple summary of current chunks
   */
  private generateContextSummary(): string {
    if (this.chunks.length === 0) return '';

    // Extract key topics/entities from chunks
    const allText = this.chunks.map(c => c.text).join(' ');
    
    // Simple summary: first and last few words + topic indicators
    const words = allText.split(/\s+/);
    
    if (words.length <= 20) {
      return allText;
    }

    // Get first 10 and last 10 words
    const summary = `${words.slice(0, 10).join(' ')}... ${words.slice(-10).join(' ')}`;
    
    return summary;
  }

  /**
   * Summarize a subset of chunks
   */
  private summarizeChunks(chunks: TranscriptionChunk[]): string {
    const allText = chunks.map(c => c.text).join(' ');
    const words = allText.split(/\s+/);
    
    if (words.length <= 15) {
      return allText;
    }

    return `${words.slice(0, 8).join(' ')}... (${chunks.length} segments)`;
  }

  /**
   * Count tokens in text
   * Uses a simple estimation: ~4 characters per token for English/French
   * This is a good approximation for GPT models
   */
  private countTokens(text: string): number {
    // Simple estimation: ~4 characters per token on average
    // This is reasonably accurate for most use cases
    // For more precise counting, could integrate tiktoken or similar
    return Math.ceil(text.length / 4);
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.chunks = [];
    this.previousContextSummary = undefined;
    this.rotatedChunksCount = 0;
    this.windowStartTime = Date.now();
  }

  /**
   * Get statistics
   */
  getStats(): {
    chunkCount: number;
    tokenCount: number;
    rotatedChunksCount: number;
    conversationDurationSeconds: number;
    hasPreviousContext: boolean;
  } {
    const fullText = this.chunks.map(c => c.text).join(' ');
    const tokenCount = this.countTokens(fullText);
    const conversationDuration = this.chunks.length > 0
      ? (this.chunks[this.chunks.length - 1].timestamp - this.windowStartTime) / 1000
      : 0;

    return {
      chunkCount: this.chunks.length,
      tokenCount,
      rotatedChunksCount: this.rotatedChunksCount,
      conversationDurationSeconds: conversationDuration,
      hasPreviousContext: !!this.previousContextSummary,
    };
  }
}

// ==================== Session Context Manager ====================

/**
 * Manages context buffers per session
 */
export class SessionContextManager {
  private sessionBuffers: Map<string, TranscriptionContextBuffer> = new Map();
  private defaultConfig: Partial<ContextBufferConfig>;

  constructor(defaultConfig: Partial<ContextBufferConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create buffer for a session
   */
  getBuffer(sessionId: string): TranscriptionContextBuffer {
    let buffer = this.sessionBuffers.get(sessionId);
    
    if (!buffer) {
      buffer = new TranscriptionContextBuffer(this.defaultConfig);
      this.sessionBuffers.set(sessionId, buffer);
      console.log(`[SessionContextManager] Created new context buffer for session ${sessionId.slice(0, 8)}...`);
    }

    return buffer;
  }

  /**
   * Add a chunk to a session's buffer
   */
  addChunk(sessionId: string, chunk: TranscriptionChunk): ChunkAnalysisContext {
    const buffer = this.getBuffer(sessionId);
    return buffer.addChunk(chunk);
  }

  /**
   * Get noise filter context for a session
   */
  getNoiseFilterContext(sessionId: string) {
    const buffer = this.getBuffer(sessionId);
    return buffer.getNoiseFilterContext();
  }

  /**
   * Close a session's buffer
   */
  closeSession(sessionId: string): void {
    const buffer = this.sessionBuffers.get(sessionId);
    if (buffer) {
      const stats = buffer.getStats();
      console.log(`[SessionContextManager] Closing session ${sessionId.slice(0, 8)}... - processed ${stats.chunkCount + stats.rotatedChunksCount} total chunks`);
      this.sessionBuffers.delete(sessionId);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessionBuffers.keys());
  }
}

// ==================== Singleton Export ====================

export const sessionContextManager = new SessionContextManager();
