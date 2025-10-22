import { useState, useRef, useEffect, useCallback } from "react";

import { EDITOR_LS_KEYS, debounce, isDevEnv } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useApp } from "../App";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import { t } from "../../i18n";
import Trans from "../Trans";

import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";
import {
  convertMermaidToExcalidraw,
  insertToEditor,
  saveMermaidDataToStorage,
} from "./common";

import "./MermaidToExcalidraw.scss";

import type { BinaryFiles } from "../../types";
import type { MermaidToExcalidrawLibProps } from "./common";
import { ArrowRightIcon } from "@excalidraw/excalidraw/components/icons";

const MERMAID_EXAMPLE =
  "flowchart TD\n A[Christmas] -->|Get money| B(Go shopping)\n B --> C{Let me think}\n C -->|One| D[Laptop]\n C -->|Two| E[iPhone]\n C -->|Three| F[Car]";

const debouncedSaveMermaidDefinition = debounce(saveMermaidDataToStorage, 300);

const MermaidToExcalidraw = ({
  mermaidToExcalidrawLib,
}: {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
}) => {
  const [text, setText] = useState(
    () =>
      EditorLocalStorage.get<string>(EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW) ||
      MERMAID_EXAMPLE,
  );
  const [error, setError] = useState<Error | null>(null);
  const [hasContent, setHasContent] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });

  const app = useApp();

  // Extracted conversion logic to avoid duplication
  const performConversion = useCallback(
    (mermaidDefinition: string) => {
      if (!mermaidDefinition) {
        return;
      }

      convertMermaidToExcalidraw({
        canvasRef,
        data,
        mermaidToExcalidrawLib,
        setError,
        mermaidDefinition,
      })
        .then(() => {
          setHasContent(data.current.elements.length > 0);
        })
        .catch((err) => {
          if (isDevEnv()) {
            console.error("Failed to parse mermaid definition", err);
          }
          setHasContent(false);
        });
    },
    [mermaidToExcalidrawLib],
  );

  // Stable ref to always use latest performConversion in debounced function
  const performConversionRef = useRef(performConversion);
  performConversionRef.current = performConversion;

  // Debounced conversion for auto-convert mode (performance optimization)
  const debouncedConvert = useRef(
    debounce((definition: string) => {
      performConversionRef.current(definition);
    }, 300),
  ).current;

  // Auto-convert on text change with debounce
  useEffect(() => {
    const trimmedText = text.trim();
    debouncedConvert(trimmedText);
  }, [text, debouncedConvert]);

  // Save to local storage on text change
  useEffect(() => {
    debouncedSaveMermaidDefinition(text.trim());
  }, [text]);

  // Cleanup: flush pending operations on unmount
  useEffect(
    () => () => {
      debouncedSaveMermaidDefinition.flush();
      debouncedConvert.flush?.();
    },
    [debouncedConvert],
  );

  const onInsertToEditor = () => {
    insertToEditor({
      app,
      data,
      text,
      shouldSaveMermaidDataToStorage: true,
    });
  };

  const onInsertRef = useRef(onInsertToEditor);
  onInsertRef.current = onInsertToEditor;

  // Global keyboard shortcut: Cmd/Ctrl+Enter to insert
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey
      ) {
        event.preventDefault();
        onInsertRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <div className="ttd-dialog-desc">
        <Trans
          i18nKey="mermaid.description"
          flowchartLink={(el) => (
            <a href="https://mermaid.js.org/syntax/flowchart.html">{el}</a>
          )}
          sequenceLink={(el) => (
            <a href="https://mermaid.js.org/syntax/sequenceDiagram.html">
              {el}
            </a>
          )}
          classLink={(el) => (
            <a href="https://mermaid.js.org/syntax/classDiagram.html">{el}</a>
          )}
        />
      </div>
      <TTDDialogPanels>
        <TTDDialogPanel
          label={t("mermaid.syntax")}
        >
          <TTDDialogInput
            input={text}
            placeholder={"Write Mermaid diagram defintion here..."}
            onChange={(event) => setText(event.target.value)}
          />
        </TTDDialogPanel>
        <TTDDialogPanel
          label={t("mermaid.preview")}
          panelAction={{
            action: onInsertToEditor,
            label: t("mermaid.button"),
            icon: ArrowRightIcon,
          }}
          renderSubmitShortcut={() => <TTDDialogSubmitShortcut variant="ctrlEnter" />}
        >
          <TTDDialogOutput
            canvasRef={canvasRef}
            loaded={mermaidToExcalidrawLib.loaded}
            error={error}
            hasContent={hasContent}
          />
        </TTDDialogPanel>
      </TTDDialogPanels>
    </>
  );
};
export default MermaidToExcalidraw;
