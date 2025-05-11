import { pointFrom } from "@excalidraw/math";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_COLOR_PALETTE,
  DEFAULT_ELEMENT_STROKE_PICKS,
  ARROW_TYPE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
  ROUNDNESS,
  STROKE_WIDTH,
  VERTICAL_ALIGN,
  KEYS,
  randomInteger,
  arrayToMap,
  getFontFamilyString,
  getShortcutKey,
  tupleToCoors,
  getLineHeight,
  reduceToCommonValue,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import {
  bindLinearElement,
  bindPointToSnapToElementOutline,
  calculateFixedPointForElbowArrowBinding,
  getHoveredElementForBinding,
  updateBoundElements,
} from "@excalidraw/element";

import { LinearElementEditor } from "@excalidraw/element";

import { newElementWith } from "@excalidraw/element";

import {
  getBoundTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import {
  isArrowElement,
  isBoundToContainer,
  isElbowArrow,
  isLinearElement,
  isTextElement,
  isUsingAdaptiveRadius,
} from "@excalidraw/element";

import { hasStrokeColor } from "@excalidraw/element";

import { updateElbowArrowPoints } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import type {
  Arrowhead,
  ElementsMap,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  FontFamilyValues,
  TextAlign,
  VerticalAlign,
} from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import type { CaptureUpdateActionType } from "@excalidraw/element";

import { trackEvent } from "../analytics";
import { ButtonIconSelect } from "../components/ButtonIconSelect";
import { ColorPicker } from "../components/ColorPicker/ColorPicker";
import { FontPicker } from "../components/FontPicker/FontPicker";
import { IconPicker } from "../components/IconPicker";
// TODO barnabasmolnar/editor-redesign
// TextAlignTopIcon, TextAlignBottomIcon,TextAlignMiddleIcon,
// ArrowHead icons
import { Range } from "../components/Range";
import {
  ArrowheadArrowIcon,
  ArrowheadBarIcon,
  ArrowheadCircleIcon,
  ArrowheadTriangleIcon,
  ArrowheadNoneIcon,
  StrokeStyleDashedIcon,
  StrokeStyleDottedIcon,
  TextAlignTopIcon,
  TextAlignBottomIcon,
  TextAlignMiddleIcon,
  FillHachureIcon,
  FillCrossHatchIcon,
  FillSolidIcon,
  SloppinessArchitectIcon,
  SloppinessArtistIcon,
  SloppinessCartoonistIcon,
  StrokeWidthThinIcon,
  StrokeWidthBaseIcon,
  StrokeWidthBoldIcon,
  StrokeWidthExtraBoldIcon,
  FontSizeSmallIcon,
  FontSizeMediumIcon,
  FontSizeLargeIcon,
  FontSizeExtraLargeIcon,
  EdgeSharpIcon,
  EdgeRoundIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  FillZigZagIcon,
  ArrowheadTriangleOutlineIcon,
  ArrowheadCircleOutlineIcon,
  ArrowheadDiamondIcon,
  ArrowheadDiamondOutlineIcon,
  fontSizeIcon,
  sharpArrowIcon,
  roundArrowIcon,
  elbowArrowIcon,
  ArrowheadCrowfootIcon,
  ArrowheadCrowfootOneIcon,
  ArrowheadCrowfootOneOrManyIcon,
} from "../components/icons";

import { Fonts } from "../fonts";
import { getLanguage, t } from "../i18n";
import {
  canHaveArrowheads,
  getSelectedElements,
  getTargetElements,
  isSomeElementSelected,
} from "../scene";

import { register } from "./register";

import type { AppClassProperties, AppState, Primitive } from "../types";

const FONT_SIZE_RELATIVE_INCREASE_STEP = 0.1;

export const changeProperty = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  callback: (element: ExcalidrawElement) => ExcalidrawElement,
  includeBoundText = false,
) => {
  const selectedElementIds = arrayToMap(
    getSelectedElements(elements, appState, {
      includeBoundTextElement: includeBoundText,
    }),
  );

  return elements.map((element) => {
    if (
      selectedElementIds.get(element.id) ||
      element.id === appState.editingTextElement?.id
    ) {
      return callback(element);
    }
    return element;
  });
};

export const getFormValue = function <T extends Primitive>(
  elements: readonly ExcalidrawElement[],
  app: AppClassProperties,
  getAttribute: (element: ExcalidrawElement) => T,
  isRelevantElement: true | ((element: ExcalidrawElement) => boolean),
  defaultValue: T | ((isSomeElementSelected: boolean) => T),
): T {
  const editingTextElement = app.state.editingTextElement;
  const nonDeletedElements = getNonDeletedElements(elements);

  let ret: T | null = null;

  if (editingTextElement) {
    ret = getAttribute(editingTextElement);
  }

  if (!ret) {
    const hasSelection = isSomeElementSelected(nonDeletedElements, app.state);

    if (hasSelection) {
      const selectedElements = app.scene.getSelectedElements(app.state);
      const targetElements =
        isRelevantElement === true
          ? selectedElements
          : selectedElements.filter((el) => isRelevantElement(el));

      ret =
        reduceToCommonValue(targetElements, getAttribute) ??
        (typeof defaultValue === "function"
          ? defaultValue(true)
          : defaultValue);
    } else {
      ret =
        typeof defaultValue === "function" ? defaultValue(false) : defaultValue;
    }
  }

  return ret;
};

const offsetElementAfterFontResize = (
  prevElement: ExcalidrawTextElement,
  nextElement: ExcalidrawTextElement,
  scene: Scene,
) => {
  if (isBoundToContainer(nextElement) || !nextElement.autoResize) {
    return nextElement;
  }
  return scene.mutateElement(nextElement, {
    x:
      prevElement.textAlign === "left"
        ? prevElement.x
        : prevElement.x +
          (prevElement.width - nextElement.width) /
            (prevElement.textAlign === "center" ? 2 : 1),
    // centering vertically is non-standard, but for Excalidraw I think
    // it makes sense
    y: prevElement.y + (prevElement.height - nextElement.height) / 2,
  });
};

