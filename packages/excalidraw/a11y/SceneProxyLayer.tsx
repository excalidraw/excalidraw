import { memo, useEffect, useMemo, useRef, useState } from "react";

import { KEYS } from "@excalidraw/common";
import { makeNextSelectedElementIds } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  useApp,
  useExcalidrawContainer,
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "../components/App";
import { useAppStateValue } from "../hooks/useAppStateValue";
import { t } from "../i18n";

import { announce } from "./announcer";
import { getElementDescription } from "./description";
import { getSceneReadingOrder } from "./readingOrder";

import "./a11y.scss";

/** above this element count only proxies near the viewport / focus /
 * selection are rendered (plus reading-order neighbors so Tab works) */
const VIRTUALIZATION_THRESHOLD = 400;

const SceneProxyItem = memo(
  ({
    element,
    description,
    isCurrent,
    onProxyFocus,
    setRef,
  }: {
    element: NonDeletedExcalidrawElement;
    description: string;
    isCurrent: boolean;
    onProxyFocus: (element: NonDeletedExcalidrawElement) => void;
    setRef: (id: string, node: HTMLDivElement | null) => void;
  }) => {
    return (
      <div
        className="excalidraw-a11y-scene__element"
        data-a11y-element-id={element.id}
        role="graphics-object"
        tabIndex={isCurrent ? 0 : -1}
        aria-label={description}
        onFocus={() => onProxyFocus(element)}
        ref={(node) => setRef(element.id, node)}
        style={{
          left: element.x,
          top: element.y,
          width: Math.max(element.width, 1),
          height: Math.max(element.height, 1),
          transform: element.angle ? `rotate(${element.angle}rad)` : undefined,
        }}
      />
    );
  },
);

/**
 * Invisible, spatially-positioned DOM mirror of the scene for screen
 * readers (see ACCESSIBILITY_PLAN.md §5). One focusable proxy per element
 * in reading order; the current proxy is the single tab stop (roving
 * tabindex). Inside the layer:
 * - Tab / Shift+Tab move linearly through the reading order
 *   (leaving past either end exits the layer, so no keyboard trap),
 * - Ctrl+Alt+Arrow moves spatially to the nearest element in a direction;
 *   with Shift held the selection is left untouched (multi-select travel),
 * - Space toggles the focused element in/out of the selection,
 * - Escape returns focus to the editor container,
 * - all other keys (arrows to move, Enter to edit, Delete…) keep their
 *   existing editor behavior since focus stays inside the container.
 *
 * Focusing a proxy selects the element and pans the viewport to it
 * (WCAG 2.4.11); the `:focus-visible` outline provides 2.4.7.
 *
 * For very large scenes only proxies intersecting the viewport (plus the
 * focused/selected ones and the focused element's reading-order
 * neighbors) are rendered; focusing an element pans the viewport, which
 * re-renders the window around the new position.
 */
