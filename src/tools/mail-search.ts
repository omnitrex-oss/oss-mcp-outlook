import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";
import { formatMessageList } from "../utils/format.js";

const SELECT_FIELDS =
  "id,subject,from,toRecipients,receivedDateTime,isRead,hasAttachments,bodyPreview";

export function registerMailSearch(
  server: McpServer,
  graph: GraphClient,
  _audit: AuditLogger,
): void {
  server.tool(
    "mail_search",
    "Search emails using KQL (Keyword Query Language) syntax. Examples: 'from:john subject:report', 'hasAttachment:true received>2024-01-01'",
    {
      query: z
        .string()
        .describe("KQL search query"),
      top: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results (default: 10, max: 50)"),
    },
    async ({ query, top = 10 }) => {
      const params = new URLSearchParams();
      params.set("$search", `"${query}"`);
      params.set("$select", SELECT_FIELDS);
      params.set("$top", String(top));

      const result = await graph.get<{ value: Record<string, unknown>[] }>(
        `/me/messages?${params.toString()}`,
      );
      const formatted = formatMessageList(result.value as never[]);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { results: formatted, count: formatted.length },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
