/**
 * Encryption Utility
 *
 * Provides secure encryption/decryption for sensitive data like Telegram bot tokens
 * using AES-256-GCM encryption
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Get encryption key from environment
 * Falls back to a derived key if ENCRYPTION_KEY is not set
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;

  if (!envKey) {
    console.warn(
      "[Encryption] ENCRYPTION_KEY not set in environment. Using fallback - NOT RECOMMENDED FOR PRODUCTION!",
    );
    // Fallback: derive from JWT_SECRET (not ideal but better than nothing)
    const fallback =
      process.env.JWT_SECRET || "insecure-fallback-key-change-this";
    return crypto.scryptSync(fallback, "salt", 32);
  }

  // Ensure key is 32 bytes for AES-256
  if (envKey.length < 32) {
    return crypto.scryptSync(envKey, "salt", 32);
  }

  return Buffer.from(envKey.slice(0, 32), "utf-8");
}

/**
 * Encrypt a string value
 * @param plaintext - The text to encrypt
 * @returns Base64-encoded encrypted data with format: iv:authTag:encryptedData
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData (all in hex)
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("[Encryption] Error encrypting data:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt an encrypted string
 * @param encryptedData - The encrypted data in format iv:authTag:encryptedData
 * @returns The decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Parse the encrypted data
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("[Encryption] Error decrypting data:", error);
    throw new Error(
      "Failed to decrypt data - data may be corrupted or key changed",
    );
  }
}

/**
 * Generate a cryptographically secure random string
 * @param length - Length of the string to generate
 * @returns Random string (uppercase alphanumeric)
 */
export function generateSecureCode(length: number = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars: 0, O, 1, I
  let result = "";
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }

  return result;
}

/**
 * Format a verification code for display (e.g., ABCD-1234-EFGH)
 */
export function formatVerificationCode(code: string): string {
  if (code.length !== 12) {
    return code;
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

/**
 * Validate encryption key setup
 * @returns true if encryption is properly configured
 */
export function validateEncryptionSetup(): boolean {
  const hasKey = !!process.env.ENCRYPTION_KEY;
  if (!hasKey) {
    console.warn("[Encryption] ENCRYPTION_KEY environment variable not set!");
    console.warn("[Encryption] Generate one with: openssl rand -base64 32");
  }
  return hasKey;
}
