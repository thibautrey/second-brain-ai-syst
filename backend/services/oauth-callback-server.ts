/**
 * OAuth Callback Server
 * Creates a local HTTP server to capture OAuth redirect callbacks
 * Used for the ChatGPT OAuth PKCE flow
 */

import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

export interface OAuthCallbackResult {
  code: string;
  state: string;
}

export interface OAuthCallbackServerOptions {
  port?: number;
  timeoutMs?: number;
}

/**
 * Start a local OAuth callback server
 * This captures the OAuth redirect and extracts the authorization code
 *
 * @param options Configuration options for the server
 * @returns Promise that resolves with the authorization code and state
 */
export function startOAuthCallbackServer(
  options: OAuthCallbackServerOptions = {},
): Promise<OAuthCallbackResult> {
  const port = options.port ?? 1455;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000; // 5 minutes default

  return new Promise((resolve, reject) => {
    let timeout: NodeJS.Timeout | undefined;
    let finished = false;

    const server: Server = createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

        if (url.pathname === "/auth/callback") {
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");
          const errorDescription = url.searchParams.get("error_description");

          // Set CORS headers for browser compatibility
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

          // Handle preflight requests
          if (req.method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
          }

          // Send response to browser
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

          if (error) {
            const errorMsg = errorDescription || error;
            res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255,255,255,0.1);
      border-radius: 16px;
      backdrop-filter: blur(10px);
      max-width: 400px;
    }
    h1 { color: #ff6b6b; margin-bottom: 1rem; }
    p { color: #ccc; line-height: 1.6; }
    .error-code {
      background: rgba(255,107,107,0.2);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-family: monospace;
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ OAuth Error</h1>
    <div class="error-code">${escapeHtml(errorMsg)}</div>
    <p>Authentication failed. Please close this window and try again.</p>
  </div>
</body>
</html>
            `);
            finish(new Error(errorMsg));
            return;
          }

          if (!code || !state) {
            res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255,255,255,0.1);
      border-radius: 16px;
      backdrop-filter: blur(10px);
      max-width: 400px;
    }
    h1 { color: #ff6b6b; margin-bottom: 1rem; }
    p { color: #ccc; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Error</h1>
    <p>Missing authorization code or state parameter.</p>
    <p>Please close this window and try again.</p>
  </div>
</body>
</html>
            `);
            finish(new Error("Missing code or state parameter"));
            return;
          }

          // Success response
          res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255,255,255,0.1);
      border-radius: 16px;
      backdrop-filter: blur(10px);
      max-width: 400px;
    }
    h1 { color: #4ade80; margin-bottom: 1rem; }
    p { color: #ccc; line-height: 1.6; }
    .checkmark {
      font-size: 4rem;
      animation: pop 0.4s ease-out;
    }
    @keyframes pop {
      0% { transform: scale(0); }
      80% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✅</div>
    <h1>Authentication Successful!</h1>
    <p>You can close this window now.</p>
    <p style="font-size: 0.9rem; opacity: 0.7;">Redirecting back to the app...</p>
  </div>
  <script>
    // Try to close the window after a short delay
    setTimeout(() => {
      window.close();
    }, 2000);
  </script>
</body>
</html>
          `);

          finish(undefined, { code, state });
        } else if (url.pathname === "/health") {
          // Health check endpoint
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", waiting: true }));
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
        }
      },
    );

    const finish = (err?: Error, result?: OAuthCallbackResult) => {
      if (finished) return;
      finished = true;

      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      // Close the server
      try {
        server.close();
      } catch {
        // Ignore close errors
      }

      if (err) {
        reject(err);
      } else if (result) {
        resolve(result);
      }
    };

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        finish(
          new Error(
            `Port ${port} is already in use. Please close any other OAuth flows and try again.`,
          ),
        );
      } else {
        finish(
          err instanceof Error ? err : new Error("OAuth callback server error"),
        );
      }
    });

    server.listen(port, "127.0.0.1", () => {
      console.log(
        `🔐 OAuth callback server listening on http://127.0.0.1:${port}/auth/callback`,
      );
    });

    // Set timeout
    timeout = setTimeout(() => {
      console.log("⏰ OAuth callback timeout - closing server");
      finish(new Error("OAuth callback timeout - please try again"));
    }, timeoutMs);
  });
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * Check if the callback server port is available
 */
export async function isPortAvailable(port: number = 1455): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port, "127.0.0.1");
  });
}

/**
 * Get the default callback URL
 */
export function getCallbackUrl(port: number = 1455): string {
  return `http://127.0.0.1:${port}/auth/callback`;
}
