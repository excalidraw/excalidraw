import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { debounce } from "@excalidraw/common";
import { Excalidraw } from "@excalidraw/excalidraw";

import { loadScene, saveScene } from "./persistence";

const save = debounce(saveScene, 300);
window.addEventListener("pagehide", save.flush);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Excalidraw
      authoringUnits="screen"
      initialData={loadScene(localStorage)}
      onChange={(elements, appState, files) =>
        save(localStorage, elements, appState, files)
      }
    />
  </StrictMode>,
);
