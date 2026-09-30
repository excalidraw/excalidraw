import {
  CaptureUpdateAction,
  reconcileElements,
  restoreElements,
} from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AppState,
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";

import { report } from "../api/telemetry";

import { fetchSceneFiles } from "./sceneIO";

export type CollabStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export interface Presenter {
  from: string;
  name: string;
  frameId: string;
  index: number;
}

export interface PresenceUser {
  id: string;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  color: string;
  access: "VIEW" | "EDIT";
}

interface Options {
  sceneId: string;
  /** share-link token for guests; omit for cookie-authenticated users */
  token?: string;
  apiRef: React.MutableRefObject<ExcalidrawImperativeAPI | null>;
  fileUrl: (fileId: string) => string;
  enabled?: boolean;
  /** server-pushed comment events (created/updated/deleted) */
  onComment?: (msg: any) => void;
}

const wsUrl = (sceneId: string, token?: string) => {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const path = token ? `share/${encodeURIComponent(token)}` : sceneId;
  return `${proto}//${location.host}/api/v1/collab/${path}`;
};

/**
 * Live collaboration over the workspace WebSocket:
 *   - sends ONLY the elements whose version changed (never the whole scene)
 *   - merges remote deltas with Excalidraw's own reconciler
 *   - presence + remote cursors
 *   - reconnects with backoff; edits made offline are diffed and sent on reconnect
 */
