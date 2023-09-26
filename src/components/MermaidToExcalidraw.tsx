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

import { MermaidToExcalidrawResult } from "@excalidraw/mermaid-to-excalidraw/dist/interfaces";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw"; //zsviczian
import type { MermaidOptions } from "@excalidraw/mermaid-to-excalidraw";
import { t } from "../i18n";
import Trans from "./Trans";

const LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW = "mermaid-to-excalidraw";
const MERMAID_EXAMPLE =
  "flowchart TD\n A[Christmas] -->|Get money| B(Go shopping)\n B --> C{Let me think}\n C -->|One| D[Laptop]\n C -->|Two| E[iPhone]\n C -->|Three| F[test]";

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
    <div
      data-testid="mermaid-error"
      style={{
        color: "red",
        fontWeight: 800,
        fontSize: "30px",
        wordBreak: "break-word",
        overflow: "auto",
        maxHeight: "100%",
        textAlign: "center",
      }}
    >
      Error! <p style={{ fontSize: "18px", fontWeight: "600" }}>{error}</p>
    </div>
  );
};

const MermaidToExcalidraw = ({
  selectedElements, //zsviczian
}: {
  selectedElements: readonly NonDeletedExcalidrawElement[];
}) => {
  const mermaidToExcalidrawLib = useRef<{
    parseMermaidToExcalidraw: (
      defination: string,
      options: MermaidOptions,
    ) => Promise<MermaidToExcalidrawResult>;
  } | null>(null);
  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text);
  const [loading, setLoading] = useState(true);
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
    canvasNode.replaceChildren();
  };

  useEffect(() => {
    const loadMermaidToExcalidrawLib = async () => {
      mermaidToExcalidrawLib.current = await import(
        /* webpackChunkName:"mermaid-to-excalidraw" */ "@excalidraw/mermaid-to-excalidraw"
      );
      setLoading(false);
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
      if (!canvasNode || !mermaidToExcalidrawLib.current) {
        return;
      }
      try {
        const { elements, files } =
          await mermaidToExcalidrawLib.current.parseMermaidToExcalidraw(
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
        const parent = canvasNode.parentElement!;
        const maxWidth = parent.offsetWidth;
        const maxHeight = parent.offsetHeight;
        let dimension = Math.max(maxWidth, maxHeight);
        dimension = Math.min(dimension, parent.offsetWidth - 10);
        dimension = Math.min(dimension, parent.offsetHeight - 10);

        const canvas = await exportToCanvas({
          elements: data.current.elements,
          files: data.current.files,
          exportPadding: DEFAULT_EXPORT_PADDING,
          maxWidthOrHeight: dimension,
        });
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        await canvasToBlob(canvas);
        parent.style.background = "#fff";
        canvasNode.replaceChildren(canvas);
      } catch (e: any) {
        console.error(e.message);
        resetPreview();
        if (deferredText) {
          setError(e.message);
        }
      }
    };
    renderExcalidrawPreview();
  }, [deferredText, text]);

  const onClose = () => {
    app.setActiveTool({ type: "selection" });
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
      title={
        <>
          <p style={{ marginBottom: "5px", marginTop: "2px" }}>
            {t("mermaid.title")}
          </p>
          <span
            style={{ fontSize: "15px", fontStyle: "italic", fontWeight: 500 }}
          >
            <Trans
              i18nKey="mermaid.description"
              flowchartLink={(el) => (
                <a href="https://mermaid.js.org/syntax/flowchart.html">{el}</a>
              )}
            />
            <br />
          </span>
        </>
      }
    >
      <div className="mermaid-to-excalidraw-wrapper">
        <div
          className="mermaid-to-excalidraw-wrapper-text"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <label>{t("mermaid.syntax")}</label>

          <textarea
            style={{
              padding: "0.85rem",
              borderRadius: "8px",
              border: "1px solid #e4e4eb",
              whiteSpace: "pre-wrap",
            }}
            onChange={(event) => setText(event.target.value)}
            value={text}
          />
        </div>
        <div
          className="mermaid-to-excalidraw-wrapper-preview"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <label>{t("mermaid.preview")}</label>
          <div className="mermaid-to-excalidraw-wrapper-preview-canvas">
            {error && <ErrorComp error={error} />}
            {loading && <Spinner size="2rem" />}
            <div ref={canvasRef} />
          </div>
          <Button
            className="mermaid-to-excalidraw-wrapper-preview-insert"
            onSelect={onSelect}
          >
            {t("mermaid.button")}
            <span style={{ paddingLeft: "8px", display: "flex" }}>
              {ArrowRightIcon}
            </span>
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
