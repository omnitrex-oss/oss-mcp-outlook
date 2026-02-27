import {
  PublicClientApplication,
  type Configuration,
  type AuthenticationResult,
  type DeviceCodeRequest,
  LogLevel,
} from "@azure/msal-node";
import { ALL_SCOPES } from "./scopes.js";
import { TokenStore } from "./token-store.js";

export interface AuthConfig {
  clientId: string;
  tenantId: string;
  tokenCachePath: string;
}

/**
 * MSAL authentication wrapper.
 * Uses device code flow for initial auth, silent acquisition for subsequent calls.
 */
export class AuthManager {
  private app: PublicClientApplication;
  private tokenStore: TokenStore;
  private accountId: string | null = null;

  /** Callback to send device code message to MCP client (not stdout) */
  public onDeviceCodeMessage?: (message: string) => void;

  constructor(config: AuthConfig) {
    this.tokenStore = new TokenStore(config.tokenCachePath);

    const msalConfig: Configuration = {
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
      },
      cache: {
        cachePlugin: this.tokenStore,
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Warning,
          loggerCallback: () => {},
        },
      },
    };

    this.app = new PublicClientApplication(msalConfig);
  }

  async init(): Promise<void> {
    await this.tokenStore.init();

    // Try to find an existing cached account
    const cache = this.app.getTokenCache();
    const accounts = await cache.getAllAccounts();
    if (accounts.length > 0) {
      this.accountId = accounts[0].homeAccountId;
    }
  }

  /**
   * Get a valid access token. Tries silent acquisition first,
   * falls back to device code flow if no cached token exists.
   */
  async getAccessToken(): Promise<string> {
    // Try silent acquisition first
    if (this.accountId) {
      try {
        const cache = this.app.getTokenCache();
        const accounts = await cache.getAllAccounts();
        const account = accounts.find(
          (a) => a.homeAccountId === this.accountId,
        );
        if (account) {
          const result = await this.app.acquireTokenSilent({
            scopes: ALL_SCOPES,
            account,
          });
          if (result?.accessToken) {
            return result.accessToken;
          }
        }
      } catch {
        // Silent failed — fall through to device code
      }
    }

    // Device code flow
    return this.acquireTokenByDeviceCode();
  }

  private async acquireTokenByDeviceCode(): Promise<string> {
    const request: DeviceCodeRequest = {
      scopes: ALL_SCOPES,
      deviceCodeCallback: (response) => {
        const message = response.message;
        if (this.onDeviceCodeMessage) {
          this.onDeviceCodeMessage(message);
        } else {
          // Last resort: stderr (never stdout — that's MCP transport)
          process.stderr.write(`[Auth] ${message}\n`);
        }
      },
    };

    const result =
      await this.app.acquireTokenByDeviceCode(request);

    if (!result) {
      throw new Error("Device code authentication failed — no result returned.");
    }

    if (result.account) {
      this.accountId = result.account.homeAccountId;
    }

    return result.accessToken;
  }

  /**
   * Force re-authentication by clearing the cache.
   */
  async logout(): Promise<void> {
    await this.tokenStore.clear();
    this.accountId = null;
  }
}
