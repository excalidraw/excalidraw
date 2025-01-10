import { useState, useRef, useEffect, useDeferredValue } from "react";
import type { BinaryFiles } from "../../types";
import { useApp } from "../App";
import type { NonDeletedExcalidrawElement } from "../../element/types";
import { ArrowRightIcon } from "../icons";
import "./MermaidToExcalidraw.scss";
import { t } from "../../i18n";
import Trans from "../Trans";
import type { MermaidToExcalidrawLibProps } from "./common";
import {
  convertMermaidToExcalidraw,
  insertToEditor,
  saveMermaidDataToStorage,
} from "./common";
import { TTDDialogPanels } from "./TTDDialogPanels";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import { EDITOR_LS_KEYS } from "../../constants";
import { debounce, isDevEnv } from "../../utils";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";

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
  const deferredText = useDeferredValue(text.trim());
  const [error, setError] = useState<Error | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });

  const app = useApp();

  useEffect(() => {
    convertMermaidToExcalidraw({
      canvasRef,
      data,
      mermaidToExcalidrawLib,
      setError,
      mermaidDefinition: deferredText,
    }).catch((err) => {
      if (isDevEnv()) {
        console.error("Failed to parse mermaid definition", err);
      }
    });

    debouncedSaveMermaidDefinition(deferredText);
  }, [deferredText, mermaidToExcalidrawLib]);

  useEffect(
    () => () => {
      debouncedSaveMermaidDefinition.flush();
    },
    [],
  );

  const onInsertToEditor = () => {
    insertToEditor({
      app,
      data,
      text,
      shouldSaveMermaidDataToStorage: true,
    });
  };

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
        <TTDDialogPanel label={t("mermaid.syntax")}>
          <TTDDialogInput
            input={text}
            placeholder={"Write Mermaid diagram defintion here..."}
            onChange={(event) => setText(event.target.value)}
            onKeyboardSubmit={() => {
              onInsertToEditor();
            }}
          />
        </TTDDialogPanel>
        <TTDDialogPanel
          label={t("mermaid.preview")}
          panelAction={{
            action: () => {
              onInsertToEditor();
            },
            label: t("mermaid.button"),
            icon: ArrowRightIcon,
          }}
          renderSubmitShortcut={() => <TTDDialogSubmitShortcut />}
        >
          <TTDDialogOutput
            canvasRef={canvasRef}
            loaded={mermaidToExcalidrawLib.loaded}
            error={error}
          />
        </TTDDialogPanel>
      </TTDDialogPanels>
    </>
  );
};
export default MermaidToExcalidraw;
