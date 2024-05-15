import { useState, useRef, useEffect, useDeferredValue } from "react";
import type { BinaryFiles } from "../../types";
import { useApp } from "../App";
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from "../../element/types";
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
import { MermaidOptions, parseMermaidToExcalidraw } from "@zsviczian/mermaid-to-excalidraw";
import { DEFAULT_FONT_SIZE } from "../../constants";
import { convertToExcalidrawElements } from "../../data/transform";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import { EDITOR_LS_KEYS } from "../../constants";
import { debounce, isDevEnv } from "../../utils";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";

const MERMAID_EXAMPLE =
  "flowchart TD\n A[Christmas] -->|Get money| B(Go shopping)\n B --> C{Let me think}\n C -->|One| D[Laptop]\n C -->|Two| E[iPhone]\n C -->|Three| F[Car]";

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
  const [loading, setLoading] = useState(true); //zsviczian
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
  opts: MermaidOptions = { fontSize: DEFAULT_FONT_SIZE },
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
    }
  }
};