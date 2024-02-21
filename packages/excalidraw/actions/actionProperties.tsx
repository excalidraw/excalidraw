import { AppClassProperties, AppState, Primitive } from "../types";
import {
  DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_COLOR_PALETTE,
  DEFAULT_ELEMENT_STROKE_PICKS,
} from "../colors";
import { trackEvent } from "../analytics";
import { ButtonIconSelect } from "../components/ButtonIconSelect";
import { ColorPicker } from "../components/ColorPicker/ColorPicker";
import { IconPicker } from "../components/IconPicker";
import { showFourthFont } from "../components/App";
// TODO barnabasmolnar/editor-redesign
// TextAlignTopIcon, TextAlignBottomIcon,TextAlignMiddleIcon,
// ArrowHead icons
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
  FreedrawIcon,
  FontFamilyNormalIcon,
  FontFamilyCodeIcon,
  FontFamilyLocalFontIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  FillZigZagIcon,
  ArrowheadTriangleOutlineIcon,
  ArrowheadCircleOutlineIcon,
  ArrowheadDiamondIcon,
  ArrowheadDiamondOutlineIcon,
} from "../components/icons";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
  ROUNDNESS,
  STROKE_WIDTH,
  VERTICAL_ALIGN,
} from "../constants";
import {
  getNonDeletedElements,
  isTextElement,
  redrawTextBoundingBox,
} from "../element";
import { mutateElement, newElementWith } from "../element/mutateElement";
import {
  getBoundTextElement,
  getDefaultLineHeight,
} from "../element/textElement";
import {
  isBoundToContainer,
  isLinearElement,
  isUsingAdaptiveRadius,
} from "../element/typeChecks";
import {
  Arrowhead,
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  FontFamilyValues,
  TextAlign,
  VerticalAlign,
} from "../element/types";
import { getLanguage, t } from "../i18n";
import { KEYS } from "../keys";
import { randomInteger } from "../random";
import {
  canHaveArrowheads,
  getCommonAttributeOfSelectedElements,
  getSelectedElements,
  getTargetElements,
  isSomeElementSelected,
} from "../scene";
import { hasStrokeColor } from "../scene/comparisons";
import { arrayToMap, getShortcutKey } from "../utils";
import { register } from "./register";

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
      element.id === appState.editingElement?.id
    ) {
      return callback(element);
    }
    return element;
  });
};

export const getFormValue = function <T extends Primitive>(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  getAttribute: (element: ExcalidrawElement) => T,
  isRelevantElement: true | ((element: ExcalidrawElement) => boolean),
  defaultValue: T | ((isSomeElementSelected: boolean) => T),
): T {
  const editingElement = appState.editingElement;
  const nonDeletedElements = getNonDeletedElements(elements);

  let ret: T | null = null;

  if (editingElement) {
    ret = getAttribute(editingElement);
  }

  if (!ret) {
    const hasSelection = isSomeElementSelected(nonDeletedElements, appState);

    if (hasSelection) {
      ret =
        getCommonAttributeOfSelectedElements(
          isRelevantElement === true
            ? nonDeletedElements
            : nonDeletedElements.filter((el) => isRelevantElement(el)),
          appState,
          getAttribute,
        ) ??
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
) => {
  if (isBoundToContainer(nextElement)) {
    return nextElement;
  }
  return mutateElement(
    nextElement,
    {
      x:
        prevElement.textAlign === "left"
          ? prevElement.x
          : prevElement.x +
            (prevElement.width - nextElement.width) /
              (prevElement.textAlign === "center" ? 2 : 1),
      // centering vertically is non-standard, but for Excalidraw I think
      // it makes sense
      y: prevElement.y + (prevElement.height - nextElement.height) / 2,
    },
    false,
  );
};

const changeFontSize = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
  getNewFontSize: (element: ExcalidrawTextElement) => number,
  fallbackValue?: ExcalidrawTextElement["fontSize"],
) => {
  const newFontSizes = new Set<number>();

  return {
    elements: changeProperty(
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
            app.scene.getNonDeletedElementsMap(),
          );

          newElement = offsetElementAfterFontResize(oldElement, newElement);

          return newElement;
        }

        return oldElement;
      },
      true,
    ),
    appState: {
      ...appState,
      // update state only if we've set all select text elements to
      // the same font size
      currentItemFontSize:
        newFontSizes.size === 1
          ? [...newFontSizes][0]
          : fallbackValue ?? appState.currentItemFontSize,
    },
    commitToHistory: true,
  };
};

