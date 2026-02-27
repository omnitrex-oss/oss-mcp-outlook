import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphClient, stripOData } from "../../src/graph/client.js";
import type { AuthManager } from "../../src/auth/msal.js";
import { GraphError } from "../../src/graph/error.js";

// Mock auth manager
function createMockAuth(): AuthManager {
  return {
    getAccessToken: vi.fn().mockResolvedValue("mock-token"),
    init: vi.fn(),
    logout: vi.fn(),
  } as unknown as AuthManager;
}

describe("GraphClient", () => {
  let auth: AuthManager;
  let client: GraphClient;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GraphClient(auth, { maxRetries: 2, timeoutMs: 5000 });
  });

  it("includes Authorization header in requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.get("/me/messages");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer mock-token");
  });

  it("throws GraphError on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            error: { code: "ResourceNotFound", message: "Not found" },
          }),
      }),
    );

    await expect(client.get("/me/messages/nonexistent")).rejects.toThrow(
      GraphError,
    );
  });

  it("retries on 429 with Retry-After header", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: new Headers({ "Retry-After": "1" }),
            json: () =>
              Promise.resolve({
                error: {
                  code: "TooManyRequests",
                  message: "Throttled",
                },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ value: ["data"] }),
        });
      }),
    );

    const result = await client.get<{ value: string[] }>("/me/messages");
    expect(result.value).toEqual(["data"]);
    expect(callCount).toBe(2);
  });

  it("retries once on 401", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            headers: new Headers(),
            json: () =>
              Promise.resolve({
                error: {
                  code: "InvalidAuthenticationToken",
                  message: "Token expired",
                },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: "ok" }),
        });
      }),
    );

    const result = await client.get<{ data: string }>("/me/messages");
    expect(result.data).toBe("ok");
    expect(callCount).toBe(2);
  });

  it("handles 204 No Content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );

    const result = await client.delete("/me/messages/some-id");
    expect(result).toBeUndefined();
  });

  it("sends JSON body for POST requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "new-draft" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.post("/me/messages", { subject: "Test" });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ subject: "Test" });
  });
});

describe("stripOData", () => {
  it("removes @odata properties", () => {
    const obj = {
      "@odata.context": "https://graph.microsoft.com/v1.0/$metadata",
      "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$skip=10",
      id: "abc",
      subject: "Test",
    };

    const result = stripOData(obj);
    expect(result).not.toHaveProperty("@odata.context");
    expect(result).not.toHaveProperty("@odata.nextLink");
    expect(result).toHaveProperty("id", "abc");
    expect(result).toHaveProperty("subject", "Test");
  });
});
