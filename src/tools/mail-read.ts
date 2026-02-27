import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";
import { formatMessage } from "../utils/format.js";

export function registerMailRead(
  server: McpServer,
  graph: GraphClient,
  _audit: AuditLogger,
): void {
  server.tool(
    "mail_read",
    "Read the full content of an email message including body, headers, and metadata",
    {
      messageId: z.string().describe("The message ID to read"),
      preferText: z
        .boolean()
        .optional()
        .describe("If true, request text body format (default: true)"),
    },
    async ({ messageId, preferText = true }) => {
      const headers: Record<string, string> = {};
      if (preferText) {
        headers["Prefer"] = 'outlook.body-content-type="text"';
      }

      const msg = await graph.get<Record<string, unknown>>(
        `/me/messages/${messageId}`,
      );
      const formatted = formatMessage(msg as never, true);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    },
  );
}
