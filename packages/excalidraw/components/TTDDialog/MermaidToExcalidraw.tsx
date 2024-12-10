import { useState, useRef, useEffect, useDeferredValue } from "react";
import type { BinaryFiles } from "../../types";
import { useApp } from "../App";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../../element/types";
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
import type { MermaidConfig } from "@zsviczian/mermaid-to-excalidraw";
import { parseMermaidToExcalidraw } from "@zsviczian/mermaid-to-excalidraw";
import { convertToExcalidrawElements } from "../../data/transform";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import { EDITOR_LS_KEYS } from "../../constants";
import { debounce, isDevEnv } from "../../utils";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";

//zsviczian
const MERMAID_EXAMPLE =
  "flowchart TD\n  A[The Excalidraw Plugin is Community Supported] --> B{Will YOU support it?}\n  B -- 👍 Yes --> C[Long-term stability + new features]\n  B -- No 👎 --> D[Plugin eventually stops working]\n  C --> E[Support at https://ko-fi.com/zsolt]\n  E --> F[🎉 Encourage others to support]\n  D --> G[🪦 R.I.P. Excalidraw Plugin]";

const debouncedSaveMermaidDefinition = debounce(saveMermaidDataToStorage, 300);

const MermaidToExcalidraw = ({
  mermaidToExcalidrawLib,
  selectedElements, //zsviczian
}: {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  selectedElements: readonly NonDeletedExcalidrawElement[]; //zsviczian
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
    const selectedMermaidImage = selectedElements.filter(
      (el) => el.type === "image" && el.customData?.mermaidText,
    )[0]; //zsviczian
    if(selectedMermaidImage) {
      setText(selectedMermaidImage.customData?.mermaidText);
    }//zsviczian
    convertMermaidToExcalidraw({
      canvasRef,
      data,
      mermaidToExcalidrawLib,
      setError,
      mermaidDefinition: selectedMermaidImage
        ? selectedMermaidImage.customData?.mermaidText
        : deferredText, //zsviczian
    }).catch((err) => {
      if (isDevEnv()) {
        console.error("Failed to parse mermaid definition", err);
      }
    });

    debouncedSaveMermaidDefinition(deferredText);
  }, [deferredText, mermaidToExcalidrawLib, selectedElements]); //zsviczian

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

//zsviczian
export const mermaidToExcalidraw = async (
  mermaidDefinition: string,
  opts:MermaidConfig, // MermaidOptions = { fontSize: DEFAULT_FONT_SIZE },
  forceSVG: boolean = false,
): Promise<
  | {
      elements?: ExcalidrawElement[];
      files?: any;
      error?: string;
    }
  | undefined
> => {
  try {
    const { elements, files } = await parseMermaidToExcalidraw(
      mermaidDefinition,
      opts,
      forceSVG,
    );

    return {
      elements: convertToExcalidrawElements(
        elements.map((el) => {
          if (el.type === "image") {
            el.customData = { mermaidText: mermaidDefinition };
          }
          return el;
        }),
        {
          regenerateIds: true,
        },
      ),
      files,
    };
  } catch (e: any) {
    return {
      error: e.message,
    };
  }
};