const changeFontSize = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
  getNewFontSize: (element: ExcalidrawTextElement) => number,
  fallbackValue?: ExcalidrawTextElement["fontSize"],
) => {
  const newFontSizes = new Set<number>();

  const updatedElements = changeProperty(
    elements,
    appState,
    (oldElement) => {
      if (isTextElement(oldElement)) {
        const newFontSize = getNewFontSize(oldElement);
        newFontSizes.add(newFontSize);

        let newElement: ExcalidrawTextElement = newElementWith(oldElement, {
          fontSize: newFontSize,
        });
        redrawTextBoundingBox(
          newElement,
          app.scene.getContainerElement(oldElement),
          app.scene,
        );

        newElement = offsetElementAfterFontResize(
          oldElement,
          newElement,
          app.scene,
        );

        return newElement;
      }
      return oldElement;
    },
    true,
  );

  // Update arrow elements after text elements have been updated
  getSelectedElements(elements, appState, {
    includeBoundTextElement: true,
  }).forEach((element) => {
    if (isTextElement(element)) {
      updateBoundElements(element, app.scene);
    }
  });

  return {
    elements: updatedElements,
    appState: {
      ...appState,
      // update state only if we've set all select text elements to
      // the same font size
      currentItemFontSize:
        newFontSizes.size === 1
          ? [...newFontSizes][0]
          : fallbackValue ?? appState.currentItemFontSize,
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

// -----------------------------------------------------------------------------

export const actionChangeStrokeColor = register({
  name: "changeStrokeColor",
  label: "labels.stroke",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    //zsviczian added containers
    const containers = getSelectedElements(elements, appState, {
      includeBoundTextElement: false,
    })
      .filter((el) => el.boundElements)
      .map((el) => el.id);
    return {
      ...(value.currentItemStrokeColor && {
        elements: changeProperty(
          elements,
          appState,
          (el) => {
            if (
              //zsviczian
              isTextElement(el) &&
              el.containerId &&
              containers.includes(el.containerId) &&
              app.scene.getContainerElement(el)?.strokeColor !== el.strokeColor
            ) {
              return el;
            }
            return hasStrokeColor(el.type)
              ? newElementWith(el, {
                  strokeColor: value.currentItemStrokeColor,
                })
              : el;
          },
          true,
        ),
      }),
      appState: {
        ...appState,
        ...value,
      },
      captureUpdate: !!value.currentItemStrokeColor
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <>
      <h3 aria-hidden="true">{t("labels.stroke")}</h3>
      <ColorPicker
        topPicks={
          //zsviczian
          appState.colorPalette?.topPicks?.elementStroke ??
          DEFAULT_ELEMENT_STROKE_PICKS
        }
        palette={
          //zsviczian
          appState.colorPalette?.elementStroke ??
          DEFAULT_ELEMENT_STROKE_COLOR_PALETTE
        }
        type="elementStroke"
        label={t("labels.stroke")}
        color={getFormValue(
          elements,
          app,
          (element) => element.strokeColor,
          true,
          appState.currentItemStrokeColor,
        )}
        onChange={(color) => updateData({ currentItemStrokeColor: color })}
        elements={elements}
        appState={appState}
        updateData={updateData}
      />
    </>
  ),
});

export const actionChangeBackgroundColor = register({
  name: "changeBackgroundColor",
  label: "labels.changeBackground",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      ...(value.currentItemBackgroundColor && {
        elements: changeProperty(elements, appState, (el) =>
          newElementWith(el, {
            backgroundColor: value.currentItemBackgroundColor,
          }),
        ),
      }),
      appState: {
        ...appState,
        ...value,
      },
      captureUpdate: !!value.currentItemBackgroundColor
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <>
      <h3 aria-hidden="true">{t("labels.background")}</h3>
      <ColorPicker
        topPicks={
          //zsviczian
          appState.colorPalette?.topPicks?.elementBackground ??
          DEFAULT_ELEMENT_BACKGROUND_PICKS
        }
        palette={
          //zsviczian
          appState.colorPalette?.elementBackground ??
          DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE
        }
        type="elementBackground"
        label={t("labels.background")}
        color={getFormValue(
          elements,
          app,
          (element) => element.backgroundColor,
          true,
          appState.currentItemBackgroundColor,
        )}
        onChange={(color) => updateData({ currentItemBackgroundColor: color })}
        elements={elements}
        appState={appState}
        updateData={updateData}
      />
    </>
  ),
});

export const actionChangeFillStyle = register({
  name: "changeFillStyle",
  label: "labels.fill",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    trackEvent(
      "element",
      "changeFillStyle",
      `${value} (${app.device.editor.isMobile ? "mobile" : "desktop"})`,
    );
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          fillStyle: value,
        }),
      ),
      appState: { ...appState, currentItemFillStyle: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const selectedElements = getSelectedElements(elements, appState);
    const allElementsZigZag =
      selectedElements.length > 0 &&
      selectedElements.every((el) => el.fillStyle === "zigzag");

    return (
      <fieldset>
        <legend>{t("labels.fill")}</legend>
        <ButtonIconSelect
          type="button"
          options={[
            {
              value: "hachure",
              text: `${
                allElementsZigZag ? t("labels.zigzag") : t("labels.hachure")
              } (${getShortcutKey("Alt-Click")})`,
              icon: allElementsZigZag ? FillZigZagIcon : FillHachureIcon,
              active: allElementsZigZag ? true : undefined,
              testId: `fill-hachure`,
            },
            {
              value: "cross-hatch",
              text: t("labels.crossHatch"),
              icon: FillCrossHatchIcon,
              testId: `fill-cross-hatch`,
            },
            {
              value: "solid",
              text: t("labels.solid"),
              icon: FillSolidIcon,
              testId: `fill-solid`,
            },
          ]}
          value={getFormValue(
            elements,
            app,
            (element) => element.fillStyle,
            (element) => element.hasOwnProperty("fillStyle"),
            (hasSelection) =>
              hasSelection ? null : appState.currentItemFillStyle,
          )}
          onClick={(value, event) => {
            const nextValue =
              event.altKey &&
              value === "hachure" &&
              selectedElements.every((el) => el.fillStyle === "hachure")
                ? "zigzag"
                : value;

            updateData(nextValue);
          }}
        />
      </fieldset>
    );
  },
});

