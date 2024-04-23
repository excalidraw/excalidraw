import { useState, useLayoutEffect } from "react";
import { useDevice, useExcalidrawContainer } from "../components/App";
import { THEME } from "../constants";
import { useUIAppState } from "../context/ui-appState";

export const useCreatePortalContainer = (opts?: {
  className?: string;
  parentSelector?: string;
  style?: { [x: string]: string }; //zsviczian - Obsidian Dynamic Style
}) => {
  const [div, setDiv] = useState<HTMLDivElement | null>(null);

  const device = useDevice();
  const { theme } = useUIAppState();

  const { container: excalidrawContainer } = useExcalidrawContainer();

  useLayoutEffect(() => {
    if (div) {
      div.className = "";
      div.classList.add("excalidraw", ...(opts?.className?.split(/\s+/) || []));
      div.classList.toggle("excalidraw--mobile", device.editor.isMobile);
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
  }, [div, theme, device.editor.isMobile, opts?.className, opts?.style]); //zsviczian added opts?.style

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