// -----------------------------------------------------------------------------

export const actionChangeStrokeColor = register({
  name: "changeStrokeColor",
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
      commitToHistory: !!value.currentItemStrokeColor,
    };
  },
  PanelComponent: ({ elements, appState, updateData, appProps }) => (
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
          appState,
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
      commitToHistory: !!value.currentItemBackgroundColor,
    };
  },
  PanelComponent: ({ elements, appState, updateData, appProps }) => (
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
          appState,
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
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
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
            appState,
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
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeWidth: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeWidth: value },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
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
          appState,
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
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
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
          appState,
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
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeStyle: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeStyle: value },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
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
          appState,
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
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <label className="control-label">
      {t("labels.opacity")}
      <input
        type="range"
        min="0"
        max="100"
        step="10"
        onChange={(event) => updateData(+event.target.value)}
        value={
          getFormValue(
            elements,
            appState,
            (element) => element.opacity,
            true,
            appState.currentItemOpacity,
          ) ?? undefined
        }
      />
    </label>
  ),
});

let scaleFontSize = false; //zsviczian
let useFibonacci = false; //zsviczian
//zsviczian
//with a random noise of +-0.05 to avoid duplicates
const fibonacciValues = [
  [177.38,109.63,67.75,41.9,25.91,16,9.9,6.14,3.83,2.29,1.47,0.9,0.57],
  [287.06,177.43,109.64,67.73,41.92,26,16.01,9.92,6.1,3.75,2.34,1.41,0.87],
  [464.44,287.11,177.44,109.65,67.76,42,25.9,15.97,9.93,6.12,3.82,2.3,1.46],
  [751.52,464.45,287.08,177.42,109.67,68,41.89,25.93,15.99,9.88,6.07,3.77,2.35]
]

//zsviczian
const normalValues = [
  [182.22,121.46,80,53,35.99,23.96,16,10.68,7.1,4.74,3.16,2.11,1.45,0.97,0.66],
  [227.82,151.88,101.25,67.51,44.95,29.98,20,13.31,8.85,5.97,3.95,2.68,1.77,1.19,0.82],
  [318.96,212.59,141.8,94.51,62.98,42.01,28,18.63,12.45,8.26,5.52,3.7,2.47,1.61,1.07],
  [410.02,273.42,182.28,121.5,81,54,36,24.01,16.05,10.69,7.13,4.78,3.12,2.07,1.38]
]

//zsviczian
const valueToIndex: { [key: number]: number }  = {
  16: 0,
  20: 1,
  28: 2,
  36: 3,
};

//zsviczian
const getFibonacciFontSize = (zoom:number, buttonValue:number):number => {
  const index = valueToIndex[buttonValue];
  if(typeof index !== "number") return buttonValue;
  const range = [
    [0,0.12],
    [0.12,0.19],
    [0.19,0.31],
    [0.31,0.5],
    [0.5,0.81],
    [0.81,1.31],
    [1.31,2.12],
    [2.12,3.43],
    [3.43,5.54],
    [5.54,8.97],
    [8.97,14.52],
    [14.52,23.49],
    [23.49,100]
  ];
  for (let i = 0; i < range.length; i++) {
    const [from, to] = range[i];
    if (zoom >= from && zoom < to) {
      return fibonacciValues[index][i];
      break;
    }
  }
  return buttonValue;
}

//zsviczian
const getScaledFontSize = (zoom:number, buttonValue:number):number => {
  const index = valueToIndex[buttonValue];
  if(typeof index !== "number") return buttonValue;
  const range = [
    [0,0.11],
    [0.11,0.16],
    [0.16,0.25],
    [0.25,0.37],
    [0.37,0.56],
    [0.56,0.83],
    [0.83,1.25],
    [1.25,1.88],
    [1.88,2.81],
    [2.81,4.22],
    [4.22,6.33],
    [6.33,9.49],
    [9.49,14.24],
    [14.24,21.36],
    [21.36,100],    
  ];
  for (let i = 0; i < range.length; i++) {
    const [from, to] = range[i];
    if (zoom >= from && zoom < to) {
      return normalValues[index][i];
      break;
    }
  }
  return buttonValue;
}

//zsviczian
const findIndex = (values: number[][], value: number):number|null => {
  for (let i = 0; i < values.length; i++) {
    const idx = values[i].indexOf(value);
    if (idx !== -1) {
      return i;
    }
  }
  return null;
};

