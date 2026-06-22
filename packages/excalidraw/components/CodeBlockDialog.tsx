import { useMemo, useState } from "react";

import { FONT_SIZES } from "@excalidraw/common";

import {
  CODE_BLOCK_FONT_SIZE,
  CODE_BLOCK_LANGUAGES,
  CODE_BLOCK_PADDING,
  DEFAULT_CODE_BLOCK_LANGUAGE,
  ShapeCache,
  getCodeBlockMeta,
  isCodeBlockTextElement,
  measureCodeBlockText,
  mutateElement,
  newCodeBlockElements,
  normalizeCodeText,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import { useApp, useExcalidrawAppState, useExcalidrawSetAppState } from "./App";
import { Dialog } from "./Dialog";

import "./CodeBlockDialog.scss";

import type { AppClassProperties } from "../types";

/** Resolve the code block text + container elements from any element in the group. */
const resolveCodeBlock = (
  app: AppClassProperties,
  elementId: ExcalidrawElement["id"],
): { text: ExcalidrawTextElement; container: ExcalidrawElement } | null => {
  const elements = app.scene.getNonDeletedElements();
  const target = elements.find((el) => el.id === elementId);
  if (!target) {
    return null;
  }
  const groupId = target.groupIds[0];
  const group = groupId
    ? elements.filter((el) => el.groupIds.includes(groupId))
    : [target];

  const text = group.find((el) => isCodeBlockTextElement(el)) as
    | ExcalidrawTextElement
    | undefined;
  const container = group.find(
    (el) => el.type === "rectangle" && !!el.customData?.codeBlock,
  );
  if (!text || !container) {
    return null;
  }
  return { text, container };
};

export const CodeBlockDialog = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const appState = useExcalidrawAppState();

  const editingElementId =
    appState.openDialog?.name === "codeBlock"
      ? appState.openDialog.editingElementId
      : undefined;

  const editing = useMemo(
    () => (editingElementId ? resolveCodeBlock(app, editingElementId) : null),
    [app, editingElementId],
  );

  const existingMeta = editing ? getCodeBlockMeta(editing.text) : undefined;

  const [code, setCode] = useState<string>(() => editing?.text.text ?? "");
  const [language, setLanguage] = useState<string>(
    () => existingMeta?.language ?? DEFAULT_CODE_BLOCK_LANGUAGE,
  );
  const [fontSize, setFontSize] = useState<number>(
    () => editing?.text.fontSize ?? CODE_BLOCK_FONT_SIZE,
  );
  const [wrap, setWrap] = useState<boolean>(() => existingMeta?.wrap ?? false);

  const close = () => setAppState({ openDialog: null });

  const onSubmit = () => {
    const normalized = normalizeCodeText(code);
    if (!normalized) {
      close();
      return;
    }

    if (editing) {
      // the block's colors follow the app theme at render time, so editing only
      // needs to update the text, language, font size, wrap and the
      // container's size to fit
      const elementsMap = app.scene.getNonDeletedElementsMap();
      const metrics = measureCodeBlockText(normalized, {
        fontSize,
        wrap,
        maxWidth: wrap ? editing.text.width : undefined,
      });

      mutateElement(editing.text as ExcalidrawTextElement, elementsMap, {
        text: normalized,
        originalText: normalized,
        fontSize,
        width: metrics.width,
        height: metrics.height,
        customData: { codeBlock: { ...existingMeta, language, wrap } },
      });
      mutateElement(editing.container, elementsMap, {
        width: metrics.width + CODE_BLOCK_PADDING * 2,
        height: metrics.height + CODE_BLOCK_PADDING * 2,
        customData: { codeBlock: { ...existingMeta, language, wrap } },
      });
      ShapeCache.delete(editing.text);
      ShapeCache.delete(editing.container);
      app.scene.triggerUpdate();
    } else {
      const { container, text } = newCodeBlockElements({
        code: normalized,
        language,
        fontSize,
        x: 0,
        y: 0,
      });

      let finalText: typeof text = text;
      let finalContainer: typeof container = container;
      if (wrap) {
        // wrap to the natural (unwrapped) width so short blocks don't shrink
        const metrics = measureCodeBlockText(normalized, {
          fontSize,
          wrap: true,
          maxWidth: text.width,
        });
        finalText = {
          ...text,
          width: metrics.width,
          height: metrics.height,
          customData: { codeBlock: { ...getCodeBlockMeta(text), wrap: true } },
        };
        finalContainer = {
          ...container,
          width: metrics.width + CODE_BLOCK_PADDING * 2,
          height: metrics.height + CODE_BLOCK_PADDING * 2,
        };
      }

      app.addElementsFromPasteOrLibrary({
        elements: [finalContainer, finalText],
        files: null,
        position: "center",
      });
    }

    close();
  };

  return (
    <Dialog
      size="wide"
      onCloseRequest={close}
      title={t(editing ? "codeBlock.editTitle" : "codeBlock.title")}
    >
      <div className="CodeBlockDialog">
        <div className="CodeBlockDialog__controls">
          <label>
            {t("codeBlock.language")}
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {CODE_BLOCK_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("codeBlock.fontSize")}
            <select
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
            >
              <option value={FONT_SIZES.sm}>S</option>
              <option value={FONT_SIZES.md}>M</option>
              <option value={FONT_SIZES.lg}>L</option>
              <option value={FONT_SIZES.xl}>XL</option>
            </select>
          </label>
          <label className="CodeBlockDialog__checkbox">
            <input
              type="checkbox"
              checked={wrap}
              onChange={(event) => setWrap(event.target.checked)}
            />
            {t("codeBlock.wrap")}
          </label>
        </div>
        <textarea
          className="CodeBlockDialog__textarea"
          autoFocus
          spellCheck={false}
          value={code}
          placeholder={t("codeBlock.placeholder")}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="CodeBlockDialog__actions">
          <button type="button" className="ExcButton" onClick={close}>
            {t("codeBlock.cancel")}
          </button>
          <button
            type="button"
            className="ExcButton ExcButton--primary"
            onClick={onSubmit}
          >
            {t(editing ? "codeBlock.save" : "codeBlock.insert")}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
