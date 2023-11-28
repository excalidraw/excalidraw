import { useAtom } from "jotai";
import { useRef, useState, ChangeEventHandler } from "react";
import { trackEvent } from "../../analytics";
import { t } from "../../i18n";
import { isFiniteNumber } from "../../utils";
import { ArrowRightIcon } from "../icons";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";
import {
  CommonDialogProps,
  MAX_PROMPT_LENGTH,
  MIN_PROMPT_LENGTH,
  MermaidToExcalidrawLibProps,
  convertMermaidToExcalidraw,
  insertToEditor,
  rateLimitsAtom,
  saveMermaidDataToStorage,
} from "./common";
import { useApp } from "../App";
import { NonDeletedExcalidrawElement } from "../../element/types";
import { BinaryFiles } from "../../types";

export type TextToDiagramProps = CommonDialogProps & {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
};

export const TextToDiagram = ({
  onTextSubmit,
  mermaidToExcalidrawLib,
}: TextToDiagramProps) => {
  const app = useApp();

  const someRandomDivRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState("");

  const prompt = text.trim();

  const handleTextChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    setText(event.target.value);
  };

  const [onTextSubmitInProgess, setOnTextSubmitInProgess] = useState(false);
  const [rateLimits, setRateLimits] = useAtom(rateLimitsAtom);

  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });

  const [error, setError] = useState<Error | null>(null);

  const onGenerate = async () => {
    if (
      prompt.length > MAX_PROMPT_LENGTH ||
      prompt.length < MIN_PROMPT_LENGTH ||
      onTextSubmitInProgess ||
      rateLimits?.rateLimitRemaining === 0
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
          new Error(`Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`),
        );
      }

      return;
    }

    try {
      setOnTextSubmitInProgess(true);

      trackEvent("ai", "generate", "ttd");

      const { generatedResponse, error, rateLimit, rateLimitRemaining } =
        await onTextSubmit(prompt, "text-to-diagram");

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
          mermaidDefinition: generatedResponse,
        });
        trackEvent("ai", "mermaid parse success", "ttd");
        saveMermaidDataToStorage(generatedResponse);
      } catch (error: any) {
        console.info(
          `%cTTD mermaid render errror: ${error.message}`,
          "color: red",
        );
        console.info(
          `>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\nTTD mermaid definition render errror: ${error.message}`,
          "color: yellow",
        );
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

  return (
    <>
      <div className="ttd-dialog-desc">
        Currently we use Mermaid as a middle step, so you'll get best results if
        you describe a diagram, workflow, flow chart, and similar.
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
                    color: ratio > 1 ? "var(--color-danger)" : undefined,
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
              insertToEditor({ app, data: data.current });
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
    </>
  );
};
