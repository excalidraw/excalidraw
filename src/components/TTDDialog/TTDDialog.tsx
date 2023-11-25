import { Dialog } from "../Dialog";
import { useApp } from "../App";
import MermaidToExcalidraw from "./MermaidToExcalidraw";
import TTDDialogTabs from "./TTDDialogTabs";
import { ChangeEventHandler, useEffect, useRef, useState } from "react";
import { useUIAppState } from "../../context/ui-appState";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { TTDDialogTabTriggers } from "./TTDDialogTabTriggers";
import { TTDDialogTabTrigger } from "./TTDDialogTabTrigger";
import { TTDDialogTab } from "./TTDDialogTab";
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

import "./TTDDialog.scss";
import { isFiniteNumber } from "../../utils";
import { atom, useAtom } from "jotai";
import { trackEvent } from "../../analytics";

const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 1000;

const rateLimitsAtom = atom<{
  rateLimit: number;
  rateLimitRemaining: number;
} | null>(null);

type OnTestSubmitRetValue = {
  rateLimit?: number | null;
  rateLimitRemaining?: number | null;
} & (
  | { generatedResponse: string | undefined; error?: null | undefined }
  | {
      error: Error;
      generatedResponse?: null | undefined;
    }
);

export const TTDDialog = (
  props:
    | {
        onTextSubmit(value: string): Promise<OnTestSubmitRetValue>;
      }
    | { __fallback: true },
) => {
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
    tab: string;
  } & (
    | {
        onTextSubmit(value: string): Promise<OnTestSubmitRetValue>;
      }
    | { __fallback: true }
  )) => {
    const app = useApp();

    const someRandomDivRef = useRef<HTMLDivElement>(null);

    const [text, setText] = useState("");

    const prompt = text.trim();

    const handleTextChange: ChangeEventHandler<HTMLTextAreaElement> = (
      event,
    ) => {
      setText(event.target.value);
    };

    const [onTextSubmitInProgess, setOnTextSubmitInProgess] = useState(false);
    const [rateLimits, setRateLimits] = useAtom(rateLimitsAtom);

    const onGenerate = async () => {
      if (
        prompt.length > MAX_PROMPT_LENGTH ||
        prompt.length < MIN_PROMPT_LENGTH ||
        onTextSubmitInProgess ||
        rateLimits?.rateLimitRemaining === 0 ||
        // means this is not a text-to-diagram dialog (needed for TS only)
        "__fallback" in rest
      ) {
        if (prompt.length < MIN_PROMPT_LENGTH) {
          setError(
            new Error(
              `Prompt is too short (min ${MIN_PROMPT_LENGTH} characters)`,
            ),
          );
        }
        if (prompt.length > MAX_PROMPT_LENGTH) {
          setError(
            new Error(
              `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`,
            ),
          );
        }

        return;
      }

      try {
        setOnTextSubmitInProgess(true);

        trackEvent("ai", "generate", "ttd");

        const { generatedResponse, error, rateLimit, rateLimitRemaining } =
          await rest.onTextSubmit(prompt);

        if (isFiniteNumber(rateLimit) && isFiniteNumber(rateLimitRemaining)) {
          setRateLimits({ rateLimit, rateLimitRemaining });
        }

        if (error) {
          setError(error);
          return;
        }
        if (!generatedResponse) {
          setError(new Error("Generation failed"));
          return;
        }

        try {
          await convertMermaidToExcalidraw({
            canvasRef: someRandomDivRef,
            data,
            mermaidToExcalidrawLib,
            setError,
            text: generatedResponse,
          });
          trackEvent("ai", "mermaid parse success", "ttd");
          saveMermaidDataToStorage(generatedResponse);
        } catch (error: any) {
          trackEvent("ai", "mermaid parse failed", "ttd");
          setError(
            new Error(
              "Generated an invalid diagram :(. You may also try a different prompt.",
            ),
          );
        }
      } catch (error: any) {
        let message: string | undefined = error.message;
        if (!message || message === "Failed to fetch") {
          message = "Request failed";
        }
        setError(new Error(message));
      } finally {
        setOnTextSubmitInProgess(false);
      }
    };

    const refOnGenerate = useRef(onGenerate);
    refOnGenerate.current = onGenerate;

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

    const [error, setError] = useState<Error | null>(null);

    return (
      <Dialog
        className="ttd-dialog"
        onCloseRequest={() => {
          app.setOpenDialog(null);
        }}
        size={1200}
        title=""
        {...rest}
        autofocus={false}
      >
        <TTDDialogTabs tab={tab}>
          {"__fallback" in rest && rest.__fallback ? (
            <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
          ) : (
            <TTDDialogTabTriggers>
              <TTDDialogTabTrigger tab="text-to-diagram">
                {t("labels.textToDiagram")}
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
              <div className="ttd-dialog-desc">
                Currently we use Mermaid as a middle step, so you'll get best
                results if you describe a diagram, workflow, flow chart, and
                similar.
              </div>
              <TTDDialogPanels>
                <TTDDialogPanel
                  label={t("labels.prompt")}
                  panelAction={{
                    action: onGenerate,
                    label: "Generate",
                    icon: ArrowRightIcon,
                  }}
                  onTextSubmitInProgess={onTextSubmitInProgess}
                  panelActionDisabled={
                    prompt.length > MAX_PROMPT_LENGTH ||
                    rateLimits?.rateLimitRemaining === 0
                  }
                  renderTopRight={() => {
                    if (!rateLimits) {
                      return null;
                    }

                    return (
                      <div
                        className="ttd-dialog-rate-limit"
                        style={{
                          fontSize: 12,
                          marginLeft: "auto",
                          color:
                            rateLimits.rateLimitRemaining === 0
                              ? "var(--color-danger)"
                              : undefined,
                        }}
                      >
                        {rateLimits.rateLimitRemaining} requests left today
                      </div>
                    );
                  }}
                  renderBottomRight={() => {
                    const ratio = prompt.length / MAX_PROMPT_LENGTH;
                    if (ratio > 0.8) {
                      return (
                        <div
                          style={{
                            marginLeft: "auto",
                            fontSize: 12,
                            fontFamily: "monospace",
                            color:
                              ratio > 1 ? "var(--color-danger)" : undefined,
                          }}
                        >
                          Length: {prompt.length}/{MAX_PROMPT_LENGTH}
                        </div>
                      );
                    }

                    return null;
                  }}
                >
                  <TTDDialogInput
                    onChange={handleTextChange}
                    input={text}
                    placeholder={"Describe what you want to see..."}
                    onKeyboardSubmit={() => {
                      refOnGenerate.current();
                    }}
                  />
                </TTDDialogPanel>
                <TTDDialogPanel
                  label="Preview"
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
                    error={error}
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
