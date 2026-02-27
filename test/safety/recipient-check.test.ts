import { describe, it, expect } from "vitest";
import {
  checkRecipients,
  extractAddresses,
} from "../../src/safety/recipient-check.js";

describe("checkRecipients", () => {
  it("allows normal recipient lists", () => {
    const result = checkRecipients(["alice@company.com", "bob@company.com"]);
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("warns for external recipients when internal domains configured", () => {
    const result = checkRecipients(
      ["alice@company.com", "external@gmail.com"],
      { internalDomains: ["company.com"] },
    );
    expect(result.allowed).toBe(true);
    expect(result.externalRecipients).toContain("external@gmail.com");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("External recipients");
  });

  it("does not warn when all recipients are internal", () => {
    const result = checkRecipients(
      ["alice@company.com", "bob@company.com"],
      { internalDomains: ["company.com"] },
    );
    expect(result.externalRecipients).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("blocks when recipient count exceeds max", () => {
    const recipients = Array.from(
      { length: 101 },
      (_, i) => `user${i}@company.com`,
    );
    const result = checkRecipients(recipients, { maxRecipients: 100 });
    expect(result.allowed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("exceeds maximum");
  });

  it("warns for >20 recipients but allows", () => {
    const recipients = Array.from(
      { length: 25 },
      (_, i) => `user${i}@company.com`,
    );
    const result = checkRecipients(recipients);
    expect(result.allowed).toBe(true);
    expect(result.warnings.some((w) => w.includes("25 recipients"))).toBe(true);
  });

  it("deduplicates recipients", () => {
    const result = checkRecipients(
      ["alice@company.com", "ALICE@COMPANY.COM", "alice@company.com"],
      { maxRecipients: 2 },
    );
    // Should be 1 unique recipient, not 3
    expect(result.allowed).toBe(true);
  });

  it("is case-insensitive for domain matching", () => {
    const result = checkRecipients(
      ["alice@COMPANY.COM"],
      { internalDomains: ["company.com"] },
    );
    expect(result.externalRecipients).toHaveLength(0);
  });
});

describe("extractAddresses", () => {
  it("extracts addresses from Graph recipient objects", () => {
    const recipients = [
      { emailAddress: { address: "alice@test.com", name: "Alice" } },
      { emailAddress: { address: "bob@test.com" } },
    ];
    const result = extractAddresses(recipients);
    expect(result).toEqual(["alice@test.com", "bob@test.com"]);
  });

  it("handles undefined arrays", () => {
    const result = extractAddresses(undefined, undefined);
    expect(result).toEqual([]);
  });

  it("merges multiple recipient arrays", () => {
    const to = [{ emailAddress: { address: "to@test.com" } }];
    const cc = [{ emailAddress: { address: "cc@test.com" } }];
    const result = extractAddresses(to, cc);
    expect(result).toEqual(["to@test.com", "cc@test.com"]);
  });

  it("skips entries without address", () => {
    const recipients = [
      { emailAddress: { address: "valid@test.com" } },
      { emailAddress: {} },
      {},
    ];
    const result = extractAddresses(recipients as never[]);
    expect(result).toEqual(["valid@test.com"]);
  });
});
