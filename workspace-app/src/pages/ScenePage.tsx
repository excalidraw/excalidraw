import { Excalidraw, restoreElements, TTDDialog } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { AppState } from "@excalidraw/excalidraw/types";

import { ApiError, get, patch } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import {
  CommentPins,
  CommentsPanel,
  PlaceLayer,
  toViewport,
} from "../components/CommentsLayer";
import { Presence } from "../components/Presence";
import { ShareDialog } from "../components/ShareDialog";
import { ExportDialog } from "../components/ExportDialog";
import { PresentationBar, SlidesPanel } from "../components/Slides";
import { SaveIndicator } from "../editor/SaveIndicator";
import { useCollab } from "../editor/useCollab";
import {
  draftIsAhead,
  draftKey,
  idbDraftStore,
  mergeSnapshots,
} from "../editor/sceneIO";
import { groupThreads, useComments } from "../editor/useComments";
import { useSceneSync } from "../editor/useSceneSync";
import { createTextSubmit, TTDIndexedDBAdapter } from "../editor/aiClient";
import { useAiStatus } from "../editor/useAiStatus";
import { usePersonalLibrary } from "../editor/usePersonalLibrary";
import { usePresentation } from "../presentation/usePresentation";

import type { Viewport } from "../components/CommentsLayer";
import type { CommentView } from "../editor/useComments";
import type { Snapshot } from "../editor/AutosaveEngine";
import type { SceneFull } from "../api/types";

const useSystemTheme = () => {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark ? "dark" : "light";
};

