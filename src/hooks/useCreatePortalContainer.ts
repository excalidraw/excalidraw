import { useState, useLayoutEffect } from "react";
import { useDevice, useExcalidrawContainer } from "../components/App";
import { useUIAppState } from "../context/ui-appState";

export const useCreatePortalContainer = (opts?: {
  className?: string;
  parentSelector?: string;
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
      div.classList.toggle("theme--dark", theme === "dark");
    }
  }, [div, theme, device.editor.isMobile, opts?.className]);

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
