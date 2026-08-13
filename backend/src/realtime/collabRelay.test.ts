import { createServer } from "http";

import { io as ioClient } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { attachCollabRelay } from "./collabRelay.js";

import type { AddressInfo } from "net";
import type { Server } from "socket.io";
import type { Socket as ClientSocket } from "socket.io-client";

let httpServer: ReturnType<typeof createServer>;
let io: Server;
let port: number;
let clients: ClientSocket[];

beforeEach(async () => {
  httpServer = createServer();
  io = attachCollabRelay(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
  clients = [];
});

afterEach(async () => {
  clients.forEach((client) => client.close());
  await new Promise<void>((resolve) => io.close(() => resolve()));
});

const connect = () =>
  new Promise<ClientSocket>((resolve) => {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ["websocket"],
    });
    client.on("connect", () => resolve(client));
    clients.push(client);
  });

const joinFirst = async (client: ClientSocket, roomId: string) => {
  const first = new Promise<void>((resolve) =>
    client.once("first-in-room", resolve),
  );
  client.emit("join-room", roomId);
  await first;
};

describe("collab relay", () => {
  it("tells the first client that it is first", async () => {
    const client = await connect();
    await expect(joinFirst(client, "room-1")).resolves.toBeUndefined();
  });

  it("announces joiners and broadcasts the participant list", async () => {
    const clientA = await connect();
    const clientB = await connect();
    await joinFirst(clientA, "room-1");

    const newUser = new Promise<string>((resolve) =>
      clientA.once("new-user", resolve),
    );
    const participants = new Promise<string[]>((resolve) =>
      clientA.once("room-user-change", (ids: string[]) => {
        if (ids.length === 2) {
          resolve(ids);
        }
      }),
    );
    clientB.emit("join-room", "room-1");

    await expect(newUser).resolves.toBe(clientB.id);
    await expect(participants).resolves.toHaveLength(2);
  });

  it("only relays broadcasts when the sender belongs to the room", async () => {
    const clientA = await connect();
    const clientB = await connect();
    await joinFirst(clientA, "room-1");

    const joined = new Promise<void>((resolve) =>
      clientA.once("new-user", () => resolve()),
    );
    clientB.emit("join-room", "room-1");
    await joined;

    const received = new Promise<void>((resolve) =>
      clientB.once("client-broadcast", () => resolve()),
    );
    clientA.emit(
      "server-broadcast",
      "room-1",
      new ArrayBuffer(4),
      new Uint8Array([1]),
    );
    await received;

    let leaked = false;
    clientB.once("client-broadcast", () => {
      leaked = true;
    });
    const outsider = await connect();
    outsider.emit(
      "server-broadcast",
      "room-1",
      new ArrayBuffer(4),
      new Uint8Array([1]),
    );
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(leaked).toBe(false);
  });

  it("notifies a presenter when users follow and unfollow them", async () => {
    const presenter = await connect();
    const follower = await connect();
    await joinFirst(presenter, "room-1");

    const followed = new Promise<string[]>((resolve) =>
      presenter.once("user-follow-room-change", resolve),
    );
    follower.emit("user-follow", {
      userToFollow: { socketId: presenter.id, username: "Presenter" },
      action: "FOLLOW",
    });
    await expect(followed).resolves.toEqual([follower.id]);

    const unfollowed = new Promise<string[]>((resolve) =>
      presenter.once("user-follow-room-change", resolve),
    );
    follower.emit("user-follow", {
      userToFollow: { socketId: presenter.id, username: "Presenter" },
      action: "UNFOLLOW",
    });
    await expect(unfollowed).resolves.toEqual([]);
  });
});
