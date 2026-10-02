import {
  DiagramToCodeError,
  DiagramToCodePlugin,
  exportToBlob,
  getNonDeletedElements,
  getTextFromElements,
  MIME_TYPES,
  parseSSEStream,
  TTDDialog,
  TTDStreamFetch,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import { safelyParseJSON } from "@excalidraw/common";

import type {
  RenderDiagramToCodeError,
  StreamChunk,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TTDIndexedDBAdapter } from "../data/TTDStorage";

const ERR_RATE_LIMIT = "ERR_RATE_LIMIT";

// rendered by the editor as app UI over the failed `iframe` element (not
// inside its sandboxed frame). Error data comes from the (untrusted) element,
// so we only use the `code` to pick our own content.
const renderDiagramToCodeError: RenderDiagramToCodeError = ({ code }) => {
  if (code !== ERR_RATE_LIMIT) {
    return null;
  }
  return (
    <>
      <div style={{ color: "var(--color-danger)" }}>
        Too many requests today,
        <br />
        please try again tomorrow!
      </div>
      <div>
        You can also try{" "}
        <a
          href={`${
            import.meta.env.VITE_APP_PLUS_LP
          }/plus?utm_source=excalidraw&utm_medium=app&utm_content=d2c`}
          target="_blank"
          rel="noopener"
        >
          Excalidraw+
        </a>{" "}
        to get more requests.
      </div>
    </>
  );
};

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  return (
    <>
      <DiagramToCodePlugin
        renderError={renderDiagramToCodeError}
        generate={async ({ frame, children, onPartial }) => {
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
            }/v1/ai/diagram-to-code/generate-streaming`,
            {
              method: "POST",
              headers: {
                Accept: "text/event-stream",
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
              throw new DiagramToCodeError(
                "Too many requests today, please try again tomorrow!",
                ERR_RATE_LIMIT,
              );
            }

            throw new Error(errorJSON.message || text);
          }

          const reader = response.body?.getReader();

          if (!reader) {
            throw new Error("Generation failed (invalid response)");
          }

          let html = "";
          let streamError: Error | null = null;

          for await (const data of parseSSEStream(reader)) {
            if (data === "[DONE]") {
              break;
            }

            const chunk = safelyParseJSON(data) as StreamChunk | null;

            if (!chunk) {
              continue;
            }

            switch (chunk.type) {
              case "content": {
                if (chunk.delta) {
                  html += chunk.delta;
                  onPartial?.(html);
                }
                break;
              }
              case "error": {
                streamError = new Error(
                  chunk.error.message || "Generation failed",
                );
                break;
              }
              case "done": {
                break;
              }
            }
          }

          if (streamError) {
            throw streamError;
          }

          if (!html.trim()) {
            throw new Error("Generation failed (invalid response)");
          }

          return {
            html,
          };
        }}
      />

      <TTDDialog
        onTextSubmit={async (props) => {
          const { onChunk, onStreamCreated, signal, messages } = props;

          const result = await TTDStreamFetch({
            url: `${
              import.meta.env.VITE_APP_AI_BACKEND
            }/v1/ai/text-to-diagram/chat-streaming`,
            messages,
            onChunk,
            onStreamCreated,
            extractRateLimits: true,
            signal,
          });

          return result;
        }}
        persistenceAdapter={TTDIndexedDBAdapter}
      />
    </>
  );
};
