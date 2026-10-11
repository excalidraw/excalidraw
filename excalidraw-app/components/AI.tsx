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
import { useAtom, useAtomValue } from "../app-jotai";
import { settingsAtom, settingsDialogStateAtom } from "../data/settingsState";

const NOT_CONFIGURED_MESSAGE =
  "No model is configured for this whiteboard. Ask an administrator to point it " +
  "at one — a local llama.cpp, Claude, or OpenCode Zen.";

/**
 * WHICH MODEL IS ANSWERING — said in the panel, not hidden in Settings.
 *
 * A user who has connected their own model should never have to guess whether
 * their prompt went to it or to whatever the deployment happens to run
 * (`feature-0017`). The chain is: this browser's Settings, then the install's
 * default, then nothing — and the panel says which one it landed on.
 */
const AnsweringWith = ({
  provider,
  model,
  fromSettings,
}: {
  provider: string;
  model?: string;
  fromSettings: boolean;
}) => (
  <p
    className="chat-interface__welcome-screen__welcome-message"
    style={{ marginTop: ".5rem" }}
  >
    Answering with <strong>{model || "(no model chosen)"}</strong>{" "}
    {model ? `via ${provider}` : `via ${provider}`}
    {fromSettings
      ? " — your own choice, from this browser's Settings"
      : " — the install's default"}
    .
  </p>
);

/** The door to Settings, offered where the problem is seen. */
const OpenSettings = () => {
  const [, setSettingsDialogState] = useAtom(settingsDialogStateAtom);
  return (
    <button
      type="button"
      className="welcome-modal__link"
      onClick={() => setSettingsDialogState({ isOpen: true })}
    >
      Open Settings
    </button>
  );
};

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  // The AI backend resolves from Settings first; an env var seeds a default only.
  const settings = useAtomValue(settingsAtom);
  const aiBackend = settings?.aiBackend ?? ENDPOINTS.aiBackend;

  // Which model this browser will use, and where that choice came from.
  const chosen = settings?.models?.[0];
  const answering = {
    provider: chosen?.kind ?? "the install's default",
    model: chosen?.model,
    fromSettings: Boolean(chosen?.baseURL),
  };

  if (!aiBackend) {
    // THE REAL CHAT MODAL, not a reduced one: every option the panel has — the
    // tabs, the history, the input, the Mermaid path — is its own. The missing
    // model is one extra line ON the real welcome screen, with the door to
    // Settings beside it, rather than a different, smaller panel.
    return (
      <TTDDialog
        onTextSubmit={async () => ({
          error: new RequestError({ message: NOT_CONFIGURED_MESSAGE }),
          generatedResponse: null,
        })}
        renderWelcomeScreen={() => (
          <>
            <TTDDialog.WelcomeMessage />
            <p className="chat-interface__welcome-screen__welcome-message">
              No model is configured for this browser yet. <OpenSettings /> to
              connect your own — a local llama.cpp, Claude, or OpenCode Zen.
            </p>
          </>
        )}
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
        renderWelcomeScreen={() => (
          <>
            <TTDDialog.WelcomeMessage />
            <AnsweringWith {...answering} />
          </>
        )}
        persistenceAdapter={TTDIndexedDBAdapter}
      />
    </>
  );
};
