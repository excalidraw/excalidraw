import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { updateElbowArrowPoints } from "@excalidraw/element/elbowArrow";

import { pointFrom, pointRotateRads, type LocalPoint } from "@excalidraw/math";

import {
  isArrowElement,
  isCurvedArrow,
  isElbowArrow,
  isLinearElement,
  isSharpArrow,
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

import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";

import {
  convertElementType,
  CONVERTIBLE_GENERIC_TYPES,
  CONVERTIBLE_LINEAR_TYPES,
  isConvertibleGenericType,
  isConvertibleLinearType,
} from "@excalidraw/element/mutateElement";

import type {
  ConvertibleGenericTypes,
  ConvertibleLinearTypes,
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElementWithContainer,
  FixedSegment,
} from "@excalidraw/element/types";

import { mutateElement, sceneCoordsToViewportCoords } from "..";
import { getSelectedElements } from "../scene";
import { trackEvent } from "../analytics";
import { atom, editorJotaiStore, useAtom } from "../editor-jotai";

import "./ShapeSwitch.scss";
import { ToolButton } from "./ToolButton";
import {
  DiamondIcon,
  elbowArrowIcon,
  EllipseIcon,
  LineIcon,
  RectangleIcon,
  roundArrowIcon,
  sharpArrowIcon,
} from "./icons";

import type App from "./App";

const GAP_HORIZONTAL = 8;
const GAP_VERTICAL = 10;

export const shapeSwitchAtom = atom<{
  type: "panel";
} | null>(null);

export const shapeSwitchFontSizeAtom = atom<{
  [id: string]: {
    fontSize: number;
    elementType: ConvertibleGenericTypes;
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

  if (selectedElements.length === 0) {
    setShapeSwitch(null);
    return null;
  }

  return <Panel app={app} elements={selectedElements} />;
};

const Panel = ({
  app,
  elements,
}: {
  app: App;
  elements: ExcalidrawElement[];
}) => {
  const { generic, linear } = getSwitchableTypeFromElements(elements);

  const genericElements = useMemo(() => {
    return generic ? getGenericSwitchableElements(elements) : [];
  }, [generic, elements]);
  const linearElements = useMemo(() => {
    return linear ? getLinearSwitchableElements(elements) : [];
  }, [linear, elements]);

  const sameType = generic
    ? genericElements.every(
        (element) => element.type === genericElements[0].type,
      )
    : linear
    ? linearElements.every(
        (element) => getArrowType(element) === getArrowType(linearElements[0]),
      )
    : false;

  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef("");

  useEffect(() => {
    const elements = [...genericElements, ...linearElements].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const newPositionRef = `
      ${app.state.scrollX}${app.state.scrollY}${app.state.offsetTop}${
      app.state.offsetLeft
    }${app.state.zoom.value}${elements.map((el) => el.id).join(",")}`;

    if (newPositionRef === positionRef.current) {
      return;
    }

    positionRef.current = newPositionRef;

    let bottomLeft;

    if (elements.length === 1) {
      const [x1, , , y2, cx, cy] = getElementAbsoluteCoords(
        elements[0],
        app.scene.getNonDeletedElementsMap(),
      );
      bottomLeft = pointRotateRads(
        pointFrom(x1, y2),
        pointFrom(cx, cy),
        elements[0].angle,
      );
    } else {
      const { minX, maxY } = getCommonBoundingBox(elements);
      bottomLeft = pointFrom(minX, maxY);
    }

    const { x, y } = sceneCoordsToViewportCoords(
      { sceneX: bottomLeft[0], sceneY: bottomLeft[1] },
      app.state,
    );

    setPanelPosition({ x, y });
  }, [genericElements, linearElements, app.scene, app.state]);

  const SHAPES: [string, ReactNode][] = linear
    ? [
        ["line", LineIcon],
        ["sharpArrow", sharpArrowIcon],
        ["curvedArrow", roundArrowIcon],
        ["elbowArrow", elbowArrowIcon],
      ]
    : generic
    ? [
        ["rectangle", RectangleIcon],
        ["diamond", DiamondIcon],
        ["ellipse", EllipseIcon],
      ]
    : [];

  return (
    <div
      style={{
        position: "absolute",
        top: `${
          panelPosition.y +
          (GAP_VERTICAL + 8) * app.state.zoom.value -
          app.state.offsetTop
        }px`,
        left: `${panelPosition.x - app.state.offsetLeft - GAP_HORIZONTAL}px`,
        zIndex: 2,
      }}
      className="ShapeSwitch__Panel"
    >
      {SHAPES.map(([type, icon]) => {
        const isSelected =
          sameType &&
          ((generic && genericElements[0].type === type) ||
            (linear && getArrowType(linearElements[0]) === type));

        return (
          <ToolButton
            className="Shape"
            key={`${elements[0].id}${elements[0].version}_${type}`}
            type="radio"
            icon={icon}
            checked={isSelected}
            name="shape-switch-option"
            title={type}
            keyBindingLabel={""}
            aria-label={type}
            data-testid={`toolbar-${type}`}
            onChange={() => {
              if (app.state.activeTool.type !== type) {
                trackEvent("shape-switch", type, "ui");
              }
              switchShapes(app, {
                generic: isConvertibleGenericType(type),
                linear: isConvertibleLinearType(type),
                nextType: type as
                  | ConvertibleGenericTypes
                  | ConvertibleLinearTypes,
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
    nextType?: ConvertibleGenericTypes | ConvertibleLinearTypes;
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
      ? CONVERTIBLE_GENERIC_TYPES.indexOf(
          selectedGenericSwitchableElements[0].type,
        )
      : -1;

    nextType =
      nextType ??
      CONVERTIBLE_GENERIC_TYPES[
        (index + CONVERTIBLE_GENERIC_TYPES.length + advancement) %
          CONVERTIBLE_GENERIC_TYPES.length
      ];

    if (nextType && isConvertibleGenericType(nextType)) {
      for (const element of selectedGenericSwitchableElements) {
        convertElementType(element, nextType, app, false);

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
      }

      app.setState((prevState) => {
        return {
          selectedElementIds,
          activeTool: updateActiveTool(prevState, {
            type: "selection",
          }),
        };
      });
    }
  }

  if (linear) {
    const selectedLinearSwitchableElements = getLinearSwitchableElements(
      selectedElements,
    ) as ExcalidrawLinearElement[];

    const arrowType = getArrowType(selectedLinearSwitchableElements[0]);
    const sameType = selectedLinearSwitchableElements.every(
      (element) => getArrowType(element) === arrowType,
    );

    const index = sameType ? CONVERTIBLE_LINEAR_TYPES.indexOf(arrowType) : -1;
    nextType =
      nextType ??
      CONVERTIBLE_LINEAR_TYPES[
        (index + CONVERTIBLE_LINEAR_TYPES.length + advancement) %
          CONVERTIBLE_LINEAR_TYPES.length
      ];

    if (nextType && isConvertibleLinearType(nextType)) {
      for (const element of selectedLinearSwitchableElements) {
        convertElementType(element, nextType, app, false);

        if (isElbowArrow(element)) {
          const nextPoints = convertLineToElbow(element);

          const fixedSegments: FixedSegment[] = [];

          for (let i = 0; i < nextPoints.length - 1; i++) {
            fixedSegments.push({
              start: nextPoints[i],
              end: nextPoints[i + 1],
              index: i,
            });
          }

          const updates = updateElbowArrowPoints(
            element,
            app.scene.getNonDeletedElementsMap(),
            {
              points: nextPoints,
              fixedSegments,
            },
          );
          mutateElement(element, updates, false);
        }
      }
    }
    const firstElement = selectedLinearSwitchableElements[0];

    app.setState((prevState) => ({
      selectedElementIds,
      selectedLinearElement:
        selectedLinearSwitchableElements.length === 1
          ? new LinearElementEditor(firstElement as ExcalidrawLinearElement)
          : null,
      activeTool: updateActiveTool(prevState, {
        type: "selection",
      }),
    }));
  }

  return true;
};

export const getSwitchableTypeFromElements = (
  elements: ExcalidrawElement[],
):
  | {
      generic: true;
      linear: false;
    }
  | {
      linear: true;
      generic: false;
    }
  | {
      generic: false;
      linear: false;
    } => {
  if (elements.length === 0) {
    return {
      generic: false,
      linear: false,
    };
  }

  let onlyLinear = true;
  for (const element of elements) {
    if (
      element.type === "rectangle" ||
      element.type === "ellipse" ||
      element.type === "diamond"
    ) {
      return {
        generic: true,
        linear: false,
      };
    }
    if (element.type !== "arrow" && element.type !== "line") {
      onlyLinear = false;
    }
  }

  if (onlyLinear) {
    // check at least some linear element is switchable
    // for a linear to be swtichable:
    // - no labels
    // - not bound to anything

    let linear = true;

    for (const element of elements) {
      if (
        isArrowElement(element) &&
        (element.startBinding !== null || element.endBinding !== null)
      ) {
        linear = false;
      } else if (element.boundElements && element.boundElements.length > 0) {
        linear = false;
      } else {
        linear = true;
        break;
      }
    }

    return {
      linear,
      generic: false,
    };
  }

  return {
    generic: false,
    linear: false,
  };
};

const getArrowType = (element: ExcalidrawLinearElement) => {
  if (isSharpArrow(element)) {
    return "sharpArrow";
  }
  if (isCurvedArrow(element)) {
    return "curvedArrow";
  }
  if (isElbowArrow(element)) {
    return "elbowArrow";
  }
  return "line";
};

const getGenericSwitchableElements = (elements: ExcalidrawElement[]) =>
  elements.filter((element) => isConvertibleGenericType(element.type)) as Array<
    | ExcalidrawRectangleElement
    | ExcalidrawDiamondElement
    | ExcalidrawEllipseElement
  >;

const getLinearSwitchableElements = (elements: ExcalidrawElement[]) =>
  elements.filter(
    (element) =>
      isLinearElement(element) &&
      !(
        isArrowElement(element) &&
        (element.startBinding !== null || element.endBinding !== null)
      ) &&
      (!element.boundElements || element.boundElements.length === 0),
  ) as ExcalidrawLinearElement[];

const convertLineToElbow = (line: ExcalidrawLinearElement) => {
  const linePoints = sanitizePoints(line.points);
  const nextPoints: LocalPoint[] = [linePoints[0]];

  let i = 1;

  // add bend points to consideration as we go through the line
  // so as to make sure the resulting points form valid segments
  while (i < linePoints.length) {
    const start = nextPoints[nextPoints.length - 1];
    const end = linePoints[i];

    if (isAxisAligned(start, end)) {
      pushSimplified(nextPoints, end);
      i++;
    } else {
      const bend = pointFrom<LocalPoint>(end[0], start[1]);
      pushSimplified(nextPoints, bend);
      // NOTE: we do not increment the counter `i`
      //       so that bend -> end in the next loop
    }
  }

  return nextPoints;
};

const isAxisAligned = (a: LocalPoint, b: LocalPoint) =>
  a[0] === b[0] || a[1] === b[1];

const areColinear = (a: LocalPoint, b: LocalPoint, c: LocalPoint) =>
  (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);

const pushSimplified = (points: LocalPoint[], point: LocalPoint) => {
  const len = points.length;
  if (len >= 2 && areColinear(points[len - 2], points[len - 1], point)) {
    // replace the previous point with the new one
    points[len - 1] = point;
  } else {
    points.push(point);
  }
};

const sanitizePoints = (points: readonly LocalPoint[]): LocalPoint[] => {
  if (points.length === 0) {
    return [];
  }

  const sanitized: LocalPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = sanitized[sanitized.length - 1];
    const [x2, y2] = points[i];

    if (x1 !== x2 || y1 !== y2) {
      sanitized.push(points[i]);
    }
  }

  return sanitized;
};

export default ShapeSwitch;
