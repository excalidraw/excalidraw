import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import { useState } from "react";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { timeAgo } from "./util";

import type { CommentView, Thread } from "../editor/useComments";
import type { useComments } from "../editor/useComments";

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
  offsetLeft: number;
  offsetTop: number;
}

export const toViewport = (a: AppState): Viewport => ({
  scrollX: a.scrollX,
  scrollY: a.scrollY,
  zoom: a.zoom.value,
  offsetLeft: a.offsetLeft,
  offsetTop: a.offsetTop,
});

type Api = ReturnType<typeof useComments>;

/** Pins are placed in scene coordinates and follow pan/zoom. */
export const CommentPins = ({
  threads,
  viewport,
  host,
  activeId,
  onOpen,
}: {
  threads: Thread[];
  viewport: Viewport;
  host: HTMLElement | null;
  activeId: string | null;
  onOpen: (id: string) => void;
}) => {
  const rect = host?.getBoundingClientRect();
  return (
    <>
      {threads.map((t) => {
        const left =
          (t.root.x + viewport.scrollX) * viewport.zoom +
          viewport.offsetLeft -
          (rect?.left ?? 0);
        const top =
          (t.root.y + viewport.scrollY) * viewport.zoom +
          viewport.offsetTop -
          (rect?.top ?? 0);
        if (
          rect &&
          (left < -20 ||
            top < -20 ||
            left > rect.width + 20 ||
            top > rect.height + 20)
        ) {
          return null;
        }
        return (
          <button
            key={t.root.id}
            className={`pin ${t.root.resolvedAt ? "resolved" : ""} ${
              activeId === t.root.id ? "active" : ""
            }`}
            style={{ left, top }}
            onClick={() => onOpen(t.root.id)}
            aria-label={`Comment by ${t.root.authorName}: ${t.root.text.slice(
              0,
              60,
            )}`}
            title={`${t.root.authorName}: ${t.root.text.slice(0, 80)}`}
          >
            {t.root.authorName.slice(0, 1).toUpperCase()}
            {t.replies.length > 0 && (
              <span className="pin-count">{t.replies.length + 1}</span>
            )}
          </button>
        );
      })}
    </>
  );
};

/** Transparent layer that turns a canvas click into a comment position. */
export const PlaceLayer = ({
  api,
  onPlace,
  onCancel,
}: {
  api: ExcalidrawImperativeAPI | null;
  onPlace: (x: number, y: number, elementId: string | null) => void;
  onCancel: () => void;
}) => (
  <div
    className="place-layer"
    role="button"
    tabIndex={0}
    aria-label="Click on the canvas to place a comment. Press Escape to cancel."
    onKeyDown={(e) => e.key === "Escape" && onCancel()}
    onClick={(e) => {
      if (!api) {
        return;
      }
      const a = api.getAppState();
      const { x, y } = viewportCoordsToSceneCoords(
        { clientX: e.clientX, clientY: e.clientY },
        {
          zoom: a.zoom,
          offsetLeft: a.offsetLeft,
          offsetTop: a.offsetTop,
          scrollX: a.scrollX,
          scrollY: a.scrollY,
        },
      );
      const selected = Object.keys(a.selectedElementIds).filter(
        (id) => a.selectedElementIds[id],
      );
      onPlace(x, y, selected.length === 1 ? selected[0]! : null);
    }}
  />
);

const Avatar = ({ c }: { c: CommentView }) => (
  <span className="avatar sm">
    {c.authorAvatarUrl ? (
      <img alt="" src={c.authorAvatarUrl} referrerPolicy="no-referrer" />
    ) : (
      c.authorName.slice(0, 1).toUpperCase()
    )}
  </span>
);

