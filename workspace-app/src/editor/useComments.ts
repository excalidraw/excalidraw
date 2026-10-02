import { useCallback, useEffect, useState } from "react";

import { del, get, patch, post } from "../api/client";

export interface CommentView {
  id: string;
  sceneId: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
  elementId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
}

export interface Thread {
  root: CommentView;
  replies: CommentView[];
}

export const groupThreads = (comments: CommentView[]): Thread[] => {
  const roots = comments.filter((c) => !c.parentId);
  return roots.map((root) => ({
    root,
    replies: comments.filter((c) => c.parentId === root.id),
  }));
};

/** Loads comments and keeps them live via the collab socket. Returns a WS event handler. */
export const useComments = (sceneId: string, enabled: boolean) => {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let alive = true;
    get(`/scenes/${sceneId}/comments`)
      .then((r) => alive && setComments(r.comments))
      .catch((e) => alive && setError(e.status === 404 ? null : e.message));
    return () => {
      alive = false;
    };
  }, [sceneId, enabled]);

  const merge = useCallback((incoming: CommentView[]) => {
    setComments((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      for (const c of incoming) {
        map.set(c.id, c);
      }
      return [...map.values()].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
    });
  }, []);

  const onEvent = useCallback(
    (msg: { op: string; comments?: CommentView[]; ids?: string[] }) => {
      if (msg.op === "deleted" && msg.ids) {
        const gone = new Set(msg.ids);
        setComments((prev) => prev.filter((c) => !gone.has(c.id)));
      } else if (msg.comments) {
        merge(msg.comments);
      }
    },
    [merge],
  );

  const run = async <T>(fn: () => Promise<T>) => {
    setError(null);
    try {
      return await fn();
    } catch (e: any) {
      setError(e.message ?? "Request failed");
      throw e;
    }
  };

  return {
    comments,
    error,
    onEvent,
    createThread: (
      text: string,
      x: number,
      y: number,
      elementId: string | null,
    ) =>
      run(async () =>
        merge([
          (await post(`/scenes/${sceneId}/comments`, { text, x, y, elementId }))
            .comment,
        ]),
      ),
    reply: (parentId: string, text: string) =>
      run(async () =>
        merge([
          (await post(`/scenes/${sceneId}/comments`, { text, parentId }))
            .comment,
        ]),
      ),
    setResolved: (id: string, resolved: boolean) =>
      run(async () =>
        merge([(await patch(`/comments/${id}`, { resolved })).comment]),
      ),
    edit: (id: string, text: string) =>
      run(async () =>
        merge([(await patch(`/comments/${id}`, { text })).comment]),
      ),
    remove: (id: string) =>
      run(async () => {
        await del(`/comments/${id}`);
        onEvent({
          op: "deleted",
          ids: [
            id,
            ...comments.filter((c) => c.parentId === id).map((c) => c.id),
          ],
        });
      }),
  };
};
