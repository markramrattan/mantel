import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMantelServer } from "./mcp.js";

const port = Number(process.env.PORT || 8787);
const app = express();
app.use(express.json({ limit: "1mb" }));

type Session = {
  transport: StreamableHTTPServerTransport;
};

const sessions = new Map<string, Session>();

function sessionIdFrom(req: express.Request): string | undefined {
  const header = req.headers["mcp-session-id"];
  return Array.isArray(header) ? header[0] : header;
}

app.all("/mcp", async (req, res) => {
  const existingId = sessionIdFrom(req);
  if (existingId) {
    const session = sessions.get(existingId);
    if (!session) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unknown MCP session. Initialize again." },
        id: null,
      });
      return;
    }
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  if (req.method !== "POST") {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Send initialize before other MCP requests." },
      id: null,
    });
    return;
  }

  const server = createMantelServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (id) => {
      sessions.set(id, { transport });
    },
    onsessionclosed: (id) => {
      sessions.delete(id);
    },
  });
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "mantel", protocol: "2025-11-25" });
});

if (process.env.NODE_ENV === "production") {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(root, "../dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Mantel MCP listening on http://127.0.0.1:${port}/mcp`);
});
