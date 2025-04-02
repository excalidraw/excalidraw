import { type ReactNode, useEffect, useMemo, useRef } from "react";

import clsx from "clsx";

import { pointFrom, pointRotateRads } from "@excalidraw/math";

import {
  getSwitchableTypeFromElements,
  isUsingAdaptiveRadius,
} from "@excalidraw/element/typeChecks";
import {
  getCommonBoundingBox,
  getElementAbsoluteCoords,
} from "@excalidraw/element/bounds";

import {
  getBoundTextElement,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
  redrawTextBoundingBox,
} from "@excalidraw/element/textElement";
import { wrapText } from "@excalidraw/element/textWrapping";
import { getFontString, updateActiveTool } from "@excalidraw/common";
import { measureText } from "@excalidraw/element/textMeasurements";
import { ShapeCache } from "@excalidraw/element/ShapeCache";

import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElementWithContainer,
  GenericSwitchableToolType,
  LinearSwitchableToolType,
} from "@excalidraw/element/types";

import { mutateElement, ROUNDNESS, sceneCoordsToViewportCoords } from "..";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";
import { trackEvent } from "../analytics";
import { atom, editorJotaiStore, useAtom } from "../editor-jotai";

import "./ShapeSwitch.scss";
import { ToolButton } from "./ToolButton";
import {
  ArrowIcon,
  DiamondIcon,
  EllipseIcon,
  LineIcon,
  RectangleIcon,
} from "./icons";

import type App from "./App";

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

  const selectedElements = useMemo(
    () => getSelectedElements(app.scene.getNonDeletedElementsMap(), app.state),
    [app.scene, app.state],
  );
  const selectedElementsTypeRef = useRef<"generic" | "linear">(null);

  // close shape switch panel if selecting different "types" of elements
  useEffect(() => {
    const { generic, linear } = getSwitchableTypeFromElements(selectedElements);
    const type = generic ? "generic" : linear ? "linear" : null;

    if (type && !selectedElementsTypeRef.current) {
      selectedElementsTypeRef.current = type;
    } else if (
      (selectedElementsTypeRef.current && !type) ||
      (selectedElementsTypeRef.current &&
        type !== selectedElementsTypeRef.current)
    ) {
      setShapeSwitch(null);
      selectedElementsTypeRef.current = null;
    }
  }, [selectedElements, app.state.selectedElementIds, setShapeSwitch]);

  // clear if not active
  if (!shapeSwitch) {
    setShapeSwitchFontSize(null);
    return null;
  }

  // clear if hint target no longer matches
  if (
    shapeSwitch.type === "hint" &&
    selectedElements[0]?.id !== shapeSwitch.id
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
      <div className="text">{t("labels.tab")}</div>
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

  const { generic, linear } = getSwitchableTypeFromElements(elements);

  const genericElements = generic ? getGenericSwitchableElements(elements) : [];

  const sameType = generic
    ? genericElements.every(
        (element) => element.type === genericElements[0].type,
      )
    : linear
    ? elements.every((element) => element.type === elements[0].type)
    : false;

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

  const SHAPES: [string, string, ReactNode][] = linear
    ? [
        ["arrow", "5", ArrowIcon],
        ["line", "6", LineIcon],
      ]
    : generic
    ? [
        ["rectangle", "2", RectangleIcon],
        ["diamond", "3", DiamondIcon],
        ["ellipse", "4", EllipseIcon],
      ]
    : [];

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
          ((generic && genericElements[0].type === type) ||
            (linear && elements[0].type === type));

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
              switchShapes(app, {
                generic: GENERIC_SWITCHABLE_SHAPES.includes(type),
                linear: LINEAR_SWITCHABLE_SHAPES.includes(type),
                nextType: type as
                  | GenericSwitchableToolType
                  | LinearSwitchableToolType,
              });
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

  redrawTextBoundingBox(boundText, container, elementsMap, false);
};