const ScenePage = () => {
  const { sceneId } = useParams();
  const [scene, setScene] = useState<SceneFull | null>(null);
  const [initial, setInitial] = useState<{
    snapshot: Snapshot;
    recovered: boolean;
  } | null>(null);
  const [error, setError] = useState<{
    status: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    setScene(null);
    setInitial(null);
    setError(null);
    (async () => {
      try {
        const { scene: s } = (await get(`/scenes/${sceneId}`)) as {
          scene: SceneFull;
        };
        // Unsaved local work from a previous session (offline/crash) wins over the server copy.
        let snapshot: Snapshot = {
          elements: s.data.elements,
          appState: s.data.appState,
        };
        let recovered = false;
        const store = idbDraftStore(draftKey(s.id));
        const draft = await store.get();
        if (draft && s.access !== "VIEW") {
          if (draftIsAhead(draft.snapshot.elements, s.data.elements)) {
            recovered = true;
            snapshot =
              draft.baseVersion === s.version
                ? draft.snapshot
                : mergeSnapshots(draft.snapshot, snapshot, {} as AppState);
          } else {
            await store.clear().catch(() => {});
          }
        }
        if (alive) {
          setScene(s);
          setInitial({ snapshot, recovered });
        }
      } catch (e) {
        if (alive) {
          setError(
            e instanceof ApiError
              ? {
                  status: e.status,
                  message:
                    e.status === 404
                      ? "This scene doesn't exist or you don't have access."
                      : e.message,
                }
              : { status: 0, message: "Something went wrong." },
          );
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [sceneId]);

  if (error) {
    return (
      <div className="center-screen">
        <h2>
          {error.status === 404 ? "Scene not found" : "Could not open scene"}
        </h2>
        <p className="muted">{error.message}</p>
        <Link className="btn primary" to="/">
          Back to dashboard
        </Link>
      </div>
    );
  }
  if (!scene || !initial) {
    return <div className="center-screen muted">Opening scene…</div>;
  }
  return (
    <SceneEditor
      key={scene.id}
      scene={scene}
      setScene={setScene}
      initial={initial}
    />
  );
};

const SceneEditor = ({
  scene,
  setScene,
  initial,
}: {
  scene: SceneFull;
  setScene: (s: SceneFull) => void;
  initial: { snapshot: Snapshot; recovered: boolean };
}) => {
  const nav = useNavigate();
  const theme = useSystemTheme();
  const { user, features } = useAuth();
  const readOnly = scene.access === "VIEW";
  const [showShare, setShowShare] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [title, setTitle] = useState(scene.name);
  const hostRef = useRef<HTMLDivElement>(null);

  // ---- comments UI state
  const commentsEnabled = features?.comments !== false;
  const [panel, setPanel] = useState<"comments" | "slides" | null>(null);
  const [sceneElements, setSceneElements] = useState<readonly any[]>([]);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<{
    x: number;
    y: number;
    elementId: string | null;
  } | null>(null);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const comments = useComments(scene.id, commentsEnabled);
  const threads = useMemo(
    () => groupThreads(comments.comments),
    [comments.comments],
  );
  const openThreads = threads.filter((t) => !t.root.resolvedAt).length;

  const sync = useSceneSync({
    draftId: scene.id,
    version: scene.version,
    initial,
    readOnly,
    dataPath: `/scenes/${scene.id}/data`,
    filePath: (id) => `/scenes/${scene.id}/files/${id}`,
    fileUrl: (id) => `/api/v1/scenes/${scene.id}/files/${id}`,
    thumbnails: true,
  });
  const { engine } = sync;
  const collab = useCollab({
    sceneId: scene.id,
    apiRef: sync.apiRef,
    fileUrl: (id) => `/api/v1/scenes/${scene.id}/files/${id}`,
    onComment: comments.onEvent,
  });
  const live = collab.status === "connected" && collab.access === "EDIT";
  useEffect(() => {
    engine.setSuspended(live);
  }, [engine, live]);

  const library = usePersonalLibrary(true);
  // Text-to-diagram is offered only where the server says this member may use AI.
  const aiStatus = useAiStatus(
    scene.workspaceId,
    features?.ai !== false && !readOnly,
  );
  const textSubmit = useMemo(
    () => createTextSubmit(scene.workspaceId),
    [scene.workspaceId],
  );
  const presentation = usePresentation({
    apiRef: sync.apiRef,
    hostRef,
    canPresent: !readOnly && collab.access === "EDIT",
    presenter: collab.presenter,
    ownConnId: collab.me.current,
    sendPresent: collab.sendPresent,
    stopPresent: collab.stopPresent,
  });

  const onChange = (
    elements: readonly any[],
    appState: AppState,
    files: any,
  ) => {
    sync.onChange(elements, appState, files);
    if (panel === "slides" || presentation.active) {
      setSceneElements(elements);
    }
    collab.onElementsChange(elements);
    if (commentsEnabled) {
      const next = toViewport(appState);
      setViewport((prev) =>
        prev &&
        prev.scrollX === next.scrollX &&
        prev.scrollY === next.scrollY &&
        prev.zoom === next.zoom &&
        prev.offsetLeft === next.offsetLeft &&
        prev.offsetTop === next.offsetTop
          ? prev
          : next,
      );
    }
  };

  const focusComment = useCallback(
    (c: CommentView) => {
      const api = sync.apiRef.current;
      if (!api) {
        return;
      }
      const a = api.getAppState();
      api.updateScene({
        appState: {
          scrollX: a.width / 2 / a.zoom.value - c.x,
          scrollY: a.height / 2 / a.zoom.value - c.y,
        } as any,
      });
    },
    [sync.apiRef],
  );

  const initialData = useMemo(
    () => ({
      elements: restoreElements(initial.snapshot.elements as any, null),
      appState: { ...initial.snapshot.appState, theme } as any,
      scrollToContent: true,
    }),
    // initial data is read once by the editor
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial],
  );

  const rename = async () => {
    const name = title.trim();
    if (!name || name === scene.name) {
      setTitle(scene.name);
      return;
    }
    try {
      await patch(`/scenes/${scene.id}`, { name });
      setScene({ ...scene, name });
    } catch {
      setTitle(scene.name);
    }
  };

  return (
    <div className="scene-page">
      <header className="scene-bar">
        <button
          className="btn ghost"
          onClick={() => {
            void engine.flush().finally(() => nav("/"));
          }}
          aria-label="Back to dashboard"
        >
          ←
        </button>
        <input
          className="title-input"
          value={title}
          disabled={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()
          }
          aria-label="Scene name"
          maxLength={200}
        />
        {readOnly && <span className="pill">View only</span>}
        <div className="grow" />
        <Presence users={collab.users} status={collab.status} />
        {!readOnly && (
          <SaveIndicator
            state={sync.saveState}
            detail={sync.saveDetail}
            online={sync.online}
            onRetry={() => engine.retryNow()}
            live={live}
          />
        )}
        {features?.presentations !== false && (
          <>
            <button
              className="btn small"
              onClick={() => {
                setSceneElements(sync.apiRef.current?.getSceneElements() ?? []);
                setPanel(panel === "slides" ? null : "slides");
              }}
              aria-pressed={panel === "slides"}
            >
              Slides
            </button>
            <button
              className="btn small"
              onClick={() => presentation.start(0)}
              title="Present the frames full screen"
            >
              ▶ Present
            </button>
          </>
        )}
        {commentsEnabled && (
          <>
            <button
              className={`btn small ${placing ? "primary" : ""}`}
              onClick={() => {
                setPanel("comments");
                setPlacing((p) => !p);
                setDraft(null);
              }}
              title="Add a comment on the canvas"
            >
              💬 Comment
            </button>
            <button
              className="btn small"
              onClick={() => setPanel(panel ? null : "comments")}
              aria-pressed={panel === "comments"}
            >
              Comments{openThreads ? ` (${openThreads})` : ""}
            </button>
          </>
        )}
        <button
          className="btn small"
          onClick={() => setShowExport(true)}
          title="Export as PDF"
        >
          Export
        </button>
        {!readOnly && (
          <button
            className="btn small"
            onClick={() => void engine.flush()}
            title="Save now (Ctrl/Cmd+S)"
          >
            Save
          </button>
        )}
        {scene.access === "OWNER" && (
          <button
            className="btn primary small"
            onClick={() => setShowShare(true)}
          >
            Share
          </button>
        )}
      </header>
      {collab.closeReason && (
        <div className="notice" role="status">
          {collab.closeReason}
        </div>
      )}
      {sync.notice && (
        <div className="notice" role="status">
          {sync.notice}{" "}
          <button className="link-btn" onClick={() => sync.setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}
      {presentation.someoneElsePresenting && !presentation.active && (
        <div className="banner-live" role="status">
          <span>🎬 {collab.presenter?.name} is presenting</span>
          <button className="btn small primary" onClick={presentation.follow}>
            Follow
          </button>
        </div>
      )}
      {presentation.message && (
        <div className="notice" role="status">
          {presentation.message}{" "}
          <button
            className="link-btn"
            onClick={() => presentation.setMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      <div
        className={`editor-host ${presentation.active ? "presenting" : ""}`}
        ref={hostRef}
      >
        <Excalidraw
          onExcalidrawAPI={sync.onApi}
          onInitialize={(api) => {
            sync.onInitialize(api);
            void library.load(api);
          }}
          onLibraryChange={library.onLibraryChange}
          initialData={initialData}
          onChange={onChange}
          onPointerUpdate={collab.onPointerUpdate}
          isCollaborating={collab.others.length > 0}
          viewModeEnabled={readOnly || presentation.active}
          zenModeEnabled={presentation.active}
          theme={theme}
          name={scene.name}
          UIOptions={{
            canvasActions: { loadScene: false, saveToActiveFile: false },
          }}
          autoFocus
        >
          {aiStatus?.available && (
            <TTDDialog
              onTextSubmit={textSubmit}
              persistenceAdapter={TTDIndexedDBAdapter}
            />
          )}
        </Excalidraw>
        {commentsEnabled && viewport && !presentation.active && (
          <div className="overlay">
            <CommentPins
              threads={threads}
              viewport={viewport}
              host={hostRef.current}
              activeId={activeThread}
              onOpen={(id) => {
                setPanel("comments");
                setActiveThread(id);
              }}
            />
            {draft && (
              <div
                className="pin draft-pin"
                style={{
                  left:
                    (draft.x + viewport.scrollX) * viewport.zoom +
                    viewport.offsetLeft -
                    (hostRef.current?.getBoundingClientRect().left ?? 0),
                  top:
                    (draft.y + viewport.scrollY) * viewport.zoom +
                    viewport.offsetTop -
                    (hostRef.current?.getBoundingClientRect().top ?? 0),
                }}
              >
                +
              </div>
            )}
          </div>
        )}
        {placing && (
          <PlaceLayer
            api={sync.apiRef.current}
            onCancel={() => setPlacing(false)}
            onPlace={(x, y, elementId) => {
              setDraft({ x, y, elementId });
              setPlacing(false);
              setPanel("comments");
            }}
          />
        )}
        {presentation.active && (
          <PresentationBar
            index={presentation.index}
            count={presentation.count}
            title={presentation.title}
            following={presentation.following}
            presenterName={collab.presenter?.name}
            onPrev={presentation.prev}
            onNext={presentation.next}
            onExit={presentation.exit}
          />
        )}
        {panel === "slides" && !presentation.active && (
          <SlidesPanel
            api={sync.apiRef.current}
            elements={sceneElements}
            canEdit={!readOnly}
            onPresent={(i) => presentation.start(i)}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === "comments" && !presentation.active && user && (
          <CommentsPanel
            threads={threads}
            api={comments}
            me={user.id}
            canModerate={scene.access === "OWNER"}
            canResolve={scene.access !== "VIEW"}
            draft={draft}
            activeId={activeThread}
            setActiveId={setActiveThread}
            onFocus={focusComment}
            onClose={() => {
              setPanel(null);
              setDraft(null);
              setPlacing(false);
            }}
            onCancelDraft={() => setDraft(null)}
          />
        )}
      </div>
      {showExport && sync.apiRef.current && (
        <ExportDialog
          api={sync.apiRef.current}
          title={title}
          onClose={() => setShowExport(false)}
        />
      )}
      {showShare && (
        <ShareDialog
          scene={scene}
          onClose={() => setShowShare(false)}
          onVisibilityChange={(visibility) =>
            setScene({ ...scene, visibility })
          }
        />
      )}
    </div>
  );
};

export { useSystemTheme };
export default ScenePage;
