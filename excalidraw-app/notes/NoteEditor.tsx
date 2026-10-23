import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  exportScene,
  getDataURL,
  getNonDeletedElements,
  hashElementsVersion,
  useExcalidrawAPI,
  useHandleLibrary,
} from "@excalidraw/excalidraw";
import {
  cleanAppStateForExport,
  clearAppStateForLocalStorage,
} from "@excalidraw/excalidraw/appState";
import { gridIcon } from "@excalidraw/excalidraw/components/icons";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";

import { LanguageList } from "../app-language/LanguageList";
import { useAppLangCode } from "../app-language/language-state";
import { useHandleAppTheme } from "../useHandleAppTheme";

import {
  IndexedDBLibraryMigrationAdapter,
  SQLiteLibraryAdapter,
} from "./libraryAdapters";
import { notesApi } from "./notesApi";

import "./NoteEditor.scss";

const SAVE_DEBOUNCE_MS = 800;
const THUMBNAIL_MAX_SIZE = 480;

type SaveStatus = "saved" | "pending" | "saving" | "error";

type SceneSnapshot = {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  saved: "Salvo",
  pending: "Alterações não salvas",
  saving: "Salvando…",
  error: "Erro ao salvar",
};

const createThumbnail = async ({
  elements,
  appState,
  files,
}: SceneSnapshot) => {
  const visibleElements = getNonDeletedElements(elements);
  if (!visibleElements.length) {
    return null;
  }
  const blob = await exportScene({
    type: "png",
    data: {
      elements: visibleElements,
      appState: cleanAppStateForExport(appState),
      files,
    },
    config: { maxWidthOrHeight: THUMBNAIL_MAX_SIZE, padding: 16 },
  });
  return getDataURL(blob);
};

/**
 * Keeps a note in sync with the server: debounces scene changes, sends only
 * images the server doesn't have yet, and serializes saves so they never
 * overlap.
 */
const useNoteSaver = (noteId: string) => {
  const [status, setStatus] = useState<SaveStatus>("saved");

  const stateRef = useRef({
    // version of the last scene seen (saved or pending); `null` until the
    // first change after load, which only establishes the baseline
    sceneVersion: null as number | null,
    viewBackgroundColor: null as string | null,
    savedFileIds: new Set<string>(),
    pending: null as SceneSnapshot | null,
    timer: 0,
    queue: Promise.resolve(),
  });

  const save = useCallback(() => {
    const state = stateRef.current;
    window.clearTimeout(state.timer);

    state.queue = state.queue.then(async () => {
      const snapshot = state.pending;
      if (!snapshot) {
        return;
      }
      state.pending = null;
      setStatus("saving");

      const newFiles: BinaryFiles = {};
      for (const [id, file] of Object.entries(snapshot.files)) {
        if (!state.savedFileIds.has(id)) {
          newFiles[id] = file;
        }
      }

      try {
        await notesApi.update(noteId, {
          elements: snapshot.elements,
          appState: clearAppStateForLocalStorage(snapshot.appState),
          files: newFiles,
          thumbnail: await createThumbnail(snapshot).catch((error) => {
            console.error("Failed to create note thumbnail", error);
            return undefined;
          }),
        });
        Object.keys(newFiles).forEach((id) => state.savedFileIds.add(id));
        setStatus(state.pending ? "pending" : "saved");
      } catch (error) {
        console.error("Failed to save note", error);
        // retry with the next change (or flush) unless newer changes exist
        state.pending ??= snapshot;
        setStatus("error");
      }
    });

    return state.queue;
  }, [noteId]);

  const onLoaded = useCallback((files: BinaryFiles) => {
    stateRef.current.savedFileIds = new Set(Object.keys(files));
  }, []);

  const onChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const state = stateRef.current;
      const sceneVersion = hashElementsVersion(elements);
      const hasNewFiles = Object.keys(files).some(
        (id) => !state.savedFileIds.has(id),
      );

      if (state.sceneVersion === null) {
        state.sceneVersion = sceneVersion;
        state.viewBackgroundColor = appState.viewBackgroundColor;
        return;
      }

      if (
        sceneVersion === state.sceneVersion &&
        appState.viewBackgroundColor === state.viewBackgroundColor &&
        !hasNewFiles
      ) {
        return;
      }

      state.sceneVersion = sceneVersion;
      state.viewBackgroundColor = appState.viewBackgroundColor;
      state.pending = { elements, appState, files };
      setStatus("pending");
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
    },
    [save],
  );

  useEffect(() => {
    const state = stateRef.current;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (state.pending) {
        save();
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      // e.g. browser back button: flush whatever is pending
      save();
    };
  }, [save]);

  return { status, onChange, onLoaded, flush: save };
};

