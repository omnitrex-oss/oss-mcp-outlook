import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[mcp-ms365-mail] Server started on stdio\n");
}

main().catch((error) => {
  process.stderr.write(`[mcp-ms365-mail] Fatal error: ${error}\n`);
  process.exit(1);
});
