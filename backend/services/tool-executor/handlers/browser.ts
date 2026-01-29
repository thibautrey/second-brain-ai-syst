import { browserService } from "../../tools/index.js";

export async function executeBrowserAction(
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "navigate": {
      if (!params.url) {
        throw new Error(
          "Missing 'url' parameter. Provide the URL to navigate to.",
        );
      }
      const result = await browserService.navigate({
        url: params.url,
        waitForSelector: params.wait_for_selector || params.waitForSelector,
        waitForNavigation:
          params.wait_for_navigation ?? params.waitForNavigation ?? true,
        timeout: params.timeout,
        blockResources:
          params.block_resources ?? params.blockResources ?? false,
        userAgent: params.user_agent || params.userAgent,
      });
      return {
        action: "navigate",
        ...result,
      };
    }

    case "get_content": {
      if (!params.url) {
        throw new Error(
          "Missing 'url' parameter. Provide the URL to fetch content from.",
        );
      }
      const result = await browserService.getContent({
        url: params.url,
        selector: params.selector,
        waitForSelector: params.wait_for_selector || params.waitForSelector,
        includeHtml: params.include_html ?? params.includeHtml ?? false,
        maxLength: params.max_length ?? params.maxLength ?? 50000,
        timeout: params.timeout,
      });
      return {
        action: "get_content",
        ...result,
      };
    }

    case "screenshot": {
      if (!params.url) {
        throw new Error(
          "Missing 'url' parameter. Provide the URL to screenshot.",
        );
      }
      const result = await browserService.screenshot({
        url: params.url,
        fullPage: params.full_page ?? params.fullPage ?? false,
        format: params.format || "png",
        quality: params.quality,
        width: params.width || 1920,
        height: params.height || 1080,
        selector: params.selector,
        waitForSelector: params.wait_for_selector || params.waitForSelector,
        timeout: params.timeout,
      });
      return {
        action: "screenshot",
        ...result,
        screenshotPreview: result.screenshot
          ? `[Base64 image, ${Math.round((result.screenshot.length * 3) / 4 / 1024)}KB]`
          : undefined,
      };
    }

    case "pdf": {
      if (!params.url) {
        throw new Error(
          "Missing 'url' parameter. Provide the URL to convert to PDF.",
        );
      }
      const result = await browserService.pdf({
        url: params.url,
        format: params.format || "A4",
        printBackground:
          params.print_background ?? params.printBackground ?? true,
        landscape: params.landscape ?? false,
        margin: params.margin,
        waitForSelector: params.wait_for_selector || params.waitForSelector,
        timeout: params.timeout,
      });
      return {
        action: "pdf",
        ...result,
        pdfPreview: result.pdf
          ? `[Base64 PDF, ${Math.round((result.pdf.length * 3) / 4 / 1024)}KB]`
          : undefined,
      };
    }

    case "scrape": {
      if (!params.url) {
        throw new Error(
          "Missing 'url' parameter. Provide the URL to scrape.",
        );
      }
      if (!params.selectors || typeof params.selectors !== "object") {
        throw new Error(
          "Missing or invalid 'selectors' parameter. Provide an object with named selectors, e.g., { title: { selector: 'h1' }, links: { selector: 'a', attribute: 'href', multiple: true } }",
        );
      }
      const result = await browserService.scrape({
        url: params.url,
        selectors: params.selectors,
        waitForSelector: params.wait_for_selector || params.waitForSelector,
        timeout: params.timeout,
      });
      return {
        action: "scrape",
        ...result,
      };
    }

    case "interact": {
      if (!params.url) {
        throw new Error(
          "Missing 'url' parameter. Provide the URL to interact with.",
        );
      }
      if (!params.actions || !Array.isArray(params.actions)) {
        throw new Error(
          "Missing or invalid 'actions' parameter. Provide an array of actions, e.g., [{ type: 'click', selector: '#button' }, { type: 'type', selector: '#input', value: 'hello' }]",
        );
      }
      const result = await browserService.interact({
        url: params.url,
        actions: params.actions,
        waitForSelector: params.wait_for_selector || params.waitForSelector,
        returnContent: params.return_content ?? params.returnContent ?? true,
        takeScreenshot:
          params.take_screenshot ?? params.takeScreenshot ?? false,
        timeout: params.timeout,
      });
      return {
        action: "interact",
        ...result,
      };
    }

    case "evaluate": {
      if (!params.url) {
        throw new Error(
          "Missing 'url' parameter. Provide the URL to evaluate JavaScript on.",
        );
      }
      if (!params.script) {
        throw new Error(
          "Missing 'script' parameter. Provide the JavaScript code to execute on the page.",
        );
      }
      const result = await browserService.evaluate(
        params.url,
        params.script,
        params.timeout,
      );
      return {
        action: "evaluate",
        ...result,
      };
    }

    case "health_check": {
      const result = await browserService.healthCheck();
      return {
        action: "health_check",
        browserless_available: result.available,
        version: result.version,
        error: result.error,
        message: result.available
          ? "Browserless service is running and ready"
          : "Browserless service is not available",
      };
    }

    default:
      throw new Error(
        `Unknown browser action: ${action}. Valid actions are: navigate, get_content, screenshot, pdf, scrape, interact, evaluate, health_check`,
      );
  }
}

