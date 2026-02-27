export interface RecipientCheckResult {
  allowed: boolean;
  externalRecipients: string[];
  warnings: string[];
  errors: string[];
}

export interface RecipientCheckConfig {
  internalDomains: string[];
  maxRecipients: number;
  warnExternalThreshold: number;
}

const DEFAULT_CONFIG: RecipientCheckConfig = {
  internalDomains: [],
  maxRecipients: 100,
  warnExternalThreshold: 0,
};

/**
 * Check recipients for external domains and enforce max recipient limits.
 */
export function checkRecipients(
  recipients: string[],
  config: Partial<RecipientCheckConfig> = {},
): RecipientCheckResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  const errors: string[] = [];

  // Deduplicate
  const unique = [...new Set(recipients.map((r) => r.toLowerCase().trim()))];

  // Max recipient check
  if (unique.length > cfg.maxRecipients) {
    errors.push(
      `Recipient count (${unique.length}) exceeds maximum (${cfg.maxRecipients}). Blocked.`,
    );
    return { allowed: false, externalRecipients: [], warnings, errors };
  }

  if (unique.length > 20) {
    warnings.push(
      `Sending to ${unique.length} recipients. Please verify this is intentional.`,
    );
  }

  // External domain check
  const externalRecipients: string[] = [];
  if (cfg.internalDomains.length > 0) {
    const internalLower = cfg.internalDomains.map((d) => d.toLowerCase());
    for (const recipient of unique) {
      const domain = recipient.split("@")[1];
      if (domain && !internalLower.includes(domain)) {
        externalRecipients.push(recipient);
      }
    }

    if (externalRecipients.length > 0) {
      warnings.push(
        `External recipients detected (outside ${cfg.internalDomains.join(", ")}): ${externalRecipients.join(", ")}`,
      );
    }
  }

  return {
    allowed: true,
    externalRecipients,
    warnings,
    errors,
  };
}

/**
 * Extract all email addresses from Graph API recipient arrays.
 */
export function extractAddresses(
  ...recipientArrays: (
    | { emailAddress?: { address?: string } }[]
    | undefined
  )[]
): string[] {
  const addresses: string[] = [];
  for (const arr of recipientArrays) {
    if (!arr) continue;
    for (const r of arr) {
      if (r.emailAddress?.address) {
        addresses.push(r.emailAddress.address);
      }
    }
  }
  return addresses;
}
