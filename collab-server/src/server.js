import { createServer } from "node:http";

import { Server } from "socket.io";

import { config } from "./config.js";
import { resolveRoomAlias } from "./rooms.js";
import {
  getLatestScene,
  getRoomPresence,
  markSocketOffline,
  markSocketOnline,
  saveLatestScene,
  setupRedis,
} from "./redis.js";
import {
  getLatestSceneFromMysql,
  saveLatestSceneSnapshot,
  saveHourlySnapshotsFromRedis,
} from "./snapshots.js";

const json = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": config.clientOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
};

const formatRoomDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.roomAlias.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

const getAllowedRoomDates = () => {
  const today = new Date();
  const allowedDates = new Set();

  for (let index = 0; index <= config.roomAlias.maxPastDays; index++) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    allowedDates.add(formatRoomDate(date));
  }

  return allowedDates;
};

const isAllowedRoomAlias = (alias) =>
  /^\d{4}-\d{2}-\d{2}$/.test(alias) && getAllowedRoomDates().has(alias);

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/rooms/resolve") {
    const alias = url.searchParams.get("alias");

    if (!alias || !/^\d{4}-\d{2}-\d{2}$/.test(alias)) {
      return json(res, 400, {
        error: "alias must be a date formatted as YYYY-MM-DD",
      });
    }

    if (!isAllowedRoomAlias(alias)) {
      return json(res, 404, { error: "room not found" });
    }

    try {
      return json(res, 200, await resolveRoomAlias(alias));
    } catch (error) {
      console.error("Failed to resolve room alias", error);
      return json(res, 500, { error: "failed to resolve room alias" });
    }
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: "not found" });
});

const io = new Server(server, {
  cors: {
    origin: config.clientOrigin,
    methods: ["GET", "POST"],
  },
});

const getRoomClients = async (roomId) => {
  const presence = await getRoomPresence(roomId);

  if (presence) {
    return presence;
  }

  return Array.from(io.sockets.adapter.rooms.get(roomId) || []);
};

const emitRoomUserChange = async (roomId) => {
  const clients = await getRoomClients(roomId);
  io.to(roomId).emit("room-user-change", clients);
};

const emitFollowRoomChange = async (roomId) => {
  const socketId = roomId.replace(/^follow@/, "");
  const followedBy = await getRoomClients(roomId);
  io.to(socketId).emit("user-follow-room-change", followedBy);
};

const latestSceneSaveTimers = new Map();
const latestScenePayloads = new Map();
const roomHydratingUntil = new Map();

const toPersistedScenePayload = ({ roomId, encryptedData, iv }) => ({
  roomId,
  encryptedData: Buffer.from(encryptedData).toString("base64"),
  iv: Buffer.from(iv).toString("base64"),
});

const queueLatestSceneSave = (roomId, encryptedData, iv) => {
  const hydratingUntil = roomHydratingUntil.get(roomId);

  if (hydratingUntil && Date.now() < hydratingUntil) {
    return;
  }

  if (hydratingUntil) {
    roomHydratingUntil.delete(roomId);
  }

  latestScenePayloads.set(roomId, {
    roomId,
    encryptedData,
    iv,
  });

  if (latestSceneSaveTimers.has(roomId)) {
    return;
  }

  const timer = setTimeout(async () => {
    latestSceneSaveTimers.delete(roomId);
    const payload = latestScenePayloads.get(roomId);

    if (!payload) {
      return;
    }

    try {
      await saveLatestScene(payload);
    } catch (error) {
      console.error("Failed to save latest scene to Redis", error);
    }

    try {
      await saveLatestSceneSnapshot(toPersistedScenePayload(payload));
    } catch (error) {
      console.error("Failed to save latest scene to MySQL", error);
    }
  }, config.scene.latestSaveThrottleMs);

  latestSceneSaveTimers.set(roomId, timer);
};

const emitScene = (socket, scene) => {
  socket.emit(
    "client-broadcast",
    Buffer.from(scene.encryptedData, "base64"),
    Buffer.from(scene.iv, "base64"),
  );
};

const getStoredScene = async (roomId) => {
  return (await getLatestScene(roomId)) || (await getLatestSceneFromMysql(roomId));
};

const replayLatestScene = async (socket, roomId) => {
  const latestScene = await getStoredScene(roomId);

  if (!latestScene) {
    return;
  }

  emitScene(socket, latestScene);
};

io.on("connection", (socket) => {
  socket.emit("init-room");

  socket.on("join-room", async (roomId) => {
    if (typeof roomId !== "string" || !roomId) {
      return;
    }

    const existingClients = Array.from(
      io.sockets.adapter.rooms.get(roomId) || [],
    ).filter((socketId) => socketId !== socket.id);
    let storedScene = null;

    if (existingClients.length === 0) {
      roomHydratingUntil.set(roomId, Date.now() + 5000);

      try {
        storedScene = await getStoredScene(roomId);
      } catch (error) {
        console.error("Failed to read stored scene during room join", error);
        roomHydratingUntil.delete(roomId);
      }
    }

    socket.join(roomId);
    await markSocketOnline({ roomId, socketId: socket.id });

    if (existingClients.length === 0) {
      if (!storedScene) {
        roomHydratingUntil.delete(roomId);
      }
      socket.emit("first-in-room");
    } else {
      socket.to(roomId).emit("new-user", socket.id);
    }

    setTimeout(() => {
      if (storedScene) {
        emitScene(socket, storedScene);
        return;
      }

      replayLatestScene(socket, roomId).catch((error) => {
        console.error("Failed to replay latest scene from storage", error);
      });
    }, 300);

    await emitRoomUserChange(roomId);
  });

  socket.on("server-broadcast", (roomId, encryptedData, iv) => {
    queueLatestSceneSave(roomId, encryptedData, iv);
    socket.to(roomId).emit("client-broadcast", encryptedData, iv);
  });

  socket.on("server-volatile-broadcast", (roomId, encryptedData, iv) => {
    socket.volatile.to(roomId).emit("client-broadcast", encryptedData, iv);
  });

  socket.on("user-follow", async (payload) => {
    const targetSocketId = payload?.userToFollow?.socketId;

    if (typeof targetSocketId !== "string" || !targetSocketId) {
      return;
    }

    const followRoomId = `follow@${targetSocketId}`;

    if (payload.action === "FOLLOW") {
      socket.join(followRoomId);
      await markSocketOnline({ roomId: followRoomId, socketId: socket.id });
    } else if (payload.action === "UNFOLLOW") {
      socket.leave(followRoomId);
      await markSocketOffline({ roomId: followRoomId, socketId: socket.id });
    }

    await emitFollowRoomChange(followRoomId);
  });

  socket.on("disconnecting", () => {
    const rooms = Array.from(socket.rooms).filter(
      (roomId) => roomId !== socket.id,
    );

    setTimeout(async () => {
      for (const roomId of rooms) {
        await markSocketOffline({ roomId, socketId: socket.id });

        if (roomId.startsWith("follow@")) {
          await emitFollowRoomChange(roomId);
        } else {
          await emitRoomUserChange(roomId);
        }
      }
    }, 0);
  });
});

await setupRedis(io);

setInterval(() => {
  saveHourlySnapshotsFromRedis().catch((error) => {
    console.error("Failed to save hourly scene snapshots", error);
  });
}, config.scene.historySnapshotIntervalMs);

server.listen(config.port, () => {
  console.log(
    `Excalidraw collab server listening on http://localhost:${config.port}`,
  );
});
