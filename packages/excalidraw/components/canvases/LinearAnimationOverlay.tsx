import React, { useEffect, useRef, useState } from "react";

import { getElementAbsoluteCoords, isLinearElement } from "@excalidraw/element";
import { applyDarkModeFilter } from "@excalidraw/common";
import { ShapeCache } from "@excalidraw/element/shape";
import {
  getAnimationDuration,
  restoreLinearElementAnimation,
} from "@excalidraw/element/linearElementAnimation";

import type {
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import "./LinearAnimationOverlay.scss";

import type { StaticCanvasAppState } from "../../types";

/** Use the rendered shaft (including curves/elbows), excluding arrowheads and
 * RoughJS's second stroke so each dot travels along one continuous path. */
export const getAnimationPath = (element: ExcalidrawLinearElement) => {
  const shape = ShapeCache.generateElementShape(element, null)?.[0];
  const ops = shape?.sets.find((set) => set.type === "path")?.ops ?? [];
  let path = "";
  for (const { op, data } of ops) {
    if (op === "move" && path) {
      break;
    }
    const command =
      op === "move"
        ? "M"
        : op === "lineTo"
        ? "L"
        : op === "bcurveTo"
        ? "C"
        : "";
    path += `${command}${data.join(" ")} `;
  }
  return path;
};

export const LinearAnimationOverlay = ({
  elements,
  allElementsMap,
  appState,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  allElementsMap: NonDeletedSceneElementsMap;
  appState: StaticCanvasAppState;
}) => {
  const hasAnimations = elements.some(
    (element) =>
      isLinearElement(element) &&
      !!element.animation &&
      element.animation.type !== "gap" &&
      !!restoreLinearElementAnimation(element.animation),
  );
  const ref = useRef<SVGSVGElement>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const document = ref.current?.ownerDocument;
    if (!document) {
      return;
    }
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [hasAnimations]);
  if (!hasAnimations) {
    return null;
  }
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className="linear-animation-overlay"
      width={appState.width}
      height={appState.height}
      style={{ visibility: hidden ? "hidden" : undefined }}
    >
      <g
        transform={`scale(${appState.zoom.value}) translate(${appState.scrollX} ${appState.scrollY})`}
      >
        {elements.map((element) => {
          if (
            !isLinearElement(element) ||
            element.isDeleted ||
            element.opacity === 0
          ) {
            return null;
          }
          const animation = restoreLinearElementAnimation(element.animation);
          if (!animation || animation.type === "gap") {
            return null;
          }
          const d = getAnimationPath(element);
          if (!d) {
            return null;
          }
          const [, , , , cx, cy] = getElementAbsoluteCoords(
            element,
            allElementsMap,
          );
          const frame =
            element.frameId &&
            appState.frameRendering.enabled &&
            appState.frameRendering.clip
              ? allElementsMap.get(element.frameId)
              : null;
          return (
            <svg
              key={element.id}
              x={frame ? frame.x : undefined}
              y={frame ? frame.y : undefined}
              width={frame ? frame.width : "100%"}
              height={frame ? frame.height : "100%"}
              overflow={frame ? "hidden" : "visible"}
            >
              <g
                transform={`translate(${frame ? -frame.x : 0} ${
                  frame ? -frame.y : 0
                })`}
              >
                <g
                  transform={`rotate(${
                    (element.angle * 180) / Math.PI
                  } ${cx} ${cy}) translate(${element.x} ${element.y})`}
                  opacity={element.opacity / 100}
                >
                  <path
                    d={d}
                    fill="none"
                    stroke={applyDarkModeFilter(
                      element.strokeColor,
                      appState.theme === "dark",
                    )}
                    strokeWidth={animation.size}
                    pathLength={animation.type === "dot" ? 1 : undefined}
                    strokeLinecap="round"
                    strokeDasharray={
                      animation.type === "dot"
                        ? "0.000001 1"
                        : animation.type === "pulse"
                        ? undefined
                        : animation.type === "dots"
                        ? "0.1 23.9"
                        : "10 14"
                    }
                    className={`linear-animation-${animation.type}`}
                    style={{
                      animationDuration: `${
                        animation.type === "dot"
                          ? getAnimationDuration(animation.speed)
                          : (animation.type === "pulse" ? 1 : 0.5) /
                            Math.max(animation.speed, 0.01)
                      }s`,
                      animationDirection:
                        animation.direction === "reverse"
                          ? "reverse"
                          : "normal",
                      animationPlayState:
                        hidden || animation.speed === 0 ? "paused" : "running",
                    }}
                  />
                </g>
              </g>
            </svg>
          );
        })}
      </g>
    </svg>
  );
};
