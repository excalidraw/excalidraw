import { useCallback, useEffect, useState } from "react";

import { addEventListener } from "@excalidraw/common";

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
import { isModuleLoadError } from "./utils/mermaidError";

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

const loadMermaidToExcalidrawLib = (
  onChunkLoadError: (api: MermaidToExcalidrawLibProps["api"]) => void,
): MermaidToExcalidrawLibProps["api"] => {
  const api: MermaidToExcalidrawLibProps["api"] = import(
    "@excalidraw/mermaid-to-excalidraw"
  ).then((lib) => ({
    // mermaid lazy-loads a chunk per diagram type, which can fail to load
    // (e.g. offline) even though the lib itself loaded fine
    parseMermaidToExcalidraw: async (definition, config) => {
      try {
        return await lib.parseMermaidToExcalidraw(definition, config);
      } catch (error) {
        if (isModuleLoadError(error)) {
          onChunkLoadError(api);
        }
        throw error;
      }
    },
  }));
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
        api: loadMermaidToExcalidrawLib((api) => setLoadError(api)),
      }));

    // `api` (or one of the chunks it lazy-loads) failed to load
    const setLoadError = useCallback(
      (api: MermaidToExcalidrawLibProps["api"]) => {
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
      [],
    );

    const retryLoadingMermaidToExcalidrawLib = useCallback(() => {
      setMermaidToExcalidrawLib((prev) =>
        prev.status === "error"
          ? {
              ...prev,
              status: "loading",
              api: loadMermaidToExcalidrawLib(setLoadError),
            }
          : prev,
      );
    }, [setLoadError]);

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
          setLoadError(api);
        },
      );
    }, [mermaidToExcalidrawLibApi, setLoadError]);

    // the lib chunk isn't precached, so a failed load is most likely due to
    // being offline -> retry automatically once we're back online
    useEffect(() => {
      if (mermaidToExcalidrawLib.status !== "error") {
        return;
      }
      return addEventListener(
        app.ownerWindow,
        "online",
        retryLoadingMermaidToExcalidrawLib,
      );
    }, [
      app,
      mermaidToExcalidrawLib.status,
      retryLoadingMermaidToExcalidrawLib,
    ]);

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
