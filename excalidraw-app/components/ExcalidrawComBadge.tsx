import { useEditorInterface } from "@excalidraw/excalidraw";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import {
  EXCALIDRAW_LOGO_ICON_PATH,
  EXCALIDRAW_LOGO_ICON_VIEWBOX,
  EXPORT_ATTRIBUTION_TEXT,
} from "@excalidraw/excalidraw/scene/exportAttribution";
import { useLayoutEffect, useState } from "react";

const CANVAS_BADGE_QUERY =
  "?utm_source=excalidraw&utm_medium=app&utm_content=canvasBadge";

/**
 * Opens the Excalidraw this app is running on: excalidraw.com in production,
 * and the same local or preview build while testing (so the new tab shows the
 * same app, badge included). Exported files always link to excalidraw.com.
 */
export const getExcalidrawComBadgeUrl = () => {
  const origin = window.location.origin.startsWith("http")
    ? window.location.origin
    : "https://excalidraw.com";
  return `${origin}/${CANVAS_BADGE_QUERY}`;
};

/** always-visible "excalidraw.com" link in the bottom-right of the whiteboard */
export const ExcalidrawComBadge = () => (
  <a
    className="excalidraw-com-badge"
    href={getExcalidrawComBadgeUrl()}
    target="_blank"
    rel="noopener noreferrer"
    title={`Open ${EXPORT_ATTRIBUTION_TEXT}`}
  >
    <svg
      viewBox={`0 0 ${EXCALIDRAW_LOGO_ICON_VIEWBOX} ${EXCALIDRAW_LOGO_ICON_VIEWBOX}`}
      aria-hidden="true"
    >
      <path d={EXCALIDRAW_LOGO_ICON_PATH} fill="currentColor" />
    </svg>
    <span>{EXPORT_ATTRIBUTION_TEXT}</span>
  </a>
);

type MobileBadgePlacement =
  | { mode: "row"; left: number; top: number; height: number }
  | { mode: "corner" }
  | { mode: "hidden" };

const isSamePlacement = (a: MobileBadgePlacement, b: MobileBadgePlacement) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Phones have no footer: the bottom holds the toolbar, with undo/redo on the
 * right of the row above it. The badge takes the free left side of that row,
 * steps aside while the row shows style buttons (a shape is selected or a
 * drawing tool is active), and sits in the bottom-left corner when there is
 * no toolbar (view mode).
 */
export const MobileExcalidrawComBadge = () => {
  const { formFactor } = useEditorInterface();
  const appState = useUIAppState();
  const isPhone = formFactor === "phone";
  const [placement, setPlacement] = useState<MobileBadgePlacement>({
    mode: "hidden",
  });

  useLayoutEffect(() => {
    if (!isPhone) {
      return;
    }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      // read the layout after the editor UI has committed this render
      frame = requestAnimationFrame(() => {
        const row = document.querySelector<HTMLElement>(
          ".excalidraw .mobile-shape-actions",
        );
        let next: MobileBadgePlacement;
        if (!row) {
          next = { mode: "corner" };
        } else if ((row.firstElementChild?.childElementCount ?? 0) > 0) {
          next = { mode: "hidden" };
        } else {
          const rect = row.getBoundingClientRect();
          next = {
            mode: "row",
            left: rect.left,
            top: rect.top,
            height: rect.height,
          };
        }
        setPlacement((prev) => (isSamePlacement(prev, next) ? prev : next));
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [
    isPhone,
    appState.selectedElementIds,
    appState.activeTool.type,
    appState.viewModeEnabled,
    appState.openMenu,
    appState.openSidebar,
  ]);

  if (!isPhone || placement.mode === "hidden") {
    return null;
  }

  return (
    <div
      className="excalidraw-com-badge-mobile"
      style={
        placement.mode === "row"
          ? {
              left: placement.left,
              top: placement.top,
              height: placement.height,
            }
          : {
              left: 16,
              bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
            }
      }
    >
      <ExcalidrawComBadge />
    </div>
  );
};
