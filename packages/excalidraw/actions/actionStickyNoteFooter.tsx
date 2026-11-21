import { arrayToMap, invariant } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  formatStickyNoteFooterDate,
  getTargetElements,
  isNonDeletedElement,
  isStickyNoteElement,
  isTextElement,
  newElementWith,
  relayoutStickyNotes,
  updateBoundElements,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawStickyNoteElement,
  StickyNoteFooterOptions,
} from "@excalidraw/element/types";

import { t } from "../i18n";
import {
  temporarilyDisableTextEditorBlur,
  withCaretPositionPreservation,
} from "../hooks/useTextEditorFocus";

import { register } from "./register";

const FOOTER_PRESETS = [
  { value: "none", label: "labels.stickyNote.footerNone" },
  { value: "short", label: "labels.stickyNote.footerShortDate" },
  { value: "time", label: "labels.stickyNote.footerTime" },
  { value: "long", label: "labels.stickyNote.footerFullDate" },
] as const;

type FooterPreset = typeof FOOTER_PRESETS[number]["value"];

const footerKey = (footer: StickyNoteFooterOptions | null) =>
  footer === null
    ? "none"
    : footer.type === "date"
    ? footer.format
    : `text:${footer.text}`;

const getTargetStickyNotes = (
  elements: readonly ExcalidrawElement[],
  appState: Parameters<typeof getTargetElements>[1],
) => {
  const elementsMap = arrayToMap(elements);
  const notes = new Map<string, ExcalidrawStickyNoteElement>();
  for (const target of getTargetElements(elementsMap, appState)) {
    const note =
      isTextElement(target) && target.containerId
        ? elementsMap.get(target.containerId)
        : target;
    if (note && !note.isDeleted && isStickyNoteElement(note)) {
      notes.set(note.id, note);
    }
  }
  return [...notes.values()];
};

export const actionChangeStickyNoteFooter = register<FooterPreset>({
  name: "changeStickyNoteFooter",
  label: "labels.stickyNote.footer",
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    app.isUIControlEnabled("stickyNoteFooter") &&
    (appState.activeTool.type === "stickynote" ||
      getTargetStickyNotes(elements, appState).length > 0),
  perform: (elements, appState, value, app) => {
    invariant(
      value === "none" ||
        value === "short" ||
        value === "time" ||
        value === "long",
      "A valid sticky note footer preset is required",
    );
    const footerOptions: StickyNoteFooterOptions | null =
      value === "none" ? null : { type: "date", format: value };
    const targets = getTargetStickyNotes(elements, appState);
    const changedIds = new Set(
      targets
        .filter(
          (note) => footerKey(note.footerOptions) !== footerKey(footerOptions),
        )
        .map((note) => note.id),
    );
    const defaultChanged =
      footerKey(appState.currentItemStickynoteFooterOptions) !==
      footerKey(footerOptions);
    if (!changedIds.size && !defaultChanged) {
      return false;
    }
    const nextAppState = { currentItemStickynoteFooterOptions: footerOptions };
    if (!changedIds.size) {
      return {
        appState: nextAppState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
    const prevElementsMap = arrayToMap(elements);
    const nextElements = relayoutStickyNotes(
      elements.map((element) =>
        changedIds.has(element.id) && isStickyNoteElement(element)
          ? newElementWith(element, { footerOptions })
          : element,
      ),
      changedIds,
      { prevElementsMap, renderEnvironment: app.renderEnvironment },
    );
    const changedElements = arrayToMap(nextElements);
    for (const id of changedIds) {
      const note = changedElements.get(id)!;
      const prev = prevElementsMap.get(id)!;
      if (
        isNonDeletedElement(note) &&
        (note.x !== prev.x || note.y !== prev.y || note.height !== prev.height)
      ) {
        updateBoundElements(note, app.scene, {
          changedElements,
          renderEnvironment: app.renderEnvironment,
        });
      }
    }
    return {
      elements: nextElements,
      appState: nextAppState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, app, updateData, data }) => {
    const notes = getTargetStickyNotes(elements, appState);
    if (
      !app.isUIControlEnabled("stickyNoteFooter") ||
      (!notes.length && appState.activeTool.type !== "stickynote")
    ) {
      return null;
    }
    const first = notes.length
      ? notes[0].footerOptions
      : appState.currentItemStickynoteFooterOptions;
    const key = footerKey(first);
    const value = notes.some((note) => footerKey(note.footerOptions) !== key)
      ? "mixed"
      : first?.type === "text"
      ? "custom"
      : key;
    const created = notes.length ? notes[0].created : Date.now();
    return (
      <fieldset className="sticky-note-footer">
        <legend>{t("labels.stickyNote.footer")}</legend>
        <select
          className="dropdown-select"
          aria-label={t("labels.stickyNote.footer")}
          value={value}
          onPointerDown={() =>
            temporarilyDisableTextEditorBlur(app.ownerDocument)
          }
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const preset = FOOTER_PRESETS.find(
              (item) => item.value === event.target.value,
            );
            if (preset) {
              withCaretPositionPreservation(
                () => updateData(preset.value),
                true,
                !!appState.editingTextElement,
                data?.onPreventClose,
                app.ownerDocument,
              );
            }
          }}
        >
          {value === "mixed" && (
            <option value="mixed" disabled>
              {t("labels.stickyNote.footerMixed")}
            </option>
          )}
          {value === "custom" && (
            <option value="custom" disabled>
              {t("labels.stickyNote.footerCustom")}
            </option>
          )}
          {FOOTER_PRESETS.map(({ value, label }) => {
            const preview =
              value === "none"
                ? null
                : formatStickyNoteFooterDate(created, value);
            return (
              <option key={value} value={value}>
                {t(label)}
                {preview && ` ? ${preview}`}
              </option>
            );
          })}
        </select>
      </fieldset>
    );
  },
});
