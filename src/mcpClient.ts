import type { ToolPayload } from "./types";

type JsonRpc = {
  jsonrpc?: string;
  id?: number | string | null;
  result?: {
    protocolVersion?: string;
    content?: { type: string; text?: string }[];
    isError?: boolean;
    tools?: { name: string }[];
  };
  error?: { message?: string };
};

let sessionId: string | undefined;
let nextId = 1;
let ready: Promise<void> | undefined;

async function openSession(): Promise<void> {
  const initialized = await post({
    jsonrpc: "2.0",
    id: nextId++,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "mantel-echo-show", version: "1.0.0" },
    },
  });
  const version = initialized?.result?.protocolVersion;
  if (version !== "2025-11-25") {
    throw new Error(`Expected MCP 2025-11-25, got ${version || "no protocol version"}.`);
  }
  await post({ jsonrpc: "2.0", method: "notifications/initialized" });
}

function parseBody(text: string, contentType: string): JsonRpc | null {
  if (!text.trim()) return null;
  if (contentType.includes("text/event-stream")) {
    const chunks = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    const last = chunks.at(-1);
    return last ? (JSON.parse(last) as JsonRpc) : null;
  }
  return JSON.parse(text) as JsonRpc;
}

async function post(message: unknown): Promise<JsonRpc | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const response = await fetch("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });
  const returnedSession = response.headers.get("mcp-session-id");
  if (returnedSession) sessionId = returnedSession;

  const text = await response.text();
  const payload = parseBody(text, response.headers.get("content-type") || "");
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Mantel MCP returned HTTP ${response.status}.`);
  }
  if (payload?.error) throw new Error(payload.error.message || "MCP request failed.");
  return payload;
}

export async function connectMantel(): Promise<string> {
  if (!ready) {
    ready = openSession().catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
  }
  await ready;
  return sessionId || "";
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolPayload> {
  await connectMantel();
  const response = await post({
    jsonrpc: "2.0",
    id: nextId++,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const result = response?.result;
  const text = result?.content?.find((block) => block.type === "text")?.text || "";
  if (result?.isError) throw new Error(text || `${name} failed.`);
  try {
    return JSON.parse(text) as ToolPayload;
  } catch {
    return { speech: text || "Mantel did not return a description." };
  }
}
