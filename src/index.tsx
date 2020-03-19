import "./app.scss";
import "./styles.scss";

import React, { useState, useLayoutEffect } from "react";
import ReactDOM from "react-dom";
import { Excalidraw } from "./export";
import { saveToLocalStorage } from "./data/localStorage";
import { loadScene, getCollaborationLinkData } from "./data";
import { InternalState } from "./types";

const rootElement = document.getElementById("root") as HTMLElement;

function AppWithResizer(props: { initialState: InternalState | void }) {
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Resize detector
  useLayoutEffect(() => {
    const onResize = () =>
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return (
    <Excalidraw
      width={size.width}
      height={size.height}
      initialState={props.initialState || undefined}
      onChange={internalState => {
        saveToLocalStorage(internalState.elements, internalState.appState);
      }}
    />
  );
}

async function getInitialState(): Promise<InternalState | void> {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");

  // init via remote
  const roomMatch = getCollaborationLinkData(window.location.href);
  if (roomMatch) {
    return;
  }

  if (id) {
    // Backwards compatibility with legacy url format
    return await loadScene(id);
  }

  const jsonMatch = window.location.hash.match(
    /^#json=([0-9]+),([a-zA-Z0-9_-]+)$/,
  );
  if (jsonMatch) {
    return await loadScene(jsonMatch[1], jsonMatch[2]);
  }
  return await loadScene(null);
}

(async () => {
  const initialState = await getInitialState();
  ReactDOM.render(<AppWithResizer initialState={initialState} />, rootElement);
})();
