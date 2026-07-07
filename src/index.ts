#!/usr/bin/env node
/**
 * Sauce recipe MCP server — STDIO transport (local Claude Code subprocess).
 * For the hosted/cloud connector see http.ts.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

async function main() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP transport channel.
  console.error("sauce-recipe-mcp running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
