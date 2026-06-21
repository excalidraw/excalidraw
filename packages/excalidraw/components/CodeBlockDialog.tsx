import { useMemo, useState } from "react";

import {
  CODE_BLOCK_LANGUAGES,
  CODE_BLOCK_PADDING,
  CODE_BLOCK_THEMES,
  DEFAULT_CODE_BLOCK_LANGUAGE,
  DEFAULT_CODE_BLOCK_THEME,
  ShapeCache,
  getCodeBlockBorderColor,
  getCodeBlockMeta,
  isCodeBlockTextElement,
  measureCodeBlockText,
  mutateElement,
  newCodeBlockElements,
  normalizeCodeText,
} from "@excalidraw/element";

import type { CodeBlockTheme } from "@excalidraw/element";
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
  const [theme, setTheme] = useState<CodeBlockTheme>(
    () => existingMeta?.theme ?? DEFAULT_CODE_BLOCK_THEME,
  );

  const close = () => setAppState({ openDialog: null });

  const onSubmit = () => {
    const normalized = normalizeCodeText(code);
    if (!normalized) {
      close();
      return;
    }

    if (editing) {
      const elementsMap = app.scene.getNonDeletedElementsMap();
      const palette = CODE_BLOCK_THEMES[theme];
      const metrics = measureCodeBlockText(normalized);

      mutateElement(editing.text as ExcalidrawTextElement, elementsMap, {
        text: normalized,
        originalText: normalized,
        strokeColor: palette.foreground,
        width: metrics.width,
        height: metrics.height,
        customData: { codeBlock: { language, theme } },
      });
      mutateElement(editing.container, elementsMap, {
        width: metrics.width + CODE_BLOCK_PADDING * 2,
        height: metrics.height + CODE_BLOCK_PADDING * 2,
        backgroundColor: palette.background,
        strokeColor: getCodeBlockBorderColor(theme),
        customData: { codeBlock: { language, theme } },
      });
      ShapeCache.delete(editing.text);
      ShapeCache.delete(editing.container);
      app.scene.triggerUpdate();
    } else {
      const { container, text } = newCodeBlockElements({
        code: normalized,
        language,
        theme,
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
          <label>
            {t("codeBlock.theme")}
            <select
              value={theme}
              onChange={(event) =>
                setTheme(event.target.value as CodeBlockTheme)
              }
            >
              <option value="dark">{t("codeBlock.themeDark")}</option>
              <option value="light">{t("codeBlock.themeLight")}</option>
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
