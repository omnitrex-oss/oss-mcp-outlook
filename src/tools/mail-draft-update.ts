import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";

const recipientSchema = z.union([
  z.string(),
  z.array(z.string()),
]);

function toRecipientArray(input: string | string[]): { emailAddress: { address: string } }[] {
  const addresses = Array.isArray(input) ? input : [input];
  return addresses.map((addr) => ({ emailAddress: { address: addr } }));
}

export function registerMailDraftUpdate(
  server: McpServer,
  graph: GraphClient,
  audit: AuditLogger,
): void {
  server.tool(
    "mail_draft_update",
    "Update an existing draft message. Only works on drafts (not sent messages).",
    {
      draftId: z.string().describe("The draft message ID to update"),
      subject: z.string().optional().describe("New subject"),
      body: z.string().optional().describe("New body content"),
      bodyType: z.enum(["text", "html"]).optional().describe("Body format"),
      to: recipientSchema.optional().describe("Replace To recipients"),
      cc: recipientSchema.optional().describe("Replace CC recipients"),
      bcc: recipientSchema.optional().describe("Replace BCC recipients"),
      importance: z.enum(["low", "normal", "high"]).optional(),
    },
    async ({ draftId, subject, body, bodyType, to, cc, bcc, importance }) => {
      // Verify it's a draft
      const existing = await graph.get<{ isDraft?: boolean }>(
        `/me/messages/${draftId}?$select=isDraft`,
      );
      if (!existing.isDraft) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Message is not a draft and cannot be updated.",
              }),
            },
          ],
          isError: true,
        };
      }

      const updates: Record<string, unknown> = {};
      if (subject !== undefined) updates.subject = subject;
      if (body !== undefined) {
        updates.body = {
          contentType: bodyType === "html" ? "HTML" : "Text",
          content: body,
        };
      }
      if (to !== undefined) updates.toRecipients = toRecipientArray(to);
      if (cc !== undefined) updates.ccRecipients = toRecipientArray(cc);
      if (bcc !== undefined) updates.bccRecipients = toRecipientArray(bcc);
      if (importance !== undefined) updates.importance = importance;

      await graph.patch(`/me/messages/${draftId}`, updates);

      await audit.log({
        action: "draft_update",
        tool: "mail_draft_update",
        success: true,
        draftId,
        subject,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              draftId,
              status: "draft_updated",
              updatedFields: Object.keys(updates),
            }),
          },
        ],
      };
    },
  );
}
