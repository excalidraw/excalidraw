import { useState, useRef, useEffect, useDeferredValue } from "react";
import { BinaryFiles } from "../types";
import { useApp } from "./App";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { DEFAULT_EXPORT_PADDING, DEFAULT_FONT_SIZE } from "../constants";
import {
  convertToExcalidrawElements,
  exportToCanvas,
} from "../packages/excalidraw/index";
import {
  ExcalidrawElement, //zsviczian
  NonDeletedExcalidrawElement,
} from "../element/types";
import { canvasToBlob } from "../data/blob";
import { ArrowRightIcon } from "./icons";
import Spinner from "./Spinner";
import "./MermaidToExcalidraw.scss";

import { MermaidToExcalidrawResult } from "@zsviczian/mermaid-to-excalidraw/dist/interfaces"; //zsviczian
import { parseMermaidToExcalidraw } from "@zsviczian/mermaid-to-excalidraw"; //zsviczian
import type { MermaidOptions } from "@zsviczian/mermaid-to-excalidraw"; //zsviczian
import { t } from "../i18n";
import Trans from "./Trans";

const LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW = "mermaid-to-excalidraw";
const MERMAID_EXAMPLE =
  "flowchart TD\n A[Christmas] -->|Get money| B(Go shopping)\n B --> C{Let me think}\n C -->|One| D[Laptop]\n C -->|Two| E[iPhone]\n C -->|Three| F[Car]";

const saveMermaidDataToStorage = (data: string) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW, data);
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

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

const ErrorComp = ({ error }: { error: string }) => {
  return (
    <div data-testid="mermaid-error" className="mermaid-error">
      Error! <p>{error}</p>
    </div>
  );
};

const MermaidToExcalidraw = ({
  selectedElements, //zsviczian
}: {
  selectedElements: readonly NonDeletedExcalidrawElement[]; //zsviczian
}) => {
  const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] = useState<{
    loaded: boolean;
    api: {
      parseMermaidToExcalidraw: (
        defination: string,
        options: MermaidOptions,
      ) => Promise<MermaidToExcalidrawResult>;
    } | null;
  }>({ loaded: false, api: null });

  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text.trim());
  const [loading, setLoading] = useState(true); //zsviczian
  const [error, setError] = useState(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });

  const app = useApp();

  const resetPreview = () => {
    const canvasNode = canvasRef.current;

    if (!canvasNode) {
      return;
    }
    const parent = canvasNode.parentElement;
    if (!parent) {
      return;
    }
    parent.style.background = "";
    setError(null);
    canvasNode.replaceChildren();
  };

  useEffect(() => {
    const loadMermaidToExcalidrawLib = async () => {
      const api = await import(
        /* webpackChunkName:"mermaid-to-excalidraw" */ "@zsviczian/mermaid-to-excalidraw" //zsviczian
      );
      setMermaidToExcalidrawLib({ loaded: true, api });
    };
    loadMermaidToExcalidrawLib();
  }, []);

  useEffect(() => {
    if (!loading) {
      const selectedMermaidImage = selectedElements.filter(
        (el) => el.type === "image" && el.customData?.mermaidText,
      )[0]; //zsviczian
      const data = selectedMermaidImage
        ? selectedMermaidImage.customData?.mermaidText
        : importMermaidDataFromStorage() || MERMAID_EXAMPLE;

      setText(data);
    }
  }, [loading, selectedElements]);

  useEffect(() => {
    const renderExcalidrawPreview = async () => {
      const canvasNode = canvasRef.current;
      const parent = canvasNode?.parentElement;
      if (
        !mermaidToExcalidrawLib.loaded ||
        !canvasNode ||
        !parent ||
        !mermaidToExcalidrawLib.api ||
        deferredText === "" //zsviczian
      ) {
        return;
      }
      if (!deferredText) {
        resetPreview();
        return;
      }
      try {
        const { elements, files } =
          await mermaidToExcalidrawLib.api.parseMermaidToExcalidraw(
            deferredText,
            {
              fontSize: DEFAULT_FONT_SIZE,
            },
          );
        setError(null);

        data.current = {
          elements: convertToExcalidrawElements(
            elements.map((el) => {
              //zsviczian
              if (el.type === "image") {
                el.customData = { mermaidText: text };
              }
              return el;
            }),
            {
              regenerateIds: true,
            },
          ),
          files,
        };

        const canvas = await exportToCanvas({
          elements: data.current.elements,
          files: data.current.files,
          exportPadding: DEFAULT_EXPORT_PADDING,
          maxWidthOrHeight:
            Math.max(parent.offsetWidth, parent.offsetHeight) *
            window.devicePixelRatio,
        });
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        await canvasToBlob(canvas);
        parent.style.background = "var(--default-bg-color)";
        canvasNode.replaceChildren(canvas);
      } catch (e: any) {
        parent.style.background = "var(--default-bg-color)";
        if (deferredText) {
          setError(e.message);
        }
      }
    };
    renderExcalidrawPreview();
  }, [deferredText, mermaidToExcalidrawLib]);

  const onClose = () => {
    app.setOpenDialog(null);
    saveMermaidDataToStorage(text);
  };

  const onSelect = () => {
    const { elements: newElements, files } = data.current;
    app.addElementsFromPasteOrLibrary({
      elements: newElements,
      files,
      position: "center",
      fitToContent: true,
    });
    onClose();
  };

  return (
    <Dialog
      className="dialog-mermaid"
      onCloseRequest={onClose}
      size={1200}
      title={
        <>
          <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
          <span className="dialog-mermaid-desc">
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
            <br />
          </span>
        </>
      }
    >
      <div className="dialog-mermaid-body">
        <div className="dialog-mermaid-panels">
          <div className="dialog-mermaid-panels-text">
            <label>{t("mermaid.syntax")}</label>

            <textarea
              onChange={(event) => setText(event.target.value)}
              value={text}
            />
          </div>
          <div className="dialog-mermaid-panels-preview">
            <label>{t("mermaid.preview")}</label>
            <div className="dialog-mermaid-panels-preview-wrapper">
              {error && <ErrorComp error={error} />}
              {mermaidToExcalidrawLib.loaded ? (
                <div
                  ref={canvasRef}
                  style={{ opacity: error ? "0.15" : 1 }}
                  className="dialog-mermaid-panels-preview-canvas-container"
                />
              ) : (
                <Spinner size="2rem" />
              )}
            </div>
          </div>
        </div>
        <div className="dialog-mermaid-buttons">
          <Button className="dialog-mermaid-insert" onSelect={onSelect}>
            {t("mermaid.button")}
            <span>{ArrowRightIcon}</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
export default MermaidToExcalidraw;

//zsviczian
export const mermaidToExcalidraw = async (
  mermaidDefinition: string,
  opts: MermaidOptions = { fontSize: DEFAULT_FONT_SIZE },
  forceSVG:boolean = false,
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
