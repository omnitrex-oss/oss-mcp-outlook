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
    name: "mcp-ms365-mail",
    version: "0.1.0",
  });

  // Register all tools
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

  return server;
}
