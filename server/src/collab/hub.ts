import { randomUUID } from "node:crypto";

import { hasUnsafeKeys } from "../security/objectKeys";
import { buildSceneFields } from "../sceneData";

import type { ObjectId } from "mongodb";
import type { WebSocket } from "ws";
import type { Database } from "../db";

export type CollabAccess = "VIEW" | "EDIT";

export interface Conn {
  id: string;
  socket: WebSocket;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  color: string;
  access: CollabAccess;
  tokens: number;
  lastRefill: number;
}

type El = Record<string, any> & {
  id: string;
  version: number;
  versionNonce: number;
};

const COLORS = [
  "#e03131",
  "#c2255c",
  "#9c36b5",
  "#6741d9",
  "#3b5bdb",
  "#1971c2",
  "#0c8599",
  "#099268",
  "#2f9e44",
  "#e8590c",
];
const MAX_ROOM_ELEMENTS = 50_000;
export const MAX_ELEMENTS_PER_MESSAGE = 5000;
const UNSAFE_URL = /^\s*(javascript|vbscript|data):/i;

/**
 * Same tie-break Excalidraw uses when reconciling: the higher version wins;
 * on equal versions the lower versionNonce wins (deterministic across peers).
 */
export const shouldAccept = (incoming: El, existing: El | undefined) =>
  !existing ||
  incoming.version > existing.version ||
  (incoming.version === existing.version &&
    incoming.versionNonce < existing.versionNonce);

export const sanitizeIncoming = (raw: unknown): El | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const e = raw as Record<string, any>;
  if (
    hasUnsafeKeys(e) ||
    typeof e.id !== "string" ||
    e.id.length === 0 ||
    e.id.length > 128 ||
    typeof e.type !== "string" ||
    e.type.length > 32 ||
    !Number.isFinite(e.version) ||
    !Number.isFinite(e.versionNonce)
  ) {
    return null;
  }
  if (typeof e.link === "string" && UNSAFE_URL.test(e.link)) {
    return { ...(e as El), link: null };
  }
  return e as El;
};

export interface Presentation {
  connId: string;
  name: string;
  frameId: string;
  index: number;
}

export class TooManyConnectionsError extends Error {}
export const MAX_CONNS_PER_ROOM = 200;
export const MAX_CONNS_PER_USER = 10;

export class Room {
  presentation: Presentation | null = null;
  conns = new Map<string, Conn>();
  elements = new Map<string, El>();
  dirty = false;
  flushTimer: ReturnType<typeof setTimeout> | null = null;
  loading: Promise<void> | null = null;
  constructor(public sceneId: ObjectId) {}
}

export class CollabHub {
  rooms = new Map<string, Room>();
  private flushIntervalMs: number;

  constructor(
    private database: Database,
    private log: { error: (o: object, m: string) => void },
    opts: { flushIntervalMs?: number } = {},
  ) {
    this.flushIntervalMs = opts.flushIntervalMs ?? 30_000;
  }

  private send(conn: Conn, msg: object) {
    if (conn.socket.readyState === 1) {
      conn.socket.send(JSON.stringify(msg));
    }
  }

  private broadcast(room: Room, msg: object, except?: Conn) {
    const data = JSON.stringify(msg);
    for (const c of room.conns.values()) {
      if (c !== except && c.socket.readyState === 1) {
        c.socket.send(data);
      }
    }
  }

