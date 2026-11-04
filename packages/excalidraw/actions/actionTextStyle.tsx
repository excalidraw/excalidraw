import {
  CaptureUpdateAction,
  applyTextSpanStyle,
  getBoundTextElement,
  getCommonTextSpanStyleValue,
  isTextElement,
  newElementWith,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import {
  DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  KEYS,
  deriveStylesPanelMode,
} from "@excalidraw/common";

import type {
  TextSpanStyleKey,
  TextSpanStylePatch,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { ColorPicker } from "../components/ColorPicker/ColorPicker";
import { RadioSelection } from "../components/RadioSelection";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";
import {
  getActiveRichEditor,
  getRichEditorWithSelection,
} from "../wysiwyg/richEditable";
import { withCaretPositionPreservation } from "../hooks/useTextEditorFocus";

import { register } from "./register";

import type { JSX } from "react";

import type { AppClassProperties, AppState } from "../types";

export type ToggleTextStyle = "bold" | "italic" | "underline" | "strikethrough";

const TEXT_STYLE_TOGGLES: readonly ToggleTextStyle[] = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
];

const getBaseStyle = (element: ExcalidrawTextElement) => ({
  strokeColor: element.strokeColor,
  fontFamily: element.fontFamily,
  fontSize: element.fontSize,
});

const getEditingTextElement = (
  appState: Pick<AppState, "editingTextElement">,
  app: AppClassProperties,
) => {
  const id = appState.editingTextElement?.id;
  const element = id ? app.scene.getElement(id) : null;
  return element && isTextElement(element)
    ? (element as NonDeleted<ExcalidrawTextElement>)
    : null;
};

/**
 * Styles the portion of the text selected in the open editor. `false` when
 * no portion is selected — the caller then styles whole elements.
 */
export const applyStyleToSelectedTextPortion = (
  appState: Pick<AppState, "editingTextElement">,
  app: AppClassProperties,
  patch: TextSpanStylePatch,
) => {
  const element = getEditingTextElement(appState, app);
  const editor = element && getRichEditorWithSelection(element.id);
  if (!element || !editor) {
    return false;
  }
  return editor.applyStyle(patch, getBaseStyle(element));
};

/**
 * Scales the font size of the portion of the text selected in the open
 * editor (from its common size, or the text's own where it varies). `false`
 * when no portion is selected.
 */
export const scaleFontSizeOfSelectedTextPortion = (
  appState: Pick<AppState, "editingTextElement">,
  app: AppClassProperties,
  getNextFontSize: (fontSize: number) => number,
) => {
  const element = getEditingTextElement(appState, app);
  const editor = element && getRichEditorWithSelection(element.id);
  if (!element || !editor) {
    return false;
  }
  const { start, end } = editor.getSelectionRange();
  const current =
    getCommonTextSpanStyleValue(element.spans, start, end, "fontSize") ??
    element.fontSize;
  return editor.applyStyle(
    { fontSize: Math.max(1, getNextFontSize(current)) },
    getBaseStyle(element),
  );
};

/** the text elements a style goes to: the edited one, or the selected ones */
type TextStyleAppState = Pick<
  AppState,
  "editingTextElement" | "selectedElementIds"
>;

const getTargetTextElements = (
  elements: readonly ExcalidrawElement[],
  appState: TextStyleAppState,
  app: AppClassProperties,
) => {
  const editing = getEditingTextElement(appState, app);
  if (editing) {
    return [editing];
  }
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const result: ExcalidrawTextElement[] = [];
  for (const element of getSelectedElements(elements, appState, {
    includeBoundTextElement: true,
  })) {
    if (isTextElement(element)) {
      result.push(element);
    } else {
      const bound = getBoundTextElement(element, elementsMap);
      if (bound) {
        result.push(bound);
      }
    }
  }
  return Array.from(new Map(result.map((el) => [el.id, el])).values());
};

/** whether `style` is on for all of the targeted text */
const isTextStyleActive = (
  elements: readonly ExcalidrawElement[],
  appState: TextStyleAppState,
  app: AppClassProperties,
  style: ToggleTextStyle,
) => {
  const editing = getEditingTextElement(appState, app);
  if (editing) {
    const editor = getActiveRichEditor(editing.id);
    const selection = editor?.getSelectionRange();
    if (selection && selection.start !== selection.end) {
      return (
        getCommonTextSpanStyleValue(
          editing.spans,
          selection.start,
          selection.end,
          style,
        ) === true
      );
    }
  }
  const targets = getTargetTextElements(elements, appState, app);
  return (
    targets.length > 0 &&
    targets.every(
      (element) =>
        element.originalText.length > 0 &&
        getCommonTextSpanStyleValue(
          element.spans,
          0,
          element.originalText.length,
          style,
        ) === true,
    )
  );
};

/**
 * Styles all of the targeted texts (the edited one, or the selected ones and
 * the texts of selected containers) throughout.
 */
const applyStyleToTextTargets = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
  patch: TextSpanStylePatch,
) => {
  const targetIds = new Set(
    getTargetTextElements(elements, appState, app).map((el) => el.id),
  );
  if (!targetIds.size) {
    return false;
  }
  const editor = getActiveRichEditor(appState.editingTextElement?.id);

  const nextElements = elements.map((element) => {
    if (!targetIds.has(element.id) || !isTextElement(element)) {
      return element;
    }
    const spans = applyTextSpanStyle(
      element.spans,
      element.originalText.length,
      0,
      element.originalText.length,
      patch,
      getBaseStyle(element),
    );
    const nextElement = newElementWith(element, { spans });
    // bold / italic change the text's width
    redrawTextBoundingBox(
      nextElement,
      app.scene.getContainerElement(nextElement),
      app.scene,
      app.renderEnvironment,
    );
    return nextElement;
  });

  if (editor) {
    const edited = nextElements.find(
      (element) => element.id === appState.editingTextElement?.id,
    );
    if (edited && isTextElement(edited)) {
      editor.setContent(edited.originalText, edited.spans ?? null);
    }
  }

  return {
    elements: nextElements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

/**
 * The value of `key` common to the targeted text: the selected portion in
 * the editor, or all of the targeted texts. `undefined` where it's the
 * texts' own, `null` where it varies.
 */
const getTargetTextStyleValue = <K extends TextSpanStyleKey>(
  elements: readonly ExcalidrawElement[],
  appState: TextStyleAppState,
  app: AppClassProperties,
  key: K,
) => {
  const editing = getEditingTextElement(appState, app);
  if (editing) {
    const selection = getActiveRichEditor(editing.id)?.getSelectionRange();
    if (selection && selection.start !== selection.end) {
      return getCommonTextSpanStyleValue(
        editing.spans,
        selection.start,
        selection.end,
        key,
      );
    }
  }
  const values = new Set(
    getTargetTextElements(elements, appState, app).map((element) =>
      getCommonTextSpanStyleValue(
        element.spans,
        0,
        element.originalText.length,
        key,
      ),
    ),
  );
  return values.size === 1 ? [...values][0] : null;
};

export const actionToggleTextStyle = register<ToggleTextStyle>({
  name: "toggleTextStyle",
  label: "labels.textStyle",
  trackEvent: false,
  perform: (elements, appState, style, app) => {
    if (!style) {
      return false;
    }
    const nextValue = !isTextStyleActive(elements, appState, app, style);
    const patch: TextSpanStylePatch = { [style]: nextValue || null };

    // a portion selected in the editor: style just that
    if (applyStyleToSelectedTextPortion(appState, app, patch)) {
      return {
        appState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    // otherwise all of the targeted texts
    return applyStyleToTextTargets(elements, appState, app, patch);
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => {
    const isCompact = deriveStylesPanelMode(app.editorInterface) !== "full";
    const icons: Record<ToggleTextStyle, JSX.Element> = {
      bold: <span style={{ fontWeight: 700 }}>B</span>,
      italic: (
        <span style={{ fontStyle: "italic", fontFamily: "serif" }}>I</span>
      ),
      underline: <span style={{ textDecoration: "underline" }}>U</span>,
      strikethrough: <span style={{ textDecoration: "line-through" }}>S</span>,
    };
    const labels: Record<ToggleTextStyle, string> = {
      bold: `${t("labels.bold")} — Ctrl+B`,
      italic: `${t("labels.italic")} — Ctrl+I`,
      underline: `${t("labels.underline")} — Ctrl+U`,
      strikethrough: `${t("labels.strikethrough")} — Ctrl+Shift+X`,
    };

    return (
      <fieldset>
        <legend>{t("labels.textStyle")}</legend>
        <div className="buttonList">
          <RadioSelection<ToggleTextStyle>
            type="button"
            value={null}
            options={TEXT_STYLE_TOGGLES.map((style) => ({
              value: style,
              text: labels[style],
              icon: icons[style],
              testId: `text-style-${style}`,
              active: isTextStyleActive(elements, appState, app, style),
            }))}
            onClick={(style) => {
              withCaretPositionPreservation(
                () => updateData(style),
                isCompact,
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

/** which toggle a keyboard shortcut is for */
export const getTextStyleForShortcut = (
  event: KeyboardEvent | React.KeyboardEvent,
): ToggleTextStyle | null => {
  if (!event[KEYS.CTRL_OR_CMD] || event.altKey) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (event.shiftKey) {
    return key === KEYS.X ? "strikethrough" : null;
  }
  return key === KEYS.B
    ? "bold"
    : key === KEYS.I
    ? "italic"
    : key === "u"
    ? "underline"
    : null;
};

/**
 * A highlighter behind the text: of the portion selected in the editor, or
 * of the whole of the targeted texts. Transparent removes it.
 */
export const actionChangeTextHighlightColor = register<{ color?: string }>({
  name: "changeTextHighlightColor",
  label: "labels.textHighlight",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const color = value?.color;
    if (color === undefined) {
      return { appState, captureUpdate: CaptureUpdateAction.EVENTUALLY };
    }
    const patch: TextSpanStylePatch = {
      highlightColor: color === "transparent" ? null : color,
    };
    if (applyStyleToSelectedTextPortion(appState, app, patch)) {
      return { appState, captureUpdate: CaptureUpdateAction.IMMEDIATELY };
    }
    return applyStyleToTextTargets(elements, appState, app, patch);
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const stylesPanelMode = deriveStylesPanelMode(app.editorInterface);
    const value = getTargetTextStyleValue(
      elements,
      appState,
      app,
      "highlightColor",
    );
    return (
      <>
        {stylesPanelMode === "full" && (
          <h3 aria-hidden="true">{t("labels.textHighlight")}</h3>
        )}
        <ColorPicker
          topPicks={DEFAULT_ELEMENT_BACKGROUND_PICKS}
          palette={DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE}
          type="textHighlight"
          label={t("labels.textHighlight")}
          color={value === null ? null : value ?? "transparent"}
          onChange={(color) => updateData({ color })}
          elements={elements}
          appState={appState}
          updateData={updateData}
        />
      </>
    );
  },
});
