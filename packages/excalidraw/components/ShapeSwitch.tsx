import { type ReactNode, useEffect, useRef } from "react";

import clsx from "clsx";

import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { editorJotaiStore, atom } from "../editor-jotai";

import { getElementAbsoluteCoords } from "../element";
import { sceneCoordsToViewportCoords } from "../utils";
import { getSelectedElements } from "../scene";
import { trackEvent } from "../analytics";
import { isArrowElement, isLinearElement } from "../element/typeChecks";
import { t } from "../i18n";

import "./ShapeSwitch.scss";

import {
  ArrowIcon,
  DiamondIcon,
  EllipseIcon,
  LineIcon,
  RectangleIcon,
} from "./icons";
import { ToolButton } from "./ToolButton";

import type App from "./App";
import type { ExcalidrawElement } from "../element/types";
import type { ToolType } from "../types";

const GAP_HORIZONTAL = 8;
const GAP_VERTICAL = 10;

export const shapeSwitchAtom = atom<"hint" | "panel" | null>(null);

const ShapeSwitch = ({ app }: { app: App }) => {
  const shapeSwitchAtomValue = editorJotaiStore.get(shapeSwitchAtom);

  if (!shapeSwitchAtomValue) {
    return null;
  }

  const selectedElements = getSelectedElements(
    app.scene.getNonDeletedElementsMap(),
    app.state,
  );
  const firstElement = selectedElements[0];

  if (firstElement && selectedElements.length === 1) {
    switch (shapeSwitchAtomValue) {
      case "hint":
        return <Hint app={app} element={firstElement} />;
      case "panel":
        return <Panel app={app} element={firstElement} />;
      default:
        return null;
    }
  }

  return null;
};

const Hint = ({ app, element }: { app: App; element: ExcalidrawElement }) => {
  const [x1, y1, , , cx, cy] = getElementAbsoluteCoords(
    element,
    app.scene.getNonDeletedElementsMap(),
  );

  const rotatedTopLeft = pointRotateRads(
    pointFrom(x1, y1),
    pointFrom(cx, cy),
    element.angle,
  );

  const { x, y } = sceneCoordsToViewportCoords(
    {
      sceneX: rotatedTopLeft[0],
      sceneY: rotatedTopLeft[1],
    },
    app.state,
  );

  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = () => {
      hintRef.current?.classList.remove("animation");
    };

    const hint = hintRef.current;

    if (hint) {
      hint.addEventListener("animationend", listener);
      editorJotaiStore.set(shapeSwitchAtom, null);
    }

    return () => hint?.removeEventListener("animationend", listener);
  }, [element.id]);

  return (
    <div
      ref={hintRef}
      key={element.id}
      style={{
        position: "absolute",
        bottom: `${
          app.state.height +
          GAP_VERTICAL * app.state.zoom.value -
          y -
          app.state.offsetTop
        }px`,
        left: `${x - app.state.offsetLeft - GAP_HORIZONTAL}px`,
        zIndex: 2,

        display: "flex",
        flexDirection: "row",
      }}
      className={clsx("ShapeSwitch__Hint", "animation")}
    >
      <div className="key">&#47;</div>
      <div className="text">{t("labels.slash")}</div>
    </div>
  );
};

const Panel = ({ app, element }: { app: App; element: ExcalidrawElement }) => {
  const [x1, , , y2, cx, cy] = getElementAbsoluteCoords(
    element,
    app.scene.getNonDeletedElementsMap(),
  );

  const rotatedBottomLeft = pointRotateRads(
    pointFrom(x1, y2),
    pointFrom(cx, cy),
    element.angle,
  );

  const { x, y } = sceneCoordsToViewportCoords(
    {
      sceneX: rotatedBottomLeft[0],
      sceneY: rotatedBottomLeft[1],
    },
    app.state,
  );

  const SHAPES: [string, string, ReactNode][] = isLinearElement(element)
    ? [
        ["arrow", "5", ArrowIcon],
        ["line", "6", LineIcon],
      ]
    : [
        ["rectangle", "2", RectangleIcon],
        ["diamond", "3", DiamondIcon],
        ["ellipse", "4", EllipseIcon],
      ];

  useEffect(() => {
    return () => {
      editorJotaiStore.set(shapeSwitchAtom, null);
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: `${
          y + (GAP_VERTICAL + 8) * app.state.zoom.value - app.state.offsetTop
        }px`,
        left: `${x - app.state.offsetLeft - GAP_HORIZONTAL}px`,
        zIndex: 2,
      }}
      className="ShapeSwitch__Panel"
    >
      {SHAPES.map(([type, shortcut, icon]) => {
        const isSelected =
          type === element.type ||
          (isArrowElement(element) && element.elbowed && type === "elbow") ||
          (isArrowElement(element) && element.roundness && type === "curve") ||
          (isArrowElement(element) &&
            !element.elbowed &&
            !element.roundness &&
            type === "straight");

        return (
          <ToolButton
            className="Shape"
            key={`${element.version}_${type}`}
            type="radio"
            icon={icon}
            checked={isSelected}
            name="shape-switch-option"
            title={type}
            keyBindingLabel={""}
            aria-label={type}
            data-testid={`toolbar-${type}`}
            onPointerDown={({ pointerType }) => {
              if (!app.state.penDetected && pointerType === "pen") {
                app.togglePenMode(true);
              }
            }}
            onChange={() => {
              if (app.state.activeTool.type !== type) {
                trackEvent("shape-switch", type, "ui");
              }
              app.setActiveTool({ type: type as ToolType });
            }}
          />
        );
      })}
    </div>
  );
};

export default ShapeSwitch;
