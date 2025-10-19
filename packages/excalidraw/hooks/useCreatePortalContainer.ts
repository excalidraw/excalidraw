import { useState, useLayoutEffect } from "react";

import { THEME } from "@excalidraw/common";

import { useDevice, useExcalidrawContainer } from "../components/App";
import { useUIAppState } from "../context/ui-appState";

export const useCreatePortalContainer = (opts?: {
  className?: string;
  parentSelector?: string;
  style?: { [x: string]: string }; //zsviczian - Obsidian Dynamic Style
}) => {
  const [div, setDiv] = useState<HTMLDivElement | null>(null);

  const device = useDevice();
  const { theme, stylesPanelMode } = useUIAppState(); //zsviczian

  const { container: excalidrawContainer } = useExcalidrawContainer();

  useLayoutEffect(() => {
    if (div) {
      div.className = "";
      div.classList.add("excalidraw", ...(opts?.className?.split(/\s+/) || []));
      div.classList.toggle("excalidraw--mobile", device.editor.isMobile);
      div.classList.toggle(
        "excalidraw--tray",
        !device.editor.isMobile && stylesPanelMode === "tray",
      ); //zsviczian
      div.classList.toggle("theme--dark", theme === THEME.DARK);
      if (opts?.style) {
        //zsviczian
        const style = opts.style;
        const styleString = Object.keys(style)
          .map((property) => `${property}: ${style[property]}`)
          .join("; ");
        div.setAttribute("style", styleString);
      }
    }
  }, [
    div,
    theme,
    device.editor.isMobile,
    opts?.className,
    opts?.style,
    stylesPanelMode,
  ]); //zsviczian added opts?.style and stylesPanelMode

  useLayoutEffect(() => {
    const container = opts?.parentSelector
      ? excalidrawContainer?.querySelector(opts.parentSelector)
      : document.body;

    if (!container) {
      return;
    }

    const div = document.createElement("div");

    container.appendChild(div);

    setDiv(div);

    return () => {
      container.removeChild(div);
    };
  }, [excalidrawContainer, opts?.parentSelector]);

  return div;
};
