import { parseSSEStream } from "@excalidraw/excalidraw";
import { RequestError } from "@excalidraw/excalidraw/errors";
import { createStore, get, set } from "idb-keyval";

import type { TTTDDialog } from "@excalidraw/excalidraw/components/TTDDialog/types";
import type { SavedChats } from "@excalidraw/excalidraw/components/TTDDialog/types";

import { report } from "../api/telemetry";

/**
 * Text-to-diagram transport for the editor's TTD dialog, talking to OUR backend.
 * (The stock helper can't send the CSRF header our API requires.)
 * The backend streams SSE chunks: {type:"content",delta} … {type:"done"} … [DONE].
 */
export const createTextSubmit =
  (workspaceId: string): TTTDDialog.onTextSubmit =>
  async ({ messages, onChunk, onStreamCreated, signal }) => {
    let res: Response;
    try {
      res = await fetch(
        `/api/v1/workspaces/${workspaceId}/ai/text-to-diagram/chat-streaming`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            accept: "text/event-stream",
            "x-requested-with": "excalidraw-workspace",
          },
          body: JSON.stringify({ messages }),
          signal,
        },
      );
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw e;
      }
      return {
        error: new RequestError({
          message: "Cannot reach the server.",
          status: 0,
        }),
      };
    }

    const rateLimit = Number(res.headers.get("x-ratelimit-limit")) || undefined;
    const rateLimitRemaining = res.headers.has("x-ratelimit-remaining")
      ? Number(res.headers.get("x-ratelimit-remaining"))
      : undefined;

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message =
        res.status === 429
          ? body?.message ?? "AI request limit reached for today."
          : body?.message ?? body?.error ?? `Generation failed (${res.status})`;
      // 429 is normal quota behaviour, not a failure worth reporting
      if (res.status !== 429) {
        report("ai_error", message, { status: res.status });
      }
      return {
        rateLimit,
        rateLimitRemaining,
        error: new RequestError({ message, status: res.status }),
      };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return {
        error: new RequestError({
          message: "The server sent an empty response.",
          status: 500,
        }),
      };
    }
    onStreamCreated?.();
    let text = "";
    let streamError: RequestError | null = null;
    for await (const data of parseSSEStream(reader)) {
      if (data === "[DONE]") {
        break;
      }
      let chunk: any;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.type === "content" && chunk.delta) {
        text += chunk.delta;
        onChunk?.(chunk.delta);
      } else if (chunk.type === "error") {
        streamError = new RequestError({
          message: chunk.error?.message ?? "Generation failed",
          status: chunk.error?.status ?? 500,
        });
      }
    }
    if (streamError) {
      return { rateLimit, rateLimitRemaining, error: streamError };
    }
    return {
      rateLimit,
      rateLimitRemaining,
      generatedResponse: text,
      error: null,
    };
  };

// ------------------------------------------------------------------ chat history (per browser)

const store = createStore("ew-ttd-chats-db", "ew-ttd-chats-store");
const KEY = "ttdChats";

export const TTDIndexedDBAdapter = {
  async loadChats(): Promise<SavedChats> {
    try {
      return (await get<SavedChats>(KEY, store)) ?? [];
    } catch {
      return [];
    }
  },
  async saveChats(chats: SavedChats): Promise<void> {
    try {
      await set(KEY, chats, store);
    } catch (e) {
      console.warn("Failed to save diagram chats:", e);
      throw e;
    }
  },
};
