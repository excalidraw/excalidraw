import React from "react";
import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  TextAlign,
  FontFamily,
} from "../element/types";
import {
  getCommonAttributeOfSelectedElements,
  isSomeElementSelected,
  getTargetElement,
  canChangeSharpness,
} from "../scene";
import { ButtonSelect } from "../components/ButtonSelect";
import { ButtonIconSelect } from "../components/ButtonIconSelect";
import {
  isTextElement,
  redrawTextBoundingBox,
  getNonDeletedElements,
} from "../element";
import { isLinearElement, isLinearElementType } from "../element/typeChecks";
import { ColorPicker } from "../components/ColorPicker";
import { AppState } from "../../src/types";
import { t } from "../i18n";
import { register } from "./register";
import { newElementWith } from "../element/mutateElement";
import { DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY } from "../constants";
import { randomInteger } from "../random";
import {
  FillHachureIcon,
  FillCrossHatchIcon,
  FillSolidIcon,
  StrokeWidthIcon,
  StrokeStyleSolidIcon,
  StrokeStyleDashedIcon,
  StrokeStyleDottedIcon,
  EdgeSharpIcon,
  EdgeRoundIcon,
  SloppinessArchitectIcon,
  SloppinessArtistIcon,
  SloppinessCartoonistIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
} from "../components/icons";

const changeProperty = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  callback: (element: ExcalidrawElement) => ExcalidrawElement,
) => {
  return elements.map((element) => {
    if (
      appState.selectedElementIds[element.id] ||
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

export const actionChangeStrokeColor = register({
  name: "changeStrokeColor",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeColor: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeColor: value },
      commitToHistory: true,
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
        onChange={updateData}
      />
    </>
  ),
});

export const actionChangeBackgroundColor = register({
  name: "changeBackgroundColor",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          backgroundColor: value,
        }),
      ),
      appState: { ...appState, currentItemBackgroundColor: value },
      commitToHistory: true,
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
        onChange={updateData}
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
            icon: <FillHachureIcon appearance={appState.appearance} />,
          },
          {
            value: "cross-hatch",
            text: t("labels.crossHatch"),
            icon: <FillCrossHatchIcon appearance={appState.appearance} />,
          },
          {
            value: "solid",
            text: t("labels.solid"),
            icon: <FillSolidIcon appearance={appState.appearance} />,
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
            value: 1,
            text: t("labels.thin"),
            icon: (
              <StrokeWidthIcon
                appearance={appState.appearance}
                strokeWidth={2}
              />
            ),
          },
          {
            value: 2,
            text: t("labels.bold"),
            icon: (
              <StrokeWidthIcon
                appearance={appState.appearance}
                strokeWidth={6}
              />
            ),
          },
          {
            value: 4,
            text: t("labels.extraBold"),
            icon: (
              <StrokeWidthIcon
                appearance={appState.appearance}
                strokeWidth={10}
              />
            ),
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
            icon: <SloppinessArchitectIcon appearance={appState.appearance} />,
          },
          {
            value: 1,
            text: t("labels.artist"),
            icon: <SloppinessArtistIcon appearance={appState.appearance} />,
          },
          {
            value: 2,
            text: t("labels.cartoonist"),
            icon: <SloppinessCartoonistIcon appearance={appState.appearance} />,
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
            icon: <StrokeStyleSolidIcon appearance={appState.appearance} />,
          },
          {
            value: "dashed",
            text: t("labels.strokeStyle_dashed"),
            icon: <StrokeStyleDashedIcon appearance={appState.appearance} />,
          },
          {
            value: "dotted",
            text: t("labels.strokeStyle_dotted"),
            icon: <StrokeStyleDottedIcon appearance={appState.appearance} />,
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
    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isTextElement(el)) {
          const element: ExcalidrawTextElement = newElementWith(el, {
            fontSize: value,
          });
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      }),
      appState: {
        ...appState,
        currentItemFontSize: value,
      },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <fieldset>
      <legend>{t("labels.fontSize")}</legend>
      <ButtonSelect
        group="font-size"
        options={[
          { value: 16, text: t("labels.small") },
          { value: 20, text: t("labels.medium") },
          { value: 28, text: t("labels.large") },
          { value: 36, text: t("labels.veryLarge") },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => isTextElement(element) && element.fontSize,
          appState.currentItemFontSize || DEFAULT_FONT_SIZE,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeFontFamily = register({
  name: "changeFontFamily",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isTextElement(el)) {
          const element: ExcalidrawTextElement = newElementWith(el, {
            fontFamily: value,
          });
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      }),
      appState: {
        ...appState,
        currentItemFontFamily: value,
      },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    const options: { value: FontFamily; text: string }[] = [
      { value: 1, text: t("labels.handDrawn") },
      { value: 2, text: t("labels.normal") },
      { value: 3, text: t("labels.code") },
    ];

    return (
      <fieldset>
        <legend>{t("labels.fontFamily")}</legend>
        <ButtonSelect<FontFamily | false>
          group="font-family"
          options={options}
          value={getFormValue(
            elements,
            appState,
            (element) => isTextElement(element) && element.fontFamily,
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
      elements: changeProperty(elements, appState, (el) => {
        if (isTextElement(el)) {
          const element: ExcalidrawTextElement = newElementWith(el, {
            textAlign: value,
          });
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      }),
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
            icon: <TextAlignLeftIcon appearance={appState.appearance} />,
          },
          {
            value: "center",
            text: t("labels.center"),
            icon: <TextAlignCenterIcon appearance={appState.appearance} />,
          },
          {
            value: "right",
            text: t("labels.right"),
            icon: <TextAlignRightIcon appearance={appState.appearance} />,
          },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => isTextElement(element) && element.textAlign,
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
    const targetElements = getTargetElement(
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
            icon: <EdgeSharpIcon appearance={appState.appearance} />,
          },
          {
            value: "round",
            text: t("labels.round"),
            icon: <EdgeRoundIcon appearance={appState.appearance} />,
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
