import { useMemo, useState } from "react";

import {
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

  const close = () => setAppState({ openDialog: null });

  const onSubmit = () => {
    const normalized = normalizeCodeText(code);
    if (!normalized) {
      close();
      return;
    }

    if (editing) {
      // the block's colors follow the app theme at render time, so editing only
      // needs to update the text, language and the container's size
      const elementsMap = app.scene.getNonDeletedElementsMap();
      const metrics = measureCodeBlockText(normalized);

      mutateElement(editing.text as ExcalidrawTextElement, elementsMap, {
        text: normalized,
        originalText: normalized,
        width: metrics.width,
        height: metrics.height,
        customData: { codeBlock: { language } },
      });
      mutateElement(editing.container, elementsMap, {
        width: metrics.width + CODE_BLOCK_PADDING * 2,
        height: metrics.height + CODE_BLOCK_PADDING * 2,
        customData: { codeBlock: { language } },
      });
      ShapeCache.delete(editing.text);
      ShapeCache.delete(editing.container);
      app.scene.triggerUpdate();
    } else {
      const { container, text } = newCodeBlockElements({
        code: normalized,
        language,
        x: 0,
        y: 0,
      });
      app.addElementsFromPasteOrLibrary({
        elements: [container, text],
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
