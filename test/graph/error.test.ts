import { describe, it, expect } from "vitest";
import { parseGraphError, GraphError } from "../../src/graph/error.js";

describe("parseGraphError", () => {
  it("parses standard Graph API error response", () => {
    const body = {
      error: {
        code: "MailboxNotFound",
        message: "The mailbox was not found.",
        innerError: {
          code: "ResourceNotFound",
          date: "2024-01-15T10:00:00",
          requestId: "abc-123",
        },
      },
    };

    const error = parseGraphError(404, body);
    expect(error).toBeInstanceOf(GraphError);
    expect(error.code).toBe("MailboxNotFound");
    expect(error.message).toBe("The mailbox was not found.");
    expect(error.statusCode).toBe(404);
    expect(error.isNotFound).toBe(true);
    expect(error.isThrottled).toBe(false);
    expect(error.isUnauthorized).toBe(false);
    expect(error.innerError?.code).toBe("ResourceNotFound");
  });

  it("parses 429 throttled response", () => {
    const body = {
      error: {
        code: "TooManyRequests",
        message: "Rate limit exceeded",
      },
    };

    const error = parseGraphError(429, body);
    expect(error.isThrottled).toBe(true);
    expect(error.code).toBe("TooManyRequests");
  });

  it("parses 401 unauthorized response", () => {
    const body = {
      error: {
        code: "InvalidAuthenticationToken",
        message: "Access token has expired or is not yet valid.",
      },
    };

    const error = parseGraphError(401, body);
    expect(error.isUnauthorized).toBe(true);
  });

  it("handles non-standard error body (string)", () => {
    const error = parseGraphError(500, "Internal Server Error");
    expect(error.code).toBe("UnknownError");
    expect(error.message).toBe("Internal Server Error");
    expect(error.statusCode).toBe(500);
  });

  it("handles null/empty body", () => {
    const error = parseGraphError(502, null);
    expect(error.code).toBe("UnknownError");
    expect(error.message).toContain("502");
  });

  it("handles body without error property", () => {
    const error = parseGraphError(500, { something: "else" });
    expect(error.code).toBe("UnknownError");
  });
});
