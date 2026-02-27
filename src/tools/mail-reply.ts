import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";
import type { AppConfig } from "../config.js";
import { previewDraft, sendDraft } from "../safety/draft-guard.js";

export function registerMailReply(
  server: McpServer,
  graph: GraphClient,
  audit: AuditLogger,
  config: AppConfig,
): void {
  server.tool(
    "mail_reply",
    "Reply to an email. Creates a reply draft, optionally sends it. Use replyAll=true for reply-all.",
    {
      messageId: z.string().describe("The message ID to reply to"),
      body: z.string().describe("Reply body content"),
      replyAll: z
        .boolean()
        .optional()
        .describe("Reply to all recipients (default: false)"),
      confirm: z
        .boolean()
        .optional()
        .describe("Set to true to send immediately. False/omit to create draft only."),
    },
    async ({ messageId, body, replyAll = false, confirm = false }) => {
      const endpoint = replyAll ? "createReplyAll" : "createReply";
      const recipientConfig = {
        internalDomains: config.internalDomains,
        maxRecipients: config.maxRecipients,
      };

      // Create reply draft
      const draft = await graph.post<{ id: string }>(
        `/me/messages/${messageId}/${endpoint}`,
        { comment: body },
      );

      await audit.log({
        action: "reply_draft",
        tool: "mail_reply",
        success: true,
        messageId,
        draftId: draft.id,
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
                    "Reply draft created. Use mail_draft_send to review and send, or mail_draft_update to modify.",
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
                status: "reply_sent",
                replyAll,
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
