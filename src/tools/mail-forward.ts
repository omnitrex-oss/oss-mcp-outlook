import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";
import type { AppConfig } from "../config.js";
import { previewDraft, sendDraft } from "../safety/draft-guard.js";

const recipientSchema = z.union([
  z.string(),
  z.array(z.string()),
]);

function toRecipientArray(input: string | string[]): { emailAddress: { address: string } }[] {
  const addresses = Array.isArray(input) ? input : [input];
  return addresses.map((addr) => ({ emailAddress: { address: addr } }));
}

export function registerMailForward(
  server: McpServer,
  graph: GraphClient,
  audit: AuditLogger,
  config: AppConfig,
): void {
  server.tool(
    "mail_forward",
    "Forward an email to new recipients. Creates a forward draft, optionally sends it.",
    {
      messageId: z.string().describe("The message ID to forward"),
      to: recipientSchema.describe("Forward recipient(s)"),
      body: z.string().optional().describe("Additional message to include"),
      confirm: z
        .boolean()
        .optional()
        .describe("Set to true to send immediately. False/omit to create draft only."),
    },
    async ({ messageId, to, body, confirm = false }) => {
      const recipientConfig = {
        internalDomains: config.internalDomains,
        maxRecipients: config.maxRecipients,
      };

      // Create forward draft
      const draft = await graph.post<{ id: string }>(
        `/me/messages/${messageId}/createForward`,
        { comment: body ?? "" },
      );

      // Update forward recipients on the draft
      const toArr = toRecipientArray(to);
      await graph.patch(`/me/messages/${draft.id}`, {
        toRecipients: toArr,
      });

      const allAddresses = (Array.isArray(to) ? to : [to]);

      await audit.log({
        action: "forward_draft",
        tool: "mail_forward",
        success: true,
        messageId,
        draftId: draft.id,
        recipients: allAddresses,
      });

      if (!confirm) {
        const preview = await previewDraft(graph, draft.id, recipientConfig);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  mode: "draft_created",
                  ...preview,
                  instruction:
                    "Forward draft created. Use mail_draft_send to review and send, or mail_draft_update to modify.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Send immediately
      const result = await sendDraft(graph, audit, draft.id, recipientConfig);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "forward_sent",
                to: result.preview.to,
                subject: result.preview.subject,
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