const Composer = ({
  placeholder,
  submit,
  autoFocus,
}: {
  placeholder: string;
  submit: (t: string) => Promise<unknown>;
  autoFocus?: boolean;
}) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!text.trim() || busy) {
      return;
    }
    setBusy(true);
    try {
      await submit(text.trim());
      setText("");
    } catch {
      /* error is shown by the panel */
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        void go();
      }}
    >
      <textarea
        autoFocus={autoFocus}
        value={text}
        maxLength={4000}
        rows={2}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) =>
          (e.metaKey || e.ctrlKey) && e.key === "Enter" && void go()
        }
      />
      <button className="btn primary small" disabled={busy || !text.trim()}>
        Send
      </button>
    </form>
  );
};

export const CommentsPanel = ({
  threads,
  api,
  me,
  canModerate,
  canResolve,
  draft,
  activeId,
  setActiveId,
  onFocus,
  onClose,
  onCancelDraft,
}: {
  threads: Thread[];
  api: Api;
  me: string;
  canModerate: boolean;
  canResolve: boolean;
  draft: { x: number; y: number; elementId: string | null } | null;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  onFocus: (c: CommentView) => void;
  onClose: () => void;
  onCancelDraft: () => void;
}) => {
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const shown = threads.filter((t) =>
    filter === "open" ? !t.root.resolvedAt : !!t.root.resolvedAt,
  );
  return (
    <aside className="comments-panel" aria-label="Comments">
      <div className="comments-head">
        <strong>Comments</strong>
        <div className="seg">
          <button
            className={filter === "open" ? "on" : ""}
            onClick={() => setFilter("open")}
          >
            Open
          </button>
          <button
            className={filter === "resolved" ? "on" : ""}
            onClick={() => setFilter("resolved")}
          >
            Resolved
          </button>
        </div>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close comments"
        >
          ✕
        </button>
      </div>
      {api.error && <div className="form-error">{api.error}</div>}
      <div className="comments-body">
        {draft && (
          <div className="thread draft">
            <div className="muted small">
              New comment{draft.elementId ? " on selected shape" : ""}
            </div>
            <Composer
              autoFocus
              placeholder="Write a comment…"
              submit={async (text) => {
                await api.createThread(text, draft.x, draft.y, draft.elementId);
                onCancelDraft();
              }}
            />
            <button className="link-btn" onClick={onCancelDraft}>
              Cancel
            </button>
          </div>
        )}
        {shown.length === 0 && !draft && (
          <p className="muted pad">
            {filter === "open"
              ? "No open comments. Use “Comment” and click the canvas."
              : "No resolved threads."}
          </p>
        )}
        {shown.map((t) => (
          <div
            key={t.root.id}
            className={`thread ${activeId === t.root.id ? "active" : ""}`}
            onClick={() => {
              setActiveId(t.root.id);
              onFocus(t.root);
            }}
          >
            {[t.root, ...t.replies].map((c) => (
              <div key={c.id} className="comment">
                <Avatar c={c} />
                <div className="comment-main">
                  <div className="comment-meta">
                    <span className="strong">{c.authorName}</span>{" "}
                    <span className="muted small">{timeAgo(c.createdAt)}</span>
                  </div>
                  <div className="comment-text">{c.text}</div>
                  {(c.userId === me || canModerate) && (
                    <button
                      className="link-btn small"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            c.parentId
                              ? "Delete this reply?"
                              : "Delete this thread and its replies?",
                          )
                        ) {
                          void api.remove(c.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {activeId === t.root.id && (
              <div onClick={(e) => e.stopPropagation()}>
                <Composer
                  placeholder="Reply…"
                  submit={(text) => api.reply(t.root.id, text)}
                />
                {(canResolve || t.root.userId === me) && (
                  <button
                    className="btn small"
                    onClick={() =>
                      void api.setResolved(t.root.id, !t.root.resolvedAt)
                    }
                  >
                    {t.root.resolvedAt ? "Reopen" : "Resolve"}
                  </button>
                )}
                {t.root.resolvedAt && (
                  <span className="muted small">
                    {" "}
                    Resolved by {t.root.resolvedByName ?? "someone"}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};
