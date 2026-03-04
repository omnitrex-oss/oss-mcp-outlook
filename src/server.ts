import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AuthManager } from "./auth/msal.js";
import { GraphClient } from "./graph/client.js";
import { AuditLogger } from "./safety/audit.js";
import { loadConfig, type AppConfig } from "./config.js";
import { registerMailList } from "./tools/mail-list.js";
import { registerMailRead } from "./tools/mail-read.js";
import { registerMailSearch } from "./tools/mail-search.js";
import { registerMailDraftCreate } from "./tools/mail-draft-create.js";
import { registerMailDraftUpdate } from "./tools/mail-draft-update.js";
import { registerMailDraftSend } from "./tools/mail-draft-send.js";
import { registerMailReply } from "./tools/mail-reply.js";
import { registerMailForward } from "./tools/mail-forward.js";
import { registerMailAttach } from "./tools/mail-attach.js";
import { registerMailAttachmentList } from "./tools/mail-attachment-list.js";
import { registerCalendarList } from "./tools/calendar-list.js";
import { registerCalendarRead } from "./tools/calendar-read.js";
import { registerCalendarCreate } from "./tools/calendar-create.js";
import { registerCalendarUpdate } from "./tools/calendar-update.js";
import { registerCalendarDelete } from "./tools/calendar-delete.js";
import { registerMailTemplateList } from "./tools/mail-template-list.js";
import { registerMailTemplateApply } from "./tools/mail-template-apply.js";

export async function createServer(): Promise<McpServer> {
  const config: AppConfig = loadConfig();

  // Initialize auth
  const auth = new AuthManager({
    clientId: config.clientId,
    tenantId: config.tenantId,
    tokenCachePath: config.tokenCachePath,
  });
  await auth.init();

  // Create Graph client
  const graph = new GraphClient(auth);

  // Create audit logger
  const audit = new AuditLogger(config.auditPath);

  // Create MCP server
  const server = new McpServer({
    name: "oss-mcp-outlook",
    version: "0.1.0",
  });

  // Register mail tools (10)
  registerMailList(server, graph, audit);
  registerMailRead(server, graph, audit);
  registerMailSearch(server, graph, audit);
  registerMailDraftCreate(server, graph, audit, config);
  registerMailDraftUpdate(server, graph, audit);
  registerMailDraftSend(server, graph, audit, config);
  registerMailReply(server, graph, audit, config);
  registerMailForward(server, graph, audit, config);
  registerMailAttach(server, graph, audit);
  registerMailAttachmentList(server, graph, audit);

  // Register calendar tools (5)
  registerCalendarList(server, graph, audit);
  registerCalendarRead(server, graph, audit);
  registerCalendarCreate(server, graph, audit);
  registerCalendarUpdate(server, graph, audit);
  registerCalendarDelete(server, graph, audit);

  // Register template tools (2)
  registerMailTemplateList(server);
  registerMailTemplateApply(server, graph, audit);

  return server;
}
