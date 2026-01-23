/**
 * Code Executor Wrapper
 *
 * Communicates with the Python code executor service via HTTP.
 * Provides safe code execution in an isolated sandbox.
 */

import axios, { AxiosInstance } from "axios";

interface CodeExecutorConfig {
  host: string;
  port: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface ExecuteCodeRequest {
  code: string;
  timeout?: number;
}

interface ExecuteCodeResponse {
  success: boolean;
  result: any;
  stdout: string;
  stderr: string;
  error: string | null;
  execution_time_ms: number;
  truncated?: boolean;
  note?: string;
}

interface ValidateCodeResponse {
  valid: boolean;
  error: string | null;
}

interface ExecutionLimits {
  max_execution_time_seconds: number;
  max_output_size_bytes: number;
  max_code_size_bytes: number;
  safe_modules: string[];
  forbidden_operations: string[];
}

interface CodeExample {
  name: string;
  code: string;
  description: string;
}

interface HealthStatus {
  status: string;
  service: string;
  version: string;
  mode: string;
  limits: {
    max_execution_time_seconds: number;
    max_output_size_bytes: number;
    max_code_size_bytes: number;
  };
}

export class CodeExecutorService {
  private config: Required<CodeExecutorConfig>;
  private client: AxiosInstance;
  private isReady = false;

  constructor(config: CodeExecutorConfig) {
    this.config = {
      maxRetries: 10,
      retryDelay: 1000,
      ...config,
    };

    this.client = axios.create({
      baseURL: `http://${this.config.host}:${this.config.port}`,
      timeout: 60000, // 60 seconds for code execution
    });
  }

  /**
   * Wait for the service to be ready
   */
  async waitForReady(): Promise<void> {
    if (this.isReady) return;

    console.log(
      `🔗 Connecting to code executor service at ${this.config.host}:${this.config.port}...`,
    );

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const health = await this.healthCheck();
        if (health.status === "healthy") {
          this.isReady = true;
          console.log(`✓ Code executor service ready (${health.mode})`);
          return;
        }
      } catch (error) {
        console.log(
          `⏳ Waiting for code executor service (attempt ${attempt}/${this.config.maxRetries})...`,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.retryDelay),
      );
    }

    throw new Error(
      `Code executor service not available after ${this.config.maxRetries} attempts`,
    );
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthStatus> {
    const response = await this.client.get<HealthStatus>("/health");
    return response.data;
  }

  /**
   * Execute Python code in sandbox
   */
  async executeCode(
    code: string,
    timeout?: number,
  ): Promise<ExecuteCodeResponse> {
    await this.waitForReady();

    const response = await this.client.post<ExecuteCodeResponse>("/execute", {
      code,
      timeout,
    });

    return response.data;
  }

  /**
   * Validate Python code syntax without executing
   */
  async validateCode(code: string): Promise<ValidateCodeResponse> {
    await this.waitForReady();

    const response = await this.client.post<ValidateCodeResponse>("/validate", {
      code,
    });

    return response.data;
  }

  /**
   * Get execution limits
   */
  async getLimits(): Promise<ExecutionLimits> {
    await this.waitForReady();

    const response = await this.client.get<ExecutionLimits>("/limits");
    return response.data;
  }

  /**
   * Get code examples
   */
  async getExamples(): Promise<CodeExample[]> {
    await this.waitForReady();

    const response = await this.client.get<{ examples: CodeExample[] }>(
      "/examples",
    );
    return response.data.examples;
  }

  /**
   * Format execution result for display
   */
  formatResult(response: ExecuteCodeResponse): string {
    const parts: string[] = [];

    if (response.stdout) {
      parts.push(`Output:\n${response.stdout}`);
    }

    if (response.stderr) {
      parts.push(`Errors:\n${response.stderr}`);
    }

    if (response.result !== null && response.result !== undefined) {
      parts.push(`Result: ${JSON.stringify(response.result)}`);
    }

    if (response.error) {
      parts.push(`Error: ${response.error}`);
    }

    if (response.truncated) {
      parts.push(`\n⚠️ ${response.note}`);
    }

    parts.push(`\n⏱️ Execution time: ${response.execution_time_ms}ms`);

    return parts.join("\n");
  }
}

// Create singleton instance with environment configuration
const CODE_EXECUTOR_HOST = process.env.CODE_EXECUTOR_HOST || "localhost";
const CODE_EXECUTOR_PORT = parseInt(
  process.env.CODE_EXECUTOR_PORT || "5002",
  10,
);

export const codeExecutorService = new CodeExecutorService({
  host: CODE_EXECUTOR_HOST,
  port: CODE_EXECUTOR_PORT,
});
