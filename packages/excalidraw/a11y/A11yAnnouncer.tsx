import { useEffect, useRef } from "react";

import { useOnAppStateChange } from "../hooks/useAppStateValue";
import { t } from "../i18n";

import { announce, destroyLiveRegions, ensureLiveRegions } from "./announcer";

import type { TranslationKeys } from "../i18n";
import type { AppState } from "../types";

const getToolLabel = (tool: AppState["activeTool"]) => {
  const type = tool.type === "custom" ? tool.customType : tool.type;
  return t(`toolBar.${type}` as TranslationKeys, null, type);
};

/**
 * Renders nothing; owns the live regions and announces editor state
 * changes (active tool, selection count, zoom) to screen readers.
 */
export const A11yAnnouncer = () => {
  useEffect(() => {
    ensureLiveRegions();
    return () => destroyLiveRegions();
  }, []);

  // useOnAppStateChange fires on (re)subscription with the current value;
  // announce only on actual changes so mounting the editor stays silent
  const prevRef = useRef<{
    toolLabel: string | null;
    selectionCount: number | null;
    zoomPercent: number | null;
    collaborators: Map<string, string> | null;
  }>({
    toolLabel: null,
    selectionCount: null,
    zoomPercent: null,
    collaborators: null,
  });

  useOnAppStateChange("activeTool", (activeTool) => {
    const toolLabel = getToolLabel(activeTool);
    const prev = prevRef.current.toolLabel;
    prevRef.current.toolLabel = toolLabel;
    if (prev !== null && prev !== toolLabel) {
      announce(t("a11y.toolSelected", { tool: toolLabel }), {
        coalesceKey: "activeTool",
      });
    }
  });

  useOnAppStateChange("selectedElementIds", (selectedElementIds) => {
    const count = Object.keys(selectedElementIds).length;
    const prev = prevRef.current.selectionCount;
    prevRef.current.selectionCount = count;
    // while browsing the scene proxy layer the focused proxy's label
    // already conveys selection — announcing the count would double-speak
    const isBrowsingScene = !!document.activeElement?.closest(
      ".excalidraw-a11y-scene",
    );
    if (prev !== null && prev !== count && !isBrowsingScene) {
      announce(
        count > 0
          ? t("a11y.selectionCount", { count })
          : t("a11y.selectionCleared"),
        { coalesceKey: "selection" },
      );
    }
  });

  useOnAppStateChange("collaborators", (collaborators) => {
    const current = new Map<string, string>();
    for (const [socketId, collaborator] of collaborators) {
      current.set(socketId, collaborator.username || t("a11y.someone"));
    }
    const previous = prevRef.current.collaborators;
    prevRef.current.collaborators = current;
    if (!previous) {
      return;
    }
    for (const [socketId, username] of current) {
      if (!previous.has(socketId)) {
        announce(t("a11y.collaboratorJoined", { name: username }));
      }
    }
    for (const [socketId, username] of previous) {
      if (!current.has(socketId)) {
        announce(t("a11y.collaboratorLeft", { name: username }));
      }
    }
  });

  useOnAppStateChange("zoom", (zoom) => {
    const zoomPercent = Math.round(zoom.value * 100);
    const prev = prevRef.current.zoomPercent;
    prevRef.current.zoomPercent = zoomPercent;
    if (prev !== null && prev !== zoomPercent) {
      announce(t("a11y.zoom", { zoom: zoomPercent }), {
        coalesceKey: "zoom",
        coalesceDelay: 500,
      });
    }
  });

  return null;
};
