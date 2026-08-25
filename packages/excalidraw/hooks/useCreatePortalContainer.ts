import { useState, useLayoutEffect } from "react";

import { THEME } from "@excalidraw/common";

import { useEditorInterface, useExcalidrawContainer } from "../components/App";
import { useUIAppState } from "../context/ui-appState";

export const useCreatePortalContainer = (opts?: {
  className?: string;
  parentSelector?: string;
}) => {
  const [div, setDiv] = useState<HTMLDivElement | null>(null);

  const editorInterface = useEditorInterface();
  const { theme } = useUIAppState();

  const { container: excalidrawContainer } = useExcalidrawContainer();

  useLayoutEffect(() => {
    if (div) {
      div.className = "";
      div.classList.add("excalidraw", ...(opts?.className?.split(/\s+/) || []));
      div.classList.toggle(
        "excalidraw--mobile",
        editorInterface.formFactor === "phone",
      );
      div.classList.toggle("theme--dark", theme === THEME.DARK);
    }
  }, [div, theme, editorInterface.formFactor, opts?.className]);

  useLayoutEffect(() => {
    let container: Element | ShadowRoot | null | undefined;

    if (opts?.parentSelector) {
      container = excalidrawContainer?.querySelector(opts.parentSelector);
    } else {
      // If Excalidraw is rendered inside a shadow root (e.g. a web component or
      // anywidget/marimo), portal into that shadow root so modals stay within
      // the same styling scope. In a regular document, fall back to document.body.
      const rootNode = excalidrawContainer?.getRootNode();
      container =
        rootNode instanceof ShadowRoot ? rootNode : document.body;
    }

    if (!container) {
      return;
    }

    const div = document.createElement("div");

    container.appendChild(div);

    setDiv(div);

    return () => {
      container!.removeChild(div);
    };
  }, [excalidrawContainer, opts?.parentSelector]);

  return div;
};
