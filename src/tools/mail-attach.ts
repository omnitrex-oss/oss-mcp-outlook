import { z } from "zod";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "../safety/audit.js";
import { detectMimeType } from "../utils/mime.js";

const SMALL_FILE_LIMIT = 3 * 1024 * 1024; // 3 MB
const LARGE_FILE_LIMIT = 150 * 1024 * 1024; // 150 MB
const UPLOAD_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB (must be multiple of 320 KiB)

export function registerMailAttach(
  server: McpServer,
  graph: GraphClient,
  audit: AuditLogger,
): void {
  server.tool(
    "mail_attach",
    "Attach a local file to a draft message. Supports files up to 150MB (auto-switches to upload session for files >3MB).",
    {
      draftId: z.string().describe("The draft message ID"),
      filePath: z.string().describe("Absolute path to the local file"),
    },
    async ({ draftId, filePath }) => {
      // Verify draft exists
      const draft = await graph.get<{ isDraft?: boolean }>(
        `/me/messages/${draftId}?$select=isDraft`,
      );
      if (!draft.isDraft) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Message is not a draft. Attachments can only be added to drafts.",
              }),
            },
          ],
          isError: true,
        };
      }

      const fileStat = await stat(filePath);
      const fileSize = fileStat.size;
      const fileName = basename(filePath);
      const contentType = detectMimeType(filePath);

      if (fileSize > LARGE_FILE_LIMIT) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `File size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds 150MB limit.`,
              }),
            },
          ],
          isError: true,
        };
      }

      if (fileSize <= SMALL_FILE_LIMIT) {
        // Direct upload (base64)
        const fileContent = await readFile(filePath);
        const base64 = fileContent.toString("base64");

        await graph.post(`/me/messages/${draftId}/attachments`, {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: fileName,
          contentType,
          contentBytes: base64,
        });
      } else {
        // Large file: upload session
        const session = await graph.post<{ uploadUrl: string }>(
          `/me/messages/${draftId}/attachments/createUploadSession`,
          {
            AttachmentItem: {
              attachmentType: "file",
              name: fileName,
              size: fileSize,
              contentType,
            },
          },
        );

        const fileContent = await readFile(filePath);
        let offset = 0;

        while (offset < fileSize) {
          const end = Math.min(offset + UPLOAD_CHUNK_SIZE, fileSize);
          const chunk = fileContent.subarray(offset, end);
          const contentRange = `bytes ${offset}-${end - 1}/${fileSize}`;

          await graph.putBytes(
            session.uploadUrl,
            Buffer.from(chunk),
            contentRange,
            contentType,
          );
          offset = end;
        }
      }

      await audit.log({
        action: "attach",
        tool: "mail_attach",
        success: true,
        draftId,
        attachmentNames: [fileName],
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "attached",
              draftId,
              fileName,
              fileSize: `${(fileSize / 1024).toFixed(1)} KB`,
              contentType,
              method: fileSize <= SMALL_FILE_LIMIT ? "direct" : "upload_session",
            }),
          },
        ],
      };
    },
  );
}
