import { DurableObject } from "cloudflare:workers";
import { DurableDeltasRepository } from "./repository";
import { ExcalidrawSyncServer } from "../sync/server";

/**
 * Durable Object impl. of Excalidraw room.
 */
export class DurableRoom extends DurableObject {
  private roomId: string | null = null;
  private sync: ExcalidrawSyncServer;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      this.roomId = (await this.ctx.storage.get("roomId")) || null;
    });

    const repository = new DurableDeltasRepository(ctx.storage);
    this.sync = new ExcalidrawSyncServer(repository);

    // in case it hibernates, let's get take active connections
    for (const ws of this.ctx.getWebSockets()) {
      this.sync.onConnect(ws);
    }
  }

  public fetch = async (request: Request): Promise<Response> =>
    this.connect(request);

  public webSocketMessage = (client: WebSocket, message: ArrayBuffer) =>
    this.sync.onMessage(client, message);

  public webSocketClose = (ws: WebSocket) => this.sync.onDisconnect(ws);

  private connect(request: Request) {
    if (!this.roomId) {
      const roomId = new URL(request.url).searchParams.get("roomId");

      if (!roomId) {
        return new Response(null, { status: 400 /* bad request */ });
      }

      this.ctx.blockConcurrencyWhile(async () => {
        await this.ctx.storage.put("roomId", roomId);
        this.roomId = roomId;
      });
    }

    const { 0: client, 1: server } = new WebSocketPair();

    this.ctx.acceptWebSocket(client);
    this.sync.onConnect(client);

    return new Response(null, {
      status: 101 /* switching protocols */,
      webSocket: server,
    });
  }
}
