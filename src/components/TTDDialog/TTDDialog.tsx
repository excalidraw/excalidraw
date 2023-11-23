import { Dialog } from "../Dialog";
import { useApp } from "../App";
import MermaidToExcalidraw from "./MermaidToExcalidraw";
import TTDDialogTabs from "./TTDDialogTabs";
import { useTunnels } from "../../context/tunnels";
import { ChangeEventHandler, useEffect, useRef, useState } from "react";
import { useUIAppState } from "../../context/ui-appState";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { TTDDialogTabTriggers } from "./TTDDialogTabTriggers";
import { TTDDialogTabTrigger } from "./TTDDialogTabTrigger";
import { TTDDialogTab } from "./TTDDialogTab";
import "./TTDDialog.scss";
import { t } from "../../i18n";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";
import {
  MermaidToExcalidrawLibProps,
  convertMermaidToExcalidraw,
  insertToEditor,
  saveMermaidDataToStorage,
} from "./common";
import { NonDeletedExcalidrawElement } from "../../element/types";
import { BinaryFiles } from "../../types";
import { ArrowRightIcon } from "../icons";

type MermaidDefinition = string;

export const TTDDialog = ({
  onTextSubmit,
  __fallback,
}: {
  onTextSubmit?(i: string): Promise<string>;
  __fallback?: boolean | undefined;
}) => {
  const appState = useUIAppState();

  if (typeof appState.openDialog === "string" || appState.openDialog === null) {
    return null;
  }

  return <TTDDialogBase onTextSubmit={onTextSubmit} __fallback={__fallback} />;
};

/**
 * Text to diagram (TTD) dialog
 */
export const TTDDialogBase = withInternalFallback(
  "TTDDialogBase",
  ({
    onTextSubmit,
    ...rest
  }: {
    onTextSubmit?(i: string): Promise<MermaidDefinition>;
    __fallback?: boolean;
  }) => {
    const app = useApp();
    const { TTDDialogTabTriggersTunnel } = useTunnels();

    const someRandomDivRef = useRef<HTMLDivElement>(null);

    const [text, setText] = useState("");
    const handleTextChange: ChangeEventHandler<HTMLTextAreaElement> = (
      event,
    ) => {
      setText(event.target.value);
    };

    const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] =
      useState<MermaidToExcalidrawLibProps>({
        loaded: false,
        api: import(
          /* webpackChunkName:"mermaid-to-excalidraw" */ "@excalidraw/mermaid-to-excalidraw"
        ),
      });

    useEffect(() => {
      const fn = async () => {
        await mermaidToExcalidrawLib.api;
        setMermaidToExcalidrawLib((prev) => ({ ...prev, loaded: true }));
      };
      fn();
    }, [mermaidToExcalidrawLib.api]);

    const data = useRef<{
      elements: readonly NonDeletedExcalidrawElement[];
      files: BinaryFiles | null;
    }>({ elements: [], files: null });

    const [error, setError] = useState(null);

    const [onTextSubmitInProgess, setOnTextSubmitInProgess] = useState(false);

    return (
      <Dialog
        className="ttd-dialog"
        onCloseRequest={() => {
          app.setOpenDialog(null);
        }}
        size={1200}
        title=""
        {...rest}
      >
        <TTDDialogTabs>
          <TTDDialogTabTriggersTunnel.Out />
          {rest.__fallback && (
            <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
          )}
          {!rest.__fallback && (
            <TTDDialogTabTriggers>
              <TTDDialogTabTrigger tab="text-to-diagram">
                Text to Diagram
              </TTDDialogTabTrigger>
              <TTDDialogTabTrigger tab="mermaid">Mermaid</TTDDialogTabTrigger>
            </TTDDialogTabTriggers>
          )}

          <TTDDialogTab className="ttd-dialog-content" tab="mermaid">
            <MermaidToExcalidraw
              mermaidToExcalidrawLib={mermaidToExcalidrawLib}
            />
          </TTDDialogTab>
          {!rest.__fallback && (
            <TTDDialogTab className="ttd-dialog-content" tab="text-to-diagram">
              <TTDDialogPanels>
                <TTDDialogPanel
                  label="Left"
                  panelAction={{
                    action: async () => {
                      if (!onTextSubmit) {
                        return;
                      }

                      try {
                        setOnTextSubmitInProgess(true);

                        const mermaid = await onTextSubmit(text);

                        await convertMermaidToExcalidraw({
                          canvasRef: someRandomDivRef,
                          data,
                          mermaidToExcalidrawLib,
                          setError,
                          text: mermaid,
                        });

                        saveMermaidDataToStorage(mermaid);

                        setOnTextSubmitInProgess(false);
                      } catch (error) {
                        setOnTextSubmitInProgess(false);

                        // TODO barnabasmolnar/hal-9000-tabs
                        // error handling
                      }
                    },
                    label: "Generate",
                    icon: ArrowRightIcon,
                  }}
                  onTextSubmitInProgess={onTextSubmitInProgess}
                >
                  <TTDDialogInput onChange={handleTextChange} input={text} />
                </TTDDialogPanel>
                <TTDDialogPanel
                  label="Right"
                  panelAction={{
                    action: () => {
                      console.info("Panel action clicked");
                      insertToEditor({ app, data });
                    },
                    label: "Insert",
                    icon: ArrowRightIcon,
                  }}
                >
                  <TTDDialogOutput
                    canvasRef={someRandomDivRef}
                    errorMessage={error}
                    loaded={mermaidToExcalidrawLib.loaded}
                  />
                </TTDDialogPanel>
              </TTDDialogPanels>
            </TTDDialogTab>
          )}
        </TTDDialogTabs>
      </Dialog>
    );
  },
);
