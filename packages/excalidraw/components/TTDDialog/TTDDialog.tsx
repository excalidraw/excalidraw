import { useEffect, useRef, useState } from "react";

import { isFiniteNumber } from "@excalidraw/math";
import { isDevEnv } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { trackEvent } from "../../analytics";
import { useUIAppState } from "../../context/ui-appState";
import { atom, useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { useApp } from "../App";
import { Dialog } from "../Dialog";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { ArrowRightIcon, brainIcon } from "../icons";
import { Switch } from "../Switch";

import MermaidToExcalidraw from "./MermaidToExcalidraw";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";
import { TTDDialogCTAPopup } from "./TTDDialogCTAPopup";
import { TTDDialogErrorBanner } from "./TTDDialogErrorBanner";
import { TTDDialogErrorToast } from "./TTDDialogErrorToast";
import TTDDialogTabs from "./TTDDialogTabs";
import { TTDDialogTab } from "./TTDDialogTab";
import { TTDDialogTabTrigger } from "./TTDDialogTabTrigger";
import { TTDDialogTabTriggers } from "./TTDDialogTabTriggers";

import {
convertMermaidToExcalidraw,
insertToEditor,
} from "./common";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";
import { TTDDialogCloseButton } from "./TTDDialogCloseButton";

import "./TTDDialog.scss";

import type { ChangeEventHandler } from "react";
import type { MermaidToExcalidrawLibProps } from "./common";

import type { BinaryFiles } from "../../types";

const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 1000;
const MOBILE_BREAKPOINT = 860;

const DEFAULT_PROMPT = "";

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
  promptLength: number;
}

