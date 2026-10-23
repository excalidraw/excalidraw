import { ExcalidrawAPIProvider } from "@excalidraw/excalidraw";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { Provider, appJotaiStore } from "../app-jotai";
import { TopErrorBoundary } from "../components/TopErrorBoundary";

import "../index.scss";

import { NoteEditor } from "./NoteEditor";
import { NotesGallery } from "./NotesGallery";

// the original excalidraw.com app, still used for `#json=` / `#room=` links
const ExcalidrawApp = lazy(() => import("../App"));

const NOTE_PARAM = "note";

const getNoteIdFromURL = () =>
  new URLSearchParams(window.location.search).get(NOTE_PARAM);

const isLegacyAppURL = () =>
  !!window.location.hash ||
  window.location.pathname === "/excalidraw-plus-export";

export const navigateToNote = (noteId: string | null) => {
  const url = new URL(window.location.href);
  if (noteId) {
    url.searchParams.set(NOTE_PARAM, noteId);
  } else {
    url.searchParams.delete(NOTE_PARAM);
  }
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const NotesApp = () => {
  const [noteId, setNoteId] = useState(getNoteIdFromURL);

  useEffect(() => {
    const onPopState = () => setNoteId(getNoteIdFromURL());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openGallery = useCallback(() => navigateToNote(null), []);

  if (!noteId && isLegacyAppURL()) {
    return (
      <Suspense fallback={null}>
        <ExcalidrawApp />
      </Suspense>
    );
  }

  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        {noteId ? (
          <ExcalidrawAPIProvider key={noteId}>
            <NoteEditor noteId={noteId} onClose={openGallery} />
          </ExcalidrawAPIProvider>
        ) : (
          <NotesGallery onOpenNote={navigateToNote} />
        )}
      </Provider>
    </TopErrorBoundary>
  );
};
