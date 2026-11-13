import clsx from "clsx";
import { useEffect, useRef } from "react";

import { t } from "../../i18n";
import { useApp } from "../App";

import "./Minimap.scss";

/**
 * The vertical space (px) the UI above the minimap gives up for it: its
 * height + the gap below it (see Minimap.scss), less a part of the clearance
 * that UI keeps from the footer anyway — the minimap can sit closer to it.
 */
export const MINIMAP_RESERVED_HEIGHT = 138;

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