export const NoteEditor = ({
  noteId,
  onClose,
}: {
  noteId: string;
  onClose: () => void;
}) => {
  const excalidrawAPI = useExcalidrawAPI();
  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();
  const [langCode] = useAppLangCode();
  const [title, setTitle] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const saver = useNoteSaver(noteId);

  useHandleLibrary({
    excalidrawAPI,
    adapter: SQLiteLibraryAdapter,
    migrationAdapter: IndexedDBLibraryMigrationAdapter,
  });

  const { onLoaded } = saver;
  const initialData = useMemo(
    () =>
      notesApi
        .get(noteId)
        .then((note): ExcalidrawInitialDataState => {
          setTitle(note.title);
          onLoaded(note.files);
          return {
            elements: note.elements,
            appState: note.appState,
            files: note.files,
          };
        })
        .catch((error) => {
          setLoadError(error.message);
          return null;
        }),
    [noteId, onLoaded],
  );

  useEffect(() => {
    document.title = `${title || "Sem título"} — Excalidraw Notes`;
  }, [title]);

  const close = async () => {
    await saver.flush();
    onClose();
  };

  const saveTitle = (value: string) => {
    notesApi.update(noteId, { title: value }).catch((error) => {
      console.error("Failed to rename note", error);
    });
  };

  if (loadError) {
    return (
      <div className="note-editor__error">
        <p>Não foi possível abrir a nota: {loadError}</p>
        <button type="button" onClick={onClose}>
          Voltar para a galeria
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: "100%" }} className="excalidraw-app note-editor">
      <Excalidraw
        initialData={initialData}
        onChange={saver.onChange}
        name={title || "Sem título"}
        langCode={langCode}
        theme={editorTheme}
        onThemeChange={setAppTheme}
        UIOptions={{ canvasActions: { toggleTheme: true } }}
        autoFocus={true}
        handleKeyboardGlobally={true}
        renderTopRightUI={(isMobile) => (
          <div className="note-editor__top-right">
            {!isMobile && (
              <input
                className="note-editor__title"
                value={title}
                placeholder="Sem título"
                aria-label="Título da nota"
                onChange={(event) => setTitle(event.target.value)}
                onBlur={(event) => saveTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") {
                    event.currentTarget.blur();
                  }
                }}
              />
            )}
            <span
              className={clsx(
                "note-editor__status",
                `note-editor__status--${saver.status}`,
              )}
              title={SAVE_STATUS_LABELS[saver.status]}
            >
              {isMobile ? "" : SAVE_STATUS_LABELS[saver.status]}
            </span>
            <button
              type="button"
              className="note-editor__back"
              onClick={close}
              title="Voltar para a galeria"
            >
              {gridIcon}
              {!isMobile && <span>Galeria</span>}
            </button>
          </div>
        )}
      >
        <MainMenu>
          <MainMenu.Item icon={gridIcon} onSelect={close}>
            Voltar para a galeria
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.CommandPalette className="highlighted" />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.Preferences />
          <MainMenu.DefaultItems.ToggleTheme
            allowSystemTheme
            theme={appTheme}
          />
          <MainMenu.ItemCustom>
            <LanguageList style={{ width: "100%" }} />
          </MainMenu.ItemCustom>
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Hints.HelpHint />
        </WelcomeScreen>
      </Excalidraw>
    </div>
  );
};
