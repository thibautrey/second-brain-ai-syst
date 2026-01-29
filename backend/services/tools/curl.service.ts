/**
 * Curl Service
 *
 * Provides HTTP request capabilities for the AI
 * Supports GET, POST, PUT, DELETE, PATCH with custom headers and body
 */

import axios, {
  AxiosRequestConfig,
  AxiosError,
  AxiosResponse,
  AxiosHeaders,
} from "axios";

export interface CurlRequest {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  url: string;
  headers?: Record<string, string>;
  body?: string | Record<string, any>;
  timeout?: number;
  followRedirects?: boolean;
  validateSsl?: boolean;
}

export interface CurlResponse {
  statusCode: number;
  headers: Record<string, any>;
  body: string;
  size: number;
  elapsed: number;
}

export class CurlService {
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB
  private readonly ALLOWED_DOMAINS_PATTERN =
    /^https?:\/\/([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(:[0-9]+)?(\/.*)?$/;

  /**
   * Validate URL format and domain
   */
  private validateUrl(url: string): boolean {
    try {
      new URL(url);
      return this.ALLOWED_DOMAINS_PATTERN.test(url);
    } catch {
      return false;
    }
  }

  /**
   * Execute HTTP request
   */
  async makeRequest(request: CurlRequest): Promise<CurlResponse> {
    // Validate URL
    if (!this.validateUrl(request.url)) {
      throw new Error(`Invalid or unsafe URL: ${request.url}`);
    }

    // Validate method
    const validMethods = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ];
    if (!validMethods.includes(request.method)) {
      throw new Error(`Invalid HTTP method: ${request.method}`);
    }

    const startTime = Date.now();
    const timeout = request.timeout || this.DEFAULT_TIMEOUT;
    const validateSsl = request.validateSsl !== false;

    try {
      const config: AxiosRequestConfig = {
        method: request.method,
        url: request.url,
        timeout,
        maxRedirects: request.followRedirects !== false ? 5 : 0,
        validateStatus: () => true, // Accept all status codes
        httpAgent: undefined,
        httpsAgent: undefined,
        responseType: "text",
        headers: new AxiosHeaders(request.headers || {}),
      };

      // Add request body if provided
      if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
        if (typeof request.body === "object") {
          config.data = request.body;
          config.headers = config.headers || {};
          (config.headers as any)["Content-Type"] = "application/json";
        } else {
          config.data = request.body;
        }
      }

      const response: AxiosResponse = await axios(config);

      // Check response size
      const responseBody = response.data || "";
      if (responseBody.length > this.MAX_RESPONSE_SIZE) {
        throw new Error(
          `Response size exceeds limit (${responseBody.length} > ${this.MAX_RESPONSE_SIZE})`,
        );
      }

      const elapsed = Date.now() - startTime;

      return {
        statusCode: response.status,
        headers: response.headers as Record<string, any>,
        body: responseBody,
        size: responseBody.length,
        elapsed,
      };
    } catch (error: any) {
      const elapsed = Date.now() - startTime;

      if (error instanceof AxiosError) {
        const statusCode = error.response?.status || 0;
        const body = error.response?.data || error.message;

        return {
          statusCode,
          headers: (error.response?.headers as Record<string, any>) || {},
          body: typeof body === "string" ? body : JSON.stringify(body),
          size: typeof body === "string" ? body.length : 0,
          elapsed,
        };
      }

      throw new Error(`HTTP request failed: ${error.message}`);
    }
  }

  /**
   * GET request
   */
  async get(
    url: string,
    headers?: Record<string, string>,
    timeout?: number,
  ): Promise<CurlResponse> {
    return this.makeRequest({
      method: "GET",
      url,
      headers,
      timeout,
    });
  }

  /**
   * POST request
   */
  async post(
    url: string,
    body?: string | Record<string, any>,
    headers?: Record<string, string>,
    timeout?: number,
  ): Promise<CurlResponse> {
    return this.makeRequest({
      method: "POST",
      url,
      body,
      headers,
      timeout,
    });
  }

  /**
   * PUT request
   */
  async put(
    url: string,
    body?: string | Record<string, any>,
    headers?: Record<string, string>,
    timeout?: number,
  ): Promise<CurlResponse> {
    return this.makeRequest({
      method: "PUT",
      url,
      body,
      headers,
      timeout,
    });
  }

  /**
   * DELETE request
   */
  async delete(
    url: string,
    headers?: Record<string, string>,
    timeout?: number,
  ): Promise<CurlResponse> {
    return this.makeRequest({
      method: "DELETE",
      url,
      headers,
      timeout,
    });
  }

  /**
   * PATCH request
   */
  async patch(
    url: string,
    body?: string | Record<string, any>,
    headers?: Record<string, string>,
    timeout?: number,
  ): Promise<CurlResponse> {
    return this.makeRequest({
      method: "PATCH",
      url,
      body,
      headers,
      timeout,
    });
  }
}

export const curlService = new CurlService();