//zsviczian
export const getFontSize = (size:number, zoom: number):number => {
  zoom = scaleFontSize ? zoom : 1;
  let normalizedSizeIdx = findIndex(fibonacciValues, size);
  if(!normalizedSizeIdx) {
    normalizedSizeIdx = findIndex(normalValues, size);
  }
  if(normalizedSizeIdx === null) return size;
  size = [16,20,28,36][normalizedSizeIdx];
  const nextValue = useFibonacci
    ? getFibonacciFontSize(zoom, size)
    : getScaledFontSize(zoom, size);
  return nextValue??size;
}

export const actionChangeFontSize = register({
  name: "changeFontSize",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return changeFontSize(elements, appState, app, () => value, value);
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    //zsviczian
    let selectedElements = getSelectedElements(elements, appState).filter(el=>isTextElement(el)) as ExcalidrawTextElement[];
    if(selectedElements.length === 0) {
      selectedElements = (
        appState.editingElement?.type === "text" ? [appState.editingElement] : []
      ) as ExcalidrawTextElement[];
    }
    const size = selectedElements[0]?.fontSize;
    let idx:number|null = null;
    if (size && selectedElements.every(el=>el.fontSize===size)) {
      idx = findIndex(normalValues, size);
      if (idx === null) {
        idx = findIndex(fibonacciValues, size);
      }
    }
    const isSmall = idx === 0;
    const isMedium = idx === 1;
    const isLarge = idx === 2;
    const isVeryLarge = idx === 3;

    return ( //zsviczian
    <fieldset>
      <legend>{t("labels.fontSize")}</legend>
      <ButtonIconSelect
        type="button" //zsviczian
        //group="font-size" //zsviczian
        options={[
          {
            value: 16,
            text: t("labels.small") + "\nSHIFT: zoomed, ALT/OPT: Fibonacci", //zsviczian
            icon: FontSizeSmallIcon,
            testId: "fontSize-small",
            active: isSmall ? true : undefined, //zsviczian
          },
          {
            value: 20,
            text: t("labels.medium") + "\nSHIFT: zoomed, ALT/OPT: Fibonacci", //zsviczian
            icon: FontSizeMediumIcon,
            testId: "fontSize-medium",
            active: isMedium ? true : undefined, //zsviczian
          },
          {
            value: 28,
            text: t("labels.large") + "\nSHIFT: zoomed, ALT/OPT: Fibonacci", //zsviczian
            icon: FontSizeLargeIcon,
            testId: "fontSize-large",
            active: isLarge ? true : undefined, //zsviczian
          },
          {
            value: 36,
            text: t("labels.veryLarge") + "\nSHIFT: zoomed, ALT/OPT: Fibonacci", //zsviczian
            icon: FontSizeExtraLargeIcon,
            testId: "fontSize-veryLarge",
            active: isVeryLarge ? true : undefined, //zsviczian
          },
        ]}
        value={getFormValue(
          elements,
          appState,
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
        onClick={(value:number, event:React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          scaleFontSize = event.shiftKey;
          useFibonacci = event.altKey;
          updateData(getFontSize(value, appState.zoom.value));
        }}
        //onChange={(value) => updateData(value)} //zsviczian
      />
    </fieldset>
  )},
});

export const actionDecreaseFontSize = register({
  name: "decreaseFontSize",
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

export const actionChangeFontFamily = register({
  name: "changeFontFamily",
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
              {
                fontFamily: value,
                lineHeight: getDefaultLineHeight(value),
              },
            );
            redrawTextBoundingBox(
              newElement,
              app.scene.getContainerElement(oldElement),
              app.scene.getNonDeletedElementsMap(),
            );
            return newElement;
          }

          return oldElement;
        },
        true,
      ),
      appState: {
        ...appState,
        currentItemFontFamily: value,
      },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const options: {
      value: FontFamilyValues;
      text: string;
      icon: JSX.Element;
      testId: string;
    }[] = [
      {
        value: FONT_FAMILY.Virgil,
        text: t("labels.handDrawn"),
        icon: FreedrawIcon,
        testId: "font-family-virgil",
      },
      {
        value: FONT_FAMILY.Helvetica,
        text: t("labels.normal"),
        icon: FontFamilyNormalIcon,
        testId: "font-family-normal",
      },
      {
        value: FONT_FAMILY.Cascadia,
        text: t("labels.code"),
        icon: FontFamilyCodeIcon,
        testId: "font-family-code",
      },
      ...(showFourthFont
        ? [
            {
              value: FONT_FAMILY.LocalFont,
              text: t("labels.localFont"),
              icon: FontFamilyLocalFontIcon,
              testId: "font-family-fourth",
            },
          ]
        : []),
    ];

    return (
      <fieldset>
        <legend>{t("labels.fontFamily")}</legend>
        <ButtonIconSelect<FontFamilyValues | false>
          group="font-family"
          options={options}
          value={getFormValue(
            elements,
            appState,
            (element) => {
              if (isTextElement(element)) {
                return element.fontFamily;
              }
              const boundTextElement = getBoundTextElement(
                element,
                app.scene.getNonDeletedElementsMap(),
              );
              if (boundTextElement) {
                return boundTextElement.fontFamily;
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
                : appState.currentItemFontFamily || DEFAULT_FONT_FAMILY,
          )}
          onChange={(value) => updateData(value)}
        />
      </fieldset>
    );
  },
});

