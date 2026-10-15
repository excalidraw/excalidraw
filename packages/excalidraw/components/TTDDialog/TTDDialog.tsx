import { useCallback, useEffect, useState } from "react";

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

const loadMermaidToExcalidrawLib = (): MermaidToExcalidrawLibProps["api"] => {
  const api = import("@excalidraw/mermaid-to-excalidraw");
  // called from state initializers/updaters, which React may invoke more than
  // once and discard the result -> don't let a discarded promise's rejection
  // go unhandled (consumers awaiting `api` still get the rejection)
  api.catch(() => {});
  return api;
};

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
      useState<MermaidToExcalidrawLibProps>(() => ({
        status: "loading",
        api: loadMermaidToExcalidrawLib(),
      }));

    const retryLoadingMermaidToExcalidrawLib = useCallback(() => {
      setMermaidToExcalidrawLib((prev) =>
        prev.status === "error"
          ? { ...prev, status: "loading", api: loadMermaidToExcalidrawLib() }
          : prev,
      );
    }, []);

    const { api: mermaidToExcalidrawLibApi } = mermaidToExcalidrawLib;
    useEffect(() => {
      const api = mermaidToExcalidrawLibApi;
      api.then(
        () => {
          setMermaidToExcalidrawLib((prev) =>
            prev.api === api
              ? { ...prev, status: "loaded", reloadRequired: false }
              : prev,
          );
        },
        (error: any) => {
          console.error("Failed to load mermaid-to-excalidraw", error);
          const reloadRequired = navigator.onLine;
          setMermaidToExcalidrawLib((prev) =>
            prev.api === api
              ? {
                  ...prev,
                  status: "error",
                  reloadRequired: prev.reloadRequired || reloadRequired,
                }
              : prev,
          );
        },
      );
    }, [mermaidToExcalidrawLibApi]);

    // the lib chunk isn't precached, so a failed load is most likely due to
    // being offline -> retry automatically once we're back online
    useEffect(() => {
      if (mermaidToExcalidrawLib.status !== "error") {
        return;
      }
      window.addEventListener("online", retryLoadingMermaidToExcalidrawLib);
      return () => {
        window.removeEventListener(
          "online",
          retryLoadingMermaidToExcalidrawLib,
        );
      };
    }, [mermaidToExcalidrawLib.status, retryLoadingMermaidToExcalidrawLib]);

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
                onRetryLoad={retryLoadingMermaidToExcalidrawLib}
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
              onRetryLoad={retryLoadingMermaidToExcalidrawLib}
              isActive={tab === "mermaid"}
            />
          </TTDDialogTab>
        </TTDDialogTabs>
      </Dialog>
    );
  },
);
