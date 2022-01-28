import { AppState } from "../../src/types";
import { ButtonIconSelect } from "../components/ButtonIconSelect";
import { ColorPicker } from "../components/ColorPicker";
import { IconPicker } from "../components/IconPicker";
import { showFourthFont } from "../components/App";
import {
  ArrowheadArrowIcon,
  ArrowheadBarIcon,
  ArrowheadDotIcon,
  ArrowheadTriangleIcon,
  ArrowheadNoneIcon,
  EdgeRoundIcon,
  EdgeSharpIcon,
  FillCrossHatchIcon,
  FillHachureIcon,
  FillSolidIcon,
  FontFamilyCodeIcon,
  FontFamilyHandDrawnIcon,
  FontFamilyNormalIcon,
  FontFamilyLocalFontIcon,
  FontSizeExtraLargeIcon,
  FontSizeLargeIcon,
  FontSizeMediumIcon,
  FontSizeSmallIcon,
  SloppinessArchitectIcon,
  SloppinessArtistIcon,
  SloppinessCartoonistIcon,
  StrokeStyleDashedIcon,
  StrokeStyleDottedIcon,
  StrokeStyleSolidIcon,
  StrokeWidthIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from "../components/icons";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
} from "../constants";
import {
  getNonDeletedElements,
  isTextElement,
  redrawTextBoundingBox,
} from "../element";
import { mutateElement, newElementWith } from "../element/mutateElement";
import {
  getBoundTextElement,
  getContainerElement,
} from "../element/textElement";
import {
  isBoundToContainer,
  isLinearElement,
  isLinearElementType,
} from "../element/typeChecks";
import {
  Arrowhead,
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  FontFamilyValues,
  TextAlign,
} from "../element/types";
import { getLanguage, t } from "../i18n";
import { KEYS } from "../keys";
import { randomInteger } from "../random";
import {
  canChangeSharpness,
  canHaveArrowheads,
  getCommonAttributeOfSelectedElements,
  getSelectedElements,
  getTargetElements,
  isSomeElementSelected,
} from "../scene";
import { hasStrokeColor } from "../scene/comparisons";
import { arrayToMap } from "../utils";
import { register } from "./register";

const FONT_SIZE_RELATIVE_INCREASE_STEP = 0.1;

const changeProperty = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  callback: (element: ExcalidrawElement) => ExcalidrawElement,
  includeBoundText = false,
) => {
  const selectedElementIds = arrayToMap(
    getSelectedElements(elements, appState, includeBoundText),
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

const getFormValue = function <T>(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  getAttribute: (element: ExcalidrawElement) => T,
  defaultValue?: T,
): T | null {
  const editingElement = appState.editingElement;
  const nonDeletedElements = getNonDeletedElements(elements);
  return (
    (editingElement && getAttribute(editingElement)) ??
    (isSomeElementSelected(nonDeletedElements, appState)
      ? getCommonAttributeOfSelectedElements(
          nonDeletedElements,
          appState,
          getAttribute,
        )
      : defaultValue) ??
    null
  );
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
  getNewFontSize: (element: ExcalidrawTextElement) => number,
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
            getContainerElement(oldElement),
            appState,
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
          : appState.currentItemFontSize,
    },
    commitToHistory: true,
  };
};

// -----------------------------------------------------------------------------

export const actionChangeStrokeColor = register({
  name: "changeStrokeColor",
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
      commitToHistory: !!value.currentItemStrokeColor,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <>
      <h3 aria-hidden="true">{t("labels.stroke")}</h3>
      <ColorPicker
        type="elementStroke"
        label={t("labels.stroke")}
        color={getFormValue(
          elements,
          appState,
          (element) => element.strokeColor,
          appState.currentItemStrokeColor,
        )}
        onChange={(color) => updateData({ currentItemStrokeColor: color })}
        isActive={appState.openPopup === "strokeColorPicker"}
        setActive={(active) =>
          updateData({ openPopup: active ? "strokeColorPicker" : null })
        }
      />
    </>
  ),
});

