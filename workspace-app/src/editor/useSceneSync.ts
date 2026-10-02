import { CaptureUpdateAction, getSceneVersion } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { report } from "../api/telemetry";

import { AutosaveEngine } from "./AutosaveEngine";
import { createFileUploader } from "./fileUploader";
import {
  fetchSceneFiles,
  idbDraftStore,
  makeThumbnail,
  mergeSnapshots,
  persistedAppState,
  putSceneData,
  toSaveFailure,
} from "./sceneIO";

import type { SaveState, Snapshot } from "./AutosaveEngine";

const THUMB_EVERY_MS = 60_000;

export const sceneToken = (
  elements: readonly any[],
  appState: Partial<AppState>,
) =>
  `${getSceneVersion(elements as any)}|${appState.viewBackgroundColor}|${
    appState.gridSize
  }|${appState.gridModeEnabled}`;

export interface SceneSyncOptions {
  /** Stable id used for the local draft key. */
  draftId: string;
  version: number;
  initial: { snapshot: Snapshot; recovered: boolean };
  readOnly: boolean;
  /** API paths (without /api/v1) for saving. */
  dataPath: string;
  filePath: (fileId: string) => string;
  /** Absolute URL to fetch a file's bytes. */
  fileUrl: (fileId: string) => string;
  thumbnails?: boolean;
}

/** Connects an Excalidraw instance to the server with autosave + offline recovery. */
export const useSceneSync = (o: SceneSyncOptions) => {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const filesRef = useRef<BinaryFiles>({});
  const lastThumbAt = useRef(0);
  const uploader = useMemo(
    () => createFileUploader(o.filePath),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [o.draftId],
  );
  useEffect(() => () => uploader.dispose(), [uploader]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveDetail, setSaveDetail] = useState<string>();
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState<string | null>(
    o.initial.recovered ? "Recovered unsaved changes from this device." : null,
  );

  const engine = useMemo(
    () =>
      new AutosaveEngine({
        baseVersion: o.version,
        drafts: idbDraftStore(`ew:draft:${o.draftId}`),
        save: async (snapshot, baseVersion) => {
          // Images first, so the scene never references files the server lacks.
          try {
            await uploader.ensure(filesRef.current, snapshot.elements);
          } catch (e) {
            throw toSaveFailure(e);
          }
          let thumbnail: string | undefined;
          if (
            o.thumbnails &&
            Date.now() - lastThumbAt.current > THUMB_EVERY_MS
          ) {
            thumbnail = await makeThumbnail(
              snapshot.elements,
              snapshot.appState,
              filesRef.current,
            );
            lastThumbAt.current = Date.now();
          }
          return putSceneData(o.dataPath, snapshot, baseVersion, thumbnail);
        },
        merge: (local, remote) =>
          mergeSnapshots(
            local,
            remote,
            apiRef.current?.getAppState() ?? ({} as AppState),
          ),
        onMerged: (merged) => {
          apiRef.current?.updateScene({
            elements: merged.elements as any,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        },
        onState: (s, d) => {
          if (s === "error" || s === "offline") {
            report("save_failure", d ?? s, { state: s });
          }
          setSaveState(s);
          setSaveDetail(d);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [o.draftId, o.version, o.dataPath, uploader],
  );

  useEffect(() => {
    engine.revive();
    if (o.initial.recovered && !o.readOnly) {
      engine.adoptDraft(
        o.initial.snapshot,
        sceneToken(o.initial.snapshot.elements, o.initial.snapshot.appState),
      );
    }
    return () => {
      if (engine.atRisk) {
        void engine.flush();
      }
      engine.dispose();
    };
  }, [engine, o.initial, o.readOnly]);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      engine.retryNow();
      uploader.retry();
    };
    const off = () => setOnline(false);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (engine.atRisk) {
        e.preventDefault();
      }
    };
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!o.readOnly) {
          void engine.flush();
        }
      }
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", key, true);
    };
  }, [engine, o.readOnly, uploader]);

  const onChange = useCallback(
    (elements: readonly any[], appState: AppState, files: BinaryFiles) => {
      filesRef.current = files;
      if (!o.readOnly) {
        // images go up immediately, independent of (possibly paused) scene saves
        uploader.sync(files, elements);
        engine.update(
          { elements, appState: persistedAppState(appState) },
          sceneToken(elements, appState),
        );
      }
    },
    [engine, o.readOnly, uploader],
  );

  const onApi = useCallback((api: ExcalidrawImperativeAPI | null) => {
    apiRef.current = api;
    if (import.meta.env.DEV) {
      // dev-only debugging/testing hook (same idea as `window.h` in excalidraw-app)
      (window as any).__ewApi = api;
    }
  }, []);

  /** Editor state is ready: pull image bytes for elements already in the scene. */
  const onInitialize = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      void fetchSceneFiles(api, o.initial.snapshot.elements, o.fileUrl).then(
        () => {
          // files fetched from the server are already stored there
          uploader.markUploaded(Object.keys(api.getFiles()));
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [o.initial, o.draftId, uploader],
  );

  return {
    engine,
    apiRef,
    onChange,
    onApi,
    onInitialize,
    saveState,
    saveDetail,
    online,
    notice,
    setNotice,
  };
};