export const SceneProxyLayer = () => {
  const app = useApp();
  const elements = useExcalidrawElements();
  const { container: excalidrawContainer } = useExcalidrawContainer();
  const setAppState = useExcalidrawSetAppState();
  const appState = useAppStateValue([
    "scrollX",
    "scrollY",
    "zoom",
    "selectedElementIds",
    "width",
    "height",
  ]);

  const ordered = useMemo(() => getSceneReadingOrder(elements), [elements]);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>());
  // focus queued for a proxy that isn't rendered yet (virtualized scenes)
  const pendingFocusId = useRef<string | null>(null);
  // skip the focus→selection sync for the next proxy focus event
  // (Ctrl+Alt+Shift+Arrow travel that must not disturb the selection)
  const suppressSelectionSync = useRef(false);

  // fall back to the first element when the remembered one is gone
  const effectiveCurrentId = ordered.some((el) => el.id === currentId)
    ? currentId
    : ordered[0]?.id ?? null;

  const rendered = useMemo(() => {
    if (ordered.length <= VIRTUALIZATION_THRESHOLD) {
      return ordered;
    }
    const viewportLeft = -appState.scrollX;
    const viewportTop = -appState.scrollY;
    const viewportWidth = appState.width / appState.zoom.value;
    const viewportHeight = appState.height / appState.zoom.value;
    const intersectsViewport = (element: NonDeletedExcalidrawElement) =>
      element.x + element.width >= viewportLeft &&
      element.x <= viewportLeft + viewportWidth &&
      element.y + element.height >= viewportTop &&
      element.y <= viewportTop + viewportHeight;

    const currentIndex = ordered.findIndex(
      (el) => el.id === effectiveCurrentId,
    );
    return ordered.filter(
      (element, index) =>
        element.id === effectiveCurrentId ||
        (currentIndex !== -1 && Math.abs(index - currentIndex) === 1) ||
        appState.selectedElementIds[element.id] ||
        intersectsViewport(element),
    );
  }, [
    ordered,
    effectiveCurrentId,
    appState.scrollX,
    appState.scrollY,
    appState.zoom.value,
    appState.width,
    appState.height,
    appState.selectedElementIds,
  ]);

  const descriptions = useMemo(() => {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const total = ordered.length;
    const positions = new Map<string, number>();
    ordered.forEach((element, index) => positions.set(element.id, index + 1));
    const result = new Map<string, string>();
    rendered.forEach((element) => {
      result.set(
        element.id,
        getElementDescription(element, elementsMap, {
          position: positions.get(element.id),
          total,
          selected: !!appState.selectedElementIds[element.id],
        }),
      );
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.scene, ordered, rendered, appState.selectedElementIds]);

  const setItemRef = (id: string, node: HTMLDivElement | null) => {
    if (node) {
      itemRefs.current.set(id, node);
    } else {
      itemRefs.current.delete(id);
    }
  };

  const focusProxy = (id: string, options?: { keepSelection?: boolean }) => {
    if (options?.keepSelection) {
      suppressSelectionSync.current = true;
    }
    setCurrentId(id);
    const node = itemRefs.current.get(id);
    if (node) {
      node.focus();
    } else {
      // not rendered yet (virtualized) — focus after the re-render that
      // `setCurrentId` triggers, which always includes the current proxy
      pendingFocusId.current = id;
    }
  };

  useEffect(() => {
    if (pendingFocusId.current) {
      const node = itemRefs.current.get(pendingFocusId.current);
      if (node) {
        pendingFocusId.current = null;
        node.focus();
      }
    }
  });

  const panToElementIfNeeded = (element: NonDeletedExcalidrawElement) => {
    const { scrollX, scrollY, zoom, width, height } = app.state;
    const viewportWidth = width / zoom.value;
    const viewportHeight = height / zoom.value;
    const viewLeft = -scrollX;
    const viewTop = -scrollY;

    const isVisible =
      element.x >= viewLeft &&
      element.y >= viewTop &&
      element.x + element.width <= viewLeft + viewportWidth &&
      element.y + element.height <= viewTop + viewportHeight;

    if (!isVisible) {
      setAppState({
        scrollX: viewportWidth / 2 - (element.x + element.width / 2),
        scrollY: viewportHeight / 2 - (element.y + element.height / 2),
      });
    }
  };

  const onProxyFocus = (element: NonDeletedExcalidrawElement) => {
    setCurrentId(element.id);
    panToElementIfNeeded(element);
    const keepSelection = suppressSelectionSync.current;
    suppressSelectionSync.current = false;
    // sync selection (skip locked elements — they aren't selectable)
    if (
      !keepSelection &&
      !element.locked &&
      !app.state.selectedElementIds[element.id]
    ) {
      setAppState((prevState) => ({
        selectedElementIds: makeNextSelectedElementIds(
          { [element.id]: true },
          prevState,
        ),
        selectedGroupIds: {},
      }));
    }
  };

  // reverse sync: when selection changes while browsing the layer (e.g.
  // flowchart Alt+Arrow navigation), follow it with focus
  useEffect(() => {
    const selectedIds = Object.keys(appState.selectedElementIds);
    if (selectedIds.length !== 1) {
      return;
    }
    const active = document.activeElement;
    if (
      !layerRef.current?.contains(active) ||
      active?.getAttribute("data-a11y-element-id") === selectedIds[0]
    ) {
      return;
    }
    const proxy = itemRefs.current.get(selectedIds[0]);
    if (proxy) {
      setCurrentId(selectedIds[0]);
      proxy.focus();
    }
  }, [appState.selectedElementIds]);

  const moveSpatially = (
    from: NonDeletedExcalidrawElement,
    direction: [number, number],
    options?: { keepSelection?: boolean },
  ) => {
    const fromX = from.x + from.width / 2;
    const fromY = from.y + from.height / 2;
    let best: { id: string; score: number } | null = null;
    for (const candidate of ordered) {
      if (candidate.id === from.id) {
        continue;
      }
      const dx = candidate.x + candidate.width / 2 - fromX;
      const dy = candidate.y + candidate.height / 2 - fromY;
      const distance = Math.hypot(dx, dy);
      if (!distance) {
        continue;
      }
      // Miro-style scoring: closest wins, weighted by how well the
      // candidate aligns with the requested direction
      const alignment = (dx * direction[0] + dy * direction[1]) / distance;
      if (alignment <= 0.1) {
        continue;
      }
      const score = distance / alignment;
      if (!best || score < best.score) {
        best = { id: candidate.id, score };
      }
    }
    if (best) {
      focusProxy(best.id, options);
    }
  };

  const toggleElementSelection = (element: NonDeletedExcalidrawElement) => {
    if (element.locked) {
      return;
    }
    const isSelected = !!app.state.selectedElementIds[element.id];
    setAppState((prevState) => {
      const nextSelectedIds = { ...prevState.selectedElementIds };
      if (isSelected) {
        delete nextSelectedIds[element.id];
      } else {
        nextSelectedIds[element.id] = true;
      }
      return {
        selectedElementIds: makeNextSelectedElementIds(
          nextSelectedIds,
          prevState,
        ),
      };
    });
    const count =
      Object.keys(app.state.selectedElementIds).length + (isSelected ? -1 : 1);
    announce(
      isSelected
        ? t("a11y.removedFromSelection", { count })
        : t("a11y.addedToSelection", { count }),
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // while editing points or cropping, the editor owns Tab/arrows/Space
    if (
      app.state.selectedLinearElement?.isEditing ||
      app.state.croppingElementId
    ) {
      return;
    }
    const targetId = (event.target as HTMLElement).getAttribute(
      "data-a11y-element-id",
    );
    if (!targetId) {
      return;
    }
    const index = ordered.findIndex((el) => el.id === targetId);
    if (index === -1) {
      return;
    }

    if (event.key === KEYS.TAB) {
      const nextIndex = event.shiftKey ? index - 1 : index + 1;
      if (nextIndex >= 0 && nextIndex < ordered.length) {
        event.preventDefault();
        event.stopPropagation();
        focusProxy(ordered[nextIndex].id);
      }
      // at either end: let the browser move focus out of the layer
      // (no keyboard trap, WCAG 2.1.2)
      return;
    }

    // keyboard multi-select (WCAG 2.1.1 — Shift+click equivalent)
    if (event.key === KEYS.SPACE) {
      event.preventDefault();
      event.stopPropagation();
      toggleElementSelection(ordered[index]);
      return;
    }

    if (event.ctrlKey && event.altKey) {
      const direction: [number, number] | null =
        event.key === KEYS.ARROW_LEFT
          ? [-1, 0]
          : event.key === KEYS.ARROW_RIGHT
          ? [1, 0]
          : event.key === KEYS.ARROW_UP
          ? [0, -1]
          : event.key === KEYS.ARROW_DOWN
          ? [0, 1]
          : null;
      if (direction) {
        event.preventDefault();
        event.stopPropagation();
        moveSpatially(ordered[index], direction, {
          // Shift: travel without touching the selection, so a
          // multi-selection built with Space survives the trip
          keepSelection: event.shiftKey,
        });
        return;
      }
    }

    if (event.key === KEYS.ESCAPE) {
      // let it bubble so the editor also deselects, then leave the layer
      excalidrawContainer?.focus();
    }
  };

  if (!ordered.length) {
    return null;
  }

  const zoomValue = appState.zoom.value;

  return (
    <div
      className="excalidraw-a11y-scene"
      ref={layerRef}
      role="group"
      aria-roledescription={t("a11y.whiteboard")}
      aria-label={t("a11y.sceneLabel", { count: ordered.length })}
      onKeyDown={handleKeyDown}
      style={{
        transform: `scale(${zoomValue}) translate(${appState.scrollX}px, ${appState.scrollY}px)`,
      }}
    >
      {rendered.map((element) => (
        <SceneProxyItem
          key={element.id}
          element={element}
          description={descriptions.get(element.id) ?? ""}
          isCurrent={element.id === effectiveCurrentId}
          onProxyFocus={onProxyFocus}
          setRef={setItemRef}
        />
      ))}
    </div>
  );
};
