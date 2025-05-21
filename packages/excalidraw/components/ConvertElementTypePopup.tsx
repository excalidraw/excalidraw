import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  getLinearElementSubType,
  updateElbowArrowPoints,
} from "@excalidraw/element";

import { pointFrom, pointRotateRads, type LocalPoint } from "@excalidraw/math";

import {
  hasBoundTextElement,
  isArrowBoundToElement,
  isArrowElement,
  isElbowArrow,
  isLinearElement,
  isUsingAdaptiveRadius,
} from "@excalidraw/element";

import {
  getCommonBoundingBox,
  getElementAbsoluteCoords,
} from "@excalidraw/element";

import {
  getBoundTextElement,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import { wrapText } from "@excalidraw/element";

import {
  assertNever,
  CLASSES,
  getFontString,
  isProdEnv,
  mapFind,
  reduceToCommonValue,
  updateActiveTool,
} from "@excalidraw/common";

import { measureText } from "@excalidraw/element";

import { LinearElementEditor } from "@excalidraw/element";

import {
  newArrowElement,
  newElement,
  newLinearElement,
} from "@excalidraw/element";

import { ShapeCache } from "@excalidraw/element";

import { updateBindings } from "@excalidraw/element";

import type {
  ConvertibleGenericTypes,
  ConvertibleLinearTypes,
  ConvertibleTypes,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
  ExcalidrawSelectionElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElementWithContainer,
  FixedSegment,
} from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import {
  bumpVersion,
  mutateElement,
  ROUNDNESS,
  sceneCoordsToViewportCoords,
} from "..";
import { trackEvent } from "../analytics";
import { atom } from "../editor-jotai";

import "./ConvertElementTypePopup.scss";
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

import type { AppClassProperties } from "../types";

const GAP_HORIZONTAL = 8;
const GAP_VERTICAL = 10;

type ExcalidrawConvertibleElement =
  | ExcalidrawRectangleElement
  | ExcalidrawDiamondElement
  | ExcalidrawEllipseElement
  | ExcalidrawLinearElement;

// indicates order of switching
const GENERIC_TYPES = ["rectangle", "diamond", "ellipse"] as const;
// indicates order of switching
const LINEAR_TYPES = [
  "line",
  "sharpArrow",
  "curvedArrow",
  "elbowArrow",
] as const;

const CONVERTIBLE_GENERIC_TYPES: ReadonlySet<ConvertibleGenericTypes> = new Set(
  GENERIC_TYPES,
);

const CONVERTIBLE_LINEAR_TYPES: ReadonlySet<ConvertibleLinearTypes> = new Set(
  LINEAR_TYPES,
);

const isConvertibleGenericType = (
  elementType: string,
): elementType is ConvertibleGenericTypes =>
  CONVERTIBLE_GENERIC_TYPES.has(elementType as ConvertibleGenericTypes);

const isConvertibleLinearType = (
  elementType: string,
): elementType is ConvertibleLinearTypes =>
  elementType === "arrow" ||
  CONVERTIBLE_LINEAR_TYPES.has(elementType as ConvertibleLinearTypes);

export const convertElementTypePopupAtom = atom<{
  type: "panel";
} | null>(null);

type CacheKey = string & { _brand: "CacheKey" };

const FONT_SIZE_CONVERSION_CACHE = new Map<
  ExcalidrawElement["id"],
  {
    fontSize: number;
  }
>();

const LINEAR_ELEMENT_CONVERSION_CACHE = new Map<
  CacheKey,
  ExcalidrawLinearElement
>();

const ConvertElementTypePopup = ({ app }: { app: App }) => {
  const selectedElements = app.scene.getSelectedElements(app.state);
  const elementsCategoryRef = useRef<ConversionType>(null);

  // close shape switch panel if selecting different "types" of elements
  useEffect(() => {
    if (selectedElements.length === 0) {
      app.updateEditorAtom(convertElementTypePopupAtom, null);
      return;
    }

    const conversionType = getConversionTypeFromElements(selectedElements);

    if (conversionType && !elementsCategoryRef.current) {
      elementsCategoryRef.current = conversionType;
    } else if (
      (elementsCategoryRef.current && !conversionType) ||
      (elementsCategoryRef.current &&
        conversionType !== elementsCategoryRef.current)
    ) {
      app.updateEditorAtom(convertElementTypePopupAtom, null);
      elementsCategoryRef.current = null;
    }
  }, [selectedElements, app]);

  useEffect(() => {
    return () => {
      FONT_SIZE_CONVERSION_CACHE.clear();
      LINEAR_ELEMENT_CONVERSION_CACHE.clear();
    };
  }, []);

  return <Panel app={app} elements={selectedElements} />;
};

const Panel = ({
  app,
  elements,
}: {
  app: App;
  elements: ExcalidrawElement[];
}) => {
  const conversionType = getConversionTypeFromElements(elements);

  const genericElements = useMemo(() => {
    return conversionType === "generic"
      ? filterGenericConvetibleElements(elements)
      : [];
  }, [conversionType, elements]);
  const linearElements = useMemo(() => {
    return conversionType === "linear"
      ? filterLinearConvertibleElements(elements)
      : [];
  }, [conversionType, elements]);

  const sameType =
    conversionType === "generic"
      ? genericElements.every(
          (element) => element.type === genericElements[0].type,
        )
      : conversionType === "linear"
      ? linearElements.every(
          (element) =>
            getLinearElementSubType(element) ===
            getLinearElementSubType(linearElements[0]),
        )
      : false;

  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef("");
  const panelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    for (const linearElement of linearElements) {
      const cacheKey = toCacheKey(
        linearElement.id,
        getConvertibleType(linearElement),
      );
      if (!LINEAR_ELEMENT_CONVERSION_CACHE.has(cacheKey)) {
        LINEAR_ELEMENT_CONVERSION_CACHE.set(cacheKey, linearElement);
      }
    }
  }, [linearElements]);

  useEffect(() => {
    for (const element of genericElements) {
      if (!FONT_SIZE_CONVERSION_CACHE.has(element.id)) {
        const boundText = getBoundTextElement(
          element,
          app.scene.getNonDeletedElementsMap(),
        );
        if (boundText) {
          FONT_SIZE_CONVERSION_CACHE.set(element.id, {
            fontSize: boundText.fontSize,
          });
        }
      }
    }
  }, [genericElements, app.scene]);

  const SHAPES: [string, ReactNode][] =
    conversionType === "linear"
      ? [
          ["line", LineIcon],
          ["sharpArrow", sharpArrowIcon],
          ["curvedArrow", roundArrowIcon],
          ["elbowArrow", elbowArrowIcon],
        ]
      : conversionType === "generic"
      ? [
          ["rectangle", RectangleIcon],
          ["diamond", DiamondIcon],
          ["ellipse", EllipseIcon],
        ]
      : [];

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
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
      className={CLASSES.CONVERT_ELEMENT_TYPE_POPUP}
    >
      {SHAPES.map(([type, icon]) => {
        const isSelected =
          sameType &&
          ((conversionType === "generic" && genericElements[0].type === type) ||
            (conversionType === "linear" &&
              getLinearElementSubType(linearElements[0]) === type));

        return (
          <ToolButton
            className="Shape"
            key={`${elements[0].id}${elements[0].version}_${type}`}
            type="radio"
            icon={icon}
            checked={isSelected}
            name="convertElementType-option"
            title={type}
            keyBindingLabel={""}
            aria-label={type}
            data-testid={`toolbar-${type}`}
            onChange={() => {
              if (app.state.activeTool.type !== type) {
                trackEvent("convertElementType", type, "ui");
              }
              convertElementTypes(app, {
                conversionType,
                nextType: type as
                  | ConvertibleGenericTypes
                  | ConvertibleLinearTypes,
              });
              panelRef.current?.focus();
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
  scene: Scene,
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

  mutateElement(boundText, scene.getNonDeletedElementsMap(), {
    fontSize: nextFontSize,
    width: metrics.width,
    height: metrics.height,
  });

  redrawTextBoundingBox(boundText, container, scene);
};

type ConversionType = "generic" | "linear" | null;

export const convertElementTypes = (
  app: App,
  {
    conversionType,
    nextType,
    direction = "right",
  }: {
    conversionType: ConversionType;
    nextType?: ConvertibleTypes;
    direction?: "left" | "right";
  },
): boolean => {
  if (!conversionType) {
    return false;
  }

  const selectedElements = app.scene.getSelectedElements(app.state);

  const selectedElementIds = selectedElements.reduce(
    (acc, element) => ({ ...acc, [element.id]: true }),
    {},
  );

  const advancement = direction === "right" ? 1 : -1;

  if (conversionType === "generic") {
    const convertibleGenericElements =
      filterGenericConvetibleElements(selectedElements);

    const sameType = convertibleGenericElements.every(
      (element) => element.type === convertibleGenericElements[0].type,
    );

    const index = sameType
      ? GENERIC_TYPES.indexOf(convertibleGenericElements[0].type)
      : -1;

    nextType =
      nextType ??
      GENERIC_TYPES[
        (index + GENERIC_TYPES.length + advancement) % GENERIC_TYPES.length
      ];

    if (nextType && isConvertibleGenericType(nextType)) {
      const convertedElements: Record<string, ExcalidrawElement> = {};

      for (const element of convertibleGenericElements) {
        const convertedElement = convertElementType(element, nextType, app);
        convertedElements[convertedElement.id] = convertedElement;
      }

      const nextElements = [];

      for (const element of app.scene.getElementsIncludingDeleted()) {
        if (convertedElements[element.id]) {
          nextElements.push(convertedElements[element.id]);
        } else {
          nextElements.push(element);
        }
      }

      app.scene.replaceAllElements(nextElements);

      for (const element of Object.values(convertedElements)) {
        const boundText = getBoundTextElement(
          element,
          app.scene.getNonDeletedElementsMap(),
        );
        if (boundText) {
          if (FONT_SIZE_CONVERSION_CACHE.get(element.id)) {
            mutateElement(boundText, app.scene.getNonDeletedElementsMap(), {
              fontSize:
                FONT_SIZE_CONVERSION_CACHE.get(element.id)?.fontSize ??
                boundText.fontSize,
            });
          }

          adjustBoundTextSize(
            element as ExcalidrawTextContainer,
            boundText,
            app.scene,
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

  if (conversionType === "linear") {
    const convertibleLinearElements = filterLinearConvertibleElements(
      selectedElements,
    ) as ExcalidrawLinearElement[];

    if (!nextType) {
      const commonSubType = reduceToCommonValue(
        convertibleLinearElements,
        getLinearElementSubType,
      );

      const index = commonSubType ? LINEAR_TYPES.indexOf(commonSubType) : -1;
      nextType =
        LINEAR_TYPES[
          (index + LINEAR_TYPES.length + advancement) % LINEAR_TYPES.length
        ];
    }

    if (isConvertibleLinearType(nextType)) {
      const convertedElements: ExcalidrawElement[] = [];

      const nextElementsMap: Map<ExcalidrawElement["id"], ExcalidrawElement> =
        app.scene.getElementsMapIncludingDeleted();

      for (const element of convertibleLinearElements) {
        const cachedElement = LINEAR_ELEMENT_CONVERSION_CACHE.get(
          toCacheKey(element.id, nextType),
        );

        // if switching to the original subType or a subType we've already
        // converted to, reuse the cached element to get the original properties
        // (needed for simple->elbow->simple conversions or between line
        // and arrows)
        if (
          cachedElement &&
          getLinearElementSubType(cachedElement) === nextType
        ) {
          nextElementsMap.set(cachedElement.id, cachedElement);
          convertedElements.push(cachedElement);
        } else {
          const converted = convertElementType(element, nextType, app);
          nextElementsMap.set(converted.id, converted);
          convertedElements.push(converted);
        }
      }

      app.scene.replaceAllElements(nextElementsMap);

      // post normalization
      for (const element of convertedElements) {
        if (isLinearElement(element)) {
          if (isElbowArrow(element)) {
            const nextPoints = convertLineToElbow(element);
            if (nextPoints.length < 2) {
              // skip if not enough points to form valid segments
              continue;
            }
            const fixedSegments: FixedSegment[] = [];
            for (let i = 1; i < nextPoints.length - 2; i++) {
              fixedSegments.push({
                start: nextPoints[i],
                end: nextPoints[i + 1],
                index: i + 1,
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
            mutateElement(element, app.scene.getNonDeletedElementsMap(), {
              ...updates,
              endArrowhead: "arrow",
            });
          } else {
            // if we're converting to non-elbow linear element, check if
            // we've already cached one of these linear elements so we can
            // reuse the points (case: curved->elbow->line and similar)

            const similarCachedLinearElement = mapFind(
              ["line", "sharpArrow", "curvedArrow"] as const,
              (type) =>
                LINEAR_ELEMENT_CONVERSION_CACHE.get(
                  toCacheKey(element.id, type),
                ),
            );

            if (similarCachedLinearElement) {
              const points = similarCachedLinearElement.points;
              app.scene.mutateElement(element, {
                points,
              });
            }
          }
        }
      }
    }

    const convertedSelectedLinearElements = filterLinearConvertibleElements(
      app.scene.getSelectedElements(app.state),
    );

    app.setState((prevState) => ({
      selectedElementIds,
      selectedLinearElement:
        convertedSelectedLinearElements.length === 1
          ? new LinearElementEditor(
              convertedSelectedLinearElements[0],
              app.scene.getNonDeletedElementsMap(),
            )
          : null,
      activeTool: updateActiveTool(prevState, {
        type: "selection",
      }),
    }));
  }

  return true;
};

export const getConversionTypeFromElements = (
  elements: ExcalidrawElement[],
): ConversionType => {
  if (elements.length === 0) {
    return null;
  }

  let canBeLinear = false;
  for (const element of elements) {
    if (isConvertibleGenericType(element.type)) {
      // generic type conversion have preference
      return "generic";
    }
    if (isEligibleLinearElement(element)) {
      canBeLinear = true;
    }
  }

  if (canBeLinear) {
    return "linear";
  }

  return null;
};

const isEligibleLinearElement = (element: ExcalidrawElement) => {
  return (
    isLinearElement(element) &&
    (!isArrowElement(element) ||
      (!isArrowBoundToElement(element) && !hasBoundTextElement(element)))
  );
};

const toCacheKey = (
  elementId: ExcalidrawElement["id"],
  convertitleType: ConvertibleTypes,
) => {
  return `${elementId}:${convertitleType}` as CacheKey;
};

const filterGenericConvetibleElements = (elements: ExcalidrawElement[]) =>
  elements.filter((element) => isConvertibleGenericType(element.type)) as Array<
    | ExcalidrawRectangleElement
    | ExcalidrawDiamondElement
    | ExcalidrawEllipseElement
  >;

const filterLinearConvertibleElements = (elements: ExcalidrawElement[]) =>
  elements.filter((element) =>
    isEligibleLinearElement(element),
  ) as ExcalidrawLinearElement[];

const THRESHOLD = 20;
const isVert = (a: LocalPoint, b: LocalPoint) => a[0] === b[0];
const isHorz = (a: LocalPoint, b: LocalPoint) => a[1] === b[1];
const dist = (a: LocalPoint, b: LocalPoint) =>
  isVert(a, b) ? Math.abs(a[1] - b[1]) : Math.abs(a[0] - b[0]);

const convertLineToElbow = (line: ExcalidrawLinearElement): LocalPoint[] => {
  // 1. build an *orthogonal* route, snapping offsets < SNAP
  const ortho: LocalPoint[] = [line.points[0]];
  const src = sanitizePoints(line.points);

  for (let i = 1; i < src.length; ++i) {
    const start = ortho[ortho.length - 1];
    const end = [...src[i]] as LocalPoint; // clone

    // snap tiny offsets onto the current axis
    if (Math.abs(end[0] - start[0]) < THRESHOLD) {
      end[0] = start[0];
    } else if (Math.abs(end[1] - start[1]) < THRESHOLD) {
      end[1] = start[1];
    }

    // straight or needs a 90 ° bend?
    if (isVert(start, end) || isHorz(start, end)) {
      ortho.push(end);
    } else {
      ortho.push(pointFrom<LocalPoint>(start[0], end[1]));
      ortho.push(end);
    }
  }

  // 2. drop obviously colinear middle points
  const trimmed: LocalPoint[] = [ortho[0]];
  for (let i = 1; i < ortho.length - 1; ++i) {
    if (
      !(
        (isVert(ortho[i - 1], ortho[i]) && isVert(ortho[i], ortho[i + 1])) ||
        (isHorz(ortho[i - 1], ortho[i]) && isHorz(ortho[i], ortho[i + 1]))
      )
    ) {
      trimmed.push(ortho[i]);
    }
  }
  trimmed.push(ortho[ortho.length - 1]);

  // 3. collapse micro “jogs” (V-H-V / H-V-H whose short leg < SNAP)
  const clean: LocalPoint[] = [trimmed[0]];
  for (let i = 1; i < trimmed.length - 1; ++i) {
    const a = clean[clean.length - 1];
    const b = trimmed[i];
    const c = trimmed[i + 1];

    const v1 = isVert(a, b);
    const v2 = isVert(b, c);
    if (v1 !== v2) {
      const d1 = dist(a, b);
      const d2 = dist(b, c);

      if (d1 < THRESHOLD || d2 < THRESHOLD) {
        // pick the shorter leg to remove
        if (d2 < d1) {
          // … absorb leg 2 – pull *c* onto axis of *a-b*
          if (v1) {
            c[0] = a[0];
          } else {
            c[1] = a[1];
          }
        } else {
          // … absorb leg 1 – slide the whole first leg onto *b-c* axis
          // eslint-disable-next-line no-lonely-if
          if (v2) {
            for (
              let k = clean.length - 1;
              k >= 0 && clean[k][0] === a[0];
              --k
            ) {
              clean[k][0] = b[0];
            }
          } else {
            for (
              let k = clean.length - 1;
              k >= 0 && clean[k][1] === a[1];
              --k
            ) {
              clean[k][1] = b[1];
            }
          }
        }
        // *b* is gone, don’t add it
        continue;
      }
    }
    clean.push(b);
  }
  clean.push(trimmed[trimmed.length - 1]);
  return clean;
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

/**
 * Converts an element to a new type, adding or removing properties as needed
 * so that the element object is always valid.
 *
 * Valid conversions at this point:
 * - switching between generic elements
 *   e.g. rectangle -> diamond
 * - switching between linear elements
 *   e.g. elbow arrow -> line
 */
const convertElementType = <
  TElement extends Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
>(
  element: TElement,
  targetType: ConvertibleTypes,
  app: AppClassProperties,
): ExcalidrawElement => {
  if (!isValidConversion(element.type, targetType)) {
    if (!isProdEnv()) {
      throw Error(`Invalid conversion from ${element.type} to ${targetType}.`);
    }
    return element;
  }

  if (element.type === targetType) {
    return element;
  }

  ShapeCache.delete(element);

  if (isConvertibleGenericType(targetType)) {
    const nextElement = bumpVersion(
      newElement({
        ...element,
        type: targetType,
        roundness:
          targetType === "diamond" && element.roundness
            ? {
                type: isUsingAdaptiveRadius(targetType)
                  ? ROUNDNESS.ADAPTIVE_RADIUS
                  : ROUNDNESS.PROPORTIONAL_RADIUS,
              }
            : element.roundness,
      }),
    ) as typeof element;

    updateBindings(nextElement, app.scene);

    return nextElement;
  }

  if (isConvertibleLinearType(targetType)) {
    switch (targetType) {
      case "line": {
        return bumpVersion(
          newLinearElement({
            ...element,
            type: "line",
          }),
        );
      }
      case "sharpArrow": {
        return bumpVersion(
          newArrowElement({
            ...element,
            type: "arrow",
            elbowed: false,
            roundness: null,
            startArrowhead: app.state.currentItemStartArrowhead,
            endArrowhead: app.state.currentItemEndArrowhead,
          }),
        );
      }
      case "curvedArrow": {
        return bumpVersion(
          newArrowElement({
            ...element,
            type: "arrow",
            elbowed: false,
            roundness: {
              type: ROUNDNESS.PROPORTIONAL_RADIUS,
            },
            startArrowhead: app.state.currentItemStartArrowhead,
            endArrowhead: app.state.currentItemEndArrowhead,
          }),
        );
      }
      case "elbowArrow": {
        return bumpVersion(
          newArrowElement({
            ...element,
            type: "arrow",
            elbowed: true,
            fixedSegments: null,
            roundness: null,
          }),
        );
      }
    }
  }

  assertNever(targetType, `unhandled conversion type: ${targetType}`);

  return element;
};

const isValidConversion = (
  startType: string,
  targetType: ConvertibleTypes,
): startType is ConvertibleTypes => {
  if (
    isConvertibleGenericType(startType) &&
    isConvertibleGenericType(targetType)
  ) {
    return true;
  }

  if (
    isConvertibleLinearType(startType) &&
    isConvertibleLinearType(targetType)
  ) {
    return true;
  }

  // NOTE: add more conversions when needed

  return false;
};

const getConvertibleType = (
  element: ExcalidrawConvertibleElement,
): ConvertibleTypes => {
  if (isLinearElement(element)) {
    return getLinearElementSubType(element);
  }
  return element.type;
};

export default ConvertElementTypePopup;
