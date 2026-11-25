import { memo, useEffect, useState } from "react";

import { applyDarkModeFilter, THEME } from "@excalidraw/common";
import {
  ARROW_FLOW_PACE,
  getArrowFlowLength,
  getArrowFlowPath,
  hasArrowFlow,
  normalizeArrowFlow,
} from "@excalidraw/element";

import type {
  ArrowFlow,
  ExcalidrawArrowElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { AppState } from "../../types";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const useReducedMotion = (ownerWindow: Window | null) => {
  const [reduced, setReduced] = useState(
    // matchMedia may be missing or stubbed (tests, some embeds)
    () => !!ownerWindow?.matchMedia?.(REDUCED_MOTION)?.matches,
  );
  useEffect(() => {
    const query = ownerWindow?.matchMedia?.(REDUCED_MOTION);
    if (!query) {
      return;
    }
    const onChange = () => setReduced(query.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [ownerWindow]);
  return reduced;
};

/**
 * Packets for one arrow. Re-rendered only when the arrow itself changes
 * (its version) or the theme does, so panning and zooming never restart the
 * animation.
 */
const ArrowPackets = memo(
  ({
    element,
    flow,
    isDarkTheme,
  }: {
    element: ExcalidrawArrowElement;
    flow: ArrowFlow;
    isDarkTheme: boolean;
    version: number;
  }) => {
    const path = getArrowFlowPath(element);
    if (!path) {
      return null;
    }
    const length = Math.max(40, getArrowFlowLength(element));
    const duration = Math.max(1.2, length / ARROW_FLOW_PACE[flow.speed]);
    // a few packets on long arrows, spread evenly along them
    const count = Math.min(3, Math.max(1, Math.round(length / 260)));
    const radius = 2 + element.strokeWidth * 0.9;
    const color = applyDarkModeFilter(element.strokeColor, isDarkTheme);

    const packet = (begin: number, backward: boolean, key: string) => (
      <circle
        key={key}
        r={radius}
        fill={color}
        // hidden until its first run starts, so packets don't pile up at the start
        opacity={0}
      >
        <animateMotion
          path={path}
          dur={`${duration.toFixed(2)}s`}
          begin={`${begin.toFixed(2)}s`}
          repeatCount="indefinite"
          calcMode="linear"
          keyPoints={backward ? "1;0" : "0;1"}
          keyTimes="0;1"
        />
        <set attributeName="opacity" to="1" begin={`${begin.toFixed(2)}s`} />
      </circle>
    );

    const packets = [];
    for (let i = 0; i < count; i++) {
      const begin = (i * duration) / count;
      if (flow.direction !== "backward") {
        packets.push(packet(begin, false, `f${i}`));
      }
      if (flow.direction !== "forward") {
        packets.push(packet(begin + duration / (2 * count), true, `b${i}`));
      }
    }
    return <g opacity={element.opacity / 100}>{packets}</g>;
  },
  (prev, next) =>
    prev.version === next.version &&
    prev.isDarkTheme === next.isDarkTheme &&
    prev.flow.direction === next.flow.direction &&
    prev.flow.speed === next.flow.speed,
);

/**
 * Moving packets on arrows that have a flow, drawn above the static canvas and
 * below the interactive one (selection, handles). Scene coordinates are mapped
 * to the viewport with one transform.
 */
export const ArrowFlowLayer = ({
  elements,
  appState,
  ownerWindow,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: Pick<AppState, "scrollX" | "scrollY" | "zoom" | "theme">;
  ownerWindow: Window | null;
}) => {
  const reducedMotion = useReducedMotion(ownerWindow);
  const arrows: (ExcalidrawArrowElement & { flow: ArrowFlow })[] = [];
  for (const element of elements) {
    if (hasArrowFlow(element)) {
      arrows.push(element);
    }
  }

  if (!arrows.length || reducedMotion) {
    return null;
  }

  const isDarkTheme = appState.theme === THEME.DARK;
  return (
    <svg
      className="excalidraw__arrow-flow"
      aria-hidden="true"
      data-testid="arrow-flow-layer"
    >
      <g
        transform={`scale(${appState.zoom.value}) translate(${appState.scrollX} ${appState.scrollY})`}
      >
        {arrows.map((element) => (
          <ArrowPackets
            key={element.id}
            element={element}
            flow={normalizeArrowFlow(element.flow) ?? element.flow}
            isDarkTheme={isDarkTheme}
            version={element.version}
          />
        ))}
      </g>
    </svg>
  );
};
