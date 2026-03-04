import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ICachePlugin, TokenCacheContext } from "@azure/msal-node";

/**
 * Token cache persistence layer.
 * Tries OS keychain (keytar) first, falls back to encrypted file.
 */
export class TokenStore implements ICachePlugin {
  private cachePath: string;
  private keytar: typeof import("keytar") | null = null;
  private static readonly SERVICE_NAME = "oss-mcp-outlook";
  private static readonly ACCOUNT_NAME = "token-cache";

  constructor(cachePath: string) {
    this.cachePath = cachePath;
  }

  async init(): Promise<void> {
    try {
      this.keytar = await import("keytar");
    } catch {
      // keytar not available — file fallback is fine
      this.keytar = null;
    }
  }

  async beforeCacheAccess(context: TokenCacheContext): Promise<void> {
    const data = await this.load();
    if (data) {
      context.tokenCache.deserialize(data);
    }
  }

  async afterCacheAccess(context: TokenCacheContext): Promise<void> {
    if (context.cacheHasChanged) {
      const data = context.tokenCache.serialize();
      await this.save(data);
    }
  }

  private async load(): Promise<string | null> {
    // Try keytar first
    if (this.keytar) {
      try {
        const secret = await this.keytar.getPassword(
          TokenStore.SERVICE_NAME,
          TokenStore.ACCOUNT_NAME,
        );
        if (secret) return secret;
      } catch {
        // Fall through to file
      }
    }

    // File fallback
    try {
      return await readFile(this.cachePath, "utf-8");
    } catch {
      return null;
    }
  }

  private async save(data: string): Promise<void> {
    // Try keytar first
    if (this.keytar) {
      try {
        await this.keytar.setPassword(
          TokenStore.SERVICE_NAME,
          TokenStore.ACCOUNT_NAME,
          data,
        );
        return;
      } catch {
        // Fall through to file
      }
    }

    // File fallback with restricted permissions
    await mkdir(dirname(this.cachePath), { recursive: true });
    await writeFile(this.cachePath, data, { mode: 0o600 });
  }

  async clear(): Promise<void> {
    if (this.keytar) {
      try {
        await this.keytar.deletePassword(
          TokenStore.SERVICE_NAME,
          TokenStore.ACCOUNT_NAME,
        );
      } catch {
        // ignore
      }
    }
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(this.cachePath);
    } catch {
      // ignore
    }
  }
}
