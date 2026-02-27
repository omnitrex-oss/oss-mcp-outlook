import type { AuthManager } from "../auth/msal.js";
import { GraphError, parseGraphError } from "./error.js";
import { paginate, type PaginatedResult } from "./pagination.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface GraphClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

interface RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** If true, returns raw Response instead of parsed JSON */
  raw?: boolean;
}

/**
 * Lightweight Microsoft Graph API HTTP client.
 * Handles auth header injection, 429 retry, 401 refresh, and error parsing.
 */
export class GraphClient {
  private auth: AuthManager;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(auth: AuthManager, options: GraphClientOptions = {}) {
    this.auth = auth;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>({ method: "GET", path });
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: "POST", path, body });
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>({ method: "PATCH", path, body });
  }

  async delete(path: string): Promise<void> {
    await this.request<void>({ method: "DELETE", path });
  }

  /**
   * POST with no response body (e.g., /messages/{id}/send returns 202).
   */
  async postEmpty(path: string, body?: unknown): Promise<void> {
    await this.request<void>({ method: "POST", path, body, raw: true });
  }

  /**
   * PUT raw bytes (used for upload session chunks).
   */
  async putBytes(
    url: string,
    data: Buffer,
    contentRange: string,
    contentType: string,
  ): Promise<unknown> {
    const token = await this.auth.getAccessToken();
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
        "Content-Range": contentRange,
        "Content-Length": data.byteLength.toString(),
      },
      body: data,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw parseGraphError(response.status, body);
    }

    if (
      response.headers.get("content-length") === "0" ||
      response.status === 204
    ) {
      return undefined;
    }
    return response.json();
  }

  /**
   * Paginated GET — follows @odata.nextLink automatically.
   */
  async getPaginated<T>(
    path: string,
    maxPages?: number,
  ): Promise<PaginatedResult<T>> {
    const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
    return paginate<T>(
      async (pageUrl) => {
        const fullUrl = pageUrl.startsWith("http")
          ? pageUrl
          : `${GRAPH_BASE}${pageUrl}`;
        return this.request({
          method: "GET",
          path: fullUrl,
        });
      },
      url,
      maxPages,
    );
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    let lastError: Error | null = null;
    let retries = 0;

    while (retries <= this.maxRetries) {
      try {
        const token = await this.auth.getAccessToken();
        const url = options.path.startsWith("http")
          ? options.path
          : `${GRAPH_BASE}${options.path}`;

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          ...options.headers,
        };

        if (options.body) {
          headers["Content-Type"] = "application/json";
        }

        const response = await fetch(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        // 204 No Content or raw mode
        if (response.status === 204 || response.status === 202) {
          return undefined as T;
        }

        if (response.ok) {
          if (options.raw) return undefined as T;
          return (await response.json()) as T;
        }

        // Error handling
        const body = await response.json().catch(() => null);
        const error = parseGraphError(response.status, body);

        // 429 Too Many Requests — retry with Retry-After
        if (error.isThrottled && retries < this.maxRetries) {
          const retryAfter = parseInt(
            response.headers.get("Retry-After") ?? "5",
            10,
          );
          await sleep(retryAfter * 1000);
          retries++;
          lastError = error;
          continue;
        }

        // 401 Unauthorized — refresh token and retry once
        if (error.isUnauthorized && retries === 0) {
          retries++;
          lastError = error;
          continue;
        }

        throw error;
      } catch (error) {
        if (error instanceof GraphError) throw error;
        lastError = error as Error;
        retries++;
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip OData metadata properties from a response object.
 */
export function stripOData<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith("@odata.")) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}