export const actionChangeStrokeWidth = register({
  name: "changeStrokeWidth",
  label: "labels.strokeWidth",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeWidth: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeWidth: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <fieldset>
      <legend>{t("labels.strokeWidth")}</legend>
      <ButtonIconSelect
        group="stroke-width"
        options={[
          {
            //zsviczian
            value: 0.5,
            text: t("labels.extraThin"),
            icon: StrokeWidthThinIcon,
          },
          {
            value: STROKE_WIDTH.thin,
            text: t("labels.thin"),
            icon: StrokeWidthBaseIcon,
            testId: "strokeWidth-thin",
          },
          {
            value: STROKE_WIDTH.bold,
            text: t("labels.bold"),
            icon: StrokeWidthBoldIcon,
            testId: "strokeWidth-bold",
          },
          {
            value: STROKE_WIDTH.extraBold,
            text: t("labels.extraBold"),
            icon: StrokeWidthExtraBoldIcon,
            testId: "strokeWidth-extraBold",
          },
        ]}
        value={getFormValue(
          elements,
          app,
          (element) => element.strokeWidth,
          (element) => element.hasOwnProperty("strokeWidth"),
          (hasSelection) =>
            hasSelection ? null : appState.currentItemStrokeWidth,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeSloppiness = register({
  name: "changeSloppiness",
  label: "labels.sloppiness",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          seed: randomInteger(),
          roughness: value,
        }),
      ),
      appState: { ...appState, currentItemRoughness: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <fieldset>
      <legend>{t("labels.sloppiness")}</legend>
      <ButtonIconSelect
        group="sloppiness"
        options={[
          {
            value: 0,
            text: t("labels.architect"),
            icon: SloppinessArchitectIcon,
          },
          {
            value: 1,
            text: t("labels.artist"),
            icon: SloppinessArtistIcon,
          },
          {
            value: 2,
            text: t("labels.cartoonist"),
            icon: SloppinessCartoonistIcon,
          },
        ]}
        value={getFormValue(
          elements,
          app,
          (element) => element.roughness,
          (element) => element.hasOwnProperty("roughness"),
          (hasSelection) =>
            hasSelection ? null : appState.currentItemRoughness,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeStrokeStyle = register({
  name: "changeStrokeStyle",
  label: "labels.strokeStyle",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeStyle: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeStyle: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <fieldset>
      <legend>{t("labels.strokeStyle")}</legend>
      <ButtonIconSelect
        group="strokeStyle"
        options={[
          {
            value: "solid",
            text: t("labels.strokeStyle_solid"),
            icon: StrokeWidthBaseIcon,
          },
          {
            value: "dashed",
            text: t("labels.strokeStyle_dashed"),
            icon: StrokeStyleDashedIcon,
          },
          {
            value: "dotted",
            text: t("labels.strokeStyle_dotted"),
            icon: StrokeStyleDottedIcon,
          },
        ]}
        value={getFormValue(
          elements,
          app,
          (element) => element.strokeStyle,
          (element) => element.hasOwnProperty("strokeStyle"),
          (hasSelection) =>
            hasSelection ? null : appState.currentItemStrokeStyle,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeOpacity = register({
  name: "changeOpacity",
  label: "labels.opacity",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (el) =>
          newElementWith(el, {
            opacity: value,
          }),
        true,
      ),
      appState: { ...appState, currentItemOpacity: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ app, updateData }) => (
    <Range updateData={updateData} app={app} testId="opacity" />
  ),
});

let scaleFontSize = false; //zsviczian
let useFibonacci = false; //zsviczian
//zsviczian
//with a random noise of +-0.05 to avoid duplicates
const fibonacciValues = [
  [
    177.38, 109.63, 67.75, 41.9, 25.91, 16, 9.9, 6.14, 3.83, 2.29, 1.47, 0.9,
    0.57,
  ],
  [
    287.06, 177.43, 109.64, 67.73, 41.92, 26, 16.01, 9.92, 6.1, 3.75, 2.34,
    1.41, 0.87,
  ],
  [
    464.44, 287.11, 177.44, 109.65, 67.76, 42, 25.9, 15.97, 9.93, 6.12, 3.82,
    2.3, 1.46,
  ],
  [
    751.52, 464.45, 287.08, 177.42, 109.67, 68, 41.89, 25.93, 15.99, 9.88, 6.07,
    3.77, 2.35,
  ],
];

//zsviczian
const normalValues = [
  [
    182.22, 121.46, 80, 53, 35.99, 23.96, 16, 10.68, 7.1, 4.74, 3.16, 2.11,
    1.45, 0.97, 0.66,
  ],
  [
    227.82, 151.88, 101.25, 67.51, 44.95, 29.98, 20, 13.31, 8.85, 5.97, 3.95,
    2.68, 1.77, 1.19, 0.82,
  ],
  [
    318.96, 212.59, 141.8, 94.51, 62.98, 42.01, 28, 18.63, 12.45, 8.26, 5.52,
    3.7, 2.47, 1.61, 1.07,
  ],
  [
    410.02, 273.42, 182.28, 121.5, 81, 54, 36, 24.01, 16.05, 10.69, 7.13, 4.78,
    3.12, 2.07, 1.38,
  ],
];

//zsviczian
const valueToIndex: { [key: number]: number } = {
  16: 0,
  20: 1,
  28: 2,
  36: 3,
};

//zsviczian
const getFibonacciFontSize = (zoom: number, buttonValue: number): number => {
  const index = valueToIndex[buttonValue];
  if (typeof index !== "number") {
    return buttonValue;
  }
  const range = [
    [0, 0.12],
    [0.12, 0.19],
    [0.19, 0.31],
    [0.31, 0.5],
    [0.5, 0.81],
    [0.81, 1.31],
    [1.31, 2.12],
    [2.12, 3.43],
    [3.43, 5.54],
    [5.54, 8.97],
    [8.97, 14.52],
    [14.52, 23.49],
    [23.49, 100],
  ];
  for (let i = 0; i < range.length; i++) {
    const [from, to] = range[i];
    if (zoom >= from && zoom < to) {
      return fibonacciValues[index][i];
      break;
    }
  }
  return buttonValue;
};

//zsviczian
const getScaledFontSize = (zoom: number, buttonValue: number): number => {
  const index = valueToIndex[buttonValue];
  if (typeof index !== "number") {
    return buttonValue;
  }
  const range = [
    [0, 0.11],
    [0.11, 0.16],
    [0.16, 0.25],
    [0.25, 0.37],
    [0.37, 0.56],
    [0.56, 0.83],
    [0.83, 1.25],
    [1.25, 1.88],
    [1.88, 2.81],
    [2.81, 4.22],
    [4.22, 6.33],
    [6.33, 9.49],
    [9.49, 14.24],
    [14.24, 21.36],
    [21.36, 100],
  ];
  for (let i = 0; i < range.length; i++) {
    const [from, to] = range[i];
    if (zoom >= from && zoom < to) {
      return normalValues[index][i];
      break;
    }
  }
  return buttonValue;
};

//zsviczian
const findIndex = (values: number[][], value: number): number | null => {
  for (let i = 0; i < values.length; i++) {
    const idx = values[i].indexOf(value);
    if (idx !== -1) {
      return i;
    }
  }
  return null;
};

//zsviczian
export const getFontSize = (size: number, zoom: number): number => {
  zoom = scaleFontSize ? zoom : 1;
  let normalizedSizeIdx = findIndex(fibonacciValues, size);
  if (!normalizedSizeIdx) {
    normalizedSizeIdx = findIndex(normalValues, size);
  }
  if (normalizedSizeIdx === null) {
    return size;
  }
  size = [16, 20, 28, 36][normalizedSizeIdx];
  const nextValue = useFibonacci
    ? getFibonacciFontSize(zoom, size)
    : getScaledFontSize(zoom, size);
  return nextValue ?? size;
};

export const actionChangeFontSize = register({
  name: "changeFontSize",
  label: "labels.fontSize",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return changeFontSize(elements, appState, app, () => value, value);
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    //zsviczian
    let selectedElements = getSelectedElements(elements, appState).filter(
      (el) => isTextElement(el),
    ) as ExcalidrawTextElement[];
    if (selectedElements.length === 0) {
      selectedElements = (
        appState.editingTextElement ? [appState.editingTextElement] : []
      ) as ExcalidrawTextElement[];
    }
    const size = selectedElements[0]?.fontSize;
    let idx: number | null = null;
    if (size && selectedElements.every((el) => el.fontSize === size)) {
      idx = findIndex(normalValues, size);
      if (idx === null) {
        idx = findIndex(fibonacciValues, size);
      }
    }
    const isSmall = idx === 0;
    const isMedium = idx === 1;
    const isLarge = idx === 2;
    const isVeryLarge = idx === 3;

    return (
      //zsviczian
      <fieldset>
        <legend>{t("labels.fontSize")}</legend>
        <ButtonIconSelect
          type="button" //zsviczian
          //group="font-size" //zsviczian
          options={[
            {
              value: 16,
              text: `${t("labels.small")}\nSHIFT: zoomed, ALT/OPT: Fibonacci`, //zsviczian
              icon: FontSizeSmallIcon,
              testId: "fontSize-small",
              active: isSmall ? true : undefined, //zsviczian
            },
            {
              value: 20,
              text: `${t("labels.medium")}\nSHIFT: zoomed, ALT/OPT: Fibonacci`, //zsviczian
              icon: FontSizeMediumIcon,
              testId: "fontSize-medium",
              active: isMedium ? true : undefined, //zsviczian
            },
            {
              value: 28,
              text: `${t("labels.large")}\nSHIFT: zoomed, ALT/OPT: Fibonacci`, //zsviczian
              icon: FontSizeLargeIcon,
              testId: "fontSize-large",
              active: isLarge ? true : undefined, //zsviczian
            },
            {
              value: 36,
              text: `${t(
                "labels.veryLarge",
              )}\nSHIFT: zoomed, ALT/OPT: Fibonacci`, //zsviczian
              icon: FontSizeExtraLargeIcon,
              testId: "fontSize-veryLarge",
              active: isVeryLarge ? true : undefined, //zsviczian
            },
          ]}
          value={getFormValue(
            elements,
            app,
            (element) => {
              if (isTextElement(element)) {
                return element.fontSize;
              }
              const boundTextElement = getBoundTextElement(
                element,
                app.scene.getNonDeletedElementsMap(),
              );
              if (boundTextElement) {
                return boundTextElement.fontSize;
              }
              return null;
            },
            (element) =>
              isTextElement(element) ||
              getBoundTextElement(
                element,
                app.scene.getNonDeletedElementsMap(),
              ) !== null,
            (hasSelection) =>
              hasSelection
                ? null
                : appState.currentItemFontSize || DEFAULT_FONT_SIZE,
          )}
          //zsviczian onClick
          onClick={(
            value: number,
            event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
          ) => {
            scaleFontSize = event.shiftKey;
            useFibonacci = event.altKey;
            updateData(getFontSize(value, appState.zoom.value));
          }}
          //onChange={(value) => updateData(value)} //zsviczian
        />
      </fieldset>
    );
  },
});

export const actionDecreaseFontSize = register({
  name: "decreaseFontSize",
  label: "labels.decreaseFontSize",
  icon: fontSizeIcon,
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return changeFontSize(elements, appState, app, (element) =>
      Math.round(
        // get previous value before relative increase (doesn't work fully
        // due to rounding and float precision issues)
        (1 / (1 + FONT_SIZE_RELATIVE_INCREASE_STEP)) * element.fontSize,
      ),
    );
  },
  keyTest: (event) => {
    return (
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      // KEYS.COMMA needed for MacOS
      (event.key === KEYS.CHEVRON_LEFT || event.key === KEYS.COMMA)
    );
  },
});

export const actionIncreaseFontSize = register({
  name: "increaseFontSize",
  label: "labels.increaseFontSize",
  icon: fontSizeIcon,
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return changeFontSize(elements, appState, app, (element) =>
      Math.round(element.fontSize * (1 + FONT_SIZE_RELATIVE_INCREASE_STEP)),
    );
  },
  keyTest: (event) => {
    return (
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      // KEYS.PERIOD needed for MacOS
      (event.key === KEYS.CHEVRON_RIGHT || event.key === KEYS.PERIOD)
    );
  },
});

type ChangeFontFamilyData = Partial<
  Pick<
    AppState,
    "openPopup" | "currentItemFontFamily" | "currentHoveredFontFamily"
  >
> & {
  /** cache of selected & editing elements populated on opened popup */
  cachedElements?: ElementsMap;
  /** flag to reset all elements to their cached versions  */
  resetAll?: true;
  /** flag to reset all containers to their cached versions */
  resetContainers?: true;
};

export const actionChangeFontFamily = register({
  name: "changeFontFamily",
  label: "labels.fontFamily",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const { cachedElements, resetAll, resetContainers, ...nextAppState } =
      value as ChangeFontFamilyData;

    if (resetAll) {
      const nextElements = changeProperty(
        elements,
        appState,
        (element) => {
          const cachedElement = cachedElements?.get(element.id);
          if (cachedElement) {
            const newElement = newElementWith(element, {
              ...cachedElement,
            });

            return newElement;
          }

          return element;
        },
        true,
      );

      return {
        elements: nextElements,
        appState: {
          ...appState,
          ...nextAppState,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      };
    }

    const { currentItemFontFamily, currentHoveredFontFamily } = value;

    let nextCaptureUpdateAction: CaptureUpdateActionType =
      CaptureUpdateAction.EVENTUALLY;
    let nextFontFamily: FontFamilyValues | undefined;
    let skipOnHoverRender = false;

    if (currentItemFontFamily) {
      nextFontFamily = currentItemFontFamily;
      nextCaptureUpdateAction = CaptureUpdateAction.IMMEDIATELY;
    } else if (currentHoveredFontFamily) {
      nextFontFamily = currentHoveredFontFamily;
      nextCaptureUpdateAction = CaptureUpdateAction.EVENTUALLY;

      const selectedTextElements = getSelectedElements(elements, appState, {
        includeBoundTextElement: true,
      }).filter((element) => isTextElement(element));

      // skip on hover re-render for more than 200 text elements or for text element with more than 5000 chars combined
      if (selectedTextElements.length > 200) {
        skipOnHoverRender = true;
      } else {
        let i = 0;
        let textLengthAccumulator = 0;

        while (
          i < selectedTextElements.length &&
          textLengthAccumulator < 5000
        ) {
          const textElement = selectedTextElements[i] as ExcalidrawTextElement;
          textLengthAccumulator += textElement?.originalText.length || 0;
          i++;
        }

        if (textLengthAccumulator > 5000) {
          skipOnHoverRender = true;
        }
      }
    }

    const result = {
      appState: {
        ...appState,
        ...nextAppState,
      },
      captureUpdate: nextCaptureUpdateAction,
    };

    if (nextFontFamily && !skipOnHoverRender) {
      const elementContainerMapping = new Map<
        ExcalidrawTextElement,
        ExcalidrawElement | null
      >();
      let uniqueChars = new Set<string>();
      let skipFontFaceCheck = false;

      const fontsCache = Array.from(Fonts.loadedFontsCache.values());
      const fontFamily = Object.entries(FONT_FAMILY).find(
        ([_, value]) => value === nextFontFamily,
      )?.[0];

      // skip `document.font.check` check on hover, if at least one font family has loaded as it's super slow (could result in slightly different bbox, which is fine)
      if (
        currentHoveredFontFamily &&
        fontFamily &&
        fontsCache.some((sig) => sig.startsWith(fontFamily))
      ) {
        skipFontFaceCheck = true;
      }

      // following causes re-render so make sure we changed the family
      // otherwise it could cause unexpected issues, such as preventing opening the popover when in wysiwyg
      Object.assign(result, {
        elements: changeProperty(
          elements,
          appState,
          (oldElement) => {
            if (
              isTextElement(oldElement) &&
              (oldElement.fontFamily !== nextFontFamily ||
                currentItemFontFamily) // force update on selection
            ) {
              const newElement: ExcalidrawTextElement = newElementWith(
                oldElement,
                {
                  fontFamily: nextFontFamily,
                  lineHeight: getLineHeight(nextFontFamily!),
                },
              );

              const cachedContainer =
                cachedElements?.get(oldElement.containerId || "") || {};

              const container = app.scene.getContainerElement(oldElement);

              if (resetContainers && container && cachedContainer) {
                // reset the container back to it's cached version
                app.scene.mutateElement(container, { ...cachedContainer });
              }

              if (!skipFontFaceCheck) {
                uniqueChars = new Set([
                  ...uniqueChars,
                  ...Array.from(newElement.originalText),
                ]);
              }

              elementContainerMapping.set(newElement, container);

              return newElement;
            }

            return oldElement;
          },
          true,
        ),
      });

      // size is irrelevant, but necessary
      const fontString = `10px ${getFontFamilyString({
        fontFamily: nextFontFamily,
      })}`;
      const chars = Array.from(uniqueChars.values()).join();

      if (skipFontFaceCheck || window.document.fonts.check(fontString, chars)) {
        // we either skip the check (have at least one font face loaded) or do the check and find out all the font faces have loaded
        for (const [element, container] of elementContainerMapping) {
          // trigger synchronous redraw
          redrawTextBoundingBox(element, container, app.scene);
        }
      } else {
        // otherwise try to load all font faces for the given chars and redraw elements once our font faces loaded
        window.document.fonts.load(fontString, chars).then((fontFaces) => {
          for (const [element, container] of elementContainerMapping) {
            // use latest element state to ensure we don't have closure over an old instance in order to avoid possible race conditions (i.e. font faces load out-of-order while rapidly switching fonts)
            const latestElement = app.scene.getElement(element.id);
            const latestContainer = container
              ? app.scene.getElement(container.id)
              : null;

            if (latestElement) {
              // trigger async redraw
              redrawTextBoundingBox(
                latestElement as ExcalidrawTextElement,
                latestContainer,
                app.scene,
              );
            }
          }

          // trigger update once we've mutated all the elements, which also updates our cache
          app.fonts.onLoaded(fontFaces);
        });
      }
    }

    return result;
  },
  PanelComponent: ({ elements, appState, app, updateData }) => {
    const cachedElementsRef = useRef<ElementsMap>(new Map());
    const prevSelectedFontFamilyRef = useRef<number | null>(null);
    // relying on state batching as multiple `FontPicker` handlers could be called in rapid succession and we want to combine them
    const [batchedData, setBatchedData] = useState<ChangeFontFamilyData>({});
    const isUnmounted = useRef(true);

    const selectedFontFamily = useMemo(() => {
      const getFontFamily = (
        elementsArray: readonly ExcalidrawElement[],
        elementsMap: ElementsMap,
      ) =>
        getFormValue(
          elementsArray,
          app,
          (element) => {
            if (isTextElement(element)) {
              return element.fontFamily;
            }
            const boundTextElement = getBoundTextElement(element, elementsMap);
            if (boundTextElement) {
              return boundTextElement.fontFamily;
            }
            return null;
          },
          (element) =>
            isTextElement(element) ||
            getBoundTextElement(element, elementsMap) !== null,
          (hasSelection) =>
            hasSelection
              ? null
              : appState.currentItemFontFamily || DEFAULT_FONT_FAMILY,
        );

      // popup opened, use cached elements
      if (
        batchedData.openPopup === "fontFamily" &&
        appState.openPopup === "fontFamily"
      ) {
        return getFontFamily(
          Array.from(cachedElementsRef.current?.values() ?? []),
          cachedElementsRef.current,
        );
      }

      // popup closed, use all elements
      if (!batchedData.openPopup && appState.openPopup !== "fontFamily") {
        return getFontFamily(elements, app.scene.getNonDeletedElementsMap());
      }

      // popup props are not in sync, hence we are in the middle of an update, so keeping the previous value we've had
      return prevSelectedFontFamilyRef.current;
    }, [batchedData.openPopup, appState, elements, app]);

    useEffect(() => {
      prevSelectedFontFamilyRef.current = selectedFontFamily;
    }, [selectedFontFamily]);

    useEffect(() => {
      if (Object.keys(batchedData).length) {
        updateData(batchedData);
        // reset the data after we've used the data
        setBatchedData({});
      }
      // call update only on internal state changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batchedData]);

    useEffect(() => {
      isUnmounted.current = false;

      return () => {
        isUnmounted.current = true;
      };
    }, []);

    return (
      <fieldset>
        <legend>{t("labels.fontFamily")}</legend>
        <FontPicker
          isOpened={appState.openPopup === "fontFamily"}
          selectedFontFamily={selectedFontFamily}
          hoveredFontFamily={appState.currentHoveredFontFamily}
          onSelect={(fontFamily) => {
            setBatchedData({
              openPopup: null,
              currentHoveredFontFamily: null,
              currentItemFontFamily: fontFamily,
            });

            // defensive clear so immediate close won't abuse the cached elements
            cachedElementsRef.current.clear();
          }}
          onHover={(fontFamily) => {
            setBatchedData({
              currentHoveredFontFamily: fontFamily,
              cachedElements: new Map(cachedElementsRef.current),
              resetContainers: true,
            });
          }}
          onLeave={() => {
            setBatchedData({
              currentHoveredFontFamily: null,
              cachedElements: new Map(cachedElementsRef.current),
              resetAll: true,
            });
          }}
          onPopupChange={(open) => {
            if (open) {
              // open, populate the cache from scratch
              cachedElementsRef.current.clear();

              const { editingTextElement } = appState;

              // still check type to be safe
              if (editingTextElement?.type === "text") {
                // retrieve the latest version from the scene, as `editingTextElement` isn't mutated
                const latesteditingTextElement = app.scene.getElement(
                  editingTextElement.id,
                );

                // inside the wysiwyg editor
                cachedElementsRef.current.set(
                  editingTextElement.id,
                  newElementWith(
                    latesteditingTextElement || editingTextElement,
                    {},
                    true,
                  ),
                );
              } else {
                const selectedElements = getSelectedElements(
                  elements,
                  appState,
                  {
                    includeBoundTextElement: true,
                  },
                );

                for (const element of selectedElements) {
                  cachedElementsRef.current.set(
                    element.id,
                    newElementWith(element, {}, true),
                  );
                }
              }

              setBatchedData({
                openPopup: "fontFamily",
              });
            } else {
              // close, use the cache and clear it afterwards
              const data = {
                openPopup: null,
                currentHoveredFontFamily: null,
                cachedElements: new Map(cachedElementsRef.current),
                resetAll: true,
              } as ChangeFontFamilyData;

              if (isUnmounted.current) {
                // in case the component was unmounted by the parent, trigger the update directly
                updateData({ ...batchedData, ...data });
              } else {
                setBatchedData(data);
              }

              cachedElementsRef.current.clear();
            }
          }}
        />
      </fieldset>
    );
  },
});

export const actionChangeTextAlign = register({
  name: "changeTextAlign",
  label: "Change text alignment",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (isTextElement(oldElement)) {
            const newElement: ExcalidrawTextElement = newElementWith(
              oldElement,
              { textAlign: value },
            );
            redrawTextBoundingBox(
              newElement,
              app.scene.getContainerElement(oldElement),
              app.scene,
            );
            return newElement;
          }

          return oldElement;
        },
        true,
      ),
      appState: {
        ...appState,
        currentItemTextAlign: value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    return (
      <fieldset>
        <legend>{t("labels.textAlign")}</legend>
        <ButtonIconSelect<TextAlign | false>
          group="text-align"
          options={[
            {
              value: "left",
              text: t("labels.left"),
              icon: TextAlignLeftIcon,
              testId: "align-left",
            },
            {
              value: "center",
              text: t("labels.center"),
              icon: TextAlignCenterIcon,
              testId: "align-horizontal-center",
            },
            {
              value: "right",
              text: t("labels.right"),
              icon: TextAlignRightIcon,
              testId: "align-right",
            },
          ]}
          value={getFormValue(
            elements,
            app,
            (element) => {
              if (isTextElement(element)) {
                return element.textAlign;
              }
              const boundTextElement = getBoundTextElement(
                element,
                elementsMap,
              );
              if (boundTextElement) {
                return boundTextElement.textAlign;
              }
              return null;
            },
            (element) =>
              isTextElement(element) ||
              getBoundTextElement(element, elementsMap) !== null,
            (hasSelection) =>
              hasSelection ? null : appState.currentItemTextAlign,
          )}
          onChange={(value) => updateData(value)}
        />
      </fieldset>
    );
  },
});

export const actionChangeVerticalAlign = register({
  name: "changeVerticalAlign",
  label: "Change vertical alignment",
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (isTextElement(oldElement)) {
            const newElement: ExcalidrawTextElement = newElementWith(
              oldElement,
              { verticalAlign: value },
            );

            redrawTextBoundingBox(
              newElement,
              app.scene.getContainerElement(oldElement),
              app.scene,
            );
            return newElement;
          }

          return oldElement;
        },
        true,
      ),
      appState: {
        ...appState,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    return (
      <fieldset>
        <ButtonIconSelect<VerticalAlign | false>
          group="text-align"
          options={[
            {
              value: VERTICAL_ALIGN.TOP,
              text: t("labels.alignTop"),
              icon: <TextAlignTopIcon theme={appState.theme} />,
              testId: "align-top",
            },
            {
              value: VERTICAL_ALIGN.MIDDLE,
              text: t("labels.centerVertically"),
              icon: <TextAlignMiddleIcon theme={appState.theme} />,
              testId: "align-middle",
            },
            {
              value: VERTICAL_ALIGN.BOTTOM,
              text: t("labels.alignBottom"),
              icon: <TextAlignBottomIcon theme={appState.theme} />,
              testId: "align-bottom",
            },
          ]}
          value={getFormValue(
            elements,
            app,
            (element) => {
              if (isTextElement(element) && element.containerId) {
                return element.verticalAlign;
              }
              const boundTextElement = getBoundTextElement(
                element,
                app.scene.getNonDeletedElementsMap(),
              );
              if (boundTextElement) {
                return boundTextElement.verticalAlign;
              }
              return null;
            },
            (element) =>
              isTextElement(element) ||
              getBoundTextElement(
                element,
                app.scene.getNonDeletedElementsMap(),
              ) !== null,
            (hasSelection) => (hasSelection ? null : VERTICAL_ALIGN.MIDDLE),
          )}
          onChange={(value) => updateData(value)}
        />
      </fieldset>
    );
  },
});

export const actionChangeRoundness = register({
  name: "changeRoundness",
  label: "Change edge roundness",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isElbowArrow(el)) {
          return el;
        }

        return newElementWith(el, {
          roundness:
            value === "round"
              ? {
                  type: isUsingAdaptiveRadius(el.type)
                    ? ROUNDNESS.ADAPTIVE_RADIUS
                    : ROUNDNESS.PROPORTIONAL_RADIUS,
                }
              : null,
        });
      }),
      appState: {
        ...appState,
        currentItemRoundness: value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const targetElements = getTargetElements(
      getNonDeletedElements(elements),
      appState,
    );

    const hasLegacyRoundness = targetElements.some(
      (el) => el.roundness?.type === ROUNDNESS.LEGACY,
    );

    return (
      <fieldset>
        <legend>{t("labels.edges")}</legend>
        <ButtonIconSelect
          group="edges"
          options={[
            {
              value: "sharp",
              text: t("labels.sharp"),
              icon: EdgeSharpIcon,
            },
            {
              value: "round",
              text: t("labels.round"),
              icon: EdgeRoundIcon,
            },
          ]}
          value={getFormValue(
            elements,
            app,
            (element) =>
              hasLegacyRoundness ? null : element.roundness ? "round" : "sharp",
            (element) =>
              !isArrowElement(element) && element.hasOwnProperty("roundness"),
            (hasSelection) =>
              hasSelection ? null : appState.currentItemRoundness,
          )}
          onChange={(value) => updateData(value)}
        />
      </fieldset>
    );
  },
});

