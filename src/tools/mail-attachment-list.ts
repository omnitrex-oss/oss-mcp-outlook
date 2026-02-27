import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";

interface GraphAttachment {
  id: string;
  name?: string;
  size?: number;
  contentType?: string;
  isInline?: boolean;
}

export function registerMailAttachmentList(
  server: McpServer,
  graph: GraphClient,
  _audit: AuditLogger,
): void {
  server.tool(
    "mail_attachment_list",
    "List all attachments on an email message with name, size, type, and inline status",
    {
      messageId: z.string().describe("The message ID to list attachments for"),
    },
    async ({ messageId }) => {
      const result = await graph.get<{ value: GraphAttachment[] }>(
        `/me/messages/${messageId}/attachments?$select=id,name,size,contentType,isInline`,
      );

      const attachments = result.value.map((att) => ({
        id: att.id,
        name: att.name ?? "unnamed",
        size: att.size
          ? `${(att.size / 1024).toFixed(1)} KB`
          : "unknown",
        contentType: att.contentType ?? "unknown",
        isInline: att.isInline ?? false,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { attachments, count: attachments.length },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
