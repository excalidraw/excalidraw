import { type ReactNode, useEffect, useRef } from "react";

import clsx from "clsx";

import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { atom, useAtom } from "../editor-jotai";

import { getElementAbsoluteCoords, refreshTextDimensions } from "../element";
import { getFontString, sceneCoordsToViewportCoords } from "../utils";
import { getSelectedElements } from "../scene";
import { trackEvent } from "../analytics";
import { isArrowElement, isLinearElement } from "../element/typeChecks";
import { t } from "../i18n";

import {
  computeBoundTextPosition,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
} from "../element/textElement";
import { wrapText } from "../element/textWrapping";
import { measureText } from "../element/textMeasurements";
import { mutateElement } from "../element/mutateElement";
import { getCommonBoundingBox } from "../element/bounds";

import { ToolButton } from "./ToolButton";
import {
  ArrowIcon,
  DiamondIcon,
  EllipseIcon,
  LineIcon,
  RectangleIcon,
} from "./icons";

import "./ShapeSwitch.scss";

import type App from "./App";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElementWithContainer,
  GenericSwitchableToolType,
} from "../element/types";
import type { ToolType } from "../types";

const GAP_HORIZONTAL = 8;
const GAP_VERTICAL = 10;

export const GENERIC_SWITCHABLE_SHAPES = ["rectangle", "diamond", "ellipse"];

export const LINEAR_SWITCHABLE_SHAPES = ["line", "arrow"];

export const shapeSwitchAtom = atom<
  | {
      type: "hint";
      id: string;
    }
  | {
      type: "panel";
    }
  | null
>(null);
export const shapeSwitchFontSizeAtom = atom<{
  [id: string]: {
    fontSize: number;
    elementType: GenericSwitchableToolType;
  };
} | null>(null);

const ShapeSwitch = ({ app }: { app: App }) => {
  const [shapeSwitch, setShapeSwitch] = useAtom(shapeSwitchAtom);
  const [, setShapeSwitchFontSize] = useAtom(shapeSwitchFontSizeAtom);

  // clear if not active
  if (!shapeSwitch) {
    setShapeSwitchFontSize(null);
    return null;
  }

  const selectedElements = getSelectedElements(
    app.scene.getNonDeletedElementsMap(),
    app.state,
  );

  // clear if hint target no longer matches
  if (
    shapeSwitch.type === "hint" &&
    selectedElements?.[0]?.id !== shapeSwitch.id
  ) {
    setShapeSwitch(null);
    return null;
  }

  if (selectedElements.length === 0) {
    setShapeSwitch(null);
    return null;
  }

  const props = { app, elements: selectedElements };

  switch (shapeSwitch.type) {
    case "hint":
      return <Hint {...props} />;
    case "panel":
      return <Panel {...props} />;
    default:
      return null;
  }
};

const Hint = ({
  app,
  elements,
}: {
  app: App;
  elements: ExcalidrawElement[];
}) => {
  const [, setShapeSwitch] = useAtom(shapeSwitchAtom);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hint = hintRef.current;
    if (!hint) {
      return;
    }

    const handleAnimationEnd = () => {
      hint.classList.remove("animation");
      setShapeSwitch(null);
    };

    hint.addEventListener("animationend", handleAnimationEnd, { once: true });

    return () => {
      hint.removeEventListener("animationend", handleAnimationEnd);
    };
  }, [setShapeSwitch]);

  const [x1, y1, , , cx, cy] = getElementAbsoluteCoords(
    elements[0],
    app.scene.getNonDeletedElementsMap(),
  );

  const rotatedTopLeft = pointRotateRads(
    pointFrom(x1, y1),
    pointFrom(cx, cy),
    elements[0].angle,
  );

  const { x, y } = sceneCoordsToViewportCoords(
    {
      sceneX: rotatedTopLeft[0],
      sceneY: rotatedTopLeft[1],
    },
    app.state,
  );

  return (
    <div
      ref={hintRef}
      // key={element.id}
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

const Panel = ({
  app,
  elements,
}: {
  app: App;
  elements: ExcalidrawElement[];
}) => {
  let [x1, y2, cx, cy] = [0, 0, 0, 0];
  let rotatedBottomLeft = [0, 0];

  const sameType = elements.every(
    (element) => element.type === elements[0].type,
  );

  if (elements.length === 1) {
    [x1, , , y2, cx, cy] = getElementAbsoluteCoords(
      elements[0],
      app.scene.getNonDeletedElementsMap(),
    );

    rotatedBottomLeft = pointRotateRads(
      pointFrom(x1, y2),
      pointFrom(cx, cy),
      elements[0].angle,
    );
  } else {
    const { minX, maxY, midX, midY } = getCommonBoundingBox(elements);
    x1 = minX;
    y2 = maxY;
    cx = midX;
    cy = midY;
    rotatedBottomLeft = pointFrom(x1, y2);
  }

  const { x, y } = sceneCoordsToViewportCoords(
    {
      sceneX: rotatedBottomLeft[0],
      sceneY: rotatedBottomLeft[1],
    },
    app.state,
  );

  const SHAPES: [string, string, ReactNode][] = isLinearElement(elements[0])
    ? [
        ["arrow", "5", ArrowIcon],
        ["line", "6", LineIcon],
      ]
    : [
        ["rectangle", "2", RectangleIcon],
        ["diamond", "3", DiamondIcon],
        ["ellipse", "4", EllipseIcon],
      ];

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
          sameType &&
          (type === elements[0].type ||
            (isArrowElement(elements[0]) &&
              elements[0].elbowed &&
              type === "elbow") ||
            (isArrowElement(elements[0]) &&
              elements[0].roundness &&
              type === "curve") ||
            (isArrowElement(elements[0]) &&
              !elements[0].elbowed &&
              !elements[0].roundness &&
              type === "straight"));

        return (
          <ToolButton
            className="Shape"
            key={`${elements[0].version}_${type}`}
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

export const adjustBoundTextSize = (
  container: ExcalidrawTextContainer,
  boundText: ExcalidrawTextElementWithContainer,
  elementsMap: ElementsMap,
) => {
  const maxWidth = getBoundTextMaxWidth(container, boundText);
  const maxHeight = getBoundTextMaxHeight(container, boundText);

  const wrappedText = wrapText(
    boundText.text,
    getFontString(boundText),
    maxWidth,
  );

  let metrics = measureText(
    wrappedText,
    getFontString(boundText),
    boundText.lineHeight,
  );

  let nextFontSize = boundText.fontSize;
  while (
    (metrics.width > maxWidth || metrics.height > maxHeight) &&
    nextFontSize > 0
  ) {
    nextFontSize -= 1;
    const _updatedTextElement = {
      ...boundText,
      fontSize: nextFontSize,
    };
    metrics = measureText(
      boundText.text,
      getFontString(_updatedTextElement),
      boundText.lineHeight,
    );
  }

  mutateElement(
    boundText,
    {
      fontSize: nextFontSize,
      width: metrics.width,
      height: metrics.height,
    },
    false,
  );

  const { x, y } = computeBoundTextPosition(container, boundText, elementsMap);

  mutateElement(
    boundText,
    {
      x,
      y,
    },
    false,
  );

  mutateElement(
    boundText,
    {
      ...refreshTextDimensions(
        boundText,
        container,
        elementsMap,
        boundText.originalText,
      ),
      containerId: container.id,
    },
    false,
  );
};

export default ShapeSwitch;
