#!/usr/bin/env node
// stdio <-> HTTP bridge so desktop MCP clients (e.g. Claude Desktop) can use the workspace MCP server.
//
//   EW_URL=http://localhost:3100 EW_API_KEY=ewk_… node server/bin/mcp-stdio.mjs
//
// Reads newline-delimited JSON-RPC from stdin, POSTs each message to $EW_URL/mcp with the
// key as a bearer token, and writes the responses to stdout. The key never appears in logs.
import { createInterface } from "node:readline";

const base = (process.env.EW_URL || "http://localhost:3100").replace(
  /\/+$/,
  "",
);
const key = process.env.EW_API_KEY;
if (!key || !key.startsWith("ewk_")) {
  console.error("Set EW_API_KEY to a workspace API key (ewk_…).");
  process.exit(1);
}

const out = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);
const rl = createInterface({ input: process.stdin });
let pending = 0;
let closed = false;

const maybeExit = () => {
  if (closed && pending === 0) {
    process.exit(0);
  }
};

rl.on("line", async (line) => {
  if (!line.trim()) {
    return;
  }
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return out({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }
  pending++;
  try {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${key}`,
      },
      body: line,
    });
    if (res.status === 202) {
      return; // notification: nothing to send back
    }
    const text = await res.text();
    if (!res.ok && res.status !== 400) {
      return out({
        jsonrpc: "2.0",
        id: msg.id ?? null,
        error: {
          code: -32000,
          message: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        },
      });
    }
    process.stdout.write(`${text.trim()}\n`);
  } catch (e) {
    out({
      jsonrpc: "2.0",
      id: msg.id ?? null,
      error: { code: -32000, message: `Cannot reach ${base}: ${e.message}` },
    });
  } finally {
    pending--;
    maybeExit();
  }
});
rl.on("close", () => {
  closed = true;
  maybeExit();
});
