// Secrets Service
// Centralized, encrypted storage for user secrets (API keys, tokens, etc.)
// Uses AES-256-GCM for encryption

import crypto from "crypto";
import { PrismaClient, UserSecret } from "@prisma/client";

const prisma = new PrismaClient();

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Get encryption key from environment (must be 32 bytes / 64 hex chars)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn(
      "⚠️ ENCRYPTION_KEY not set - using derived key from JWT_SECRET (NOT RECOMMENDED FOR PRODUCTION)",
    );
    // Fallback: derive key from JWT_SECRET using PBKDF2
    const jwtSecret = process.env.JWT_SECRET || "default-fallback-secret";
    return crypto.pbkdf2Sync(jwtSecret, "secret-salt", 100000, 32, "sha256");
  }

  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32",
    );
  }

  return Buffer.from(key, "hex");
}

// Encryption helpers
function encrypt(plaintext: string): {
  encryptedValue: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decrypt(
  encryptedValue: string,
  iv: string,
  authTag: string,
): string {
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex"),
  );

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encryptedValue, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Types
export interface SecretInput {
  key: string;
  value: string;
  displayName: string;
  category?: string;
  description?: string;
  expiresAt?: Date;
}

export interface SecretOutput {
  id: string;
  key: string;
  displayName: string;
  category: string;
  description: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Value is NOT included for security
}

export interface SecretWithValue extends SecretOutput {
  value: string;
}

// Service class
class SecretsService {
  /**
   * Store a new secret (encrypted)
   */
  async createSecret(userId: string, input: SecretInput): Promise<SecretOutput> {
    const { encryptedValue, iv, authTag } = encrypt(input.value);

    const secret = await prisma.userSecret.create({
      data: {
        userId,
        key: input.key,
        displayName: input.displayName,
        category: input.category || "general",
        description: input.description,
        encryptedValue,
        iv,
        authTag,
        expiresAt: input.expiresAt,
      },
    });

    return this.toSecretOutput(secret);
  }

  /**
   * Update an existing secret
   */
  async updateSecret(
    userId: string,
    key: string,
    updates: Partial<SecretInput>,
  ): Promise<SecretOutput> {
    const data: any = {};

    if (updates.value !== undefined) {
      const { encryptedValue, iv, authTag } = encrypt(updates.value);
      data.encryptedValue = encryptedValue;
      data.iv = iv;
      data.authTag = authTag;
    }

    if (updates.displayName !== undefined) {
      data.displayName = updates.displayName;
    }

    if (updates.category !== undefined) {
      data.category = updates.category;
    }

    if (updates.description !== undefined) {
      data.description = updates.description;
    }

    if (updates.expiresAt !== undefined) {
      data.expiresAt = updates.expiresAt;
    }

    const secret = await prisma.userSecret.update({
      where: {
        userId_key: { userId, key },
      },
      data,
    });

    return this.toSecretOutput(secret);
  }

  /**
   * Get a secret's decrypted value
   * Updates lastUsedAt timestamp
   */
  async getSecretValue(userId: string, key: string): Promise<string | null> {
    const secret = await prisma.userSecret.findUnique({
      where: {
        userId_key: { userId, key },
      },
    });

    if (!secret) {
      return null;
    }

    // Check expiration
    if (secret.expiresAt && secret.expiresAt < new Date()) {
      return null;
    }

    // Update lastUsedAt
    await prisma.userSecret.update({
      where: { id: secret.id },
      data: { lastUsedAt: new Date() },
    });

    return decrypt(secret.encryptedValue, secret.iv, secret.authTag);
  }

  /**
   * Get multiple secrets' values at once
   * Returns a map of key -> value
   */
  async getSecretsValues(
    userId: string,
    keys: string[],
  ): Promise<Record<string, string>> {
    const secrets = await prisma.userSecret.findMany({
      where: {
        userId,
        key: { in: keys },
      },
    });

    const result: Record<string, string> = {};

    for (const secret of secrets) {
      // Skip expired secrets
      if (secret.expiresAt && secret.expiresAt < new Date()) {
        continue;
      }

      try {
        result[secret.key] = decrypt(
          secret.encryptedValue,
          secret.iv,
          secret.authTag,
        );
      } catch (error) {
        console.error(`Failed to decrypt secret ${secret.key}:`, error);
      }
    }

    // Update lastUsedAt for all accessed secrets
    if (secrets.length > 0) {
      await prisma.userSecret.updateMany({
        where: {
          id: { in: secrets.map((s) => s.id) },
        },
        data: { lastUsedAt: new Date() },
      });
    }

    return result;
  }

  /**
   * Get secret metadata (without value)
   */
  async getSecret(userId: string, key: string): Promise<SecretOutput | null> {
    const secret = await prisma.userSecret.findUnique({
      where: {
        userId_key: { userId, key },
      },
    });

    if (!secret) {
      return null;
    }

    return this.toSecretOutput(secret);
  }

  /**
   * List all secrets for a user (metadata only, no values)
   */
  async listSecrets(
    userId: string,
    category?: string,
  ): Promise<SecretOutput[]> {
    const secrets = await prisma.userSecret.findMany({
      where: {
        userId,
        ...(category && { category }),
      },
      orderBy: { createdAt: "desc" },
    });

    return secrets.map((s) => this.toSecretOutput(s));
  }

  /**
   * Delete a secret
   */
  async deleteSecret(userId: string, key: string): Promise<boolean> {
    try {
      await prisma.userSecret.delete({
        where: {
          userId_key: { userId, key },
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a secret exists
   */
  async hasSecret(userId: string, key: string): Promise<boolean> {
    const count = await prisma.userSecret.count({
      where: {
        userId,
        key,
      },
    });
    return count > 0;
  }

  /**
   * Check if multiple secrets exist
   * Returns list of missing keys
   */
  async checkSecretsExist(
    userId: string,
    keys: string[],
  ): Promise<{ exists: string[]; missing: string[] }> {
    const secrets = await prisma.userSecret.findMany({
      where: {
        userId,
        key: { in: keys },
      },
      select: { key: true },
    });

    const existingKeys = new Set(secrets.map((s) => s.key));
    const exists = keys.filter((k) => existingKeys.has(k));
    const missing = keys.filter((k) => !existingKeys.has(k));

    return { exists, missing };
  }

  /**
   * Convert DB model to output (without sensitive data)
   */
  private toSecretOutput(secret: UserSecret): SecretOutput {
    return {
      id: secret.id,
      key: secret.key,
      displayName: secret.displayName,
      category: secret.category,
      description: secret.description,
      expiresAt: secret.expiresAt,
      lastUsedAt: secret.lastUsedAt,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    };
  }
}

export const secretsService = new SecretsService();
