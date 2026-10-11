#!/usr/bin/env node
/**
 * Collaboration server — a self-hosted room server for this fork.
 *
 *   node server/collab/index.mjs
 *
 * Speaks the protocol the client already speaks (the events in
 * `excalidraw-app/app_constants.ts`), so no client change is needed:
 *
 *   client → server   join-room · server-broadcast · server-volatile-broadcast · user-follow
 *   server → client   init-room · first-in-room · new-user · room-user-change
 *                     client-broadcast · user-follow-room-change
 *
 * It relays **opaque encrypted bytes**. The room key lives in the URL fragment
 * and never reaches the server, so the server cannot read a whiteboard.
 *
 * Binds localhost by default.
 */

import { createServer } from "node:http";

import { Server } from "socket.io";

import { watch } from "node:fs";

import {
  authorize,
  findMemberByHandle,
  isRoomProtected,
  loadRegistry,
  logMembership,
  readConfig as readAccessConfig,
} from "./access.mjs";
import {
  readBlob,
  readConfig as readFilesConfig,
  safePath,
  saveBlob,
} from "./files.mjs";
import {
  RoomStore,
  isPlausiblePayload,
  isPlausibleRoomId,
  readConfig,
} from "./rooms.mjs";

/** A small root page, so a shared link to THIS hostname previews properly. */
const landingPage = ({
  title,
  description,
  points,
  host,
  appUrl,
  card,
}) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#121212" />
${
  appUrl
    ? `<link rel="canonical" href="https://${host}/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${title}" />
<meta property="og:url" content="https://${host}/" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${appUrl}/${card}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${appUrl}/${card}" />`
    : ""
}
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:linear-gradient(135deg,#121212,#1b1b2b); color:#fff;
         font:16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, sans-serif }
  main { max-width:38rem; padding:2rem }
  h1 { margin:0 0 .25rem; font-size:1.6rem }
  p.sub { margin:0 0 1.5rem; color:#b6b6c9 }
  li { margin:.5rem 0; color:#cfcfe0 }
  a { color:#a8a5ff }
  code { background:#1f1f2e; padding:.1rem .35rem; border-radius:.25rem }
</style>
</head><body><main>
<h1>${title}</h1>
<p class="sub">${description}</p>
<ul>${points.map((point) => `<li>${point}</li>`).join("")}</ul>
${
  appUrl
    ? `<p>The whiteboard itself is at <a href="${appUrl}">${appUrl}</a>.</p>`
    : ""
}
<p><code>${host}</code></p>
</main></body></html>`;

const config = readConfig();
const access = readAccessConfig();
const files = readFilesConfig();
const store = new RoomStore();

export const createCollabServer = ({
  origins = config.allowedOrigins,
  accessConfig = access,
} = {}) => {
  const httpServer = createServer(async (req, res) => {
    // File blobs. Collaboration uploads them ALREADY ENCRYPTED with the room key,
    // so these are opaque bytes the server cannot read — the same property as the
    // scene relay. The id is unguessable (the client generates it), which is the
    // capability: the same model the hosted storage used.
    const url = new URL(req.url ?? "/", "http://localhost");

    // A preflight is answered first, or a cross-origin POST never happens.
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsFor(req));
      res.end();
      return;
    }

    if (url.pathname.startsWith("/files/")) {
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      if (!safePath(files.dir, key)) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid key" }));
        return;
      }

      if (req.method === "POST" || req.method === "PUT") {
        const chunks = [];
        let size = 0;
        let refused = false;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > files.maxBytes) {
            refused = true;
            break;
          }
          chunks.push(chunk);
        }
        if (refused) {
          res.writeHead(413, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "blob too large" }));
          return;
        }
        const result = await saveBlob(files.dir, key, Buffer.concat(chunks), {
          maxBytes: files.maxBytes,
        });
        res.writeHead(result.ok ? 200 : 400, {
          "content-type": "application/json",
          ...corsFor(req),
        });
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === "GET") {
        const blob = await readBlob(files.dir, key);
        if (!blob) {
          res.writeHead(404, {
            "content-type": "application/json",
            ...corsFor(req),
          });
          res.end(JSON.stringify({ error: "no such blob" }));
          return;
        }
        res.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": blob.length,
          "cache-control": "public, max-age=31536000, immutable",
          ...corsFor(req),
        });
        res.end(blob);
        return;
      }

      res.writeHead(405, {
        "content-type": "application/json",
        ...corsFor(req),
      });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }

    if (
      req.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/index.html")
    ) {
      const host = (req.headers.host ?? "").toString();
      const html = landingPage({
        title: "Whiteboard Rooms",
        description: "Collaborate, end to end encrypted.",
        points: [
          "The room key never leaves the browser — this server relays ciphertext and can read nothing.",
          "Members, invites, and rooms only a granted member may enter.",
          "Rooms are joined over the socket protocol; <code>/healthz</code> reports the roster.",
        ],
        host,
        appUrl: process.env.COLLAB_APP_URL || "",
        card: "og-collab.png",
      });
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        ...corsFor(req),
      });
      res.end(html);
      return;
    }

    if (url.pathname === "/healthz") {
      const payload = JSON.stringify({ ok: true, ...store.stats() });
      res.writeHead(200, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
      });
      return res.end(payload);
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  /**
   * The REST side answers the page, which lives on another origin — until now only
   * socket.io had CORS, so a plain fetch to /healthz failed and looked like the
   * server being down. This is the fix for that class of confusion.
   */
  const corsFor = (req) => {
    const origin = req.headers.origin;
    return origin && origins.includes(origin)
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
          "access-control-allow-headers": "content-type",
          vary: "origin",
        }
      : {};
  };

  const io = new Server(httpServer, {
    cors: { origin: origins, methods: ["GET", "POST"] },
    // The scene payload is encrypted bytes; a room is not a database, so a
    // generous but bounded frame is enough.
    maxHttpBufferSize: 16 * 1024 * 1024,
  });

  io.on("connection", (socket) => {
    // The client waits for this before sending join-room.
    socket.emit("init-room");

    /** rooms this socket is in — a socket should only be in one, but the
     *  protocol does not forbid more, so track them and clean up honestly. */
    const joined = new Set();

    socket.on("join-room", (roomId, credentials) => {
      if (!isPlausibleRoomId(roomId)) {
        return;
      }

      // AUTHORIZATION IS SERVER-SIDE. A room is public unless the registry marks
      // it protected; then a member token or a room-scoped invite is required.
      // The client cannot opt out — a refusal here ends the attempt.
      if (accessConfig.enforcement) {
        const registry = loadRegistry(accessConfig.registryPath);
        const decision = authorize(registry, {
          roomId,
          token: credentials?.token,
          invite: credentials?.invite,
        });
        if (!decision.ok) {
          logMembership(accessConfig.logPath, {
            event: "refused",
            roomId,
            socketId: socket.id,
            reason: decision.reason,
            // never the token, never an invite code's value
            hadToken: Boolean(credentials?.token),
            hadInvite: Boolean(credentials?.invite),
          });
          socket.emit("access-denied", { roomId, reason: decision.reason });
          return;
        }
        if (decision.via !== "public") {
          // Remember the member on the SOCKET: a revocation has to be able to
          // find a live session, and the socket is where a live session lives.
          if (decision.member?.handle) {
            socket.data.member = decision.member.handle;
          }
          logMembership(accessConfig.logPath, {
            event: "joined",
            roomId,
            socketId: socket.id,
            via: decision.via,
            member: decision.member?.handle ?? null,
          });
        }
      }

      joined.add(roomId);
      socket.join(roomId);

      const { isFirst, members, scene } = store.join(roomId, socket.id);

      // Everyone needs the roster.
      io.to(roomId).emit("room-user-change", members);

      if (isFirst) {
        // The joiner owns initialization; the client fetches or seeds the scene.
        socket.emit("first-in-room");
        // If we hold the last encrypted scene, hand it over: the client has the
        // room key from the URL fragment, so it can read what we cannot.
        if (scene) {
          socket.emit("client-broadcast", scene.data, scene.iv);
        }
        return;
      }

      // Tell the others to send their scene to the newcomer.
      socket.to(roomId).emit("new-user", socket.id);
    });

    const relay = (volatile, roomId, data, iv) => {
      if (!isPlausibleRoomId(roomId) || !joined.has(roomId)) {
        return;
      }
      // Normalize whatever arrived into bytes without interpreting it.
      const payload =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : data instanceof Uint8Array
          ? data
          : null;
      if (!payload || !isPlausiblePayload(payload)) {
        return;
      }
      const normalizedIv =
        iv instanceof Uint8Array ? iv : new Uint8Array(iv ?? []);

      if (!volatile) {
        // Persist the last non-volatile payload so a reconnecting client gets
        // the scene back. Volatile payloads (cursors) are never stored.
        store.rememberScene(roomId, payload, normalizedIv);
      }

      socket.to(roomId).emit("client-broadcast", payload, normalizedIv);
    };

    socket.on("server-broadcast", (roomId, data, iv) => {
      relay(false, roomId, data, iv);
    });

    socket.on("server-volatile-broadcast", (roomId, data, iv) => {
      relay(true, roomId, data, iv);
    });

    socket.on("user-follow", (roomId, followedBy) => {
      if (!isPlausibleRoomId(roomId) || !joined.has(roomId)) {
        return;
      }
      socket.to(roomId).emit("user-follow-room-change", followedBy);
    });

    const cleanup = () => {
      for (const roomId of joined) {
        const members = store.leave(roomId, socket.id);
        if (members) {
          io.to(roomId).emit("room-user-change", members);
        }
      }
      joined.clear();
    };

    socket.on("disconnect", cleanup);
  });

  /**
   * Ends the live sessions of members who are no longer in the registry.
   *
   * Revoking a member used to take effect on their **next** join, which is a
   * surprising answer when the person is on the canvas now. The registry file IS
   * the trigger: when it changes, every socket that joined as a member is checked,
   * and one whose member has gone is disconnected from its protected room with the
   * rest told the new roster.
   *
   * Revoking an INVITE deliberately does not disconnect anyone: an invite is a
   * door, not a leash, and this only ever looks at members.
   */
  const revokeVanishedMembers = () => {
    let registry;
    try {
      registry = loadRegistry(accessConfig.registryPath);
    } catch {
      return 0;
    }
    let revoked = 0;
    for (const socket of io.sockets.sockets.values()) {
      const handle = socket.data?.member;
      if (!handle || findMemberByHandle(registry, handle)) {
        continue;
      }
      for (const roomId of socket.rooms) {
        if (roomId === socket.id || !isRoomProtected(registry, roomId)) {
          continue;
        }
        socket.leave(roomId);
        // The ROSTER comes from the store, not from socket.io's room — leaving
        // the socket.io room alone would leave the name on the list.
        store.leave(roomId, socket.id);
        socket.emit("access-revoked", {
          roomId,
          reason: "membership was revoked",
        });
        io.to(roomId).emit("room-user-change", store.memberIds(roomId));
        logMembership(accessConfig.logPath, {
          event: "revoked",
          roomId,
          socketId: socket.id,
          member: handle,
        });
        revoked += 1;
      }
      delete socket.data.member;
    }
    return revoked;
  };

  // Watch the registry so a revocation is immediate. `unref` matters: without it
  // the watcher holds the event loop open and a test suite never exits.
  let watcher = null;
  if (accessConfig.enforcement && accessConfig.registryPath) {
    try {
      watcher = watch(accessConfig.registryPath, { persistent: false }, () => {
        // The write may still be in flight when the event fires.
        setTimeout(revokeVanishedMembers, 60);
      });
      watcher.unref?.();
    } catch {
      watcher = null; // no file yet, or not watchable: revocation degrades to next-join
    }
  }

  return {
    io,
    httpServer,
    store,
    revokeVanishedMembers,
    stopWatching: () => watcher?.close(),
  };
};

// Only listen when run directly, so tests can start it on an ephemeral port.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { httpServer } = createCollabServer();
  httpServer.listen(config.port, config.host, () => {
    console.log(
      `Collab server on ws://${config.host}:${config.port} (protocol-compatible; relays encrypted bytes only)`,
    );
  });

  const sweeper = setInterval(() => {
    const dropped = store.sweep();
    if (dropped > 0) {
      console.log(
        JSON.stringify({ event: "sweep", dropped, ...store.stats() }),
      );
    }
  }, 60_000);
  sweeper.unref?.();
}