export const BROWSER_TOOL_SCHEMA = {
  name: "browser",
  description:
    "Interact with web pages through a headless browser (Browserless/Chrome). Use for: browsing the web, navigating dynamic sites, extracting content from JavaScript-rendered pages, taking screenshots, generating PDFs, scraping structured data, filling forms, clicking buttons, and running JavaScript. More powerful than curl for sites requiring JavaScript execution.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "navigate",
          "get_content",
          "screenshot",
          "pdf",
          "scrape",
          "interact",
          "evaluate",
          "health_check",
        ],
        description:
          "'navigate': load page and get basic info (title, URL, status). 'get_content': extract text content, links, and metadata. 'screenshot': capture visual snapshot. 'pdf': generate PDF document. 'scrape': extract structured data using CSS selectors. 'interact': perform actions (click, type, scroll) on page. 'evaluate': run custom JavaScript on page. 'health_check': verify browserless service is available.",
      },
      url: {
        type: "string",
        description:
          "The URL to navigate to (REQUIRED for all actions except health_check)",
      },
      selector: {
        type: "string",
        description:
          "CSS selector to extract specific element content (for get_content/screenshot)",
      },
      include_html: {
        type: "boolean",
        description:
          "Include raw HTML in response (for get_content, default: false)",
      },
      max_length: {
        type: "number",
        description:
          "Maximum text length to return (for get_content, default: 50000)",
      },
      full_page: {
        type: "boolean",
        description:
          "Capture full page including scrollable area (for screenshot, default: false)",
      },
      format: {
        type: "string",
        enum: ["png", "jpeg", "webp"],
        description: "Image format (for screenshot, default: png)",
      },
      quality: {
        type: "number",
        description: "Image quality 0-100 for jpeg/webp (for screenshot)",
      },
      width: {
        type: "number",
        description:
          "Viewport width in pixels (for screenshot, default: 1920)",
      },
      height: {
        type: "number",
        description:
          "Viewport height in pixels (for screenshot, default: 1080)",
      },
      paper_format: {
        type: "string",
        enum: ["A4", "Letter", "Legal", "Tabloid"],
        description: "Paper format (for pdf, default: A4)",
      },
      print_background: {
        type: "boolean",
        description: "Print background graphics (for pdf, default: true)",
      },
      landscape: {
        type: "boolean",
        description:
          "Use landscape orientation (for pdf, default: false)",
      },
      selectors: {
        type: "object",
        description:
          "Object mapping field names to selector configs. Each config has: selector (CSS), attribute (optional, e.g., 'href'), multiple (optional boolean). Example: { title: { selector: 'h1' }, links: { selector: 'a', attribute: 'href', multiple: true } }",
      },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "click",
                "type",
                "select",
                "scroll",
                "wait",
                "evaluate",
              ],
              description: "Action type",
            },
            selector: {
              type: "string",
              description: "CSS selector for the element",
            },
            value: {
              type: "string",
              description: "Value for type/select actions",
            },
            delay: {
              type: "number",
              description: "Delay in ms before action",
            },
            direction: {
              type: "string",
              enum: ["up", "down", "top", "bottom"],
              description: "Scroll direction (for scroll action)",
            },
            amount: {
              type: "number",
              description: "Scroll amount in pixels (for scroll action)",
            },
            duration: {
              type: "number",
              description: "Wait duration in ms (for wait action)",
            },
            script: {
              type: "string",
              description: "JavaScript to execute (for evaluate action)",
            },
          },
        },
        description:
          "Array of actions to perform in sequence. Example: [{ type: 'click', selector: '#login' }, { type: 'type', selector: '#username', value: 'user' }]",
      },
      return_content: {
        type: "boolean",
        description:
          "Return page text content after interactions (for interact, default: true)",
      },
      take_screenshot: {
        type: "boolean",
        description:
          "Take screenshot after interactions (for interact, default: false)",
      },
      script: {
        type: "string",
        description:
          "JavaScript code to execute on the page (for evaluate). Code runs in page context and can return values.",
      },
      wait_for_selector: {
        type: "string",
        description:
          "Wait for this CSS selector to appear before proceeding",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds (default: 30000)",
      },
      block_resources: {
        type: "boolean",
        description:
          "Block images, fonts, CSS for faster loading (for navigate, default: false)",
      },
      user_agent: {
        type: "string",
        description: "Custom user agent string",
      },
    },
    required: ["action"],
  },
};
