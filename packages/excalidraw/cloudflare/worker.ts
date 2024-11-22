export { DurableRoom } from "./room";

/**
 * Worker relay for Durable Room.
 */
export default {
  // TODO: ensure it's wss in the prod
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // TODO: only auth user should reach this
    const upgrade = request.headers.get("upgrade");
    if (!upgrade || upgrade !== "websocket") {
      return new Response(null, { status: 426 /* upgrade required */ });
    }

    if (request.method !== "GET") {
      return new Response(null, { status: 405 /* method not allowed */ });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/connect") {
      return new Response(null, { status: 403 /* forbidden */ });
    }

    // TODO: double check that the scene exists
    const roomId = url.searchParams.get("roomId");
    if (!roomId) {
      return new Response(null, { status: 400 /* bad request */ });
    }

    const id: DurableObjectId = env.DURABLE_ROOM.idFromName(roomId);
    const room = env.DURABLE_ROOM.get(id);

    return room.fetch(request);
  },
};
