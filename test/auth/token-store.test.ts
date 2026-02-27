import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock keytar to force file fallback
vi.mock("keytar", () => {
  throw new Error("keytar not available");
});

// Import after mock
const { TokenStore } = await import("../../src/auth/token-store.js");

describe("TokenStore (file fallback)", () => {
  let testDir: string;
  let cachePath: string;
  let store: InstanceType<typeof TokenStore>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `mcp-token-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    cachePath = join(testDir, "token-cache.json");
    store = new TokenStore(cachePath);
    await store.init();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("saves and loads token cache via ICachePlugin", async () => {
    const testData = JSON.stringify({
      Account: { test: "data" },
      AccessToken: {},
    });

    // Simulate MSAL calling afterCacheAccess
    const mockContext = {
      cacheHasChanged: true,
      tokenCache: {
        serialize: () => testData,
        deserialize: vi.fn(),
      },
    };

    await store.afterCacheAccess(mockContext as never);

    // Verify file was written
    const fileContent = await readFile(cachePath, "utf-8");
    expect(fileContent).toBe(testData);

    // Simulate MSAL calling beforeCacheAccess
    const loadContext = {
      tokenCache: {
        serialize: () => "",
        deserialize: vi.fn(),
      },
    };

    await store.beforeCacheAccess(loadContext as never);
    expect(loadContext.tokenCache.deserialize).toHaveBeenCalledWith(testData);
  });

  it("handles missing cache file gracefully", async () => {
    // Use a path that doesn't exist and no keytar
    const emptyStore = new TokenStore(join(testDir, "nonexistent", "cache.json"));
    await emptyStore.init();

    const loadContext = {
      tokenCache: {
        serialize: () => "",
        deserialize: vi.fn(),
      },
    };

    // Should not throw even if file doesn't exist
    await emptyStore.beforeCacheAccess(loadContext as never);
    expect(loadContext.tokenCache.deserialize).not.toHaveBeenCalled();
  });

  it("clears cache by deleting file", async () => {
    // Write some data first
    const mockContext = {
      cacheHasChanged: true,
      tokenCache: {
        serialize: () => '{"test":"data"}',
        deserialize: vi.fn(),
      },
    };
    await store.afterCacheAccess(mockContext as never);

    // Clear
    await store.clear();

    // Verify file is gone
    const loadContext = {
      tokenCache: {
        serialize: () => "",
        deserialize: vi.fn(),
      },
    };
    await store.beforeCacheAccess(loadContext as never);
    expect(loadContext.tokenCache.deserialize).not.toHaveBeenCalled();
  });
});