export const actionChangeBackgroundColor = register({
  name: "changeBackgroundColor",
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
  PanelComponent: ({ elements, appState, updateData }) => (
    <>
      <h3 aria-hidden="true">{t("labels.background")}</h3>
      <ColorPicker
        type="elementBackground"
        label={t("labels.background")}
        color={getFormValue(
          elements,
          appState,
          (element) => element.backgroundColor,
          appState.currentItemBackgroundColor,
        )}
        onChange={(color) => updateData({ currentItemBackgroundColor: color })}
        isActive={appState.openPopup === "backgroundColorPicker"}
        setActive={(active) =>
          updateData({ openPopup: active ? "backgroundColorPicker" : null })
        }
      />
    </>
  ),
});

export const actionChangeFillStyle = register({
  name: "changeFillStyle",
  perform: (elements, appState, value) => {
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
  PanelComponent: ({ elements, appState, updateData }) => (
    <fieldset>
      <legend>{t("labels.fill")}</legend>
      <ButtonIconSelect
        options={[
          {
            value: "hachure",
            text: t("labels.hachure"),
            icon: <FillHachureIcon theme={appState.theme} />,
          },
          {
            value: "cross-hatch",
            text: t("labels.crossHatch"),
            icon: <FillCrossHatchIcon theme={appState.theme} />,
          },
          {
            value: "solid",
            text: t("labels.solid"),
            icon: <FillSolidIcon theme={appState.theme} />,
          },
        ]}
        group="fill"
        value={getFormValue(
          elements,
          appState,
          (element) => element.fillStyle,
          appState.currentItemFillStyle,
        )}
        onChange={(value) => {
          updateData(value);
        }}
      />
    </fieldset>
  ),
});

export const actionChangeStrokeWidth = register({
  name: "changeStrokeWidth",
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
            value: 0.5,
            text: t("labels.extraThin"),
            icon: <StrokeWidthIcon theme={appState.theme} strokeWidth={1} />,
          },
          {
            value: 1,
            text: t("labels.thin"),
            icon: <StrokeWidthIcon theme={appState.theme} strokeWidth={2} />,
          },
          {
            value: 2,
            text: t("labels.bold"),
            icon: <StrokeWidthIcon theme={appState.theme} strokeWidth={6} />,
          },
          {
            value: 4,
            text: t("labels.extraBold"),
            icon: <StrokeWidthIcon theme={appState.theme} strokeWidth={10} />,
          },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => element.strokeWidth,
          appState.currentItemStrokeWidth,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeSloppiness = register({
  name: "changeSloppiness",
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
            icon: <SloppinessArchitectIcon theme={appState.theme} />,
          },
          {
            value: 1,
            text: t("labels.artist"),
            icon: <SloppinessArtistIcon theme={appState.theme} />,
          },
          {
            value: 2,
            text: t("labels.cartoonist"),
            icon: <SloppinessCartoonistIcon theme={appState.theme} />,
          },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => element.roughness,
          appState.currentItemRoughness,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeStrokeStyle = register({
  name: "changeStrokeStyle",
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
            icon: <StrokeStyleSolidIcon theme={appState.theme} />,
          },
          {
            value: "dashed",
            text: t("labels.strokeStyle_dashed"),
            icon: <StrokeStyleDashedIcon theme={appState.theme} />,
          },
          {
            value: "dotted",
            text: t("labels.strokeStyle_dotted"),
            icon: <StrokeStyleDottedIcon theme={appState.theme} />,
          },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => element.strokeStyle,
          appState.currentItemStrokeStyle,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeOpacity = register({
  name: "changeOpacity",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          opacity: value,
        }),
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
        onWheel={(event) => {
          event.stopPropagation();
          const target = event.target as HTMLInputElement;
          const STEP = 10;
          const MAX = 100;
          const MIN = 0;
          const value = +target.value;

          if (event.deltaY < 0 && value < MAX) {
            updateData(value + STEP);
          } else if (event.deltaY > 0 && value > MIN) {
            updateData(value - STEP);
          }
        }}
        value={
          getFormValue(
            elements,
            appState,
            (element) => element.opacity,
            appState.currentItemOpacity,
          ) ?? undefined
        }
      />
    </label>
  ),
});

export const actionChangeFontSize = register({
  name: "changeFontSize",
  perform: (elements, appState, value) => {
    return changeFontSize(elements, appState, () => value);
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <fieldset>
      <legend>{t("labels.fontSize")}</legend>
      <ButtonIconSelect
        group="font-size"
        options={[
          {
            value: 16,
            text: t("labels.small"),
            icon: <FontSizeSmallIcon theme={appState.theme} />,
          },
          {
            value: 20,
            text: t("labels.medium"),
            icon: <FontSizeMediumIcon theme={appState.theme} />,
          },
          {
            value: 28,
            text: t("labels.large"),
            icon: <FontSizeLargeIcon theme={appState.theme} />,
          },
          {
            value: 36,
            text: t("labels.veryLarge"),
            icon: <FontSizeExtraLargeIcon theme={appState.theme} />,
          },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => {
            if (isTextElement(element)) {
              return element.fontSize;
            }
            const boundTextElement = getBoundTextElement(element);
            if (boundTextElement) {
              return boundTextElement.fontSize;
            }
            return null;
          },
          appState.currentItemFontSize || DEFAULT_FONT_SIZE,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionDecreaseFontSize = register({
  name: "decreaseFontSize",
  perform: (elements, appState, value) => {
    return changeFontSize(elements, appState, (element) =>
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
  perform: (elements, appState, value) => {
    return changeFontSize(elements, appState, (element) =>
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
  perform: (elements, appState, value) => {
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
              },
            );
            redrawTextBoundingBox(
              newElement,
              getContainerElement(oldElement),
              appState,
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
  PanelComponent: ({ elements, appState, updateData }) => {
    const options: {
      value: FontFamilyValues;
      text: string;
      icon: JSX.Element;
    }[] = [
      {
        value: FONT_FAMILY.Virgil,
        text: t("labels.handDrawn"),
        icon: <FontFamilyHandDrawnIcon theme={appState.theme} />,
      },
      {
        value: FONT_FAMILY.Helvetica,
        text: t("labels.normal"),
        icon: <FontFamilyNormalIcon theme={appState.theme} />,
      },
      {
        value: FONT_FAMILY.Cascadia,
        text: t("labels.code"),
        icon: <FontFamilyCodeIcon theme={appState.theme} />,
      },
      ...(showFourthFont
        ? [
            {
              value: FONT_FAMILY.LocalFont,
              text: t("labels.localFont"),
              icon: <FontFamilyLocalFontIcon theme={appState.theme} />,
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
              const boundTextElement = getBoundTextElement(element);
              if (boundTextElement) {
                return boundTextElement.fontFamily;
              }
              return null;
            },
            appState.currentItemFontFamily || DEFAULT_FONT_FAMILY,
          )}
          onChange={(value) => updateData(value)}
        />
      </fieldset>
    );
  },
});

export const actionChangeTextAlign = register({
  name: "changeTextAlign",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (isTextElement(oldElement)) {
            const newElement: ExcalidrawTextElement = newElementWith(
              oldElement,
              {
                textAlign: value,
              },
            );
            redrawTextBoundingBox(
              newElement,
              getContainerElement(oldElement),
              appState,
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
  PanelComponent: ({ elements, appState, updateData }) => (
    <fieldset>
      <legend>{t("labels.textAlign")}</legend>
      <ButtonIconSelect<TextAlign | false>
        group="text-align"
        options={[
          {
            value: "left",
            text: t("labels.left"),
            icon: <TextAlignLeftIcon theme={appState.theme} />,
          },
          {
            value: "center",
            text: t("labels.center"),
            icon: <TextAlignCenterIcon theme={appState.theme} />,
          },
          {
            value: "right",
            text: t("labels.right"),
            icon: <TextAlignRightIcon theme={appState.theme} />,
          },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => {
            if (isTextElement(element)) {
              return element.textAlign;
            }
            const boundTextElement = getBoundTextElement(element);
            if (boundTextElement) {
              return boundTextElement.textAlign;
            }
            return null;
          },
          appState.currentItemTextAlign,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeSharpness = register({
  name: "changeSharpness",
  perform: (elements, appState, value) => {
    const targetElements = getTargetElements(
      getNonDeletedElements(elements),
      appState,
    );
    const shouldUpdateForNonLinearElements = targetElements.length
      ? targetElements.every((el) => !isLinearElement(el))
      : !isLinearElementType(appState.elementType);
    const shouldUpdateForLinearElements = targetElements.length
      ? targetElements.every(isLinearElement)
      : isLinearElementType(appState.elementType);
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeSharpness: value,
        }),
      ),
      appState: {
        ...appState,
        currentItemStrokeSharpness: shouldUpdateForNonLinearElements
          ? value
          : appState.currentItemStrokeSharpness,
        currentItemLinearStrokeSharpness: shouldUpdateForLinearElements
          ? value
          : appState.currentItemLinearStrokeSharpness,
      },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <fieldset>
      <legend>{t("labels.edges")}</legend>
      <ButtonIconSelect
        group="edges"
        options={[
          {
            value: "sharp",
            text: t("labels.sharp"),
            icon: <EdgeSharpIcon theme={appState.theme} />,
          },
          {
            value: "round",
            text: t("labels.round"),
            icon: <EdgeRoundIcon theme={appState.theme} />,
          },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => element.strokeSharpness,
          (canChangeSharpness(appState.elementType) &&
            (isLinearElementType(appState.elementType)
              ? appState.currentItemLinearStrokeSharpness
              : appState.currentItemStrokeSharpness)) ||
            null,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeArrowhead = register({
  name: "changeArrowhead",
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
        <div className="iconSelectList">
          <IconPicker
            label="arrowhead_start"
            options={[
              {
                value: null,
                text: t("labels.arrowhead_none"),
                icon: <ArrowheadNoneIcon theme={appState.theme} />,
                keyBinding: "q",
              },
              {
                value: "arrow",
                text: t("labels.arrowhead_arrow"),
                icon: (
                  <ArrowheadArrowIcon theme={appState.theme} flip={!isRTL} />
                ),
                keyBinding: "w",
              },
              {
                value: "bar",
                text: t("labels.arrowhead_bar"),
                icon: <ArrowheadBarIcon theme={appState.theme} flip={!isRTL} />,
                keyBinding: "e",
              },
              {
                value: "dot",
                text: t("labels.arrowhead_dot"),
                icon: <ArrowheadDotIcon theme={appState.theme} flip={!isRTL} />,
                keyBinding: "r",
              },
              {
                value: "triangle",
                text: t("labels.arrowhead_triangle"),
                icon: (
                  <ArrowheadTriangleIcon theme={appState.theme} flip={!isRTL} />
                ),
                keyBinding: "t",
              },
            ]}
            value={getFormValue<Arrowhead | null>(
              elements,
              appState,
              (element) =>
                isLinearElement(element) && canHaveArrowheads(element.type)
                  ? element.startArrowhead
                  : appState.currentItemStartArrowhead,
              appState.currentItemStartArrowhead,
            )}
            onChange={(value) => updateData({ position: "start", type: value })}
          />
          <IconPicker
            label="arrowhead_end"
            group="arrowheads"
            options={[
              {
                value: null,
                text: t("labels.arrowhead_none"),
                keyBinding: "q",
                icon: <ArrowheadNoneIcon theme={appState.theme} />,
              },
              {
                value: "arrow",
                text: t("labels.arrowhead_arrow"),
                keyBinding: "w",
                icon: (
                  <ArrowheadArrowIcon theme={appState.theme} flip={isRTL} />
                ),
              },
              {
                value: "bar",
                text: t("labels.arrowhead_bar"),
                keyBinding: "e",
                icon: <ArrowheadBarIcon theme={appState.theme} flip={isRTL} />,
              },
              {
                value: "dot",
                text: t("labels.arrowhead_dot"),
                keyBinding: "r",
                icon: <ArrowheadDotIcon theme={appState.theme} flip={isRTL} />,
              },
              {
                value: "triangle",
                text: t("labels.arrowhead_triangle"),
                icon: (
                  <ArrowheadTriangleIcon theme={appState.theme} flip={isRTL} />
                ),
                keyBinding: "t",
              },
            ]}
            value={getFormValue<Arrowhead | null>(
              elements,
              appState,
              (element) =>
                isLinearElement(element) && canHaveArrowheads(element.type)
                  ? element.endArrowhead
                  : appState.currentItemEndArrowhead,
              appState.currentItemEndArrowhead,
            )}
            onChange={(value) => updateData({ position: "end", type: value })}
          />
        </div>
      </fieldset>
    );
  },
});
