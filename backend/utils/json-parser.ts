/**
 * JSON Parser Utility
 * Handles parsing JSON from LLM responses that may contain markdown code blocks,
 * incomplete JSON, or non-JSON prefixes
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
  if (!text) {
    // Return empty string for null/undefined to avoid crashes
    return "";
  }

  if (typeof text !== "string") {
    // For non-string inputs, return empty string
    // (In production Node.js environment, this should never happen due to TypeScript)
    return "";
  }

  // First, try to match complete code blocks (with anchors for start/end)
  // This handles the most common case where LLM wraps entire response
  let cleaned = text.replace(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/m, "$1");

  // If that didn't change anything, try removing code blocks anywhere in text
  // This handles cases where code blocks aren't at the start/end
  if (cleaned === text) {
    cleaned = text.replace(/```(?:json)?\s*\n([\s\S]*?)\n```/g, "$1");
  }

  // Only apply fallback cleanup if we haven't already extracted content from code blocks
  // This minimizes risk of corrupting JSON that might contain backticks
  if (cleaned === text && text.includes("```")) {
    // Handle inline code blocks without newlines (less common)
    cleaned = cleaned.replace(/^```(?:json)?\s*/g, "");
    cleaned = cleaned.replace(/```\s*$/g, "");
  }

  return cleaned.trim();
}

/**
 * Extract JSON from text that may contain non-JSON prefixes
 * Finds the first { and last } and extracts everything between
 */
export function extractJSONFromText(text: string): string {
  const trimmed = text.trim();

  // Find the first opening brace
  const startIdx = trimmed.indexOf("{");
  if (startIdx === -1) {
    // No opening brace found, return original text
    return trimmed;
  }

  // Find the last closing brace
  const endIdx = trimmed.lastIndexOf("}");
  if (endIdx === -1 || endIdx <= startIdx) {
    // No valid closing brace after opening brace
    return trimmed;
  }

  // Extract the JSON substring
  return trimmed.substring(startIdx, endIdx + 1);
}

/**
 * Try to repair incomplete JSON by adding missing closing braces
 */
export function repairIncompleteJSON(text: string): string {
  let repaired = text.trim();

  // Count opening and closing braces
  let openBraces = 0;
  let closeBraces = 0;

  for (const char of repaired) {
    if (char === "{") openBraces++;
    if (char === "}") closeBraces++;
  }

  // Add missing closing braces
  while (openBraces > closeBraces) {
    repaired += "}";
    closeBraces++;
  }

  return repaired;
}

/**
 * Parse JSON from LLM response with multiple fallback strategies
 * @param response - The LLM response that may contain JSON wrapped in markdown
 * @returns Parsed JSON object
 * @throws SyntaxError if JSON cannot be parsed after all strategies
 */
export function parseJSONFromLLMResponse<T = any>(response: string): T {
  if (!response || typeof response !== "string") {
    throw new Error("Response must be a non-empty string");
  }

  let cleaned = stripMarkdownCodeBlocks(response);

  // Strategy 1: Try direct parsing
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Strategy 1 failed, try extraction
  }

  // Strategy 2: Extract JSON from text with non-JSON prefixes
  const extracted = extractJSONFromText(cleaned);
  if (extracted !== cleaned) {
    try {
      return JSON.parse(extracted);
    } catch (e2) {
      // Strategy 2 failed, try repair
    }
  }

  // Strategy 3: Repair incomplete JSON
  const repaired = repairIncompleteJSON(extracted);
  if (repaired !== extracted) {
    try {
      return JSON.parse(repaired);
    } catch (e3) {
      // Strategy 3 failed, try as is
    }
  }

  // Strategy 4: If all strategies fail, throw detailed error
  console.error("[JSONParser] Failed to parse JSON from response:");
  console.error("Original response:", response.substring(0, 200));
  console.error("After markdown stripping:", cleaned.substring(0, 200));
  console.error("After extraction:", extracted.substring(0, 200));
  console.error("After repair:", repaired.substring(0, 200));

  throw new SyntaxError(
    `Failed to parse JSON from LLM response: "${cleaned.substring(0, 100)}..."`,
  );
}
