import { secretsService } from "../../secrets.js";

export async function executeSecretsAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  switch (action) {
    case "list": {
      const secrets = await secretsService.listSecrets(
        userId,
        params.category,
      );

      return {
        action: "list",
        secrets: secrets.map((s) => ({
          key: s.key,
          displayName: s.displayName,
          category: s.category,
          description: s.description,
          lastUsedAt: s.lastUsedAt,
        })),
        count: secrets.length,
      };
    }

    case "check": {
      if (!params.keys || !Array.isArray(params.keys)) {
        throw new Error("Missing 'keys' array parameter");
      }

      const result = await secretsService.checkSecretsExist(userId, params.keys);

      return {
        action: "check",
        exists: result.exists,
        missing: result.missing,
        allPresent: result.missing.length === 0,
      };
    }

    case "has": {
      if (!params.key) {
        throw new Error("Missing 'key' parameter");
      }

      const exists = await secretsService.hasSecret(userId, params.key);

      return {
        action: "has",
        key: params.key,
        exists,
      };
    }

    case "update": {
      if (!params.key) {
        throw new Error(
          "Missing 'key' parameter - specify which secret to update",
        );
      }
      if (!params.value) {
        throw new Error(
          "Missing 'value' parameter - provide the new value for the secret",
        );
      }

      const exists = await secretsService.hasSecret(userId, params.key);
      if (!exists) {
        return {
          action: "update",
          key: params.key,
          success: false,
          error: `Secret '${params.key}' not found. Use 'create' action to add a new secret.`,
        };
      }

      const updates: {
        value: string;
        displayName?: string;
        category?: string;
        description?: string;
      } = {
        value: params.value,
      };
      if (params.displayName) updates.displayName = params.displayName;
      if (params.category) updates.category = params.category;
      if (params.description) updates.description = params.description;

      const secret = await secretsService.updateSecret(
        userId,
        params.key,
        updates,
      );

      console.log(`[SecretsAudit] User ${userId} updated secret: ${params.key}`);

      return {
        action: "update",
        key: secret.key,
        displayName: secret.displayName,
        category: secret.category,
        success: true,
        message: `Secret '${params.key}' updated successfully`,
      };
    }

    case "create": {
      if (!params.key || !params.value) {
        throw new Error("Missing required parameters: 'key' and 'value'");
      }

      const secret = await secretsService.createSecret(userId, {
        key: params.key,
        value: params.value,
        displayName: params.displayName || params.key,
        category: params.category || "api_keys",
        description: params.description,
      });

      return {
        action: "create",
        success: true,
        key: secret.key,
        displayName: secret.displayName,
        category: secret.category,
        message: `Secret '${params.key}' created successfully`,
      };
    }

    default:
      throw new Error(`Unknown secrets action: ${action}`);
  }
}

export const SECRETS_TOOL_SCHEMA = {
  name: "secrets",
  description:
    "Manage user API keys and secrets. Use to check, create, or update secrets needed for generated tools. IMPORTANT: You can NEVER read/retrieve the actual value of a secret - only list, check existence, create, or update.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "check", "has", "create", "update"],
        description:
          "'list': show all configured secret names (grouped by category). 'check': verify if multiple keys exist. 'has': check single key existence. 'create': store a new API key or secret. 'update': update the value of an existing secret.",
      },
      keys: {
        type: "array",
        items: { type: "string" },
        description:
          "For 'check': array of secret key names to verify (e.g., ['openweathermap_api_key', 'google_maps_key'])",
      },
      key: {
        type: "string",
        description:
          "For 'has', 'create', 'update': the secret key name (e.g., 'openweathermap_api_key')",
      },
      value: {
        type: "string",
        description:
          "For 'create' or 'update': the actual secret value (API key, token, etc.)",
      },
      displayName: {
        type: "string",
        description:
          "For 'create': human-readable name for the secret (e.g., 'OpenWeatherMap API Key')",
      },
      description: {
        type: "string",
        description:
          "For 'create': optional description of what this secret is used for",
      },
      category: {
        type: "string",
        description:
          "For 'list' or 'create': secret category (e.g., 'api_keys', 'oauth', 'database')",
      },
    },
    required: ["action"],
  },
};
