import websocket from "@fastify/websocket";

import { resolveSceneAccess } from "../access";
import { parseId } from "../http";
import { hashToken } from "../security/tokens";

import { TooManyConnectionsError } from "../collab/hub";

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ObjectId } from "mongodb";
import type { WebSocket } from "ws";

import type { CollabAccess } from "../collab/hub";

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

type Who = {
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  access: CollabAccess;
};

/**
 * WS /api/v1/collab/:sceneId          (session cookie: members / shared users)
 * WS /api/v1/collab/share/:token      (unguessable share token; scene id never exposed)
 * The Origin header is checked to block cross-site WebSocket hijacking.
 */
export const collabRoutes = async (app: FastifyInstance) => {
  const { database, config } = app;
  await app.register(websocket, {
    options: { maxPayload: 4 * 1024 * 1024, perMessageDeflate: true },
  });
  const hub = app.collab;
  const rateLimit = {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  };

  const originOk = (req: FastifyRequest) => {
    const origin = req.headers.origin;
    return !origin || config.allowedOrigins.includes(origin);
  };

  /** Registers handlers immediately (no early frames lost), then joins the room. */
  const serve = async (socket: WebSocket, sceneId: ObjectId, who: Who) => {
    const queue: string[] = [];
    let conn: Awaited<ReturnType<typeof hub.join>> | null = null;
    socket.on("message", (data: Buffer) => {
      const s = data.toString();
      if (conn) {
        hub.handle(sceneId, conn, s);
      } else {
        queue.push(s);
      }
    });
    socket.on("close", () => {
      if (conn) {
        void hub.leave(sceneId, conn);
      }
    });
    socket.on("error", () => socket.close());
    try {
      conn = await hub.join(sceneId, socket, who);
    } catch (e) {
      if (e instanceof TooManyConnectionsError) {
        return socket.close(4429, "too many connections");
      }
      throw e;
    }
    for (const s of queue.splice(0)) {
      hub.handle(sceneId, conn, s);
    }
    if (socket.readyState !== 1) {
      void hub.leave(sceneId, conn);
    }
  };

  app.get(
    "/collab/:sceneId",
    { websocket: true, ...rateLimit },
    async (socket, req) => {
      if (!originOk(req)) {
        return socket.close(4403, "forbidden origin");
      }
      let sceneId: ObjectId;
      try {
        sceneId = parseId((req.params as any).sceneId, "scene");
      } catch {
        return socket.close(4404, "not found");
      }
      if (!req.auth) {
        return socket.close(4401, "unauthenticated");
      }
      const scene = await database.c.scenes.findOne(
        { _id: sceneId },
        { projection: { "data.elements": 0, thumbnail: 0 } },
      );
      const level =
        scene && !scene.deletedAt
          ? await resolveSceneAccess(req, scene, req.auth.user._id)
          : null;
      if (!level) {
        return socket.close(4404, "not found");
      }
      await serve(socket, sceneId, {
        userId: req.auth.user._id.toHexString(),
        name: req.auth.user.displayName,
        avatarUrl: req.auth.user.avatarUrl,
        access: level === "VIEW" ? "VIEW" : "EDIT",
      });
    },
  );

  app.get(
    "/collab/share/:token",
    { websocket: true, ...rateLimit },
    async (socket, req) => {
      if (!originOk(req)) {
        return socket.close(4403, "forbidden origin");
      }
      const token = (req.params as any).token;
      if (typeof token !== "string" || !TOKEN_SHAPE.test(token)) {
        return socket.close(4404, "not found");
      }
      const link = await database.c.shareLinks.findOne({
        tokenHash: hashToken(token, config.sessionSecret),
      });
      if (
        !link ||
        link.revokedAt ||
        (link.expiresAt && link.expiresAt.getTime() <= Date.now())
      ) {
        return socket.close(4404, "not found");
      }
      const scene = await database.c.scenes.findOne(
        { _id: link.sceneId },
        { projection: { deletedAt: 1 } },
      );
      if (!scene || scene.deletedAt) {
        return socket.close(4404, "not found");
      }
      await serve(socket, link.sceneId, {
        userId: null,
        name: "Guest",
        avatarUrl: null,
        access: link.level,
      });
    },
  );
};
