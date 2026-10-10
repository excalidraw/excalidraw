#!/usr/bin/env node
/**
 * Tickets board — a READ-ONLY HTTP view of `tickets/`.
 *
 *   node server/tickets/index.mjs
 *
 * Binds localhost by default. It serves only `tickets/<column>/<file>.md`,
 * refuses any path that escapes the tickets root, and never writes.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { applyMove } from "./move.mjs";
import {
  COLUMNS,
  buildBoard,
  buildCard,
  columnOf,
  parseDevIds,
  readConfig,
  safeResolve,
} from "./tickets.mjs";

const config = readConfig();

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
};

const applyCors = (req, res) => {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  res.setHeader("access-control-allow-methods", "GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
};

const readDevIds = async () => {
  try {
    return parseDevIds(
      await readFile(path.join(config.root, "tickets", "DEVIDS"), "utf8"),
    );
  } catch {
    return {};
  }
};

const listBoard = async (res) => {
  const ticketsRoot = path.join(config.root, "tickets");
  const devIds = await readDevIds();
  const entries = [];

  for (const column of COLUMNS) {
    const dir = path.join(ticketsRoot, column);
    let files;
    try {
      files = await readdir(dir);
    } catch {
      continue; // a missing column is empty, not an error
    }
    for (const filename of files) {
      if (!filename.endsWith(".md")) {
        continue;
      }
      const full = path.join(dir, filename);
      const stats = await stat(full).catch(() => null);
      if (!stats?.isFile()) {
        continue;
      }
      const markdown = await readFile(full, "utf8").catch(() => "");
      const card = buildCard(column, filename, markdown);
      // The authoritative dev-id table may differ from the built-in one.
      const owner = card.devId ? devIds[card.devId] : undefined;
      if (owner && card.owner && card.owner.replace(/^@/, "") !== owner) {
        card.problems.push(
          `filename id '${card.devId}' but owner ${card.owner}`,
        );
      }
      entries.push(card);
    }
  }

  return json(res, 200, buildBoard(entries));
};

const readTicket = async (res, relative) => {
  const located = columnOf(relative);
  if (!located) {
    return json(res, 404, { error: "not a ticket path" });
  }
  const resolved = safeResolve(
    path.join(config.root, "tickets"),
    `${located.column}/${located.filename}`,
  );
  if (!resolved) {
    // A traversal attempt is refused, not resolved.
    return json(res, 400, { error: "path escapes the tickets root" });
  }
  try {
    const markdown = await readFile(resolved, "utf8");
    return json(res, 200, {
      column: located.column,
      filename: located.filename,
      markdown,
    });
  } catch {
    return json(res, 404, { error: "no such ticket" });
  }
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const server = createServer(async (req, res) => {
  applyCors(req, res);

  // Parsed FIRST: a route below reads `url.pathname`, and a `const` declared
  // after its use is a temporal dead zone that takes the whole server down on the
  // first request rather than returning an error.
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // THE ONE WRITE. The board is read-only for content by design — a ticket body
  // is authored in a file. Moving a ticket between columns IS the status change,
  // so that one action is allowed, and it is the only one.
  if (req.method === "POST" && url.pathname === "/api/tickets/move") {
    let request;
    try {
      request = JSON.parse(await readBody(req));
    } catch (error) {
      return json(res, 400, { error: error.message });
    }

    const result = applyMove(config.root, request, {
      logPath: config.writeLog,
      who: req.headers["x-excalidraw-who"]?.toString() || "unknown",
    });
    if (!result.ok) {
      return json(res, 400, { error: result.error });
    }
    return json(res, 200, { ok: true, detail: result.detail });
  }

  if (req.method !== "GET") {
    return json(res, 405, {
      error: "read-only: GET, and POST to /api/tickets/move",
    });
  }

  if (pathname === "/healthz") {
    return json(res, 200, { ok: true, root: config.root });
  }

  if (pathname === "/api/tickets") {
    return listBoard(res);
  }

  const match = /^\/api\/tickets\/(.+)$/.exec(pathname);
  if (match) {
    return readTicket(res, match[1]);
  }

  return json(res, 404, { error: `no route GET ${pathname}` });
});

server.listen(config.port, config.host, () => {
  console.log(
    `Tickets board on http://${config.host}:${config.port} (read-only) — root ${config.root}`,
  );
});
