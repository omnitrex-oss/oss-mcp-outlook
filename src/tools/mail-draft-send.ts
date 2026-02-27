import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";
import type { AppConfig } from "../config.js";
import { previewDraft, sendDraft } from "../safety/draft-guard.js";

export function registerMailDraftSend(
  server: McpServer,
  graph: GraphClient,
  audit: AuditLogger,
  config: AppConfig,
): void {
  server.tool(
    "mail_draft_send",
    "Send a draft email. Set confirm=false to preview first (recommended), confirm=true to actually send.",
    {
      draftId: z.string().describe("The draft message ID to send"),
      confirm: z
        .boolean()
        .describe(
          "Set to true to actually send. Set to false (or omit) to preview the draft without sending.",
        ),
    },
    async ({ draftId, confirm }) => {
      const recipientConfig = {
        internalDomains: config.internalDomains,
        maxRecipients: config.maxRecipients,
      };

      if (!confirm) {
        // Preview only — no send
        const preview = await previewDraft(graph, draftId, recipientConfig);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  mode: "preview",
                  ...preview,
                  instruction:
                    "Review the above. Call mail_draft_send again with confirm=true to send.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Confirmed send
      const result = await sendDraft(graph, audit, draftId, recipientConfig);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "sent",
                subject: result.preview.subject,
                to: result.preview.to,
                cc: result.preview.cc,
                warnings: result.preview.warnings.length > 0
                  ? result.preview.warnings
                  : undefined,
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
