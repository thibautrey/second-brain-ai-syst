/**
 * Secret Detector Service
 *
 * Scans Python code for all secret/API key references
 * and validates that they are properly declared.
 *
 * Detects patterns:
 * - os.environ.get('SECRET_KEY')
 * - os.getenv('SECRET_KEY')
 * - os.environ['SECRET_KEY']
 * - Environment variable assignments
 */

/**
 * Detect all secrets referenced in Python code
 *
 * @param code Python code to scan
 * @returns Array of secret key names found
 */
export function detectSecretsInCode(code: string): string[] {
  const secrets = new Set<string>();

  // Pattern 1: os.environ.get('KEY_NAME') or os.environ.get("KEY_NAME")
  const getPattern =
    /os\.environ\.get\(\s*['"]([\w_]+)['"]\s*(?:,\s*['""][^"']*['"]?)?\s*\)/g;
  let match;

  while ((match = getPattern.exec(code)) !== null) {
    secrets.add(match[1]);
  }

  // Pattern 2: os.getenv('KEY_NAME') or os.getenv("KEY_NAME")
  const getenvPattern =
    /os\.getenv\(\s*['"]([\w_]+)['"]\s*(?:,\s*['""][^"']*['"]?)?\s*\)/g;
  while ((match = getenvPattern.exec(code)) !== null) {
    secrets.add(match[1]);
  }

  // Pattern 3: os.environ['KEY_NAME'] or os.environ["KEY_NAME"]
  const environPattern = /os\.environ\[\s*['"]([\w_]+)['"]\s*\]/g;
  while ((match = environPattern.exec(code)) !== null) {
    secrets.add(match[1]);
  }

  // Pattern 4: Common API key patterns (for detection from imports/comments)
  // e.g., API_KEY, TOKEN, SECRET, PASSWORD with all caps
  const commonSecretPattern =
    /(?:^|\s)([A-Z_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|KEY|AUTH)[A-Z_]*)\s*=/g;
  while ((match = commonSecretPattern.exec(code)) !== null) {
    const key = match[1];
    // Only add if it looks like it's being set from environment
    const line =
      code.split("\n")[code.substring(0, match.index).split("\n").length - 1];
    if (line && (line.includes("environ") || line.includes("getenv"))) {
      secrets.add(key);
    }
  }

  return Array.from(secrets).sort();
}

/**
 * Validate that all secrets used in code are declared
 *
 * @param code Python code to scan
 * @param declaredSecrets Array of declared secret names
 * @returns Validation result with detected and missing secrets
 */
export function validateSecretsDeclaration(
  code: string,
  declaredSecrets: string[] = [],
): {
  valid: boolean;
  detectedSecrets: string[];
  declaredSecrets: string[];
  missingSecrets: string[];
  undeclaredSecrets: string[];
} {
  const detectedSecrets = detectSecretsInCode(code);
  const declared = new Set(declaredSecrets);
  const detected = new Set(detectedSecrets);

  // Secrets used but not declared
  const missingSecrets = detectedSecrets.filter((s) => !declared.has(s));

  // Secrets declared but not used
  const undeclaredSecrets = declaredSecrets.filter((s) => !detected.has(s));

  return {
    valid: missingSecrets.length === 0,
    detectedSecrets,
    declaredSecrets,
    missingSecrets,
    undeclaredSecrets,
  };
}

/**
 * Merge detected secrets with declared ones, ensuring completeness
 *
 * @param code Python code
 * @param declaredSecrets Currently declared secrets
 * @returns Complete list of all required secrets
 */
export function mergeAndCompleteSecrets(
  code: string,
  declaredSecrets: string[] = [],
): string[] {
  const detected = detectSecretsInCode(code);
  const allSecrets = new Set([...declaredSecrets, ...detected]);
  return Array.from(allSecrets).sort();
}

/**
 * Generate validation report for secrets
 *
 * @param code Python code
 * @param declaredSecrets Declared secrets
 * @returns Human-readable report
 */
export function generateSecretsReport(
  code: string,
  declaredSecrets: string[] = [],
): string {
  const validation = validateSecretsDeclaration(code, declaredSecrets);
  const lines: string[] = [];

  lines.push("=== Secret Declaration Report ===");
  lines.push("");

  if (validation.detectedSecrets.length === 0) {
    lines.push("✓ No secrets detected in code");
  } else {
    lines.push(
      `Detected ${validation.detectedSecrets.length} secret(s) in code:`,
    );
    validation.detectedSecrets.forEach((s) => {
      const declared = validation.declaredSecrets.includes(s);
      lines.push(
        `  ${declared ? "✓" : "❌"} ${s}${declared ? " (declared)" : " (NOT DECLARED)"}`,
      );
    });
  }

  lines.push("");

  if (validation.missingSecrets.length > 0) {
    lines.push(
      `⚠️  Missing declarations (${validation.missingSecrets.length}):`,
    );
    validation.missingSecrets.forEach((s) => {
      lines.push(`  - ${s}`);
    });
    lines.push("");
  }

  if (validation.undeclaredSecrets.length > 0) {
    lines.push(
      `ℹ️  Declared but not used (${validation.undeclaredSecrets.length}):`,
    );
    validation.undeclaredSecrets.forEach((s) => {
      lines.push(`  - ${s}`);
    });
    lines.push("");
  }

  if (validation.valid) {
    lines.push("✓ All secrets are properly declared");
  } else {
    lines.push("❌ Secret declaration is incomplete");
  }

  return lines.join("\n");
}
