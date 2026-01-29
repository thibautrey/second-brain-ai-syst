/**
 * Browser Service
 *
 * Provides web browser automation capabilities via Browserless.
 * Allows the AI agent to navigate websites, extract content, take screenshots,
 * fill forms, click elements, and perform complex web interactions.
 */

import axios, { AxiosError } from "axios";

// Browserless v2 configuration
// See: https://docs.browserless.io/rest-apis
const BROWSERLESS_URL =
  process.env.BROWSERLESS_URL || "http://browserless:3000";
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || "";

export interface BrowserNavigateOptions {
  /** URL to navigate to */
  url: string;
  /** Wait for a selector before returning */
  waitForSelector?: string;
  /** Wait for navigation to complete */
  waitForNavigation?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Block images, stylesheets, fonts for faster loading */
  blockResources?: boolean;
  /** User agent string */
  userAgent?: string;
}

export interface BrowserContentOptions {
  /** URL to fetch content from */
  url: string;
  /** CSS selector to extract specific content */
  selector?: string;
  /** Wait for a selector before extracting */
  waitForSelector?: string;
  /** Include full HTML or just text */
  includeHtml?: boolean;
  /** Maximum text length to return */
  maxLength?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface BrowserScreenshotOptions {
  /** URL to screenshot */
  url: string;
  /** Full page screenshot */
  fullPage?: boolean;
  /** Image format */
  format?: "png" | "jpeg" | "webp";
  /** Image quality (0-100, for jpeg/webp) */
  quality?: number;
  /** Viewport width */
  width?: number;
  /** Viewport height */
  height?: number;
  /** CSS selector to screenshot specific element */
  selector?: string;
  /** Wait for selector before screenshot */
  waitForSelector?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface BrowserPdfOptions {
  /** URL to convert to PDF */
  url: string;
  /** Paper format */
  format?: "A4" | "Letter" | "Legal" | "Tabloid";
  /** Print background graphics */
  printBackground?: boolean;
  /** Landscape orientation */
  landscape?: boolean;
  /** Page margins */
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  /** Wait for selector before generating PDF */
  waitForSelector?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface BrowserScrapingOptions {
  /** URL to scrape */
  url: string;
  /** Selectors to extract data from */
  selectors: {
    [key: string]: {
      selector: string;
      /** Extract attribute instead of text */
      attribute?: string;
      /** Extract multiple elements */
      multiple?: boolean;
    };
  };
  /** Wait for selector before scraping */
  waitForSelector?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface BrowserInteractionOptions {
  /** URL to interact with */
  url: string;
  /** Actions to perform */
  actions: BrowserAction[];
  /** Wait for selector before starting */
  waitForSelector?: string;
  /** Return page content after actions */
  returnContent?: boolean;
  /** Take screenshot after actions */
  takeScreenshot?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface BrowserAction {
  /** Action type */
  type: "click" | "type" | "select" | "scroll" | "wait" | "evaluate";
  /** CSS selector for the element */
  selector?: string;
  /** Value for type/select actions */
  value?: string;
  /** Delay before action in ms */
  delay?: number;
  /** JavaScript code for evaluate action */
  script?: string;
  /** Scroll direction for scroll action */
  direction?: "up" | "down" | "top" | "bottom";
  /** Scroll amount in pixels */
  amount?: number;
  /** Wait time in ms for wait action */
  duration?: number;
}

export interface BrowserResponse {
  success: boolean;
  data?: any;
  error?: string;
  url?: string;
  title?: string;
  statusCode?: number;
  timing?: {
    navigationStart: number;
    domContentLoaded: number;
    loadComplete: number;
  };
}

export interface BrowserContentResponse extends BrowserResponse {
  content?: string;
  html?: string;
  links?: Array<{ text: string; href: string }>;
  images?: Array<{ alt: string; src: string }>;
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string;
  };
}

export interface BrowserScreenshotResponse extends BrowserResponse {
  /** Base64 encoded image */
  screenshot?: string;
  format?: string;
  width?: number;
  height?: number;
}

export interface BrowserScrapingResponse extends BrowserResponse {
  data?: Record<string, any>;
}

export class BrowserService {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = BROWSERLESS_URL;
    this.token = BROWSERLESS_TOKEN;
  }

  /**
   * Get the authorization header
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Navigate to a URL and get basic page info
   * Uses Browserless v2 /chromium/function endpoint with ESM format
   */
  async navigate(options: BrowserNavigateOptions): Promise<BrowserResponse> {
    try {
      const code = this.buildNavigationScript(options);
      const tokenParam = this.token ? `?token=${this.token}` : "";

      const response = await axios.post(
        `${this.baseUrl}/chromium/function${tokenParam}`,
        code,
        {
          headers: {
            "Content-Type": "application/javascript",
          },
          timeout: options.timeout || 30000,
        },
      );

      return {
        success: true,
        ...response.data,
      };
    } catch (error: any) {
      return this.handleError(error, "navigate");
    }
  }

  /**
   * Get page content (text, HTML, links, metadata)
   * Uses Browserless v2 /chromium/content endpoint
   */
  async getContent(
    options: BrowserContentOptions,
  ): Promise<BrowserContentResponse> {
    try {
      const tokenParam = this.token ? `?token=${this.token}` : "";
      const response = await axios.post(
        `${this.baseUrl}/chromium/content${tokenParam}`,
        {
          url: options.url,
          waitForSelector: options.waitForSelector
            ? { selector: options.waitForSelector }
            : undefined,
          gotoOptions: {
            waitUntil: "networkidle2",
            timeout: options.timeout || 30000,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: (options.timeout || 30000) + 5000,
        },
      );

      let content = response.data;

      // Parse and clean the content
      const result: BrowserContentResponse = {
        success: true,
        url: options.url,
      };

      if (typeof content === "string") {
        // Extract text content, truncate if needed
        result.html = options.includeHtml ? content : undefined;
        result.content = this.extractTextContent(content, options.maxLength);
        result.metadata = this.extractMetadata(content);
        result.links = this.extractLinks(content);
      } else {
        result.data = content;
      }

      return result;
    } catch (error: any) {
      return this.handleError(error, "getContent");
    }
  }

  /**
   * Take a screenshot of a webpage
   * Uses Browserless v2 /chromium/screenshot endpoint
   */
  async screenshot(
    options: BrowserScreenshotOptions,
  ): Promise<BrowserScreenshotResponse> {
    try {
      const screenshotOptions: any = {
        fullPage: options.fullPage ?? false,
        type: options.format || "png",
      };

      if (options.quality && options.format !== "png") {
        screenshotOptions.quality = options.quality;
      }

      if (options.selector) {
        screenshotOptions.selector = options.selector;
      }

      const tokenParam = this.token ? `?token=${this.token}` : "";
      const response = await axios.post(
        `${this.baseUrl}/chromium/screenshot${tokenParam}`,
        {
          url: options.url,
          options: screenshotOptions,
          viewport: {
            width: options.width || 1920,
            height: options.height || 1080,
          },
          waitForSelector: options.waitForSelector
            ? { selector: options.waitForSelector }
            : undefined,
          gotoOptions: {
            waitUntil: "networkidle2",
            timeout: options.timeout || 30000,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: (options.timeout || 30000) + 5000,
          responseType: "arraybuffer",
        },
      );

      const base64 = Buffer.from(response.data).toString("base64");

      return {
        success: true,
        url: options.url,
        screenshot: base64,
        format: options.format || "png",
        width: options.width || 1920,
        height: options.height || 1080,
      };
    } catch (error: any) {
      return this.handleError(error, "screenshot");
    }
  }

  /**
   * Generate a PDF from a webpage
   */
  async pdf(
    options: BrowserPdfOptions,
  ): Promise<BrowserResponse & { pdf?: string }> {
    try {
      const pdfOptions: any = {
        format: options.format || "A4",
        printBackground: options.printBackground ?? true,
        landscape: options.landscape ?? false,
      };

      if (options.margin) {
        pdfOptions.margin = options.margin;
      }

      const tokenParam = this.token ? `?token=${this.token}` : "";
      const response = await axios.post(
        `${this.baseUrl}/chromium/pdf${tokenParam}`,
        {
          url: options.url,
          options: pdfOptions,
          waitForSelector: options.waitForSelector
            ? { selector: options.waitForSelector }
            : undefined,
          gotoOptions: {
            waitUntil: "networkidle2",
            timeout: options.timeout || 30000,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: (options.timeout || 30000) + 5000,
          responseType: "arraybuffer",
        },
      );

      const base64 = Buffer.from(response.data).toString("base64");

      return {
        success: true,
        url: options.url,
        pdf: base64,
      };
    } catch (error: any) {
      return this.handleError(error, "pdf");
    }
  }

  /**
   * Scrape structured data from a webpage using selectors
   * Uses Browserless v2 /chromium/function endpoint
   */
  async scrape(
    options: BrowserScrapingOptions,
  ): Promise<BrowserScrapingResponse> {
    try {
      const script = this.buildScrapingScript(options);
      const tokenParam = this.token ? `?token=${this.token}` : "";

      const response = await axios.post(
        `${this.baseUrl}/chromium/function${tokenParam}`,
        script,
        {
          headers: {
            "Content-Type": "application/javascript",
          },
          timeout: options.timeout || 30000,
        },
      );

      return {
        success: true,
        url: options.url,
        data: response.data?.data || response.data,
      };
    } catch (error: any) {
      return this.handleError(error, "scrape");
    }
  }

  /**
   * Perform complex interactions on a webpage
   * Uses Browserless v2 /chromium/function endpoint
   */
  async interact(
    options: BrowserInteractionOptions,
  ): Promise<BrowserResponse & { screenshot?: string; content?: string }> {
    try {
      const script = this.buildInteractionScript(options);
      const tokenParam = this.token ? `?token=${this.token}` : "";

      const response = await axios.post(
        `${this.baseUrl}/chromium/function${tokenParam}`,
        script,
        {
          headers: {
            "Content-Type": "application/javascript",
          },
          timeout: options.timeout || 60000,
        },
      );

      return {
        success: true,
        url: options.url,
        ...(response.data?.data || response.data),
      };
    } catch (error: any) {
      return this.handleError(error, "interact");
    }
  }

  /**
   * Execute custom JavaScript on a page
   * Uses Browserless v2 /chromium/function endpoint with ESM format
   */
  async evaluate(
    url: string,
    script: string,
    timeout: number = 30000,
  ): Promise<BrowserResponse> {
    try {
      const tokenParam = this.token ? `?token=${this.token}` : "";
      const code = `
export default async function ({ page }) {
  await page.goto("${url}", { waitUntil: 'networkidle2' });
  const result = await page.evaluate(() => {
    ${script}
  });
  return {
    data: result,
    type: "application/json"
  };
}`;

      const response = await axios.post(
        `${this.baseUrl}/chromium/function${tokenParam}`,
        code,
        {
          headers: {
            "Content-Type": "application/javascript",
          },
          timeout: timeout + 5000,
        },
      );

      return {
        success: true,
        url,
        data: response.data?.data || response.data,
      };
    } catch (error: any) {
      return this.handleError(error, "evaluate");
    }
  }

  /**
   * Build navigation script for browserless v2 function endpoint (ESM format)
   */
  private buildNavigationScript(options: BrowserNavigateOptions): string {
    const blockResources = options.blockResources
      ? this.getResourceBlockingScript()
      : "";
    const setUserAgent = options.userAgent
      ? `await page.setUserAgent('${options.userAgent}');`
      : "";
    const waitForSelector = options.waitForSelector
      ? `await page.waitForSelector('${options.waitForSelector}', { timeout: ${options.timeout || 30000} });`
      : "";

    return `export default async function ({ page }) {
  ${blockResources}
  ${setUserAgent}

  const response = await page.goto("${options.url}", {
    waitUntil: '${options.waitForNavigation ? "networkidle2" : "domcontentloaded"}',
    timeout: ${options.timeout || 30000}
  });

  ${waitForSelector}

  const title = await page.title();
  const url = page.url();

  return {
    data: {
      url,
      title,
      statusCode: response ? response.status() : null,
    },
    type: "application/json"
  };
}`;
  }

  /**
   * Build scraping script for browserless v2 function endpoint (ESM format)
   */
  private buildScrapingScript(options: BrowserScrapingOptions): string {
    // Serialize selectors to JSON for embedding in the script
    const selectorsJson = JSON.stringify(options.selectors);
    const waitForSelector = options.waitForSelector
      ? `await page.waitForSelector('${options.waitForSelector}', { timeout: 30000 });`
      : "";

    return `export default async function ({ page }) {
  await page.goto("${options.url}", { waitUntil: 'networkidle2' });

  ${waitForSelector}

  const selectors = ${selectorsJson};

  const data = await page.evaluate((selectors) => {
    const result = {};

    for (const [key, config] of Object.entries(selectors)) {
      try {
        if (config.multiple) {
          const elements = document.querySelectorAll(config.selector);
          result[key] = Array.from(elements).map(el =>
            config.attribute ? el.getAttribute(config.attribute) : el.textContent?.trim()
          ).filter(Boolean);
        } else {
          const element = document.querySelector(config.selector);
          if (element) {
            result[key] = config.attribute
              ? element.getAttribute(config.attribute)
              : element.textContent?.trim();
          }
        }
      } catch (e) {
        result[key] = null;
      }
    }

    return result;
  }, selectors);

  return {
    data,
    type: "application/json"
  };
}`;
  }

  /**
   * Build interaction script for browserless v2 function endpoint (ESM format)
   */
  private buildInteractionScript(options: BrowserInteractionOptions): string {
    const actionsJson = JSON.stringify(options.actions);
    const waitForSelector = options.waitForSelector
      ? `await page.waitForSelector('${options.waitForSelector}', { timeout: 30000 });`
      : "";

    return `export default async function ({ page }) {
  await page.goto("${options.url}", { waitUntil: 'networkidle2' });

  ${waitForSelector}

  const actions = ${actionsJson};
  const results = [];

  for (const action of actions) {
    try {
      if (action.delay) {
        await new Promise(resolve => setTimeout(resolve, action.delay));
      }

      switch (action.type) {
        case 'click':
          await page.click(action.selector);
          results.push({ action: 'click', selector: action.selector, success: true });
          break;

        case 'type':
          await page.type(action.selector, action.value);
          results.push({ action: 'type', selector: action.selector, success: true });
          break;

        case 'select':
          await page.select(action.selector, action.value);
          results.push({ action: 'select', selector: action.selector, success: true });
          break;

        case 'scroll':
          if (action.direction === 'top') {
            await page.evaluate(() => window.scrollTo(0, 0));
          } else if (action.direction === 'bottom') {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          } else {
            const amount = action.amount || 300;
            const delta = action.direction === 'up' ? -amount : amount;
            await page.evaluate((delta) => window.scrollBy(0, delta), delta);
          }
          results.push({ action: 'scroll', direction: action.direction, success: true });
          break;

        case 'wait':
          await new Promise(resolve => setTimeout(resolve, action.duration || 1000));
          results.push({ action: 'wait', duration: action.duration, success: true });
          break;

        case 'evaluate':
          const evalResult = await page.evaluate(action.script);
          results.push({ action: 'evaluate', result: evalResult, success: true });
          break;
      }
    } catch (error) {
      results.push({ action: action.type, selector: action.selector, success: false, error: error.message });
    }
  }

  const response = { actions: results };

  ${options.returnContent ? `response.content = await page.evaluate(() => document.body.innerText);` : ""}
  ${options.takeScreenshot ? `response.screenshot = await page.screenshot({ encoding: 'base64' });` : ""}

  return {
    data: response,
    type: "application/json"
  };
}`;
  }

  /**
   * Get resource blocking script to speed up page loading
   */
  private getResourceBlockingScript(): string {
    return `
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
    `;
  }

  /**
   * Extract text content from HTML
   */
  private extractTextContent(html: string, maxLength?: number): string {
    // Simple HTML tag removal (basic implementation)
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (maxLength && text.length > maxLength) {
      text = text.substring(0, maxLength) + "...";
    }

    return text;
  }

  /**
   * Extract metadata from HTML
   */
  private extractMetadata(html: string): BrowserContentResponse["metadata"] {
    const metadata: BrowserContentResponse["metadata"] = {};

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) metadata.title = titleMatch[1].trim();

    // Meta description
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i,
    );
    if (descMatch) metadata.description = descMatch[1];

    // Keywords
    const keywordsMatch = html.match(
      /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)/i,
    );
    if (keywordsMatch) {
      metadata.keywords = keywordsMatch[1].split(",").map((k) => k.trim());
    }

    // OG Image
    const ogImageMatch = html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)/i,
    );
    if (ogImageMatch) metadata.ogImage = ogImageMatch[1];

    return metadata;
  }

  /**
   * Extract links from HTML
   */
  private extractLinks(html: string): Array<{ text: string; href: string }> {
    const links: Array<{ text: string; href: string }> = [];
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null && links.length < 50) {
      const href = match[1];
      const text = match[2].trim();
      if (
        href &&
        text &&
        !href.startsWith("#") &&
        !href.startsWith("javascript:")
      ) {
        links.push({ href, text });
      }
    }

    return links;
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: any, operation: string): BrowserResponse {
    let errorMessage = `Browser ${operation} failed`;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        errorMessage += `: ${axiosError.response.status} - ${axiosError.response.statusText}`;
        if (axiosError.response.data) {
          const data = axiosError.response.data as any;
          // Handle both object and string error responses
          if (typeof data === "string") {
            errorMessage += ` - ${data}`;
          } else if (data.message) {
            errorMessage += ` - ${data.message}`;
          }
        }
      } else if (axiosError.code === "ECONNREFUSED") {
        errorMessage =
          "Browserless service is not available. Please ensure the browserless container is running.";
      } else if (axiosError.code === "ETIMEDOUT") {
        errorMessage = `Browser ${operation} timed out. The page may be too slow to load.`;
      } else {
        errorMessage += `: ${axiosError.message}`;
      }
    } else {
      errorMessage += `: ${error.message || "Unknown error"}`;
    }

    console.error(`[BrowserService] ${errorMessage}`, error);

    return {
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Check if browserless service is available
   */
  async healthCheck(): Promise<{
    available: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/json/version`, {
        headers: this.getHeaders(),
        timeout: 5000,
      });

      return {
        available: true,
        version: response.data?.Browser || response.data?.webSocketDebuggerUrl,
      };
    } catch (error: any) {
      return {
        available: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export const browserService = new BrowserService();
