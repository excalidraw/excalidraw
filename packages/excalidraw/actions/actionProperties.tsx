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
  getLineHeight,
  isTransparent,
  reduceToCommonValue,
} from "@excalidraw/common";

import { canBecomePolygon, getNonDeletedElements } from "@excalidraw/element";

import {
  bindLinearElement,
  calculateFixedPointForElbowArrowBinding,
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
  isLineElement,
  isTextElement,
  isUsingAdaptiveRadius,
} from "@excalidraw/element";

import { hasStrokeColor } from "@excalidraw/element";

import {
  updateElbowArrowPoints,
  CaptureUpdateAction,
  toggleLinePolygonState,
} from "@excalidraw/element";

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
import { RadioSelection } from "../components/RadioSelection";
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

import {
  withCaretPositionPreservation,
  restoreCaretPosition,
} from "../hooks/useTextEditorFocus";

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
  perform: (elements, appState, value) => {
    return {
      ...(value.currentItemStrokeColor && {
        elements: changeProperty(
          elements,
          appState,
          (el) => {
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
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <>
      {appState.stylesPanelMode === "full" && (
        <h3 aria-hidden="true">{t("labels.stroke")}</h3>
      )}
      <ColorPicker
        topPicks={DEFAULT_ELEMENT_STROKE_PICKS}
        palette={DEFAULT_ELEMENT_STROKE_COLOR_PALETTE}
        type="elementStroke"
        label={t("labels.stroke")}
        color={getFormValue(
          elements,
          app,
          (element) => element.strokeColor,
          true,
          (hasSelection) =>
            !hasSelection ? appState.currentItemStrokeColor : null,
        )}
        onChange={(color) => updateData({ currentItemStrokeColor: color })}
        elements={elements}
        appState={appState}
        updateData={updateData}
        compactMode={
          appState.stylesPanelMode === "compact" ||
          appState.stylesPanelMode === "mobile"
        }
      />
    </>
  ),
});

export const actionChangeBackgroundColor = register({
  name: "changeBackgroundColor",
  label: "labels.changeBackground",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    if (!value.currentItemBackgroundColor) {
      return {
        appState: {
          ...appState,
          ...value,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    let nextElements;

    const selectedElements = app.scene.getSelectedElements(appState);
    const shouldEnablePolygon =
      !isTransparent(value.currentItemBackgroundColor) &&
      selectedElements.every(
        (el) => isLineElement(el) && canBecomePolygon(el.points),
      );

    if (shouldEnablePolygon) {
      const selectedElementsMap = arrayToMap(selectedElements);
      nextElements = elements.map((el) => {
        if (selectedElementsMap.has(el.id) && isLineElement(el)) {
          return newElementWith(el, {
            backgroundColor: value.currentItemBackgroundColor,
            ...toggleLinePolygonState(el, true),
          });
        }
        return el;
      });
    } else {
      nextElements = changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          backgroundColor: value.currentItemBackgroundColor,
        }),
      );
    }

    return {
      elements: nextElements,
      appState: {
        ...appState,
        ...value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <>
      {appState.stylesPanelMode === "full" && (
        <h3 aria-hidden="true">{t("labels.background")}</h3>
      )}
      <ColorPicker
        topPicks={DEFAULT_ELEMENT_BACKGROUND_PICKS}
        palette={DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE}
        type="elementBackground"
        label={t("labels.background")}
        color={getFormValue(
          elements,
          app,
          (element) => element.backgroundColor,
          true,
          (hasSelection) =>
            !hasSelection ? appState.currentItemBackgroundColor : null,
        )}
        onChange={(color) => updateData({ currentItemBackgroundColor: color })}
        elements={elements}
        appState={appState}
        updateData={updateData}
        compactMode={
          appState.stylesPanelMode === "compact" ||
          appState.stylesPanelMode === "mobile"
        }
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
        <div className="buttonList">
          <RadioSelection
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
        </div>
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
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <fieldset>
      <legend>{t("labels.strokeWidth")}</legend>
      <div className="buttonList">
        <RadioSelection
          group="stroke-width"
          options={[
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
      </div>
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
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <fieldset>
      <legend>{t("labels.sloppiness")}</legend>
      <div className="buttonList">
        <RadioSelection
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
      </div>
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
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <fieldset>
      <legend>{t("labels.strokeStyle")}</legend>
      <div className="buttonList">
        <RadioSelection
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
      </div>
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

export const actionChangeFontSize = register({
  name: "changeFontSize",
  label: "labels.fontSize",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return changeFontSize(elements, appState, app, () => value, value);
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <fieldset>
      <legend>{t("labels.fontSize")}</legend>
      <div className="buttonList">
        <RadioSelection
          group="font-size"
          options={[
            {
              value: 16,
              text: t("labels.small"),
              icon: FontSizeSmallIcon,
              testId: "fontSize-small",
            },
            {
              value: 20,
              text: t("labels.medium"),
              icon: FontSizeMediumIcon,
              testId: "fontSize-medium",
            },
            {
              value: 28,
              text: t("labels.large"),
              icon: FontSizeLargeIcon,
              testId: "fontSize-large",
            },
            {
              value: 36,
              text: t("labels.veryLarge"),
              icon: FontSizeExtraLargeIcon,
              testId: "fontSize-veryLarge",
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
          onChange={(value) => {
            withCaretPositionPreservation(
              () => updateData(value),
              appState.stylesPanelMode === "compact" ||
                appState.stylesPanelMode === "mobile",
              !!appState.editingTextElement,
              data?.onPreventClose,
            );
          }}
        />
      </div>
    </fieldset>
  ),
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
      <>
        {appState.stylesPanelMode === "full" && (
          <legend>{t("labels.fontFamily")}</legend>
        )}
        <FontPicker
          isOpened={appState.openPopup === "fontFamily"}
          selectedFontFamily={selectedFontFamily}
          hoveredFontFamily={appState.currentHoveredFontFamily}
          compactMode={appState.stylesPanelMode !== "full"}
          onSelect={(fontFamily) => {
            withCaretPositionPreservation(
              () => {
                setBatchedData({
                  openPopup: null,
                  currentHoveredFontFamily: null,
                  currentItemFontFamily: fontFamily,
                });
                // defensive clear so immediate close won't abuse the cached elements
                cachedElementsRef.current.clear();
              },
              appState.stylesPanelMode === "compact" ||
                appState.stylesPanelMode === "mobile",
              !!appState.editingTextElement,
            );
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
                ...batchedData,
                openPopup: "fontFamily",
              });
            } else {
              const fontFamilyData = {
                currentHoveredFontFamily: null,
                cachedElements: new Map(cachedElementsRef.current),
                resetAll: true,
              } as ChangeFontFamilyData;

              setBatchedData({
                ...fontFamilyData,
              });
              cachedElementsRef.current.clear();

              // Refocus text editor when font picker closes if we were editing text
              if (
                (appState.stylesPanelMode === "compact" ||
                  appState.stylesPanelMode === "mobile") &&
                appState.editingTextElement
              ) {
                restoreCaretPosition(null); // Just refocus without saved position
              }
            }
          }}
        />
      </>
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
  PanelComponent: ({ elements, appState, updateData, app, data }) => {
    const elementsMap = app.scene.getNonDeletedElementsMap();

    return (
      <fieldset>
        <legend>{t("labels.textAlign")}</legend>
        <div className="buttonList">
          <RadioSelection<TextAlign | false>
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
            onChange={(value) => {
              withCaretPositionPreservation(
                () => updateData(value),
                appState.stylesPanelMode === "compact" ||
                  appState.stylesPanelMode === "mobile",
                !!appState.editingTextElement,
                data?.onPreventClose,
              );
            }}
          />
        </div>
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
  PanelComponent: ({ elements, appState, updateData, app, data }) => {
    return (
      <fieldset>
        <div className="buttonList">
          <RadioSelection<VerticalAlign | false>
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
            onChange={(value) => {
              withCaretPositionPreservation(
                () => updateData(value),
                appState.stylesPanelMode === "compact" ||
                  appState.stylesPanelMode === "mobile",
                !!appState.editingTextElement,
                data?.onPreventClose,
              );
            }}
          />
        </div>
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
  PanelComponent: ({ elements, appState, updateData, app, renderAction }) => {
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
        <div className="buttonList">
          <RadioSelection
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
                hasLegacyRoundness
                  ? null
                  : element.roundness
                  ? "round"
                  : "sharp",
              (element) =>
                !isArrowElement(element) && element.hasOwnProperty("roundness"),
              (hasSelection) =>
                hasSelection ? null : appState.currentItemRoundness,
            )}
            onChange={(value) => updateData(value)}
          />
          {renderAction("togglePolygon")}
        </div>
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
      keyBinding: "x",
    },
    {
      value: "crowfoot_many",
      text: t("labels.arrowhead_crowfoot_many"),
      icon: <ArrowheadCrowfootIcon flip={flip} />,
      keyBinding: "c",
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

export const actionChangeArrowProperties = register({
  name: "changeArrowProperties",
  label: "Change arrow properties",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    // This action doesn't perform any changes directly
    // It's just a container for the arrow type and arrowhead actions
    return false;
  },
  PanelComponent: ({ elements, appState, updateData, app, renderAction }) => {
    return (
      <div className="selected-shape-actions">
        {renderAction("changeArrowhead")}
        {renderAction("changeArrowType")}
      </div>
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
        const startElement =
          newElement.startBinding &&
          (elementsMap.get(
            newElement.startBinding.elementId,
          ) as ExcalidrawBindableElement);
        const endElement =
          newElement.endBinding &&
          (elementsMap.get(
            newElement.endBinding.elementId,
          ) as ExcalidrawBindableElement);

        const startBinding =
          startElement && newElement.startBinding
            ? {
                // @ts-ignore TS cannot discern check above
                ...newElement.startBinding!,
                ...calculateFixedPointForElbowArrowBinding(
                  newElement,
                  startElement,
                  "start",
                  elementsMap,
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
                  elementsMap,
                ),
              }
            : null;

        newElement = {
          ...newElement,
          startBinding,
          endBinding,
          ...updateElbowArrowPoints(newElement, elementsMap, {
            points: [startGlobalPoint, endGlobalPoint].map(
              (p): LocalPoint =>
                pointFrom(p[0] - newElement.x, p[1] - newElement.y),
            ),
            startBinding,
            endBinding,
            fixedSegments: null,
          }),
        };
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
        <div className="buttonList">
          <RadioSelection
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
        </div>
      </fieldset>
    );
  },
});
