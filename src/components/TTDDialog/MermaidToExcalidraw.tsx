import { useState, useRef, useEffect, useDeferredValue } from "react";
import { BinaryFiles } from "../../types";
import { useApp } from "../App";
import { ExcalidrawElement, NonDeletedExcalidrawElement } from "../../element/types";
import { ArrowRightIcon } from "../icons";
import "./MermaidToExcalidraw.scss";
import { t } from "../../i18n";
import Trans from "../Trans";
import {
  LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW,
  MermaidToExcalidrawLibProps,
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

const MERMAID_EXAMPLE =
  "flowchart TD\n A[Christmas] -->|Get money| B(Go shopping)\n B --> C{Let me think}\n C -->|One| D[Laptop]\n C -->|Two| E[iPhone]\n C -->|Three| F[Car]";

const importMermaidDataFromStorage = () => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW);
    if (data) {
      return data;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

const MermaidToExcalidraw = ({
  mermaidToExcalidrawLib,
  selectedElements, //zsviczian
}: {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  selectedElements: readonly NonDeletedExcalidrawElement[]; //zsviczian
}) => {
  const [text, setText] = useState("");
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
    const data = selectedMermaidImage
      ? selectedMermaidImage.customData?.mermaidText
      : importMermaidDataFromStorage() || MERMAID_EXAMPLE;
    setText(data);
  }, [selectedElements]); //zsviczian

  useEffect(() => {
    convertMermaidToExcalidraw({
      canvasRef,
      data,
      mermaidToExcalidrawLib,
      setError,
      text: deferredText,
    }).catch(() => {});
  }, [deferredText, mermaidToExcalidrawLib]);

  const textRef = useRef(text);

  // slightly hacky but really quite simple
  // essentially, we want to save the text to LS when the component unmounts
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  useEffect(() => {
    return () => {
      if (textRef.current) {
        saveMermaidDataToStorage(textRef.current);
      }
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
        />
      </div>
      <TTDDialogPanels>
        <TTDDialogPanel label={t("mermaid.syntax")}>
          <TTDDialogInput
            input={text}
            placeholder={"Write Mermaid diagram defintion here..."}
            onChange={(event) => setText(event.target.value)}
          />
        </TTDDialogPanel>
        <TTDDialogPanel
          label={t("mermaid.preview")}
          panelAction={{
            action: () => {
              insertToEditor({
                app,
                data,
                text,
                shouldSaveMermaidDataToStorage: true,
              });
            },
            label: t("mermaid.button"),
            icon: ArrowRightIcon,
          }}
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
      elements: ExcalidrawElement[];
      files: any;
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
    console.error(e.message);
  }
};