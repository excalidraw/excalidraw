import {
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
import { RequestError } from "@excalidraw/excalidraw/errors";
import { safelyParseJSON } from "@excalidraw/common";

import type { StreamChunk } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TTDIndexedDBAdapter } from "../data/TTDStorage";
import { ENDPOINTS } from "../endpoints";
import { useAtomValue } from "../app-jotai";
import { settingsAtom } from "../data/settingsState";

const NOT_CONFIGURED_MESSAGE =
  "No model is configured for this whiteboard. Ask an administrator to point it " +
  "at one — a local llama.cpp, Claude, or OpenCode Zen.";

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  // The AI backend resolves from Settings first; an env var seeds a default only.
  const settings = useAtomValue(settingsAtom);
  const aiBackend = settings?.aiBackend ?? ENDPOINTS.aiBackend;

  if (!aiBackend) {
    // THE REAL CHAT MODAL, not a reduced one. Everything the panel offers — the
    // tabs, the history, the input, the Mermaid path — is the panel's own, and the
    // missing model is reported as a message IN the chat. A user should get the
    // whole chatbox with one honest line about why no answer comes back, rather
    // than a different, smaller thing that is not the chat.
    return (
      <TTDDialog
        onTextSubmit={async () => ({
          error: new RequestError({ message: NOT_CONFIGURED_MESSAGE }),
          generatedResponse: null,
        })}
        persistenceAdapter={TTDIndexedDBAdapter}
      />
    );
  }

  return (
    <>
      {/* Offered only when the bridge can actually see: an entry that always
          errors reads as a defect, and the bridge answers the same question at
          /healthz with `vision`. */}
      {settings?.visionEnabled && (
        <DiagramToCodePlugin
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
              `${aiBackend}/v1/ai/diagram-to-code/generate-streaming`,
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
                return {
                  html: `<html>
                <body style="margin: 0; text-align: center">
                <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; height: 100vh; padding: 0 60px">
                  <div style="color:red">Too many requests today,</br>please try again tomorrow!</div>
                  </br>
                  </br>
                  <div>Too many requests today, please try again tomorrow.</div>
                </div>
                </body>
                </html>`,
                };
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
      )}

      <TTDDialog
        onTextSubmit={async (props) => {
          const { onChunk, onStreamCreated, signal, messages } = props;

          const result = await TTDStreamFetch({
            url: `${aiBackend}/v1/ai/text-to-diagram/chat-streaming`,
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
