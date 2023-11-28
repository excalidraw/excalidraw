import { Dialog } from "../Dialog";
import { useApp } from "../App";
import MermaidToExcalidraw from "./MermaidToExcalidraw";
import TTDDialogTabs from "./TTDDialogTabs";
import { useEffect, useState } from "react";
import { useUIAppState } from "../../context/ui-appState";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { TTDDialogTabTriggers } from "./TTDDialogTabTriggers";
import { TTDDialogTabTrigger } from "./TTDDialogTabTrigger";
import { TTDDialogTab } from "./TTDDialogTab";
import { t } from "../../i18n";
import { CommonDialogProps, MermaidToExcalidrawLibProps } from "./common";

import "./TTDDialog.scss";
import { TextToDiagram } from "./TextToDiagram";
import { TextToDrawing } from "./TextToDrawing";

export const TTDDialog = (props: CommonDialogProps | { __fallback: true }) => {
  const appState = useUIAppState();

  if (appState.openDialog?.name !== "ttd") {
    return null;
  }

  return <TTDDialogBase {...props} tab={appState.openDialog.tab} />;
};

/**
 * Text to diagram (TTD) dialog
 */
export const TTDDialogBase = withInternalFallback(
  "TTDDialogBase",
  ({
    tab,
    ...rest
  }: {
    tab: "text-to-diagram" | "mermaid" | "text-to-drawing";
  } & (CommonDialogProps | { __fallback: true })) => {
    const app = useApp();

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

    return (
      <Dialog
        className="ttd-dialog"
        onCloseRequest={() => {
          app.setOpenDialog(null);
        }}
        size={1200}
        title={false}
        {...rest}
        autofocus={false}
      >
        <TTDDialogTabs dialog="ttd" tab={tab}>
          {"__fallback" in rest && rest.__fallback ? (
            <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
          ) : (
            <TTDDialogTabTriggers>
              <TTDDialogTabTrigger tab="text-to-diagram">
                <div style={{ display: "flex", alignItems: "center" }}>
                  {t("labels.textToDiagram")}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1px 6px",
                      marginLeft: "10px",
                      fontSize: 10,
                      borderRadius: "12px",
                      background: "pink",
                      color: "#000",
                    }}
                  >
                    AI Beta
                  </div>
                </div>
              </TTDDialogTabTrigger>
              <TTDDialogTabTrigger tab="text-to-drawing">
                <div style={{ display: "flex", alignItems: "center" }}>
                  {t("labels.textToDrawing")}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1px 6px",
                      marginLeft: "10px",
                      fontSize: 10,
                      borderRadius: "12px",
                      background: "pink",
                      color: "#000",
                    }}
                  >
                    AI Beta
                  </div>
                </div>
              </TTDDialogTabTrigger>
              <TTDDialogTabTrigger tab="mermaid">Mermaid</TTDDialogTabTrigger>
            </TTDDialogTabTriggers>
          )}

          <TTDDialogTab className="ttd-dialog-content" tab="mermaid">
            <MermaidToExcalidraw
              mermaidToExcalidrawLib={mermaidToExcalidrawLib}
            />
          </TTDDialogTab>
          {!("__fallback" in rest) && (
            <TTDDialogTab className="ttd-dialog-content" tab="text-to-diagram">
              <TextToDiagram
                onTextSubmit={rest.onTextSubmit}
                mermaidToExcalidrawLib={mermaidToExcalidrawLib}
              />
            </TTDDialogTab>
          )}
          {!("__fallback" in rest) && (
            <TTDDialogTab className="ttd-dialog-content" tab="text-to-drawing">
              <TextToDrawing onTextSubmit={rest.onTextSubmit} />
            </TTDDialogTab>
          )}
        </TTDDialogTabs>
      </Dialog>
    );
  },
);
