import { curlService } from "../../tools/index.js";

export async function executeCurlAction(
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "request":
      return curlService.makeRequest({
        method: params.method || "GET",
        url: params.url,
        headers: params.headers,
        body: params.body,
        timeout: params.timeout,
        followRedirects: params.followRedirects,
        validateSsl: params.validateSsl,
      });

    case "get":
      return curlService.get(params.url, params.headers, params.timeout);

    case "post":
      return curlService.post(
        params.url,
        params.body,
        params.headers,
        params.timeout,
      );

    case "put":
      return curlService.put(
        params.url,
        params.body,
        params.headers,
        params.timeout,
      );

    case "delete":
      return curlService.delete(params.url, params.headers, params.timeout);

    case "patch":
      return curlService.patch(
        params.url,
        params.body,
        params.headers,
        params.timeout,
      );

    default:
      throw new Error(`Unknown curl action: ${action}`);
  }
}

export const CURL_TOOL_SCHEMA = {
  name: "curl",
  description:
    "Make HTTP requests to external APIs and websites. Supports all HTTP methods with custom headers and body. For APIs requiring authentication, include the auth header (e.g., Bearer token). Response includes status code, headers, and body.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["request", "get", "post", "put", "delete", "patch"],
        description:
          "'request': full control with method param. 'get/post/put/delete/patch': shorthand methods. Use 'get' for reading, 'post' for creating, 'put' for replacing, 'patch' for partial update, 'delete' for removing.",
      },
      url: {
        type: "string",
        description:
          "The URL to request - REQUIRED. Must be a valid HTTP/HTTPS URL (e.g., 'https://api.example.com/data')",
      },
      method: {
        type: "string",
        enum: [
          "GET",
          "POST",
          "PUT",
          "DELETE",
          "PATCH",
          "HEAD",
          "OPTIONS",
        ],
        description:
          "HTTP method - only needed with 'request' action. Otherwise use the action shortcuts.",
      },
      headers: {
        type: "object",
        description:
          "Custom HTTP headers as key-value object. Common headers: {'Authorization': 'Bearer <token>', 'Content-Type': 'application/json', 'Accept': 'application/json'}. Content-Type defaults to 'application/json' when body is an object.",
      },
      body: {
        type: "object",
        description:
          "Request body for POST/PUT/PATCH. Pass as an object (will be JSON-encoded automatically). For form data or other formats, use a string and set appropriate Content-Type header.",
      },
      timeout: {
        type: "number",
        description:
          "Request timeout in milliseconds (default: 30000, max: 30000). Increase for slow APIs.",
      },
      followRedirects: {
        type: "boolean",
        description:
          "Whether to follow HTTP redirects (default: true, max 5 redirects)",
      },
      validateSsl: {
        type: "boolean",
        description:
          "Validate SSL certificates (default: true). Set to false only for self-signed certs in development.",
      },
    },
    required: ["action", "url"],
  },
};