const getArrowheadOptions = (flip: boolean) => {
  return [
    {
      value: null,
      text: t("labels.arrowhead_none"),
      keyBinding: "q",
      icon: ArrowheadNoneIcon,
    },
    {
      value: "arrow",
      text: t("labels.arrowhead_arrow"),
      keyBinding: "w",
      icon: <ArrowheadArrowIcon flip={flip} />,
    },
    {
      value: "triangle",
      text: t("labels.arrowhead_triangle"),
      icon: <ArrowheadTriangleIcon flip={flip} />,
      keyBinding: "e",
    },
    {
      value: "triangle_outline",
      text: t("labels.arrowhead_triangle_outline"),
      icon: <ArrowheadTriangleOutlineIcon flip={flip} />,
      keyBinding: "r",
    },
    {
      value: "circle",
      text: t("labels.arrowhead_circle"),
      keyBinding: "a",
      icon: <ArrowheadCircleIcon flip={flip} />,
    },
    {
      value: "circle_outline",
      text: t("labels.arrowhead_circle_outline"),
      keyBinding: "s",
      icon: <ArrowheadCircleOutlineIcon flip={flip} />,
    },
    {
      value: "diamond",
      text: t("labels.arrowhead_diamond"),
      icon: <ArrowheadDiamondIcon flip={flip} />,
      keyBinding: "d",
    },
    {
      value: "diamond_outline",
      text: t("labels.arrowhead_diamond_outline"),
      icon: <ArrowheadDiamondOutlineIcon flip={flip} />,
      keyBinding: "f",
    },
    {
      value: "bar",
      text: t("labels.arrowhead_bar"),
      keyBinding: "z",
      icon: <ArrowheadBarIcon flip={flip} />,
    },
    {
      value: "crowfoot_one",
      text: t("labels.arrowhead_crowfoot_one"),
      icon: <ArrowheadCrowfootOneIcon flip={flip} />,
      keyBinding: "c",
    },
    {
      value: "crowfoot_many",
      text: t("labels.arrowhead_crowfoot_many"),
      icon: <ArrowheadCrowfootIcon flip={flip} />,
      keyBinding: "x",
    },
    {
      value: "crowfoot_one_or_many",
      text: t("labels.arrowhead_crowfoot_one_or_many"),
      icon: <ArrowheadCrowfootOneOrManyIcon flip={flip} />,
      keyBinding: "v",
    },
  ] as const;
};

