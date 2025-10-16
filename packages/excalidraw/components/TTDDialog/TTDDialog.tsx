import { useEffect, useRef, useState } from "react";

import { isFiniteNumber } from "@excalidraw/math";
import { isDevEnv } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { trackEvent } from "../../analytics";
import { useUIAppState } from "../../context/ui-appState";
import { atom, useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { useApp, useExcalidrawSetAppState } from "../App";
import { Dialog } from "../Dialog";
import { InlineIcon } from "../InlineIcon";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { ArrowRightIcon } from "../icons";

import MermaidToExcalidraw from "./MermaidToExcalidraw";
import TTDDialogTabs from "./TTDDialogTabs";
import { TTDDialogTabTriggers } from "./TTDDialogTabTriggers";
import { TTDDialogTabTrigger } from "./TTDDialogTabTrigger";
import { TTDDialogTab } from "./TTDDialogTab";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";

import {
  convertMermaidToExcalidraw,
  insertToEditor,
  saveMermaidDataToStorage,
} from "./common";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";
import { TTDDialogCloseButton } from "./TTDDialogCloseButton";

import "./TTDDialog.scss";

import type { ChangeEventHandler } from "react";
import type { MermaidToExcalidrawLibProps } from "./common";

import type { BinaryFiles } from "../../types";

const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 1000;

const rateLimitsAtom = atom<{
  rateLimit: number;
  rateLimitRemaining: number;
} | null>(null);

interface RateLimitDisplayProps {
  rateLimitRemaining: number;
}

const RateLimitDisplay = ({ rateLimitRemaining }: RateLimitDisplayProps) => {
  const isExceeded = rateLimitRemaining === 0;
  return (
    <div
      className={`ttd-dialog-rate-limit ${isExceeded ? "ttd-dialog-rate-limit--exceeded" : ""}`}
    >
      {rateLimitRemaining} requests left today
    </div>
  );
};

interface PromptFooterProps {
  generatedResponse: string | null;
  promptLength: number;
  onViewMermaid: () => void;
}

const PromptFooter = ({
  generatedResponse,
  promptLength,
  onViewMermaid,
}: PromptFooterProps) => {
  if (generatedResponse) {
    return (
      <div
        className="excalidraw-link ttd-dialog-view-mermaid-link"
        onClick={onViewMermaid}
      >
        View as Mermaid
        <InlineIcon icon={ArrowRightIcon} />
      </div>
    );
  }

  const ratio = promptLength / MAX_PROMPT_LENGTH;
  if (ratio > 0.8) {
    const isExceeded = ratio > 1;
    return (
      <div
        className={`ttd-dialog-char-count ${isExceeded ? "ttd-dialog-char-count--exceeded" : ""}`}
      >
        Length: {promptLength}/{MAX_PROMPT_LENGTH}
      </div>
    );
  }

  return null;
};

const ttdGenerationAtom = atom<{
  generatedResponse: string | null;
  prompt: string | null;
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
    tab: "text-to-diagram" | "mermaid";
  } & (
    | {
        onTextSubmit(value: string): Promise<OnTestSubmitRetValue>;
      }
    | { __fallback: true }
  )) => {
    const app = useApp();
    const setAppState = useExcalidrawSetAppState();

    const previewCanvasRef = useRef<HTMLDivElement>(null);

    const [ttdGeneration, setTtdGeneration] = useAtom(ttdGenerationAtom);

    const [text, setText] = useState(ttdGeneration?.prompt ?? "");

    const prompt = text.trim();

    const handleTextChange: ChangeEventHandler<HTMLTextAreaElement> = (
      event,
    ) => {
      setText(event.target.value);
      setTtdGeneration((s) => ({
        generatedResponse: s?.generatedResponse ?? null,
        prompt: event.target.value,
      }));
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

        if (typeof generatedResponse === "string") {
          setTtdGeneration((s) => ({
            generatedResponse,
            prompt: s?.prompt ?? null,
          }));
        }

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
            canvasRef: previewCanvasRef,
            data,
            mermaidToExcalidrawLib,
            setError,
            mermaidDefinition: generatedResponse,
          });
          trackEvent("ai", "mermaid parse success", "ttd");
        } catch (error: any) {
          if (isDevEnv()) {
            console.info(
              `%cTTD mermaid render errror: ${error.message}`,
              "color: red",
            );
            console.info(
              `>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\nTTD mermaid definition render errror: ${error.message}`,
              "color: yellow",
            );
          }
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
        api: import("@excalidraw/mermaid-to-excalidraw"),
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
        title={false}
        {...rest}
        autofocus={false}
      >
        <TTDDialogCloseButton
          onClose={() => {
            app.setOpenDialog(null);
          }}
        />
        <TTDDialogTabs dialog="ttd" tab={tab}>
          {"__fallback" in rest && rest.__fallback ? (
            <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
          ) : (
            <TTDDialogTabTriggers>
              <TTDDialogTabTrigger tab="text-to-diagram">
                <div style={{ display: "flex", alignItems: "center" }}>
                  {t("labels.textToDiagram")}
                  <div className="ttd-dialog-ai-badge">AI Beta</div>
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
                  renderTopRight={() =>
                    rateLimits ? (
                      <RateLimitDisplay
                        rateLimitRemaining={rateLimits.rateLimitRemaining}
                      />
                    ) : null
                  }
                  renderSubmitShortcut={() => <TTDDialogSubmitShortcut />}
                  renderBottomRight={() => (
                    <PromptFooter
                      generatedResponse={ttdGeneration?.generatedResponse ?? null}
                      promptLength={prompt.length}
                      onViewMermaid={() => {
                        if (ttdGeneration?.generatedResponse) {
                          saveMermaidDataToStorage(
                            ttdGeneration.generatedResponse,
                          );
                          setAppState({
                            openDialog: { name: "ttd", tab: "mermaid" },
                          });
                        }
                      }}
                    />
                  )}
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
                      insertToEditor({ app, data });
                    },
                    label: "Insert",
                    icon: ArrowRightIcon,
                  }}
                >
                  <TTDDialogOutput
                    canvasRef={previewCanvasRef}
                    error={error}
                    loaded={mermaidToExcalidrawLib.loaded}
                    hasContent={!!ttdGeneration?.generatedResponse}
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
