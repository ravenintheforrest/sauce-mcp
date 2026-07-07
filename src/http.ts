#!/usr/bin/env node
/**
 * Sauce recipe MCP server — HTTP (Streamable HTTP transport) for use as a hosted
 * "cloud" custom connector. Runs on the homelab next to Postgres (PRD P4) behind
 * the Cloudflare tunnel, so Claude (web/desktop/CLI) can reach it by URL.
 *
 * Auth: a shared secret in SAUCE_MCP_TOKEN, accepted as either
 *   - Authorization: Bearer <token>   (Claude Code CLI: --header)
 *   - ?key=<token> in the URL          (Claude web/desktop custom connector URL)
 *   - x-api-key: <token>
 *
 * Stateful sessions: a transport per MCP session, keyed by the mcp-session-id
 * header, held in memory. A restart just makes clients re-initialize.
 */

import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { buildServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 8788);
const TOKEN = process.env.SAUCE_MCP_TOKEN;

if (!TOKEN) {
  console.error("WARNING: SAUCE_MCP_TOKEN is unset — the endpoint is UNAUTHENTICATED.");
}

function authorized(req: Request): boolean {
  if (!TOKEN) return true;
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth === `Bearer ${TOKEN}`) return true;
  if (req.headers["x-api-key"] === TOKEN) return true;
  if (typeof req.query.key === "string" && req.query.key === TOKEN) return true;
  return false;
}

function unauthorized(res: Response) {
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Unauthorized" },
    id: null,
  });
}

const transports: Record<string, StreamableHTTPServerTransport> = {};

const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sauce-recipe-mcp" });
});

// Client → server JSON-RPC. New session on an initialize request; otherwise the
// mcp-session-id header selects the existing transport.
app.post("/mcp", async (req: Request, res: Response) => {
  if (!authorized(req)) return unauthorized(res);

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport | undefined =
    sessionId ? transports[sessionId] : undefined;

  if (!transport) {
    if (sessionId) {
      // Stale/unknown session (e.g. the server restarted). Per the Streamable
      // HTTP spec a 404 tells the client to start a fresh session, so it
      // self-heals instead of failing repeatedly.
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Session not found — reinitialize." },
        id: null,
      });
      return;
    }
    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: initialize first." },
        id: null,
      });
      return;
    }
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => { transports[sid] = transport!; },
    });
    transport.onclose = () => {
      if (transport!.sessionId) delete transports[transport!.sessionId];
    };
    await buildServer().connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

// SSE stream (GET) and session teardown (DELETE) for an existing session.
async function handleSession(req: Request, res: Response) {
  if (!authorized(req)) return unauthorized(res);
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? transports[sessionId] : undefined;
  if (!transport) {
    res.status(404).send("Session not found");
    return;
  }
  await transport.handleRequest(req, res);
}
app.get("/mcp", handleSession);
app.delete("/mcp", handleSession);

app.listen(PORT, () => {
  console.error(`sauce-recipe-mcp HTTP listening on :${PORT}`);
});