export const actionChangeArrowhead = register({
  name: "changeArrowhead",
  label: "Change arrowheads",
  trackEvent: false,
  perform: (
    elements,
    appState,
    value: { position: "start" | "end"; type: Arrowhead },
  ) => {
    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isLinearElement(el)) {
          const { position, type } = value;

          if (position === "start") {
            const element: ExcalidrawLinearElement = newElementWith(el, {
              startArrowhead: type,
            });
            return element;
          } else if (position === "end") {
            const element: ExcalidrawLinearElement = newElementWith(el, {
              endArrowhead: type,
            });
            return element;
          }
        }

        return el;
      }),
      appState: {
        ...appState,
        [value.position === "start"
          ? "currentItemStartArrowhead"
          : "currentItemEndArrowhead"]: value.type,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const isRTL = getLanguage().rtl;

    return (
      <fieldset>
        <legend>{t("labels.arrowheads")}</legend>
        <div className="iconSelectList buttonList">
          <IconPicker
            label="arrowhead_start"
            options={getArrowheadOptions(!isRTL)}
            value={getFormValue<Arrowhead | null>(
              elements,
              app,
              (element) =>
                isLinearElement(element) && canHaveArrowheads(element.type)
                  ? element.startArrowhead
                  : appState.currentItemStartArrowhead,
              true,
              appState.currentItemStartArrowhead,
            )}
            onChange={(value) => updateData({ position: "start", type: value })}
            numberOfOptionsToAlwaysShow={4}
          />
          <IconPicker
            label="arrowhead_end"
            group="arrowheads"
            options={getArrowheadOptions(!!isRTL)}
            value={getFormValue<Arrowhead | null>(
              elements,
              app,
              (element) =>
                isLinearElement(element) && canHaveArrowheads(element.type)
                  ? element.endArrowhead
                  : appState.currentItemEndArrowhead,
              true,
              appState.currentItemEndArrowhead,
            )}
            onChange={(value) => updateData({ position: "end", type: value })}
            numberOfOptionsToAlwaysShow={4}
          />
        </div>
      </fieldset>
    );
  },
});

