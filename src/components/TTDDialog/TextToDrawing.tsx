import { useAtom } from "jotai";
import { useRef, useState, ChangeEventHandler } from "react";
import { trackEvent } from "../../analytics";
import { NonDeletedExcalidrawElement } from "../../element/types";
import { t } from "../../i18n";
import { isFiniteNumber } from "../../utils";
import { useApp } from "../App";
import { ArrowRightIcon } from "../icons";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";
import {
  CommonDialogProps,
  MAX_PROMPT_LENGTH,
  MIN_PROMPT_LENGTH,
  insertToEditor,
  rateLimitsAtom,
  resetPreview,
} from "./common";
import {
  convertToExcalidrawElements,
  exportToCanvas,
} from "../../packages/excalidraw/index";
import { DEFAULT_EXPORT_PADDING } from "../../constants";
import { canvasToBlob } from "../../data/blob";

export type TextToDrawingProps = CommonDialogProps;

export const TextToDrawing = ({ onTextSubmit }: TextToDrawingProps) => {
  const app = useApp();
  const containerRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState("");

  const prompt = text.trim();

  const handleTextChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    setText(event.target.value);
  };

  const [onTextSubmitInProgess, setOnTextSubmitInProgess] = useState(false);
  const [rateLimits, setRateLimits] = useAtom(rateLimitsAtom);

  const [data, setData] = useState<
    readonly NonDeletedExcalidrawElement[] | null
  >(null);

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

      trackEvent("ai", "generate", "text-to-drawing");

      const { generatedResponse, error, rateLimit, rateLimitRemaining } =
        await onTextSubmit(prompt, "text-to-drawing");

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

      const canvasNode = containerRef.current;
      const parent = canvasNode?.parentElement;

      if (!canvasNode || !parent) {
        return;
      }

      if (!text) {
        resetPreview({ canvasRef: containerRef, setError });
        return;
      }

      if (!Array.isArray(generatedResponse)) {
        setError(new Error("Generation failed to return an array!"));
        return;
      }

      try {
        const elements = convertToExcalidrawElements(generatedResponse, {
          regenerateIds: true,
        });

        setData(elements);

        const canvas = await exportToCanvas({
          elements,
          files: null,
          exportPadding: DEFAULT_EXPORT_PADDING,
          maxWidthOrHeight:
            Math.max(parent.offsetWidth, parent.offsetHeight) *
            window.devicePixelRatio,
        });
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        await canvasToBlob(canvas);
        parent.style.background = "var(--default-bg-color)";
        canvasNode.replaceChildren(canvas);
      } catch (err: any) {
        console.error(err);
        parent.style.background = "var(--default-bg-color)";
        if (text) {
          setError(err);
        }

        throw err;
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
      <div className="ttd-dialog-desc">This is text to drawing.</div>
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
              if (data) {
                insertToEditor({
                  app,
                  data: {
                    elements: data,
                    files: null,
                  },
                });
              }
            },
            label: "Insert",
            icon: ArrowRightIcon,
          }}
        >
          <TTDDialogOutput
            canvasRef={containerRef}
            error={error}
            loaded={true}
          />
        </TTDDialogPanel>
      </TTDDialogPanels>
    </>
  );
};
