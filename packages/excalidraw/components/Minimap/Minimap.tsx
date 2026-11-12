import clsx from "clsx";
import { useEffect, useRef } from "react";

import { t } from "../../i18n";
import { useApp } from "../App";

import "./Minimap.scss";

/**
 * The vertical space (px) the minimap takes up above the footer (its height
 * + the gap, see Minimap.scss), for the UI above it to stay clear of it.
 */
export const MINIMAP_RESERVED_HEIGHT = 152;

/**
 * The minimap isn't available in editors shorter than this (px): it shares
 * the left edge with the styles panel, which would be left with no room.
 */
export const MINIMAP_MIN_EDITOR_HEIGHT = 500;

export const Minimap = ({ className }: { className?: string }) => {
  const app = useApp();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current!;
    let controller: { destroy: () => void } | null = null;
    let isUnmounted = false;

    // the minimap is off by default, so what drives it isn't part of the
    // initial bundle
    import("./minimap-controller.chunk")
      .then(({ MinimapController }) => {
        if (!isUnmounted) {
          controller = new MinimapController(app, container);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to load the minimap", error);
      });

    return () => {
      isUnmounted = true;
      controller?.destroy();
    };
  }, [app]);

  return (
    <div
      ref={containerRef}
      className={clsx("minimap", className)}
      role="img"
      aria-label={t("labels.minimap")}
    />
  );
};