export const useCollab = ({
  sceneId,
  token,
  apiRef,
  fileUrl,
  enabled = true,
  onComment,
}: Options) => {
  const onCommentRef = useRef(onComment);
  onCommentRef.current = onComment;
  const [status, setStatus] = useState<CollabStatus>("connecting");
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [access, setAccess] = useState<"VIEW" | "EDIT" | null>(null);
  const [closeReason, setCloseReason] = useState<string | null>(null);
  const [presenter, setPresenter] = useState<Presenter | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const meRef = useRef<string | null>(null);
  const accessRef = useRef<"VIEW" | "EDIT" | null>(null);
  const usersRef = useRef(new Map<string, PresenceUser>());
  const collabsRef = useRef(new Map<SocketId, Collaborator>());
  /** id -> version we last shared (or received) — the basis for delta detection */
  const sentRef = useRef(new Map<string, number>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCursor = useRef<any>(null);
  const lastElements = useRef<readonly any[]>([]);
  const flushRef = useRef<() => void>(() => {});

  if (import.meta.env.DEV) {
    (window as any).__collabDebug = () => ({
      access: accessRef.current,
      ws: wsRef.current?.readyState,
      last: lastElements.current.length,
      sent: [...sentRef.current.entries()],
    });
  }

  const publishUsers = () => setUsers([...usersRef.current.values()]);

  const applyCollaborators = useCallback(() => {
    apiRef.current?.updateScene({ collaborators: new Map(collabsRef.current) });
  }, [apiRef]);

  const applyRemote = useCallback(
    (remote: any[]) => {
      const api = apiRef.current;
      if (!api || remote.length === 0) {
        return;
      }
      const local = api.getSceneElementsIncludingDeleted();
      const merged = reconcileElements(
        local,
        restoreElements(remote as any, null) as any,
        api.getAppState() as AppState,
      );
      // mark as known so applying remote data never echoes back
      for (const e of merged) {
        sentRef.current.set(e.id, e.version);
      }
      api.updateScene({
        elements: merged,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      void fetchSceneFiles(api, merged, fileUrl);
    },
    [apiRef, fileUrl],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (stopped) {
        return;
      }
      setStatus(attempt === 0 ? "connecting" : "reconnecting");
      const ws = new WebSocket(wsUrl(sceneId, token));
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (wsRef.current !== ws) {
          return;
        }
        let m: any;
        try {
          m = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (m.t) {
          case "init": {
            attempt = 0;
            meRef.current = m.you;
            usersRef.current.clear();
            collabsRef.current.clear();
            for (const u of m.users as PresenceUser[]) {
              usersRef.current.set(u.id, u);
              if (u.id === m.you) {
                accessRef.current = u.access;
                setAccess(u.access);
              } else {
                collabsRef.current.set(u.id as SocketId, toCollaborator(u));
              }
            }
            publishUsers();
            setPresenter(
              m.presentation
                ? {
                    from: m.presentation.connId,
                    name: m.presentation.name,
                    frameId: m.presentation.frameId,
                    index: m.presentation.index,
                  }
                : null,
            );
            setStatus("connected");
            applyRemote(m.elements);
            applyCollaborators();
            // push whatever changed locally while we were away
            scheduleFlush(0);
            break;
          }
          case "join":
            usersRef.current.set(m.user.id, m.user);
            collabsRef.current.set(m.user.id, toCollaborator(m.user));
            publishUsers();
            applyCollaborators();
            break;
          case "leave":
            usersRef.current.delete(m.id);
            collabsRef.current.delete(m.id);
            publishUsers();
            applyCollaborators();
            break;
          case "elements":
            applyRemote(m.elements);
            break;
          case "cursor": {
            const c = collabsRef.current.get(m.from);
            if (c) {
              collabsRef.current.set(m.from, {
                ...c,
                pointer: { x: m.x, y: m.y, tool: m.tool },
                button: m.button,
                selectedElementIds: Object.fromEntries(
                  (m.selected as string[]).map((id) => [id, true]),
                ),
              });
              applyCollaborators();
            }
            break;
          }
          case "present":
            setPresenter(
              m.active
                ? {
                    from: m.from,
                    name: m.name,
                    frameId: m.frameId,
                    index: m.index,
                  }
                : null,
            );
            break;
          case "comment":
            onCommentRef.current?.(m);
            break;
          case "error":
            if (m.code === "forbidden") {
              setCloseReason("You only have view access to this scene.");
            }
            break;
        }
      };

      ws.onclose = (ev) => {
        // a superseded socket (StrictMode remount, fast reconnect) must not touch shared state
        if (wsRef.current !== ws) {
          return;
        }
        wsRef.current = null;
        if (!stopped && ev.code !== 1000 && ev.code !== 1001) {
          report("ws_failure", `collab socket closed (${ev.code})`, {
            code: ev.code,
          });
        }
        collabsRef.current.clear();
        usersRef.current.clear();
        publishUsers();
        applyCollaborators();
        if (stopped) {
          return;
        }
        // 44xx = server said we're not (or no longer) allowed: don't hammer it
        if (ev.code >= 4400 && ev.code < 4500) {
          setStatus("closed");
          setCloseReason(
            ev.code === 4401
              ? "Sign in to collaborate."
              : "Live collaboration ended: your access changed. Reload to continue.",
          );
          return;
        }
        attempt++;
        setStatus("reconnecting");
        const delay =
          Math.min(15_000, 500 * 2 ** Math.min(attempt, 5)) *
          (0.7 + Math.random() * 0.6);
        retry = setTimeout(open, delay);
      };
      ws.onerror = () => ws.close();
    };

    const scheduleFlush = (delay = 40) => {
      if (flushTimer.current) {
        return;
      }
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        flushDelta();
      }, delay);
    };

    const flushDelta = () => {
      const ws = wsRef.current;
      if (
        !ws ||
        ws.readyState !== WebSocket.OPEN ||
        accessRef.current !== "EDIT"
      ) {
        return;
      }
      const changed = lastElements.current.filter(
        (e) => sentRef.current.get(e.id) !== e.version,
      );
      if (changed.length === 0) {
        return;
      }
      for (let i = 0; i < changed.length; i += 2000) {
        ws.send(
          JSON.stringify({
            t: "elements",
            elements: changed.slice(i, i + 2000),
          }),
        );
      }
      // record only after handing to an open socket, so offline edits are re-sent later
      for (const e of changed) {
        sentRef.current.set(e.id, e.version);
      }
    };
    flushRef.current = () => scheduleFlush();

    open();
    return () => {
      stopped = true;
      if (retry) {
        clearTimeout(retry);
      }
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      setStatus("closed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, token, enabled]);

  /** Wire to Excalidraw's onChange. */
  const onElementsChange = useCallback((elements: readonly any[]) => {
    lastElements.current = elements;
    flushRef.current();
  }, []);

  /** Wire to Excalidraw's onPointerUpdate. */
  const onPointerUpdate = useCallback(
    (p: {
      pointer: { x: number; y: number; tool: "pointer" | "laser" };
      button: "down" | "up";
    }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      pendingCursor.current = {
        t: "cursor",
        x: p.pointer.x,
        y: p.pointer.y,
        tool: p.pointer.tool,
        button: p.button,
      };
      if (!cursorTimer.current) {
        cursorTimer.current = setTimeout(() => {
          cursorTimer.current = null;
          const sel = apiRef.current?.getAppState().selectedElementIds ?? {};
          wsRef.current?.readyState === WebSocket.OPEN &&
            wsRef.current.send(
              JSON.stringify({
                ...pendingCursor.current,
                selected: Object.keys(sel),
              }),
            );
        }, 40);
      }
    },
    [apiRef],
  );

  const sendPresent = useCallback((frameId: string, index: number) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "present", active: true, frameId, index }));
    }
  }, []);
  const stopPresent = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "present", active: false }));
    }
  }, []);

  const others = useMemo(
    () => users.filter((u) => u.id !== meRef.current),
    [users],
  );
  return {
    status,
    users,
    others,
    access,
    closeReason,
    presenter,
    me: meRef,
    sendPresent,
    stopPresent,
    onElementsChange,
    onPointerUpdate,
  };
};

const toCollaborator = (u: PresenceUser): Collaborator => ({
  username: u.name,
  avatarUrl: u.avatarUrl ?? undefined,
  color: { background: u.color, stroke: u.color },
  id: u.userId ?? u.id,
  socketId: u.id as SocketId,
});
