import { Excalidraw, restoreElements } from "@excalidraw/excalidraw";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError, get } from "../api/client";
import { Presence } from "../components/Presence";
import { PresentationBar } from "../components/Slides";
import { SaveIndicator } from "../editor/SaveIndicator";
import { useCollab } from "../editor/useCollab";
import { usePresentation } from "../presentation/usePresentation";
import { useSceneSync } from "../editor/useSceneSync";

import { useSystemTheme } from "./ScenePage";

import type { Snapshot } from "../editor/AutosaveEngine";

interface SharedScene {
  name: string;
  version: number;
  data: Snapshot;
  level: "VIEW" | "EDIT";
}

/** Public, cookie-less view of a scene through an unguessable share token. */
const SharedScenePage = ({ embed }: { embed?: boolean }) => {
  const { token } = useParams();
  const [scene, setScene] = useState<SharedScene | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get(`/share/${token}`)
      .then((r) => alive && setScene({ ...r.scene, level: r.level }))
      .catch(
        (e) =>
          alive &&
          setError(
            e instanceof ApiError && e.status === 404
              ? "This link is invalid, expired, or has been revoked."
              : "Could not load this scene.",
          ),
      );
    return () => {
      alive = false;
    };
  }, [token]);

  if (error) {
    return (
      <div className="center-screen">
        <h2>Link unavailable</h2>
        <p className="muted">{error}</p>
        {!embed && (
          <Link className="btn" to="/">
            Go to workspace
          </Link>
        )}
      </div>
    );
  }
  if (!scene) {
    return <div className="center-screen muted">Loading…</div>;
  }
  return <SharedEditor token={token!} scene={scene} embed={!!embed} />;
};

const SharedEditor = ({
  token,
  scene,
  embed,
}: {
  token: string;
  scene: SharedScene;
  embed: boolean;
}) => {
  const theme = useSystemTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const readOnly = embed || scene.level === "VIEW";
  const initial = useMemo(
    () => ({ snapshot: scene.data, recovered: false }),
    [scene],
  );
  const sync = useSceneSync({
    draftId: `share:${token.slice(0, 12)}`,
    version: scene.version,
    initial,
    readOnly,
    dataPath: `/share/${token}/data`,
    filePath: (id) => `/share/${token}/files/${id}`,
    fileUrl: (id) => `/api/v1/share/${token}/files/${id}`,
  });
  const collab = useCollab({
    // the scene id is never exposed to link users; the server resolves the token
    sceneId: "",
    token,
    apiRef: sync.apiRef,
    fileUrl: (id) => `/api/v1/share/${token}/files/${id}`,
  });
  const live = collab.status === "connected" && collab.access === "EDIT";
  useEffect(() => {
    sync.engine.setSuspended(live);
  }, [sync.engine, live]);
  const presentation = usePresentation({
    apiRef: sync.apiRef,
    hostRef,
    canPresent: !readOnly && collab.access === "EDIT",
    presenter: collab.presenter,
    ownConnId: collab.me.current,
    sendPresent: collab.sendPresent,
    stopPresent: collab.stopPresent,
  });
  const onChange = (elements: readonly any[], appState: any, files: any) => {
    sync.onChange(elements, appState, files);
    collab.onElementsChange(elements);
  };
  const initialData = useMemo(
    () => ({
      elements: restoreElements(scene.data.elements as any, null),
      appState: { ...scene.data.appState, theme } as any,
      scrollToContent: true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene],
  );
  return (
    <div className="scene-page">
      {!embed && (
        <header className="scene-bar">
          <Link to="/" className="brand-mini">
            <span className="brand-mark" aria-hidden />
          </Link>
          <strong className="ellipsis">{scene.name}</strong>
          <span className="pill">{readOnly ? "View only" : "Can edit"}</span>
          <div className="grow" />
          <Presence users={collab.users} status={collab.status} />
          {presentation.someoneElsePresenting && !presentation.active && (
            <button className="btn small primary" onClick={presentation.follow}>
              Follow {collab.presenter?.name}
            </button>
          )}
          <button className="btn small" onClick={() => presentation.start(0)}>
            ▶ Present
          </button>
          {!readOnly && (
            <SaveIndicator
              state={sync.saveState}
              detail={sync.saveDetail}
              online={sync.online}
              onRetry={() => sync.engine.retryNow()}
              live={live}
            />
          )}
        </header>
      )}
      <div
        className={`editor-host ${presentation.active ? "presenting" : ""}`}
        ref={hostRef}
      >
        <Excalidraw
          onExcalidrawAPI={sync.onApi}
          onInitialize={sync.onInitialize}
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
        />
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
        {presentation.message && (
          <div
            className="notice"
            style={{ position: "absolute", top: 8, left: 8, zIndex: 30 }}
          >
            {presentation.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedScenePage;