const PromptFooter = ({ promptLength }: PromptFooterProps) => {
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

type OnTextSubmitRetValue = {
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
        onTextSubmit(value: string): Promise<OnTextSubmitRetValue>;
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
        onTextSubmit(value: string): Promise<OnTextSubmitRetValue>;
      }
    | { __fallback: true }
  )) => {
  const app = useApp();

  const previewCanvasRef = useRef<HTMLDivElement>(null);

  const [ttdGeneration, setTtdGeneration] = useAtom(ttdGenerationAtom);

  const [text, setText] = useState(ttdGeneration?.prompt ?? DEFAULT_PROMPT);

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
  const [isCtaPopupOpen, setIsCtaPopupOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  // Detect mobile view using media query
  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    setIsMobileView(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobileView(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const onGenerate = async () => {
    if (rateLimits?.rateLimitRemaining === 0) {
      setIsCtaPopupOpen(true);
      return;
    }

    if (
      prompt.length > MAX_PROMPT_LENGTH ||
      prompt.length < MIN_PROMPT_LENGTH ||
      onTextSubmitInProgess ||
      "__fallback" in rest
    ) {
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
        setErrorMessage(error.message);
        return;
      }
      if (!generatedResponse) {
        setErrorMessage("Generation failed");
        return;
      }
    } catch (error: unknown) {
      let message: string | undefined;
      if (error instanceof Error) {
        message = error.message;
      }
      if (!message || message === "Failed to fetch") {
        message = "Request failed";
      }
      setErrorMessage(message);
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

  const [showMermaidCode, setShowMermaidCode] = useState(false);
  const [editedMermaidCode, setEditedMermaidCode] = useState<string>("");
  const [hasValidDiagram, setHasValidDiagram] = useState(false);
  const [renderErrorMessage, setRenderErrorMessage] = useState<string | null>(null);

  const renderMermaidDiagram = async (
    mermaidDefinition: string,
    errorContext: string,
  ) => {
    try {
      await convertMermaidToExcalidraw({
        canvasRef: previewCanvasRef,
        data,
        mermaidToExcalidrawLib,
        setError: () => {},
        mermaidDefinition,
      });
      setHasValidDiagram(true);
      setRenderErrorMessage(null);
      trackEvent("ai", "mermaid parse success", "ttd");
    } catch (error: unknown) {
      setHasValidDiagram(false);
      const errorMsg =
        error instanceof Error ? error.message : "Unknown syntax error";
      setRenderErrorMessage(errorMsg);

      if (isDevEnv()) {
        console.error(`TTD mermaid render error:`, error);
      }

      trackEvent("ai", "mermaid parse failed", "ttd");
      setErrorMessage(errorContext);
    }
  };

  // Reset to preview mode when new diagram is generated and sync edited code
  useEffect(() => {
    if (ttdGeneration?.generatedResponse) {
      setShowMermaidCode(false);
      setEditedMermaidCode(ttdGeneration.generatedResponse);
      setHasValidDiagram(false);
      setRenderErrorMessage(null);
    }
  }, [ttdGeneration?.generatedResponse]);

  // Re-render diagram when switching back to preview mode
  useEffect(() => {
    const renderDiagram = async () => {
      if (
        !showMermaidCode &&
        editedMermaidCode &&
        mermaidToExcalidrawLib.loaded
      ) {
        await renderMermaidDiagram(
          editedMermaidCode,
          "Syntax error in diagram code. Please fix the code or generate a new diagram.",
        );
      }
    };

    renderDiagram();
  }, [showMermaidCode, editedMermaidCode, mermaidToExcalidrawLib.loaded]);


  useEffect(() => {
    if (tab !== "text-to-diagram") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey
      ) {
        event.preventDefault();
        insertToEditor({ app, data });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tab]);

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
      {"__fallback" in rest && rest.__fallback ? (
        <>
          <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
          <div className="ttd-dialog-content">
            <MermaidToExcalidraw
              mermaidToExcalidrawLib={mermaidToExcalidrawLib}
            />
          </div>
        </>
      ) : (
        <TTDDialogTabs dialog="ttd" tab={tab}>
          <TTDDialogTabTriggers>
            <TTDDialogTabTrigger tab="text-to-diagram">
              {t("labels.textToDiagram")}
              <span className="ttd-dialog-ai-badge">AI Beta</span>
            </TTDDialogTabTrigger>
            <TTDDialogTabTrigger tab="mermaid">
              Mermaid to diagram
            </TTDDialogTabTrigger>
          </TTDDialogTabTriggers>

          <TTDDialogTab tab="text-to-diagram" className="ttd-dialog-content">
            {!isMobileView && (
              <div className="ttd-dialog-error-banner-container">
                {errorMessage && (
                  <TTDDialogErrorBanner
                    message={errorMessage}
                    onClose={() => setErrorMessage(null)}
                  />
                )}
              </div>
            )}
            <TTDDialogPanels>
              <TTDDialogPanel
                label={t("labels.prompt")}
                panelAction={{
                  action: onGenerate,
                  label: "Generate",
                  icon: brainIcon,
                }}
                onTextSubmitInProgess={onTextSubmitInProgess}
                panelActionDisabled={
                  prompt.length < MIN_PROMPT_LENGTH ||
                  prompt.length > MAX_PROMPT_LENGTH
                }
                renderTopRight={() => (
                  <>
                    <PromptFooter promptLength={prompt.length} />
                    {rateLimits && (
                      <RateLimitDisplay
                        rateLimitRemaining={rateLimits.rateLimitRemaining}
                      />
                    )}
                  </>
                )}
                renderSubmitShortcut={() => <TTDDialogSubmitShortcut variant="enter" />}
              >
                <TTDDialogInput
                  onChange={handleTextChange}
                  input={text}
                  placeholder="What should we draw today? Describe a diagram, workflow, flow chart, and similar details."
                  onKeyboardSubmit={() => {
                    refOnGenerate.current();
                  }}
                  shortcutType="enter"
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
                renderTopRight={() => (
                  <div className="ttd-dialog-code-toggle-wrapper">
                    <label htmlFor="ttd-code-toggle" className="ttd-dialog-code-toggle-label">
                      Edit as code
                    </label>
                    <Switch
                      name="ttd-code-toggle"
                      checked={showMermaidCode}
                      onChange={(checked) => setShowMermaidCode(checked)}
                      disabled={!ttdGeneration?.generatedResponse}
                    />
                  </div>
                )}
                renderSubmitShortcut={() => <TTDDialogSubmitShortcut variant="ctrlEnter" />}
              >
                <TTDDialogOutput
                  canvasRef={previewCanvasRef}
                  error={null}
                  loaded={mermaidToExcalidrawLib.loaded}
                  hasContent={hasValidDiagram}
                  showMermaidCode={showMermaidCode}
                  mermaidCode={editedMermaidCode}
                  onMermaidCodeChange={setEditedMermaidCode}
                  renderError={renderErrorMessage}
                />
              </TTDDialogPanel>
            </TTDDialogPanels>
          </TTDDialogTab>

          <TTDDialogTab tab="mermaid" className="ttd-dialog-content">
            <MermaidToExcalidraw
              mermaidToExcalidrawLib={mermaidToExcalidrawLib}
            />
          </TTDDialogTab>
        </TTDDialogTabs>
      )}
      <TTDDialogCTAPopup
        isOpen={isCtaPopupOpen}
        onClose={() => setIsCtaPopupOpen(false)}
        onExploreClick={() => {
          window.open(
            import.meta.env.VITE_APP_PLUS_LP || "https://plus.excalidraw.com",
            "_blank",
          );
        }}
        onFreeTrialClick={() => {
          window.open(
            import.meta.env.VITE_APP_PLUS_TRIAL || "https://app.excalidraw.com/",
            "_blank",
          );
        }}
      />
      {isMobileView && (
        <TTDDialogErrorToast
          isOpen={!!errorMessage}
          message={errorMessage || ""}
          onClose={() => setErrorMessage(null)}
          autoHideDuration={5000}
        />
      )}
    </Dialog>
  );
},
);
