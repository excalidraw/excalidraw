import { useState, type ReactNode } from "react";

import {
  DiagramToCodePlugin,
  exportToBlob,
  getNonDeletedElements,
  getTextFromElements,
  MIME_TYPES,
  TTADialog,
  TTADefaultTransportAdapter,
  TTDDefaultTransportAdapter,
  TTDDialog,
  TTDRateLimitWarningContent,
  useI18n,
} from "@excalidraw/excalidraw";
import Trans from "@excalidraw/excalidraw/components/Trans";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import { formatTimeToHourMinute, safelyParseJSON } from "@excalidraw/common";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TTDIndexedDBAdapter } from "../data/TTDStorage";

import "./AI.scss";

const TTA_LIMIT_UPSELL_URL = `${
  import.meta.env.VITE_APP_PLUS_LP
}/plus?utm_source=excalidraw&utm_medium=app&utm_content=aiChatBanner#excalidraw-redirect`;

const TTD_LIMIT_UPSELL_URL = `${
  import.meta.env.VITE_APP_PLUS_LP
}/plus?utm_source=excalidraw&utm_medium=app&utm_content=ttdChatBanner#excalidraw-redirect`;

const AI_BACKEND_BASE_URL = import.meta.env.VITE_APP_AI_BACKEND?.replace(
  /\/$/,
  "",
);

const postJson =
  (url: string) =>
  async ({
    method,
    headers,
    payload,
    signal,
  }: {
    method: "POST";
    headers: Record<string, string>;
    payload: unknown;
    signal?: AbortSignal;
  }) =>
    fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload),
      signal,
    });

const postJsonWithoutSignal =
  (url: string) =>
  async ({
    method,
    headers,
    payload,
  }: {
    method: "POST";
    headers: Record<string, string>;
    payload: unknown;
  }) =>
    fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload),
    });

const ttdTransport = new TTDDefaultTransportAdapter({
  stream: postJson(
    `${AI_BACKEND_BASE_URL}/v1/ai/text-to-diagram/chat-streaming`,
  ),
});
const ttaTransport = new TTADefaultTransportAdapter({
  stream: postJson(`${AI_BACKEND_BASE_URL}/v1/ai/tta/generate/stream`),
  truncate: postJsonWithoutSignal(
    `${AI_BACKEND_BASE_URL}/v1/ai/tta/chat/truncate`,
  ),
});

const TTASystemRateLimitWarning = ({
  title,
  timestamp,
  children,
}: {
  title: string;
  timestamp: string;
  children: ReactNode;
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "flex-start",
      width: "100%",
      paddingBottom: "0.5rem",
    }}
  >
    <div
      style={{
        maxWidth: "80%",
        minWidth: "6rem",
        padding: "0.75rem 1rem",
        borderRadius: "var(--border-radius-md)",
        background: "var(--color-warning)",
        color: "var(--color-warning-color)",
        boxShadow: "var(--chat-msg-shadow)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "0.5rem",
          fontSize: "0.75rem",
        }}
      >
        <span style={{ fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: "0.625rem" }}>{timestamp}</span>
      </div>
      <div style={{ fontFamily: "monospace" }}>{children}</div>
    </div>
  </div>
);

