import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AuditLogger } from "../../src/safety/audit.js";

describe("AuditLogger", () => {
  let auditDir: string;
  let logger: AuditLogger;

  beforeEach(async () => {
    auditDir = join(tmpdir(), `mcp-audit-test-${Date.now()}`);
    await mkdir(auditDir, { recursive: true });
    logger = new AuditLogger(auditDir);
  });

  afterEach(async () => {
    await rm(auditDir, { recursive: true, force: true });
  });

  it("writes structured JSON log entries", async () => {
    await logger.log({
      action: "send",
      tool: "mail_draft_send",
      success: true,
      recipients: ["alice@test.com"],
      subject: "Test email",
    });

    const now = new Date();
    const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.jsonl`;
    const filePath = join(auditDir, fileName);
    const content = await readFile(filePath, "utf-8");
    const entry = JSON.parse(content.trim());

    expect(entry.action).toBe("send");
    expect(entry.tool).toBe("mail_draft_send");
    expect(entry.success).toBe(true);
    expect(entry.recipients).toEqual(["alice@test.com"]);
    expect(entry.subject).toBe("Test email");
    expect(entry.timestamp).toBeDefined();
  });

  it("never logs email body content", async () => {
    await logger.log({
      action: "send",
      tool: "mail_draft_send",
      success: true,
      recipients: ["alice@test.com"],
      subject: "Sensitive topic",
    });

    const now = new Date();
    const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.jsonl`;
    const filePath = join(auditDir, fileName);
    const content = await readFile(filePath, "utf-8");

    // The AuditEntry type doesn't have a body field — verify it doesn't appear
    expect(content).not.toContain('"body"');
    expect(content).not.toContain('"content"');
  });

  it("appends multiple entries to the same file", async () => {
    await logger.log({
      action: "draft_create",
      tool: "mail_draft_create",
      success: true,
      draftId: "draft-1",
    });

    await logger.log({
      action: "send",
      tool: "mail_draft_send",
      success: true,
      draftId: "draft-1",
    });

    const now = new Date();
    const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.jsonl`;
    const filePath = join(auditDir, fileName);
    const content = await readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).action).toBe("draft_create");
    expect(JSON.parse(lines[1]).action).toBe("send");
  });

  it("logs attachment names", async () => {
    await logger.log({
      action: "attach",
      tool: "mail_attach",
      success: true,
      draftId: "draft-1",
      attachmentNames: ["report.pdf", "data.xlsx"],
    });

    const now = new Date();
    const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.jsonl`;
    const filePath = join(auditDir, fileName);
    const content = await readFile(filePath, "utf-8");
    const entry = JSON.parse(content.trim());

    expect(entry.attachmentNames).toEqual(["report.pdf", "data.xlsx"]);
  });

  it("creates audit directory if it doesn't exist", async () => {
    const nestedDir = join(auditDir, "nested", "path");
    const nestedLogger = new AuditLogger(nestedDir);

    await nestedLogger.log({
      action: "test",
      tool: "test",
      success: true,
    });

    const now = new Date();
    const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.jsonl`;
    const filePath = join(nestedDir, fileName);
    const content = await readFile(filePath, "utf-8");
    expect(JSON.parse(content.trim()).action).toBe("test");
  });
});
