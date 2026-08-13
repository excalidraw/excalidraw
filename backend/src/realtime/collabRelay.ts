import { Server } from "socket.io";

import type { Server as HttpServer } from "http";

type UserFollowPayload = {
  userToFollow?: { socketId?: string };
  action?: "FOLLOW" | "UNFOLLOW";
};

export function attachCollabRelay(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    transports: ["websocket", "polling"],
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
    },
  });

  io.on("connection", (socket) => {
    socket.emit("init-room");

    socket.on("join-room", async (roomId: string) => {
      if (typeof roomId !== "string" || roomId.length === 0) {
        return;
      }

      await socket.join(roomId);
      const sockets = await io.in(roomId).fetchSockets();

      if (sockets.length === 1) {
        socket.emit("first-in-room");
      } else {
        socket.broadcast.to(roomId).emit("new-user", socket.id);
      }

      io.in(roomId).emit(
        "room-user-change",
        sockets.map(({ id }) => id),
      );
    });

    socket.on(
      "server-broadcast",
      (roomId: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
        if (socket.rooms.has(roomId)) {
          socket.broadcast
            .to(roomId)
            .emit("client-broadcast", encryptedData, iv);
        }
      },
    );

    socket.on(
      "server-volatile-broadcast",
      (roomId: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
        if (socket.rooms.has(roomId)) {
          socket.volatile.broadcast
            .to(roomId)
            .emit("client-broadcast", encryptedData, iv);
        }
      },
    );

    socket.on("user-follow", async (payload: UserFollowPayload) => {
      const targetSocketId = payload?.userToFollow?.socketId;
      if (
        typeof targetSocketId !== "string" ||
        (payload.action !== "FOLLOW" && payload.action !== "UNFOLLOW")
      ) {
        return;
      }

      const followRoomId = `follow@${targetSocketId}`;
      if (payload.action === "FOLLOW") {
        await socket.join(followRoomId);
      } else {
        await socket.leave(followRoomId);
      }

      const followers = await io.in(followRoomId).fetchSockets();
      io.to(targetSocketId).emit(
        "user-follow-room-change",
        followers.map(({ id }) => id),
      );
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) {
          continue;
        }
        const remainingIds = [
          ...(io.sockets.adapter.rooms.get(roomId) ?? []),
        ].filter((id) => id !== socket.id);
        if (roomId.startsWith("follow@")) {
          io.to(roomId.slice("follow@".length)).emit(
            "user-follow-room-change",
            remainingIds,
          );
        } else {
          socket.broadcast.to(roomId).emit("room-user-change", remainingIds);
        }
      }
    });
  });

  return io;
}
