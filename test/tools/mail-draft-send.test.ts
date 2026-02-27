import { describe, it, expect, vi } from "vitest";
import { previewDraft, sendDraft } from "../../src/safety/draft-guard.js";
import type { GraphClient } from "../../src/graph/client.js";
import type { AuditLogger } from "../../src/safety/audit.js";

function createMockGraph(draft: Record<string, unknown> = {}): GraphClient {
  const defaultDraft = {
    id: "draft-123",
    subject: "Test Subject",
    isDraft: true,
    body: { content: "Hello world", contentType: "text" },
    toRecipients: [
      { emailAddress: { address: "alice@company.com", name: "Alice" } },
    ],
    ccRecipients: [],
    bccRecipients: [],
    hasAttachments: false,
    ...draft,
  };

  return {
    get: vi.fn().mockImplementation((path: string) => {
      if (path.includes("/attachments")) {
        return Promise.resolve({ value: [] });
      }
      return Promise.resolve(defaultDraft);
    }),
    post: vi.fn().mockResolvedValue(undefined),
    postEmpty: vi.fn().mockResolvedValue(undefined),
  } as unknown as GraphClient;
}

function createMockAudit(): AuditLogger {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditLogger;
}

describe("previewDraft", () => {
  it("returns a preview with draft details", async () => {
    const graph = createMockGraph();
    const preview = await previewDraft(graph, "draft-123", {});

    expect(preview.draftId).toBe("draft-123");
    expect(preview.subject).toBe("Test Subject");
    expect(preview.to).toContain("alice@company.com");
    expect(preview.bodySnippet).toContain("Hello world");
    expect(preview.readyToSend).toBe(true);
  });

  it("throws if message is not a draft", async () => {
    const graph = createMockGraph({ isDraft: false });
    await expect(
      previewDraft(graph, "msg-123", {}),
    ).rejects.toThrow("not a draft");
  });

  it("includes external recipient warnings", async () => {
    const graph = createMockGraph({
      toRecipients: [
        { emailAddress: { address: "external@gmail.com" } },
      ],
    });

    const preview = await previewDraft(graph, "draft-123", {
      internalDomains: ["company.com"],
    });

    expect(preview.warnings.length).toBeGreaterThan(0);
    expect(preview.warnings[0]).toContain("External");
  });

  it("blocks when recipients exceed max", async () => {
    const recipients = Array.from({ length: 101 }, (_, i) => ({
      emailAddress: { address: `user${i}@test.com` },
    }));

    const graph = createMockGraph({ toRecipients: recipients });
    const preview = await previewDraft(graph, "draft-123", {
      maxRecipients: 100,
    });

    expect(preview.readyToSend).toBe(false);
  });

  it("includes attachment names in preview", async () => {
    const graph = {
      ...createMockGraph({ hasAttachments: true }),
      get: vi.fn().mockImplementation((path: string) => {
        if (path.includes("/attachments")) {
          return Promise.resolve({
            value: [
              { name: "report.pdf", size: 1024 },
              { name: "data.xlsx", size: 2048 },
            ],
          });
        }
        return Promise.resolve({
          id: "draft-123",
          subject: "With attachments",
          isDraft: true,
          body: { content: "See attached", contentType: "text" },
          toRecipients: [
            { emailAddress: { address: "alice@test.com" } },
          ],
          ccRecipients: [],
          bccRecipients: [],
          hasAttachments: true,
        });
      }),
    } as unknown as GraphClient;

    const preview = await previewDraft(graph, "draft-123", {});
    expect(preview.attachments).toEqual(["report.pdf", "data.xlsx"]);
  });
});

describe("sendDraft", () => {
  it("sends draft and logs to audit", async () => {
    const graph = createMockGraph();
    const audit = createMockAudit();

    const result = await sendDraft(graph, audit, "draft-123", {});

    expect(result.sent).toBe(true);
    expect(result.preview.subject).toBe("Test Subject");
    expect((graph.postEmpty as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "/me/messages/draft-123/send",
    );
    expect((audit.log as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
    const logCall = (audit.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(logCall.action).toBe("send");
    expect(logCall.success).toBe(true);
  });

  it("throws if recipients are blocked", async () => {
    const recipients = Array.from({ length: 101 }, (_, i) => ({
      emailAddress: { address: `user${i}@test.com` },
    }));
    const graph = createMockGraph({ toRecipients: recipients });
    const audit = createMockAudit();

    await expect(
      sendDraft(graph, audit, "draft-123", { maxRecipients: 100 }),
    ).rejects.toThrow("Cannot send");
  });
});
