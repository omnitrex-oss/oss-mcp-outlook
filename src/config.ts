import { join } from "node:path";
import { homedir } from "node:os";

export interface AppConfig {
  clientId: string;
  tenantId: string;
  tokenCachePath: string;
  internalDomains: string[];
  maxRecipients: number;
  auditPath: string;
}

function resolveHome(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

export function loadConfig(): AppConfig {
  const clientId = process.env.MS365_CLIENT_ID;
  const tenantId = process.env.MS365_TENANT_ID;

  if (!clientId) {
    throw new Error(
      "MS365_CLIENT_ID environment variable is required. " +
        "Register an Azure AD app and provide the Application (client) ID.",
    );
  }

  if (!tenantId) {
    throw new Error(
      "MS365_TENANT_ID environment variable is required. " +
        "Provide the Directory (tenant) ID from your Azure AD app registration.",
    );
  }

  const defaultBase = join(homedir(), ".mcp-outlook");

  return {
    clientId,
    tenantId,
    tokenCachePath: resolveHome(
      process.env.MS365_TOKEN_CACHE_PATH ??
        join(defaultBase, "token-cache.json"),
    ),
    internalDomains: process.env.MS365_INTERNAL_DOMAINS
      ? process.env.MS365_INTERNAL_DOMAINS.split(",")
          .map((d) => d.trim())
          .filter(Boolean)
      : [],
    maxRecipients: parseInt(
      process.env.MS365_MAX_RECIPIENTS ?? "100",
      10,
    ),
    auditPath: resolveHome(
      process.env.MS365_AUDIT_PATH ?? join(defaultBase, "audit"),
    ),
  };
}
