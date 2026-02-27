import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";
import type { AppConfig } from "../config.js";
import { checkRecipients, extractAddresses } from "../safety/recipient-check.js";

const recipientSchema = z.union([
  z.string().describe("Single email address"),
  z.array(z.string()).describe("Array of email addresses"),
]);

function toRecipientArray(input: string | string[]): { emailAddress: { address: string } }[] {
  const addresses = Array.isArray(input) ? input : [input];
  return addresses.map((addr) => ({ emailAddress: { address: addr } }));
}

export function registerMailDraftCreate(
  server: McpServer,
  graph: GraphClient,
  audit: AuditLogger,
  config: AppConfig,
): void {
  server.tool(
    "mail_draft_create",
    "Create a draft email message. Does NOT send — use mail_draft_send to send after review.",
    {
      to: recipientSchema.describe("Recipient(s)"),
      subject: z.string().describe("Email subject"),
      body: z.string().describe("Email body content"),
      bodyType: z
        .enum(["text", "html"])
        .optional()
        .describe("Body format (default: text)"),
      cc: recipientSchema.optional().describe("CC recipient(s)"),
      bcc: recipientSchema.optional().describe("BCC recipient(s)"),
      importance: z
        .enum(["low", "normal", "high"])
        .optional()
        .describe("Message importance (default: normal)"),
    },
    async ({ to, subject, body, bodyType = "text", cc, bcc, importance }) => {
      const toArr = toRecipientArray(to);
      const ccArr = cc ? toRecipientArray(cc) : undefined;
      const bccArr = bcc ? toRecipientArray(bcc) : undefined;

      // Pre-check recipients
      const allAddresses = extractAddresses(toArr, ccArr, bccArr);
      const recipientCheck = checkRecipients(allAddresses, {
        internalDomains: config.internalDomains,
        maxRecipients: config.maxRecipients,
      });

      const message: Record<string, unknown> = {
        subject,
        body: {
          contentType: bodyType === "html" ? "HTML" : "Text",
          content: body,
        },
        toRecipients: toArr,
        importance: importance ?? "normal",
      };
      if (ccArr) message.ccRecipients = ccArr;
      if (bccArr) message.bccRecipients = bccArr;

      const draft = await graph.post<{ id: string; subject: string }>(
        "/me/messages",
        message,
      );

      await audit.log({
        action: "draft_create",
        tool: "mail_draft_create",
        success: true,
        draftId: draft.id,
        recipients: allAddresses,
        subject,
      });

      const warnings = recipientCheck.warnings;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                draftId: draft.id,
                subject,
                to: allAddresses,
                status: "draft_created",
                warnings: warnings.length > 0 ? warnings : undefined,
                nextStep:
                  "Use mail_draft_send with this draftId to review and send, or mail_attach to add attachments.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