const TTAWelcomeScreen = () => {
  const { t } = useI18n();
  const [isStorageInfoDialogOpen, setIsStorageInfoDialogOpen] = useState(false);

  return (
    <>
      <div className="tta-chat-empty-tagline">
        {t("ai.chat.emptyState.guidance")}
      </div>
      <div className="tta-chat-empty-storage-notice">
        {t("ai.chat.emptyState.storageNotice")}{" "}
        <button
          type="button"
          className="tta-chat-empty-storage-notice__more"
          onClick={() => setIsStorageInfoDialogOpen(true)}
        >
          {t("ai.chat.emptyState.seeMore")}
        </button>
      </div>

      {isStorageInfoDialogOpen && (
        <Dialog
          title={t("ai.chat.emptyState.storageDialog.title")}
          size="small"
          onCloseRequest={() => setIsStorageInfoDialogOpen(false)}
        >
          <div className="tta-chat-empty-storage-dialog">
            <p>
              <Trans
                i18nKey="ai.chat.emptyState.storageDialog.description"
                link={(el) => (
                  <a
                    target="_blank"
                    rel="noopener"
                    href={`${
                      import.meta.env.VITE_APP_PLUS_LP
                    }/plus?utm_source=excalidraw&utm_medium=app&utm_content=aiUsageNotice#excalidraw-redirect`}
                  >
                    {el}
                  </a>
                )}
                br={() => (
                  <>
                    <br />
                    <br />
                  </>
                )}
              />
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
};

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  const { t } = useI18n();

  return (
    <>
      <DiagramToCodePlugin
        generate={async ({ frame, children }) => {
          const appState = excalidrawAPI.getAppState();

          // SAFETY: This should never happen, but log it just in case
          if (children.some((el) => el.isDeleted)) {
            console.error(
              "[NONDELETED][INVARIANT] Generated children elements should not be `isDeleted: true`",
            );
          }

          const blob = await exportToBlob({
            elements: getNonDeletedElements(children),
            appState: {
              ...appState,
              exportBackground: true,
              viewBackgroundColor: appState.viewBackgroundColor,
            },
            exportingFrame: frame,
            files: excalidrawAPI.getFiles(),
            mimeType: MIME_TYPES.jpg,
          });

          const dataURL = await getDataURL(blob);

          const textFromFrameChildren = getTextFromElements(children);

          const response = await fetch(
            `${
              import.meta.env.VITE_APP_AI_BACKEND
            }/v1/ai/diagram-to-code/generate`,
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                texts: textFromFrameChildren,
                image: dataURL,
                theme: appState.theme,
              }),
            },
          );

          if (!response.ok) {
            const text = await response.text();
            const errorJSON = safelyParseJSON(text);

            if (!errorJSON) {
              throw new Error(text);
            }

            if (errorJSON.statusCode === 429) {
              return {
                html: `<html>
                <body style="margin: 0; text-align: center">
                <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; height: 100vh; padding: 0 60px">
                  <div style="color:red">Too many requests today,</br>please try again tomorrow!</div>
                  </br>
                  </br>
                  <div>You can also try <a href="${
                    import.meta.env.VITE_APP_PLUS_LP
                  }/plus?utm_source=excalidraw&utm_medium=app&utm_content=d2c" target="_blank" rel="noopener">Excalidraw+</a> to get more requests.</div>
                </div>
                </body>
                </html>`,
              };
            }

            throw new Error(errorJSON.message || text);
          }

          try {
            const { html } = await response.json();

            if (!html) {
              throw new Error("Generation failed (invalid response)");
            }
            return {
              html,
            };
          } catch (error: any) {
            throw new Error("Generation failed (invalid response)");
          }
        }}
      />

      <TTDDialog
        transportAdapter={ttdTransport}
        renderWarning={(warning) => {
          return (
            <TTDRateLimitWarningContent
              warning={warning}
              onUpgrade={() => {
                window.open(TTD_LIMIT_UPSELL_URL, "_blank", "noopener");
              }}
            />
          );
        }}
        persistenceAdapter={TTDIndexedDBAdapter}
      />

      <TTADialog
        transportAdapter={ttaTransport}
        maxImages={1}
        renderWelcomeScreen={() => <TTAWelcomeScreen />}
        onMaxImages={() => (
          <Trans
            i18nKey="ai.chat.imageLimit"
            link={(el) => (
              <a
                target="_blank"
                rel="noopener"
                href={`${
                  import.meta.env.VITE_APP_PLUS_LP
                }/plus?utm_source=excalidraw&utm_medium=app&utm_content=ttt-imageLimit#excalidraw-redirect`}
              >
                {el}
              </a>
            )}
          />
        )}
        renderWarning={(warning, message) => {
          return (
            <TTASystemRateLimitWarning
              title={t("chat.role.system")}
              timestamp={formatTimeToHourMinute(
                message.createdAt ?? Date.now(),
              )}
            >
              <TTDRateLimitWarningContent
                warning={warning}
                onUpgrade={() => {
                  window.open(TTA_LIMIT_UPSELL_URL, "_blank", "noopener");
                }}
              />
            </TTASystemRateLimitWarning>
          );
        }}
      />
    </>
  );
};
