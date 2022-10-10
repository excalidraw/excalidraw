import { AppState } from "../../src/types";
import { ButtonIconSelect } from "../components/ButtonIconSelect";
import { ColorPicker } from "../components/ColorPicker";
import { IconPicker } from "../components/IconPicker";
// TODO barnabasmolnar/editor-redesign
import {
  ArrowheadArrowIcon,
  ArrowheadBarIcon,
  ArrowheadDotIcon,
  ArrowheadTriangleIcon,
  ArrowheadNoneIcon,
  StrokeStyleDashedIcon,
  StrokeStyleDottedIcon,
  TextAlignTopIcon,
  TextAlignBottomIcon,
  TextAlignMiddleIcon,
} from "../components/icons";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
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
  VerticalAlign,
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
          redrawTextBoundingBox(newElement, getContainerElement(oldElement));

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
        elements={elements}
        appState={appState}
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
        elements={elements}
        appState={appState}
      />
    </>
  ),
});

export const actionChangeFillStyle = register({
  name: "changeFillStyle",
  trackEvent: false,
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
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g
                  clipPath="url(#a)"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M-.977 13.73 13.73-.977M4.8 19.508 19.508 4.8M-3.806 10.902 10.902-3.806M1.6 17.108 16.308 2.4" />
                </g>
                <rect
                  x=".5"
                  y=".5"
                  width={15}
                  height={15}
                  rx="2.5"
                  stroke="currentColor"
                />
                <defs>
                  <clipPath id="a">
                    <rect width={16} height={16} rx={3} fill="#fff" />
                  </clipPath>
                </defs>
              </svg>
            ),
          },
          {
            value: "cross-hatch",
            text: t("labels.crossHatch"),
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g
                  clipPath="url(#a)"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M-.977 13.73 13.73-.977M4.8 19.508 19.508 4.8M-3.806 10.902 10.902-3.806M1.6 17.108 16.308 2.4M13.73 16.68-.977 1.971M19.508 10.902 4.8-3.806M10.902 19.508-3.806 4.8M17.108 14.102 2.4-.606" />
                </g>
                <rect
                  x=".5"
                  y=".5"
                  width={15}
                  height={15}
                  rx="2.5"
                  stroke="currentColor"
                />
                <defs>
                  <clipPath id="a">
                    <rect width={16} height={16} rx={3} fill="#fff" />
                  </clipPath>
                </defs>
              </svg>
            ),
          },
          {
            value: "solid",
            text: t("labels.solid"),
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x=".5"
                  y=".5"
                  width={15}
                  height={15}
                  rx="2.5"
                  fill="currentColor"
                />
                <rect
                  x=".5"
                  y=".5"
                  width={15}
                  height={15}
                  rx="2.5"
                  stroke="currentColor"
                />
              </svg>
            ),
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
            value: 1,
            text: t("labels.thin"),
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 8h14"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
          {
            value: 2,
            text: t("labels.bold"),
            icon: (
              <svg
                viewBox="0 0 18 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 8h14"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
          {
            value: 4,
            text: t("labels.extraBold"),
            icon: (
              <svg
                viewBox="0 0 20 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 8h14"
                  stroke="currentColor"
                  strokeWidth="4.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
            icon: (
              <svg
                viewBox="0 0 20 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 10.723C2.986 9.66 8.081 6.772 11.282 5.497c3.2-1.274.121 3.386 1.583 3.726C14.327 9.563 19 7.046 19 7.046"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            ),
          },
          {
            value: 1,
            text: t("labels.artist"),
            icon: (
              <svg
                viewBox="0 0 20 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 11.426c1.986-1.062 7.081-3.95 10.282-5.225 3.2-1.275.121 3.386 1.583 3.725C14.327 10.266 19 7.75 19 7.75M2.837 10.426C6.393 8.522 10.194 3.681 11.8 4.43c1.605.747-1.384 4.93-.16 6.714C12.866 12.926 19 9.426 19 9.426"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            ),
          },
          {
            value: 2,
            text: t("labels.cartoonist"),
            icon: (
              <svg
                viewBox="0 0 20 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 10.823C3.084 9.77 11.352 4.408 13.505 4.501c2.153.094-.503 6.166.413 6.884.916.718 4.235-2.147 5.082-2.576M1.514 8.246C2.912 7.623 8.08 4.309 9.9 4.509c1.822.198 1.2 4.592 2.545 4.93 1.345.338 4.606-2.419 5.526-2.903"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            ),
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
            icon: (
              <svg
                viewBox="0 0 20 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 8h18"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
          {
            value: "dashed",
            text: t("labels.strokeStyle_dashed"),
            // TODO barnabasmolnar/editor-redesign
            icon: <StrokeStyleDashedIcon theme={appState.theme} />,
          },
          {
            value: "dotted",
            text: t("labels.strokeStyle_dotted"),
            // TODO barnabasmolnar/editor-redesign
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
            appState.currentItemOpacity,
          ) ?? undefined
        }
      />
    </label>
  ),
});

export const actionChangeFontSize = register({
  name: "changeFontSize",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return changeFontSize(elements, appState, () => value, value);
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
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11 5.5c0-.663-.253-1.299-.703-1.768A2.353 2.353 0 0 0 8.6 3H7.4c-.637 0-1.247.263-1.697.732A2.554 2.554 0 0 0 5 5.5c0 .663.253 1.299.703 1.768.45.469 1.06.732 1.697.732h1.2c.637 0 1.247.263 1.697.732.45.47.703 1.105.703 1.768s-.253 1.299-.703 1.768c-.45.469-1.06.732-1.697.732H7.4a2.352 2.352 0 0 1-1.697-.732A2.554 2.554 0 0 1 5 10.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
            testId: "fontSize-small",
          },
          {
            value: 20,
            text: t("labels.medium"),
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 13V3l4 8.75L12 3v10"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
            testId: "fontSize-medium",
          },
          {
            value: 28,
            text: t("labels.large"),
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 3v10h6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
            testId: "fontSize-large",
          },
          {
            value: 36,
            text: t("labels.veryLarge"),
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="m1 3 6 10M7 3 1 13M9 3v10h6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
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
  trackEvent: false,
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
  trackEvent: false,
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
  trackEvent: false,
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
            redrawTextBoundingBox(newElement, getContainerElement(oldElement));
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
        icon: (
          <svg
            viewBox="0 0 24 24"
            strokeWidth="1.2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M4 20h4l10.5 -10.5a1.5 1.5 0 0 0 -4 -4l-10.5 10.5v4" />
            <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
          </svg>
        ),
      },
      {
        value: FONT_FAMILY.Helvetica,
        text: t("labels.normal"),
        icon: (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4.667 13.333v-8a2.667 2.667 0 0 1 2.666-2.666h1.334a2.667 2.667 0 0 1 2.666 2.666v8M4.667 8.667h6.666"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        value: FONT_FAMILY.Cascadia,
        text: t("labels.code"),
        icon: (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4.667 5.333 2 8l2.667 2.667M11.333 5.333 14 8l-2.667 2.667M9.333 2.667 6.667 13.333"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
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
  trackEvent: false,
  perform: (elements, appState, value) => {
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
            redrawTextBoundingBox(newElement, getContainerElement(oldElement));
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
  PanelComponent: ({ elements, appState, updateData }) => {
    return (
      <fieldset>
        <legend>{t("labels.textAlign")}</legend>
        <ButtonIconSelect<TextAlign | false>
          group="text-align"
          options={[
            {
              value: "left",
              text: t("labels.left"),
              icon: (
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g
                    clipPath="url(#a)"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.667 4h10.666M2.667 8h6.666M2.667 12H12" />
                  </g>
                  <defs>
                    <clipPath id="a">
                      <path fill="#fff" d="M0 0h16v16H0z" />
                    </clipPath>
                  </defs>
                </svg>
              ),
            },
            {
              value: "center",
              text: t("labels.center"),
              icon: (
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g clipPath="url(#clip0_218_11808)">
                    <path
                      d="M2.66663 4H13.3333"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5.33337 8H10.6667"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 12H12"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                  <defs>
                    <clipPath id="clip0_218_11808">
                      <rect width={16} height={16} fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              ),
            },
            {
              value: "right",
              text: t("labels.right"),
              icon: (
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g
                    clipPath="url(#a)"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.667 4h10.666M6.667 8h6.666M4 12h9.333" />
                  </g>
                  <defs>
                    <clipPath id="a">
                      <path fill="#fff" d="M0 0h16v16H0z" />
                    </clipPath>
                  </defs>
                </svg>
              ),
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
    );
  },
});
export const actionChangeVerticalAlign = register({
  name: "changeVerticalAlign",
  trackEvent: { category: "element" },
  perform: (elements, appState, value) => {
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

            redrawTextBoundingBox(newElement, getContainerElement(oldElement));
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
  PanelComponent: ({ elements, appState, updateData }) => {
    return (
      <fieldset>
        <ButtonIconSelect<VerticalAlign | false>
          group="text-align"
          options={[
            {
              value: VERTICAL_ALIGN.TOP,
              text: t("labels.alignTop"),
              icon: <TextAlignTopIcon theme={appState.theme} />,
            },
            {
              value: VERTICAL_ALIGN.MIDDLE,
              text: t("labels.centerVertically"),
              icon: <TextAlignMiddleIcon theme={appState.theme} />,
            },
            {
              value: VERTICAL_ALIGN.BOTTOM,
              text: t("labels.alignBottom"),
              icon: <TextAlignBottomIcon theme={appState.theme} />,
            },
          ]}
          value={getFormValue(elements, appState, (element) => {
            if (isTextElement(element) && element.containerId) {
              return element.verticalAlign;
            }
            const boundTextElement = getBoundTextElement(element);
            if (boundTextElement) {
              return boundTextElement.verticalAlign;
            }
            return null;
          })}
          onChange={(value) => updateData(value)}
        />
      </fieldset>
    );
  },
});

export const actionChangeSharpness = register({
  name: "changeSharpness",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const targetElements = getTargetElements(
      getNonDeletedElements(elements),
      appState,
    );
    const shouldUpdateForNonLinearElements = targetElements.length
      ? targetElements.every((el) => !isLinearElement(el))
      : !isLinearElementType(appState.activeTool.type);
    const shouldUpdateForLinearElements = targetElements.length
      ? targetElements.every(isLinearElement)
      : isLinearElementType(appState.activeTool.type);
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
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8.264 2.664h-5.6V8.264M10.667 2.667v.006M13.333 2.667v.006M13.333 5.333v.007M13.333 8v.007M2.667 10.667v.006M13.333 10.667v.006M2.667 13.333v.007M5.333 13.333v.007M8 13.333v.007M10.667 13.333v.007M13.333 13.333v.007"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
          {
            value: "round",
            text: t("labels.round"),
            icon: (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.667 8V5.333a2.667 2.667 0 0 1 2.666-2.666H8M10.667 2.667v.006M13.333 2.667v.006M13.333 5.333v.007M13.333 8v.007M2.667 10.667v.006M13.333 10.667v.006M2.667 13.333v.007M5.333 13.333v.007M8 13.333v.007M10.667 13.333v.007M13.333 13.333v.007"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => element.strokeSharpness,
          (canChangeSharpness(appState.activeTool.type) &&
            (isLinearElementType(appState.activeTool.type)
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
