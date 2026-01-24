/**
 * JSON Parser Utility
 * Handles parsing JSON from LLM responses that may contain markdown code blocks
 */

/**
 * Strip markdown code blocks from a string
 * Handles formats like:
 * ```json
 * { ... }
 * ```
 * or
 * ```
 * { ... }
 * ```
 */
export function stripMarkdownCodeBlocks(text: string): string {
  if (!text || typeof text !== 'string') {
    // Return empty string for invalid inputs to maintain type safety
    return '';
  }

  // First, try to match complete code blocks (with anchors for start/end)
  // This handles the most common case where LLM wraps entire response
  let cleaned = text.replace(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/gm, '$1');
  
  // If that didn't change anything, try removing code blocks anywhere in text
  // This handles cases where code blocks aren't at the start/end
  if (cleaned === text) {
    cleaned = text.replace(/```(?:json)?\s*\n([\s\S]*?)\n```/g, '$1');
  }
  
  // Also handle inline code blocks without newlines (less common but possible)
  cleaned = cleaned.replace(/```(?:json)?\s*/g, '');
  cleaned = cleaned.replace(/```\s*$/g, '');
  
  return cleaned.trim();
}

/**
 * Parse JSON from LLM response, automatically stripping markdown code blocks
 * @param response - The LLM response that may contain JSON wrapped in markdown
 * @returns Parsed JSON object
 * @throws SyntaxError if JSON is invalid after stripping markdown
 */
export function parseJSONFromLLMResponse<T = any>(response: string): T {
  const cleaned = stripMarkdownCodeBlocks(response);
  return JSON.parse(cleaned);
}
