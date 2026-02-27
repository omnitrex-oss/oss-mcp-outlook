import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";
import { formatMessageList } from "../utils/format.js";

const SELECT_FIELDS =
  "id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,isDraft,hasAttachments,importance,bodyPreview";

export function registerMailList(
  server: McpServer,
  graph: GraphClient,
  _audit: AuditLogger,
): void {
  server.tool(
    "mail_list",
    "List messages in inbox or any mail folder with filtering and pagination",
    {
      folder: z
        .string()
        .optional()
        .describe("Folder name or ID (default: inbox)"),
      top: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of messages to return (default: 25, max: 100)"),
      filter: z
        .string()
        .optional()
        .describe("OData filter expression (e.g., 'isRead eq false')"),
      orderBy: z
        .string()
        .optional()
        .describe(
          "Sort order (default: 'receivedDateTime desc')",
        ),
      skip: z.number().optional().describe("Number of messages to skip"),
    },
    async ({ folder, top = 25, filter, orderBy, skip }) => {
      const basePath = folder
        ? `/me/mailFolders/${encodeURIComponent(folder)}/messages`
        : "/me/messages";

      const params = new URLSearchParams();
      params.set("$select", SELECT_FIELDS);
      params.set("$top", String(top));
      params.set("$orderby", orderBy ?? "receivedDateTime desc");
      if (filter) params.set("$filter", filter);
      if (skip) params.set("$skip", String(skip));

      const path = `${basePath}?${params.toString()}`;
      const result = await graph.getPaginated<Record<string, unknown>>(path, 1);
      const formatted = formatMessageList(result.items as never[]);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { messages: formatted, hasMore: result.hasMore, count: formatted.length },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
