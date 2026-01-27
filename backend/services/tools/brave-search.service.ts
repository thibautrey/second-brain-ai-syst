/**
 * Brave Search Service
 *
 * Provides web search via the Brave Search API.
 * Requires a subscription token stored as user secret "BRAVE_SEARCH_API_KEY"
 * or the environment variable BRAVE_SEARCH_API_KEY.
 */

import axios, { AxiosError } from "axios";
import { secretsService } from "../secrets.js";

export interface BraveSearchOptions {
  count?: number;
  offset?: number;
  country?: string;
  searchLang?: string;
  uiLang?: string;
  safesearch?: "off" | "moderate" | "strict";
  freshness?: "pd" | "pw" | "pm" | "py" | string;
  extraSnippets?: boolean;
  summary?: boolean;
  timeoutMs?: number;
}

export interface BraveSearchResult {
  title: string;
  url: string;
  snippet?: string;
  extraSnippets?: string[];
  language?: string;
  age?: string;
}

export interface BraveSearchResponse {
  query: string;
  total?: number | null;
  moreResultsAvailable?: boolean;
  results: BraveSearchResult[];
  summaryKey?: string;
  adjustedParams?: { count?: number; offset?: number };
}

export class BraveSearchService {
  private readonly API_URL = "https://api.search.brave.com/res/v1/web/search";
  private readonly SECRET_KEY = "BRAVE_SEARCH_API_KEY";

  /**
   * Execute a Brave web search
   */
  async searchWeb(
    userId: string,
    query: string,
    options: BraveSearchOptions = {},
  ): Promise<BraveSearchResponse> {
    if (!query || query.trim().length === 0) {
      throw new Error("Missing 'query' parameter for Brave search");
    }

    // Retrieve API key from user secrets or environment
    const secretValue =
      (await secretsService.getSecretValue(userId, this.SECRET_KEY)) ||
      process.env.BRAVE_SEARCH_API_KEY;

    if (!secretValue) {
      throw new Error(
        "Brave Search API key not found. Please add it as secret 'BRAVE_SEARCH_API_KEY' (or set env BRAVE_SEARCH_API_KEY) before using this tool.",
      );
    }

    // Clamp parameters to Brave limits (max 20 results, offsets 0-9)
    const sanitizedCount = Math.min(Math.max(options.count ?? 10, 1), 20);
    const sanitizedOffset = Math.min(Math.max(options.offset ?? 0, 0), 9);

    const params: Record<string, any> = {
      q: query,
      count: sanitizedCount,
      offset: sanitizedOffset,
      country: options.country || "us",
      search_lang: options.searchLang || "en",
      ui_lang: options.uiLang || "en-US",
      safesearch: options.safesearch || "moderate",
    };

    if (options.freshness) params.freshness = options.freshness;
    if (options.extraSnippets) params.extra_snippets = true;
    if (options.summary) params.summary = 1;

    try {
      const response = await axios.get(this.API_URL, {
        params,
        headers: {
          "X-Subscription-Token": secretValue,
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "User-Agent": "second-brain-ai/0.1",
        },
        timeout: options.timeoutMs ?? 12000,
      });

      const webResults = response.data?.web?.results || [];

      return {
        query: params.q,
        total: response.data?.web?.total ?? null,
        moreResultsAvailable:
          response.data?.query?.more_results_available ??
          response.data?.web?.more_results_available,
        summaryKey: response.data?.summarizer?.key,
        adjustedParams:
          sanitizedCount !== options.count || sanitizedOffset !== options.offset
            ? { count: sanitizedCount, offset: sanitizedOffset }
            : undefined,
        results: webResults.map((item: any) => ({
          title: item.title,
          url: item.url,
          snippet: item.description || item.snippet,
          extraSnippets: item.extra_snippets,
          language: item.language,
          age: item.page_age?.relative || item.page_age?.absolute,
        })),
      };
    } catch (error: any) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const reason =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message;

        if (status === 401 || status === 403) {
          throw new Error(
            "Brave Search rejected the request (auth error). Please verify that 'BRAVE_SEARCH_API_KEY' is valid.",
          );
        }

        throw new Error(
          `Brave Search API error${status ? ` (${status})` : ""}: ${reason}`,
        );
      }

      throw new Error(
        `Brave Search request failed: ${error?.message || String(error)}`,
      );
    }
  }
}

export const braveSearchService = new BraveSearchService();
