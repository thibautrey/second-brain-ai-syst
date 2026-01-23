/**
 * Curl Tool Test Examples
 *
 * These examples show how the AI can use the curl tool
 * to make HTTP requests and fetch data from the web
 */

// Example 1: Simple GET request to fetch JSON data
export const example1_getJson = {
  toolId: "curl",
  action: "get",
  params: {
    url: "https://jsonplaceholder.typicode.com/users/1",
  },
};

// Example 2: GET request with custom headers (e.g., Authorization)
export const example2_getWithAuth = {
  toolId: "curl",
  action: "get",
  params: {
    url: "https://api.github.com/user",
    headers: {
      Authorization: "Bearer YOUR_GITHUB_TOKEN",
      Accept: "application/json",
    },
  },
};

// Example 3: POST request with JSON body
export const example3_postJson = {
  toolId: "curl",
  action: "post",
  params: {
    url: "https://jsonplaceholder.typicode.com/posts",
    body: {
      title: "Test Post",
      body: "This is a test post",
      userId: 1,
    },
    headers: {
      "Content-Type": "application/json",
    },
  },
};

// Example 4: POST request with form data (as string)
export const example4_postForm = {
  toolId: "curl",
  action: "post",
  params: {
    url: "https://api.example.com/form",
    body: "name=John&email=john@example.com",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  },
};

// Example 5: Request with full control (custom timeout, redirects, etc.)
export const example5_fullControl = {
  toolId: "curl",
  action: "request",
  params: {
    url: "https://api.example.com/endpoint",
    method: "PUT",
    body: JSON.stringify({ key: "value" }),
    headers: {
      "Content-Type": "application/json",
      "X-Custom-Header": "custom-value",
    },
    timeout: 10000,
    followRedirects: true,
    validateSsl: true,
  },
};

// Example 6: DELETE request
export const example6_delete = {
  toolId: "curl",
  action: "delete",
  params: {
    url: "https://api.example.com/resource/123",
    headers: {
      Authorization: "Bearer token",
    },
  },
};

// Example 7: PATCH request
export const example7_patch = {
  toolId: "curl",
  action: "patch",
  params: {
    url: "https://api.example.com/resource/123",
    body: {
      status: "updated",
    },
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    },
  },
};

// Example 8: Fetch HTML and parse it (for web scraping)
export const example8_scrapeHtml = {
  toolId: "curl",
  action: "get",
  params: {
    url: "https://example.com",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  },
};

// Example 9: Call a public API with rate limiting
export const example9_publicApi = {
  toolId: "curl",
  action: "get",
  params: {
    url: "https://api.coindesk.com/v1/bpi/currentprice.json",
    timeout: 5000,
  },
};

// Example 10: Webhook/callback simulation
export const example10_webhook = {
  toolId: "curl",
  action: "post",
  params: {
    url: "https://webhook.example.com/callback",
    body: {
      event: "user_action",
      timestamp: new Date().toISOString(),
      data: {
        userId: "user123",
        action: "login",
      },
    },
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": "secret123",
    },
  },
};

/**
 * Response Format
 *
 * All curl tool requests return a response with this structure:
 *
 * {
 *   "success": true,
 *   "toolUsed": "curl",
 *   "executionTime": 123,  // milliseconds
 *   "data": {
 *     "statusCode": 200,
 *     "headers": {
 *       "content-type": "application/json",
 *       "content-length": "1024",
 *       ...
 *     },
 *     "body": "{...}",  // response body as string
 *     "size": 1024,      // response size in bytes
 *     "elapsed": 123     // request duration in ms
 *   }
 * }
 *
 * For errors:
 *
 * {
 *   "success": false,
 *   "error": "HTTP request failed: ...",
 *   "executionTime": 123,
 *   "toolUsed": "curl"
 * }
 */
