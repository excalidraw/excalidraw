import { useEffect, useState } from "react";

import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";
import { useApp } from "../App";
import { Dialog } from "../Dialog";
import { withInternalFallback } from "../hoc/withInternalFallback";

import MermaidToExcalidraw from "./MermaidToExcalidraw";
import TextToDiagram from "./TextToDiagram";
import TTDDialogTabs from "./TTDDialogTabs";
import { TTDDialogTabTriggers } from "./TTDDialogTabTriggers";
import { TTDDialogTabTrigger } from "./TTDDialogTabTrigger";
import { TTDDialogTab } from "./TTDDialogTab";

import "./TTDDialog.scss";

import { TTDWelcomeMessage } from "./TTDWelcomeMessage";

import type {
  MermaidToExcalidrawLibProps,
  TTDPersistenceAdapter,
  TTTDDialog,
} from "./types";

export const TTDDialog = (
  props:
    | {
        onTextSubmit: TTTDDialog.onTextSubmit;
        renderWelcomeScreen?: TTTDDialog.renderWelcomeScreen;
        renderWarning?: TTTDDialog.renderWarning;
        persistenceAdapter: TTDPersistenceAdapter;
      }
    | { __fallback: true },
) => {
  const appState = useUIAppState();

  if (appState.openDialog?.name !== "ttd") {
    return null;
  }

  return <TTDDialogBase {...props} tab={appState.openDialog.tab} />;
};

TTDDialog.WelcomeMessage = TTDWelcomeMessage;

/**
 * Text to diagram (TTD) dialog
 */
const TTDDialogBase = withInternalFallback(
  "TTDDialogBase",
  ({
    tab,
    ...rest
  }: {
    tab: "text-to-diagram" | "mermaid";
  } & (
    | {
        onTextSubmit(
          props: TTTDDialog.OnTextSubmitProps,
        ): Promise<TTTDDialog.OnTextSubmitRetValue>;
        renderWelcomeScreen?: TTTDDialog.renderWelcomeScreen;
        renderWarning?: TTTDDialog.renderWarning;
        persistenceAdapter: TTDPersistenceAdapter;
      }
    | { __fallback: true }
  )) => {
    const app = useApp();

    const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] =
      useState<MermaidToExcalidrawLibProps>({
        loaded: false,
        api: import("@excalidraw/mermaid-to-excalidraw"),
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
        size={1520}
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
                <div className="ttd-dialog-tab-trigger__content">
                  {t("labels.textToDiagram")}
                  <div className="ttd-dialog-tab-trigger__badge">
                    {t("chat.aiBeta")}
                  </div>
                </div>
              </TTDDialogTabTrigger>
              <TTDDialogTabTrigger tab="mermaid">
                {t("mermaid.label")}
              </TTDDialogTabTrigger>
            </TTDDialogTabTriggers>
          )}

          {!("__fallback" in rest) && (
            <TTDDialogTab className="ttd-dialog-content" tab="text-to-diagram">
              <TextToDiagram
                mermaidToExcalidrawLib={mermaidToExcalidrawLib}
                onTextSubmit={rest.onTextSubmit}
                renderWelcomeScreen={rest.renderWelcomeScreen}
                renderWarning={rest.renderWarning}
                persistenceAdapter={rest.persistenceAdapter}
              />
            </TTDDialogTab>
          )}
          <TTDDialogTab className="ttd-dialog-content" tab="mermaid">
            <MermaidToExcalidraw
              mermaidToExcalidrawLib={mermaidToExcalidrawLib}
              isActive={tab === "mermaid"}
            />
          </TTDDialogTab>
        </TTDDialogTabs>
      </Dialog>
    );
  },
);
