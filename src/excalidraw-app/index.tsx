import React, { useEffect, useLayoutEffect, useState } from "react";
import { EVENT_LOAD, trackEvent } from "../analytics";
import { LoadingMessage } from "../components/LoadingMessage";
import { TopErrorBoundary } from "../components/TopErrorBoundary";
import { EVENT } from "../constants";
import {
  getTotalStorageSize,
  importFromLocalStorage,
  importUsernameFromLocalStorage,
  saveToLocalStorage,
  saveUsernameToLocalStorage,
} from "../data/localStorage";
import { ImportedDataState } from "../data/types";
import { ExcalidrawElement } from "../element/types";
import Excalidraw from "../packages/excalidraw/index";
import { SAVE_TO_LOCAL_STORAGE_TIMEOUT } from "../time_constants";
import { AppState } from "../types";
import { debounce } from "../utils";

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

  const [initialState, setInitialState] = useState<{
    data: ImportedDataState;
    user: {
      name: string | null;
    };
  } | null>(null);

  useEffect(() => {
    const storageSize = getTotalStorageSize();
    if (storageSize) {
      trackEvent(EVENT_LOAD, "storage", "size", storageSize);
    } else {
      trackEvent(EVENT_LOAD, "first time");
    }
    setInitialState({
      data: importFromLocalStorage(),
      user: {
        name: importUsernameFromLocalStorage(),
      },
    });
  }, []);

  useEffect(() => {
    window.addEventListener(EVENT.UNLOAD, onBlur, false);
    window.addEventListener(EVENT.BLUR, onBlur, false);
    return () => {
      window.removeEventListener(EVENT.UNLOAD, onBlur, false);
      window.removeEventListener(EVENT.BLUR, onBlur, false);
    };
  }, []);

  return initialState ? (
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
  ) : (
    <LoadingMessage />
  );
}
