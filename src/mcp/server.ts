import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerTools } from "./tools.js";
import { VERSION } from "../shared/version.js";

const server = new McpServer({
  name: "wiki-agent",
  version: VERSION,
});

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Wiki-Agent MCP server error:", err);
  process.exit(1);
});