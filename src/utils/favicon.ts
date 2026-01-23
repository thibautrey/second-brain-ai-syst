/**
 * Utility functions for fetching and managing favicons from provider endpoints
 */

const FAVICON_CACHE = new Map<string, string>();

/**
 * Fetches the favicon URL for a given provider endpoint
 * @param baseUrl - The base URL of the provider endpoint
 * @param fallbackUrl - Optional fallback URL if favicon cannot be found
 * @returns The favicon URL or null if not found
 */
export async function getFaviconUrl(
  baseUrl: string,
  fallbackUrl?: string,
): Promise<string | null> {
  if (!baseUrl) return null;

  // Check cache first
  if (FAVICON_CACHE.has(baseUrl)) {
    return FAVICON_CACHE.get(baseUrl) || null;
  }

  try {
    // Normalize the URL
    const url = new URL(baseUrl);
    const origin = url.origin;

    // Try multiple favicon locations
    const faviconUrls = [
      `${origin}/favicon.ico`,
      `${origin}/apple-touch-icon.png`,
      `${origin}/favicon.png`,
    ];

    // Try to fetch each favicon URL
    for (const faviconUrl of faviconUrls) {
      try {
        const response = await fetch(faviconUrl, {
          method: "HEAD",
          cache: "force-cache",
        });

        if (response.ok) {
          FAVICON_CACHE.set(baseUrl, faviconUrl);
          return faviconUrl;
        }
      } catch {
        // Continue to next URL
        continue;
      }
    }

    // If no favicon found, try using a favicon service
    const faviconServiceUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin)}&sz=128`;
    FAVICON_CACHE.set(baseUrl, faviconServiceUrl);
    return faviconServiceUrl;
  } catch (error) {
    console.error(`Failed to fetch favicon for ${baseUrl}:`, error);
    FAVICON_CACHE.set(baseUrl, ""); // Cache the failure
    return fallbackUrl || null;
  }
}

/**
 * Clears the favicon cache
 */
export function clearFaviconCache(): void {
  FAVICON_CACHE.clear();
}

/**
 * Gets favicon from cache if available
 * @param baseUrl - The base URL to check in cache
 * @returns The cached favicon URL or undefined
 */
export function getCachedFaviconUrl(baseUrl: string): string | undefined {
  return FAVICON_CACHE.get(baseUrl);
}
