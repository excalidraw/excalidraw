import { useState, useRef, useEffect, useDeferredValue } from "react";

import { useApp } from "../App";
import { ArrowRightIcon } from "../icons";
import { EDITOR_LS_KEYS } from "../../constants";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import { t } from "../../i18n";
import { debounce, isDevEnv } from "../../utils";
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
import type { NonDeletedExcalidrawElement } from "../../element/types";

//zsviczian
const MERMAID_EXAMPLE =
  "flowchart TD\n  A[The Excalidraw Plugin is Community Supported] --> B{Will YOU support it?}\n  B -- 👍 Yes --> C[Long-term stability + new features]\n  B -- No 👎 --> D[Plugin eventually stops working 😢]\n  C --> E[Support at ❤️ https://ko-fi.com/zsolt]\n  E --> F[📢 Encourage others to support]\n  D --> G[🪦 R.I.P. Excalidraw Plugin]";

const debouncedSaveMermaidDefinition = debounce(saveMermaidDataToStorage, 300);

const MermaidToExcalidraw = ({
  mermaidToExcalidrawLib,
  selectedElements, //zsviczian
}: {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  selectedElements: readonly NonDeletedExcalidrawElement[]; //zsviczian
}) => {
  const selectedMermaidImage = selectedElements.filter(
    (el) => el.type === "image" && el.customData?.mermaidText,
  )[0]; //zsviczian
  const [text, setText] = useState(
    () =>
      selectedMermaidImage?.customData?.mermaidText || //zsviczian
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
  }, [deferredText, mermaidToExcalidrawLib]); //zsviczian

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
