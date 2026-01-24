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
    return text;
  }

  // Remove markdown code blocks with optional language identifier
  // Pattern matches: ```json\n...\n``` or ```\n...\n```
  let cleaned = text.replace(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/gm, '$1');
  
  // Also handle inline code blocks at the start/end
  cleaned = cleaned.replace(/^```(?:json)?\s*/gm, '');
  cleaned = cleaned.replace(/```\s*$/gm, '');
  
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