  private users(room: Room) {
    return [...room.conns.values()].map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.name,
      avatarUrl: c.avatarUrl,
      color: c.color,
      access: c.access,
    }));
  }

  async join(
    sceneId: ObjectId,
    socket: WebSocket,
    who: {
      userId: string | null;
      name: string;
      avatarUrl: string | null;
      access: CollabAccess;
    },
  ): Promise<Conn> {
    const key = sceneId.toHexString();
    let room = this.rooms.get(key);
    if (!room) {
      room = new Room(sceneId);
      this.rooms.set(key, room);
      room.loading = this.load(room);
    }
    // resource guard: one runaway client (or many tabs) must not exhaust a room
    if (
      room.conns.size >= MAX_CONNS_PER_ROOM ||
      (who.userId &&
        [...room.conns.values()].filter((c) => c.userId === who.userId)
          .length >= MAX_CONNS_PER_USER)
    ) {
      if (room.conns.size === 0) {
        this.rooms.delete(key);
      }
      throw new TooManyConnectionsError();
    }
    const conn: Conn = {
      id: randomUUID(),
      socket,
      ...who,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      tokens: 300,
      lastRefill: Date.now(),
    };
    room.conns.set(conn.id, conn);
    await room.loading;
    this.send(conn, {
      t: "init",
      you: conn.id,
      users: this.users(room),
      elements: [...room.elements.values()],
      presentation: room.presentation,
    });
    this.broadcast(
      room,
      { t: "join", user: this.users(room).find((u) => u.id === conn.id) },
      conn,
    );
    return conn;
  }

  private async load(room: Room) {
    const scene = await this.database.c.scenes.findOne(
      { _id: room.sceneId },
      { projection: { "data.elements": 1 } },
    );
    for (const el of (scene?.data.elements ?? []) as El[]) {
      room.elements.set(el.id, el);
    }
  }

  /** Token-bucket: ~100 msg/s sustained, burst 300. */
  private allow(conn: Conn) {
    const now = Date.now();
    conn.tokens = Math.min(
      300,
      conn.tokens + ((now - conn.lastRefill) / 1000) * 100,
    );
    conn.lastRefill = now;
    if (conn.tokens < 1) {
      return false;
    }
    conn.tokens -= 1;
    return true;
  }

  handle(sceneId: ObjectId, conn: Conn, raw: string) {
    const room = this.rooms.get(sceneId.toHexString());
    if (!room || !this.allow(conn)) {
      return;
    }
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg?.t === "cursor") {
      const num = (v: unknown) =>
        typeof v === "number" && Number.isFinite(v) ? v : 0;
      this.broadcast(
        room,
        {
          t: "cursor",
          from: conn.id,
          x: num(msg.x),
          y: num(msg.y),
          tool: msg.tool === "laser" ? "laser" : "pointer",
          button: msg.button === "down" ? "down" : "up",
          selected: Array.isArray(msg.selected)
            ? msg.selected
                .slice(0, 200)
                .filter((s: unknown) => typeof s === "string")
            : [],
        },
        conn,
      );
      return;
    }
    if (msg?.t === "present") {
      // Only editors can drive a presentation; everyone else can follow it.
      if (conn.access !== "EDIT") {
        this.send(conn, {
          t: "error",
          code: "forbidden",
          message: "view-only",
        });
        return;
      }
      if (msg.active === false) {
        if (room.presentation?.connId === conn.id) {
          room.presentation = null;
          this.broadcast(
            room,
            { t: "present", active: false, from: conn.id },
            conn,
          );
        }
        return;
      }
      if (
        typeof msg.frameId !== "string" ||
        msg.frameId.length > 128 ||
        !Number.isInteger(msg.index) ||
        msg.index < 0
      ) {
        return;
      }
      // one presenter at a time; a second editor cannot hijack a running session
      if (room.presentation && room.presentation.connId !== conn.id) {
        this.send(conn, {
          t: "error",
          code: "busy",
          message: `${room.presentation.name} is already presenting`,
        });
        return;
      }
      room.presentation = {
        connId: conn.id,
        name: conn.name,
        frameId: msg.frameId,
        index: msg.index,
      };
      this.broadcast(
        room,
        {
          t: "present",
          active: true,
          from: conn.id,
          name: conn.name,
          frameId: msg.frameId,
          index: msg.index,
        },
        conn,
      );
      return;
    }
    if (msg?.t === "elements") {
      if (conn.access !== "EDIT") {
        // Enforced server-side: view-only connections can never alter the scene.
        this.send(conn, {
          t: "error",
          code: "forbidden",
          message: "view-only",
        });
        return;
      }
      if (
        !Array.isArray(msg.elements) ||
        msg.elements.length > MAX_ELEMENTS_PER_MESSAGE
      ) {
        return;
      }
      const accepted: El[] = [];
      for (const raw of msg.elements) {
        const el = sanitizeIncoming(raw);
        if (!el) {
          continue;
        }
        const existing = room.elements.get(el.id);
        if (!existing && room.elements.size >= MAX_ROOM_ELEMENTS) {
          continue;
        }
        if (shouldAccept(el, existing)) {
          room.elements.set(el.id, el);
          accepted.push(el);
        }
      }
      if (accepted.length) {
        room.dirty = true;
        this.broadcast(
          room,
          { t: "elements", from: conn.id, elements: accepted },
          conn,
        );
        this.scheduleFlush(room);
      }
    }
  }

  private scheduleFlush(room: Room) {
    if (room.flushTimer) {
      return;
    }
    room.flushTimer = setTimeout(() => {
      room.flushTimer = null;
      void this.flush(room);
    }, this.flushIntervalMs);
  }

  /** Merges the room into MongoDB with the same version rule (idempotent, retried on races). */
  async flush(room: Room) {
    if (!room.dirty) {
      return;
    }
    room.dirty = false;
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const scene = await this.database.c.scenes.findOne({
          _id: room.sceneId,
          deletedAt: null,
        });
        if (!scene) {
          return;
        }
        const merged = new Map<string, El>(
          (scene.data.elements as El[]).map((e) => [e.id, e]),
        );
        let changed = false;
        for (const el of room.elements.values()) {
          if (shouldAccept(el, merged.get(el.id))) {
            merged.set(el.id, el);
            changed = true;
          }
        }
        if (!changed) {
          return;
        }
        const fields = buildSceneFields({
          elements: [...merged.values()] as any,
          appState: scene.data.appState,
        });
        const res = await this.database.c.scenes.updateOne(
          { _id: room.sceneId, version: scene.version, deletedAt: null },
          { $set: { ...fields, updatedAt: new Date() }, $inc: { version: 1 } },
        );
        if (res.matchedCount) {
          return;
        }
      }
      room.dirty = true; // lost 5 races in a row: try again next tick
    } catch (err) {
      room.dirty = true;
      this.log.error({ err: (err as Error).message }, "collab flush failed");
    }
  }

  async leave(sceneId: ObjectId, conn: Conn) {
    const key = sceneId.toHexString();
    const room = this.rooms.get(key);
    if (!room) {
      return;
    }
    room.conns.delete(conn.id);
    this.broadcast(room, { t: "leave", id: conn.id });
    if (room.presentation?.connId === conn.id) {
      room.presentation = null;
      this.broadcast(room, { t: "present", active: false, from: conn.id });
    }
    if (room.conns.size === 0) {
      if (room.flushTimer) {
        clearTimeout(room.flushTimer);
        room.flushTimer = null;
      }
      await this.flush(room);
      // only drop the room if nobody rejoined while flushing
      if (room.conns.size === 0) {
        this.rooms.delete(key);
      }
    }
  }

  /**
   * Applies element changes made outside a socket (public API / MCP) to a live room, so
   * connected editors see them immediately and the next room flush cannot undo them.
   */
  applyExternal(sceneId: ObjectId, elements: El[]) {
    const room = this.rooms.get(sceneId.toHexString());
    if (!room) {
      return;
    }
    const accepted: El[] = [];
    for (const raw of elements) {
      const el = sanitizeIncoming(raw);
      if (el && shouldAccept(el, room.elements.get(el.id))) {
        room.elements.set(el.id, el);
        accepted.push(el);
      }
    }
    if (accepted.length) {
      this.broadcast(room, { t: "elements", from: "api", elements: accepted });
    }
  }

  /** Pushes a server-originated event (e.g. comment changes) to everyone in a scene's room. */
  emit(sceneId: ObjectId, msg: object) {
    const room = this.rooms.get(sceneId.toHexString());
    if (room) {
      this.broadcast(room, msg);
    }
  }

  /** Immediately closes every connection to a scene (revoked/deleted). */
  kick(
    sceneId: ObjectId,
    code = 4403,
    reason = "access revoked",
    filter?: (c: Conn) => boolean,
  ) {
    const room = this.rooms.get(sceneId.toHexString());
    for (const c of room?.conns.values() ?? []) {
      if (!filter || filter(c)) {
        c.socket.close(code, reason);
      }
    }
  }

  async shutdown() {
    for (const room of this.rooms.values()) {
      if (room.flushTimer) {
        clearTimeout(room.flushTimer);
      }
      await this.flush(room);
      for (const c of room.conns.values()) {
        c.socket.close(1001, "server shutting down");
      }
    }
  }
}
