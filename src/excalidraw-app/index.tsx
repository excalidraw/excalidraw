import React, { useState, useLayoutEffect, useEffect } from "react";

import { LoadingMessage } from "../components/LoadingMessage";
import { TopErrorBoundary } from "../components/TopErrorBoundary";
import Excalidraw from "../excalidraw-embed/index";

import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
  saveToLocalStorage,
  saveUsernameToLocalStorage,
} from "../data/localStorage";

import { debounce } from "../utils";

import { SAVE_TO_LOCAL_STORAGE_TIMEOUT } from "../time_constants";
import { EVENT } from "../constants";

import { ImportedDataState } from "../data/types";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

const saveDebounced = debounce(
  (elements: readonly ExcalidrawElement[], state: AppState) => {
    saveToLocalStorage(elements, state);
  },
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
);

const onUsernameChange = (username: string) => {
  saveUsernameToLocalStorage(username);
};

const onBlur = () => {
  saveDebounced.flush();
};

export default function ExcalidrawApp() {
  // dimensions
  // ---------------------------------------------------------------------------

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useLayoutEffect(() => {
    const onResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  // initial state
  // ---------------------------------------------------------------------------

  const [initialState, setInitialState] = useState<{
    data: ImportedDataState;
    user: {
      name: string | null;
    };
  } | null>(null);

  useEffect(() => {
    setInitialState({
      data: importFromLocalStorage(),
      user: {
        name: importUsernameFromLocalStorage(),
      },
    });
  }, []);

  // blur/unload
  // ---------------------------------------------------------------------------

  useEffect(() => {
    window.addEventListener(EVENT.UNLOAD, onBlur, false);
    window.addEventListener(EVENT.BLUR, onBlur, false);
    return () => {
      window.removeEventListener(EVENT.UNLOAD, onBlur, false);
      window.removeEventListener(EVENT.BLUR, onBlur, false);
    };
  }, []);

  // ---------------------------------------------------------------------------

  if (!initialState) {
    return <LoadingMessage />;
  }

  return (
    <TopErrorBoundary>
      <Excalidraw
        width={dimensions.width}
        height={dimensions.height}
        onChange={saveDebounced}
        initialData={initialState.data}
        user={initialState.user}
        onUsernameChange={onUsernameChange}
      />
    </TopErrorBoundary>
  );
}