export const switchShapes = (
  app: App,
  {
    generic,
    linear,
    nextType,
    direction = "right",
  }: {
    generic?: boolean;
    linear?: boolean;
    nextType?: GenericSwitchableToolType | LinearSwitchableToolType;
    direction?: "left" | "right";
  } = {},
): boolean => {
  if (!generic && !linear) {
    return false;
  }

  const selectedElements = getSelectedElements(
    app.scene.getNonDeletedElementsMap(),
    app.state,
  );

  const selectedElementIds = selectedElements.reduce(
    (acc, element) => ({ ...acc, [element.id]: true }),
    {},
  );

  const advancement = direction === "right" ? 1 : -1;

  if (generic) {
    const selectedGenericSwitchableElements =
      getGenericSwitchableElements(selectedElements);

    const sameType = selectedGenericSwitchableElements.every(
      (element) => element.type === selectedGenericSwitchableElements[0].type,
    );

    const index = sameType
      ? GENERIC_SWITCHABLE_SHAPES.indexOf(
          selectedGenericSwitchableElements[0].type,
        )
      : -1;

    nextType =
      nextType ??
      (GENERIC_SWITCHABLE_SHAPES[
        (index + GENERIC_SWITCHABLE_SHAPES.length + advancement) %
          GENERIC_SWITCHABLE_SHAPES.length
      ] as GenericSwitchableToolType);

    selectedGenericSwitchableElements.forEach((element) => {
      ShapeCache.delete(element);

      mutateElement(
        element,
        {
          type: nextType as GenericSwitchableToolType,
          roundness:
            nextType === "diamond" && element.roundness
              ? {
                  type: isUsingAdaptiveRadius(nextType)
                    ? ROUNDNESS.ADAPTIVE_RADIUS
                    : ROUNDNESS.PROPORTIONAL_RADIUS,
                  value: ROUNDNESS.PROPORTIONAL_RADIUS,
                }
              : element.roundness,
        },
        false,
      );

      const boundText = getBoundTextElement(
        element,
        app.scene.getNonDeletedElementsMap(),
      );
      if (boundText) {
        if (
          editorJotaiStore.get(shapeSwitchFontSizeAtom)?.[element.id]
            ?.elementType === nextType
        ) {
          mutateElement(
            boundText,
            {
              fontSize:
                editorJotaiStore.get(shapeSwitchFontSizeAtom)?.[element.id]
                  ?.fontSize ?? boundText.fontSize,
            },
            false,
          );
        }

        adjustBoundTextSize(
          element as ExcalidrawTextContainer,
          boundText,
          app.scene.getNonDeletedElementsMap(),
        );
      }
    });

    app.setState((prevState) => {
      return {
        selectedElementIds,
        activeTool: updateActiveTool(prevState, {
          type: "selection",
        }),
      };
    });
  }

  if (linear) {
    const sameType = selectedElements.every(
      (element) => element.type === selectedElements[0].type,
    );
    const index = sameType
      ? LINEAR_SWITCHABLE_SHAPES.indexOf(selectedElements[0].type)
      : -1;
    nextType =
      nextType ??
      (LINEAR_SWITCHABLE_SHAPES[
        (index + LINEAR_SWITCHABLE_SHAPES.length + advancement) %
          LINEAR_SWITCHABLE_SHAPES.length
      ] as LinearSwitchableToolType);

    selectedElements.forEach((element) => {
      ShapeCache.delete(element);

      mutateElement(
        element as ExcalidrawLinearElement,
        {
          type: nextType as LinearSwitchableToolType,
          startArrowhead: null,
          endArrowhead: nextType === "arrow" ? "arrow" : null,
        },
        false,
      );
    });
    const firstElement = selectedElements[0];

    app.setState((prevState) => ({
      selectedElementIds,
      selectedLinearElement:
        selectedElements.length === 1
          ? new LinearElementEditor(firstElement as ExcalidrawLinearElement)
          : null,
      activeTool: updateActiveTool(prevState, {
        type: "selection",
      }),
    }));
  }

  return true;
};

const getGenericSwitchableElements = (elements: ExcalidrawElement[]) =>
  elements.filter((element) =>
    GENERIC_SWITCHABLE_SHAPES.includes(element.type),
  );

export default ShapeSwitch;