export const actionChangeTextAlign = register({
  name: "changeTextAlign",
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
              app.scene.getNonDeletedElementsMap(),
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
      commitToHistory: true,
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
            appState,
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
              app.scene.getNonDeletedElementsMap(),
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
      commitToHistory: true,
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
            appState,
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
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          roundness:
            value === "round"
              ? {
                  type: isUsingAdaptiveRadius(el.type)
                    ? ROUNDNESS.ADAPTIVE_RADIUS
                    : ROUNDNESS.PROPORTIONAL_RADIUS,
                }
              : null,
        }),
      ),
      appState: {
        ...appState,
        currentItemRoundness: value,
      },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
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
            appState,
            (element) =>
              hasLegacyRoundness ? null : element.roundness ? "round" : "sharp",
            (element) => element.hasOwnProperty("roundness"),
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
      value: "bar",
      text: t("labels.arrowhead_bar"),
      keyBinding: "e",
      icon: <ArrowheadBarIcon flip={flip} />,
    },
    {
      value: "dot",
      text: t("labels.arrowhead_circle"),
      keyBinding: null,
      icon: <ArrowheadCircleIcon flip={flip} />,
      showInPicker: false,
    },
    {
      value: "circle",
      text: t("labels.arrowhead_circle"),
      keyBinding: "r",
      icon: <ArrowheadCircleIcon flip={flip} />,
      showInPicker: false,
    },
    {
      value: "circle_outline",
      text: t("labels.arrowhead_circle_outline"),
      keyBinding: null,
      icon: <ArrowheadCircleOutlineIcon flip={flip} />,
      showInPicker: false,
    },
    {
      value: "triangle",
      text: t("labels.arrowhead_triangle"),
      icon: <ArrowheadTriangleIcon flip={flip} />,
      keyBinding: "t",
    },
    {
      value: "triangle_outline",
      text: t("labels.arrowhead_triangle_outline"),
      icon: <ArrowheadTriangleOutlineIcon flip={flip} />,
      keyBinding: null,
      showInPicker: false,
    },
    {
      value: "diamond",
      text: t("labels.arrowhead_diamond"),
      icon: <ArrowheadDiamondIcon flip={flip} />,
      keyBinding: null,
      showInPicker: false,
    },
    {
      value: "diamond_outline",
      text: t("labels.arrowhead_diamond_outline"),
      icon: <ArrowheadDiamondOutlineIcon flip={flip} />,
      keyBinding: null,
      showInPicker: false,
    },
  ] as const;
};

export const actionChangeArrowhead = register({
  name: "changeArrowhead",
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
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
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
              appState,
              (element) =>
                isLinearElement(element) && canHaveArrowheads(element.type)
                  ? element.startArrowhead
                  : appState.currentItemStartArrowhead,
              true,
              appState.currentItemStartArrowhead,
            )}
            onChange={(value) => updateData({ position: "start", type: value })}
          />
          <IconPicker
            label="arrowhead_end"
            group="arrowheads"
            options={getArrowheadOptions(!!isRTL)}
            value={getFormValue<Arrowhead | null>(
              elements,
              appState,
              (element) =>
                isLinearElement(element) && canHaveArrowheads(element.type)
                  ? element.endArrowhead
                  : appState.currentItemEndArrowhead,
              true,
              appState.currentItemEndArrowhead,
            )}
            onChange={(value) => updateData({ position: "end", type: value })}
          />
        </div>
      </fieldset>
    );
  },
});