export const actionChangeArrowType = register({
  name: "changeArrowType",
  label: "Change arrow types",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const newElements = changeProperty(elements, appState, (el) => {
      if (!isArrowElement(el)) {
        return el;
      }
      let newElement = newElementWith(el, {
        roundness:
          value === ARROW_TYPE.round
            ? {
                type: ROUNDNESS.PROPORTIONAL_RADIUS,
              }
            : null,
        elbowed: value === ARROW_TYPE.elbow,
        points:
          value === ARROW_TYPE.elbow || el.elbowed
            ? [el.points[0], el.points[el.points.length - 1]]
            : el.points,
      });

      if (isElbowArrow(newElement)) {
        newElement.fixedSegments = null;

        const elementsMap = app.scene.getNonDeletedElementsMap();

        app.dismissLinearEditor();

        const startGlobalPoint =
          LinearElementEditor.getPointAtIndexGlobalCoordinates(
            newElement,
            0,
            elementsMap,
          );
        const endGlobalPoint =
          LinearElementEditor.getPointAtIndexGlobalCoordinates(
            newElement,
            -1,
            elementsMap,
          );
        const startHoveredElement =
          !newElement.startBinding &&
          getHoveredElementForBinding(
            tupleToCoors(startGlobalPoint),
            elements,
            elementsMap,
            appState.zoom,
            false,
            true,
          );
        const endHoveredElement =
          !newElement.endBinding &&
          getHoveredElementForBinding(
            tupleToCoors(endGlobalPoint),
            elements,
            elementsMap,
            appState.zoom,
            false,
            true,
          );
        const startElement = startHoveredElement
          ? startHoveredElement
          : newElement.startBinding &&
            (elementsMap.get(
              newElement.startBinding.elementId,
            ) as ExcalidrawBindableElement);
        const endElement = endHoveredElement
          ? endHoveredElement
          : newElement.endBinding &&
            (elementsMap.get(
              newElement.endBinding.elementId,
            ) as ExcalidrawBindableElement);

        const finalStartPoint = startHoveredElement
          ? bindPointToSnapToElementOutline(
              newElement,
              startHoveredElement,
              "start",
            )
          : startGlobalPoint;
        const finalEndPoint = endHoveredElement
          ? bindPointToSnapToElementOutline(
              newElement,
              endHoveredElement,
              "end",
            )
          : endGlobalPoint;

        startHoveredElement &&
          bindLinearElement(
            newElement,
            startHoveredElement,
            "start",
            app.scene,
          );
        endHoveredElement &&
          bindLinearElement(newElement, endHoveredElement, "end", app.scene);

        const startBinding =
          startElement && newElement.startBinding
            ? {
                // @ts-ignore TS cannot discern check above
                ...newElement.startBinding!,
                ...calculateFixedPointForElbowArrowBinding(
                  newElement,
                  startElement,
                  "start",
                ),
              }
            : null;
        const endBinding =
          endElement && newElement.endBinding
            ? {
                // @ts-ignore TS cannot discern check above
                ...newElement.endBinding,
                ...calculateFixedPointForElbowArrowBinding(
                  newElement,
                  endElement,
                  "end",
                ),
              }
            : null;

        newElement = {
          ...newElement,
          startBinding,
          endBinding,
          ...updateElbowArrowPoints(newElement, elementsMap, {
            points: [finalStartPoint, finalEndPoint].map(
              (p): LocalPoint =>
                pointFrom(p[0] - newElement.x, p[1] - newElement.y),
            ),
            startBinding,
            endBinding,
            fixedSegments: null,
          }),
        };

        LinearElementEditor.updateEditorMidPointsCache(
          newElement,
          elementsMap,
          app.state,
        );
      } else {
        const elementsMap = app.scene.getNonDeletedElementsMap();
        if (newElement.startBinding) {
          const startElement = elementsMap.get(
            newElement.startBinding.elementId,
          ) as ExcalidrawBindableElement;
          if (startElement) {
            bindLinearElement(newElement, startElement, "start", app.scene);
          }
        }
        if (newElement.endBinding) {
          const endElement = elementsMap.get(
            newElement.endBinding.elementId,
          ) as ExcalidrawBindableElement;
          if (endElement) {
            bindLinearElement(newElement, endElement, "end", app.scene);
          }
        }
      }

      return newElement;
    });

    const newState = {
      ...appState,
      currentItemArrowType: value,
    };

    // Change the arrow type and update any other state settings for
    // the arrow.
    const selectedId = appState.selectedLinearElement?.elementId;
    if (selectedId) {
      const selected = newElements.find((el) => el.id === selectedId);
      if (selected) {
        newState.selectedLinearElement = new LinearElementEditor(
          selected as ExcalidrawLinearElement,
          arrayToMap(elements),
        );
      }
    }

    return {
      elements: newElements,
      appState: newState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    return (
      <fieldset>
        <legend>{t("labels.arrowtypes")}</legend>
        <ButtonIconSelect
          group="arrowtypes"
          options={[
            {
              value: ARROW_TYPE.sharp,
              text: t("labels.arrowtype_sharp"),
              icon: sharpArrowIcon,
              testId: "sharp-arrow",
            },
            {
              value: ARROW_TYPE.round,
              text: t("labels.arrowtype_round"),
              icon: roundArrowIcon,
              testId: "round-arrow",
            },
            {
              value: ARROW_TYPE.elbow,
              text: t("labels.arrowtype_elbowed"),
              icon: elbowArrowIcon,
              testId: "elbow-arrow",
            },
          ]}
          value={getFormValue(
            elements,
            app,
            (element) => {
              if (isArrowElement(element)) {
                return element.elbowed
                  ? ARROW_TYPE.elbow
                  : element.roundness
                  ? ARROW_TYPE.round
                  : ARROW_TYPE.sharp;
              }

              return null;
            },
            (element) => isArrowElement(element),
            (hasSelection) =>
              hasSelection ? null : appState.currentItemArrowType,
          )}
          onChange={(value) => updateData(value)}
        />
      </fieldset>
    );
  },
});
