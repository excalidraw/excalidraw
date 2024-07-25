import { useEffect, useMemo, useRef, useState } from "react";
import type { AppClassProperties, AppState, Primitive } from "../types";
import type { StoreActionType } from "../store";
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
import { FontPicker } from "../components/FontPicker/FontPicker";
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
import { getBoundTextElement } from "../element/textElement";
import {
  isBoundToContainer,
  isLinearElement,
  isUsingAdaptiveRadius,
} from "../element/typeChecks";
import type {
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
import { arrayToMap, getFontFamilyString, getShortcutKey } from "../utils";
import { register } from "./register";
import { StoreAction } from "../store";
import { Fonts, getLineHeight } from "../fonts";

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
  if (isBoundToContainer(nextElement) || !nextElement.autoResize) {
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
    storeAction: StoreAction.CAPTURE,
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
      storeAction: !!value.currentItemStrokeColor
        ? StoreAction.CAPTURE
        : StoreAction.NONE,
    };
  },
  PanelComponent: ({ elements, appState, updateData, appProps }) => (
    <>
      <h3 aria-hidden="true">{t("labels.stroke")}</h3>
      <ColorPicker
        topPicks={DEFAULT_ELEMENT_STROKE_PICKS}
        palette={DEFAULT_ELEMENT_STROKE_COLOR_PALETTE}
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
      storeAction: !!value.currentItemBackgroundColor
        ? StoreAction.CAPTURE
        : StoreAction.NONE,
    };
  },
  PanelComponent: ({ elements, appState, updateData, appProps }) => (
    <>
      <h3 aria-hidden="true">{t("labels.background")}</h3>
      <ColorPicker
        topPicks={DEFAULT_ELEMENT_BACKGROUND_PICKS}
        palette={DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE}
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
      storeAction: StoreAction.CAPTURE,
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
      storeAction: StoreAction.CAPTURE,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <fieldset>
      <legend>{t("labels.strokeWidth")}</legend>
      <ButtonIconSelect
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
      storeAction: StoreAction.CAPTURE,
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
      storeAction: StoreAction.CAPTURE,
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
      storeAction: StoreAction.CAPTURE,
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

export const actionChangeFontSize = register({
  name: "changeFontSize",
  label: "labels.fontSize",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return changeFontSize(elements, appState, app, () => value, value);
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <fieldset>
      <legend>{t("labels.fontSize")}</legend>
      <ButtonIconSelect
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
        onChange={(value) => updateData(value)}
      />
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
  cachedElements?: Map<string, ExcalidrawElement>;
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
        storeAction: StoreAction.UPDATE,
      };
    }

    const { currentItemFontFamily, currentHoveredFontFamily } = value;

    let nexStoreAction: StoreActionType = StoreAction.NONE;
    let nextFontFamily: FontFamilyValues | undefined;
    let skipOnHoverRender = false;

    if (currentItemFontFamily) {
      nextFontFamily = currentItemFontFamily;
      nexStoreAction = StoreAction.CAPTURE;
    } else if (currentHoveredFontFamily) {
      nextFontFamily = currentHoveredFontFamily;
      nexStoreAction = StoreAction.NONE;

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
      storeAction: nexStoreAction,
    };

    if (nextFontFamily && !skipOnHoverRender) {
      const elementContainerMapping = new Map<
        ExcalidrawTextElement,
        ExcalidrawElement | null
      >();
      let uniqueGlyphs = new Set<string>();
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
                mutateElement(container, { ...cachedContainer }, false);
              }

              if (!skipFontFaceCheck) {
                uniqueGlyphs = new Set([
                  ...uniqueGlyphs,
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
      const glyphs = Array.from(uniqueGlyphs.values()).join();

      if (
        skipFontFaceCheck ||
        window.document.fonts.check(fontString, glyphs)
      ) {
        // we either skip the check (have at least one font face loaded) or do the check and find out all the font faces have loaded
        for (const [element, container] of elementContainerMapping) {
          // trigger synchronous redraw
          redrawTextBoundingBox(
            element,
            container,
            app.scene.getNonDeletedElementsMap(),
            false,
          );
        }
      } else {
        // otherwise try to load all font faces for the given glyphs and redraw elements once our font faces loaded
        window.document.fonts.load(fontString, glyphs).then((fontFaces) => {
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
                app.scene.getNonDeletedElementsMap(),
                false,
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
    const cachedElementsRef = useRef<Map<string, ExcalidrawElement>>(new Map());
    const prevSelectedFontFamilyRef = useRef<number | null>(null);
    // relying on state batching as multiple `FontPicker` handlers could be called in rapid succession and we want to combine them
    const [batchedData, setBatchedData] = useState<ChangeFontFamilyData>({});
    const isUnmounted = useRef(true);

    const selectedFontFamily = useMemo(() => {
      const getFontFamily = (
        elementsArray: readonly ExcalidrawElement[],
        elementsMap: Map<string, ExcalidrawElement>,
      ) =>
        getFormValue(
          elementsArray,
          appState,
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
    }, [batchedData.openPopup, appState, elements, app.scene]);

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

              const { editingElement } = appState;

              if (editingElement?.type === "text") {
                // retrieve the latest version from the scene, as `editingElement` isn't mutated
                const latestEditingElement = app.scene.getElement(
                  editingElement.id,
                );

                // inside the wysiwyg editor
                cachedElementsRef.current.set(
                  editingElement.id,
                  newElementWith(
                    latestEditingElement || editingElement,
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
      storeAction: StoreAction.CAPTURE,
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
      storeAction: StoreAction.CAPTURE,
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
  label: "Change edge roundness",
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
      storeAction: StoreAction.CAPTURE,
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
      storeAction: StoreAction.CAPTURE,
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
