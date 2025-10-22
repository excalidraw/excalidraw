import { useEffect, useRef, useState } from "react";

import { isFiniteNumber } from "@excalidraw/math";
import { EDITOR_LS_KEYS } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { trackEvent } from "../../analytics";
import { useUIAppState } from "../../context/ui-appState";
import { atom, useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { useApp, useExcalidrawSetAppState } from "../App";
import { Dialog } from "../Dialog";
import { InlineIcon } from "../InlineIcon";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { ArrowRightIcon, HelpIconThin } from "../icons";
import { Tooltip } from "../Tooltip";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";

import MermaidToExcalidraw from "./MermaidToExcalidraw";
import TTDDialogTabs from "./TTDDialogTabs";
import { TTDDialogTabTriggers } from "./TTDDialogTabTriggers";
import { TTDDialogTabTrigger } from "./TTDDialogTabTrigger";
import { TTDDialogTab } from "./TTDDialogTab";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";
import { ChatInterface } from "./ChatInterface";

import {
  convertMermaidToExcalidraw,
  insertToEditor,
  saveMermaidDataToStorage,
} from "./common";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";

import "./TTDDialog.scss";

import type { ChangeEventHandler } from "react";
import type { MermaidToExcalidrawLibProps } from "./common";
import type { ChatMessage, ChatHistory, ChatHistorySnapshot } from "./types";

import type { BinaryFiles } from "../../types";

const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 1000;

const rateLimitsAtom = atom<{
  rateLimit: number;
  rateLimitRemaining: number;
} | null>(null);

const ttdGenerationAtom = atom<{
  generatedResponse: string | null;
  prompt: string | null;
} | null>(null);

const chatHistoryAtom = atom<ChatHistory>({
  messages: [],
  currentPrompt: "",
});

const chatHistoryUndoStackAtom = atom<ChatHistorySnapshot[]>([]);
const chatHistoryRedoStackAtom = atom<ChatHistorySnapshot[]>([]);

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

    const someRandomDivRef = useRef<HTMLDivElement>(null);

    const [ttdGeneration, setTtdGeneration] = useAtom(ttdGenerationAtom);
    const [chatHistory, setChatHistory] = useAtom(chatHistoryAtom);
    const [undoStack, setUndoStack] = useAtom(chatHistoryUndoStackAtom);
    const [redoStack, setRedoStack] = useAtom(chatHistoryRedoStackAtom);

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

    const handlePromptChange = (newPrompt: string) => {
      setText(newPrompt);
      setChatHistory((prev) => ({
        ...prev,
        currentPrompt: newPrompt,
      }));
    };

    const saveSnapshot = () => {
      const snapshot: ChatHistorySnapshot = {
        messages: [...chatHistory.messages],
        currentPrompt: chatHistory.currentPrompt,
        generatedResponse: ttdGeneration?.generatedResponse || null,
        timestamp: new Date(),
      };

      setUndoStack((prev) => [...prev, snapshot]);
      setRedoStack([]); // Clear redo stack when new action is performed
    };

    const addMessage = (message: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMessage: ChatMessage = {
        ...message,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
      };

      setChatHistory((prev) => ({
        ...prev,
        messages: [...prev.messages, newMessage],
      }));
    };

    const updateLastMessage = (updates: Partial<ChatMessage>) => {
      setChatHistory((prev) => ({
        ...prev,
        messages: prev.messages.map((msg, index) =>
          index === prev.messages.length - 1 ? { ...msg, ...updates } : msg,
        ),
      }));
    };

    const handleUndo = async () => {
      if (undoStack.length === 0) return;

      // Save current state to redo stack
      const currentSnapshot: ChatHistorySnapshot = {
        messages: [...chatHistory.messages],
        currentPrompt: chatHistory.currentPrompt,
        generatedResponse: ttdGeneration?.generatedResponse || null,
        timestamp: new Date(),
      };
      setRedoStack((prev) => [...prev, currentSnapshot]);

      // Restore from undo stack
      const snapshotToRestore = undoStack[undoStack.length - 1];
      setChatHistory({
        messages: snapshotToRestore.messages,
        currentPrompt: snapshotToRestore.currentPrompt,
      });
      setText(snapshotToRestore.currentPrompt);

      // Restore the generated response and regenerate diagram
      if (snapshotToRestore.generatedResponse) {
        setTtdGeneration({
          generatedResponse: snapshotToRestore.generatedResponse,
          prompt: snapshotToRestore.currentPrompt,
        });

        // Regenerate the diagram from the restored response
        try {
          await convertMermaidToExcalidraw({
            canvasRef: someRandomDivRef,
            data,
            mermaidToExcalidrawLib,
            setError,
            mermaidDefinition: snapshotToRestore.generatedResponse,
          });
        } catch (error: any) {
          console.error("Error regenerating diagram:", error);
          setError(error);
        }
      } else {
        // Clear the diagram if no generated response
        setTtdGeneration(null);
        setError(null);
      }

      // Remove from undo stack
      setUndoStack((prev) => prev.slice(0, -1));
    };

    const handleRedo = async () => {
      if (redoStack.length === 0) return;

      // Save current state to undo stack
      const currentSnapshot: ChatHistorySnapshot = {
        messages: [...chatHistory.messages],
        currentPrompt: chatHistory.currentPrompt,
        generatedResponse: ttdGeneration?.generatedResponse || null,
        timestamp: new Date(),
      };
      setUndoStack((prev) => [...prev, currentSnapshot]);

      // Restore from redo stack
      const snapshotToRestore = redoStack[redoStack.length - 1];
      setChatHistory({
        messages: snapshotToRestore.messages,
        currentPrompt: snapshotToRestore.currentPrompt,
      });
      setText(snapshotToRestore.currentPrompt);

      // Restore the generated response and regenerate diagram
      if (snapshotToRestore.generatedResponse) {
        setTtdGeneration({
          generatedResponse: snapshotToRestore.generatedResponse,
          prompt: snapshotToRestore.currentPrompt,
        });

        // Regenerate the diagram from the restored response
        try {
          await convertMermaidToExcalidraw({
            canvasRef: someRandomDivRef,
            data,
            mermaidToExcalidrawLib,
            setError,
            mermaidDefinition: snapshotToRestore.generatedResponse,
          });
        } catch (error: any) {
          console.error("Error regenerating diagram:", error);
          setError(error);
        }
      } else {
        // Clear the diagram if no generated response
        setTtdGeneration(null);
        setError(null);
      }

      // Remove from redo stack
      setRedoStack((prev) => prev.slice(0, -1));
    };

    const [onTextSubmitInProgess, setOnTextSubmitInProgess] = useState(false);
    const [rateLimits, setRateLimits] = useAtom(rateLimitsAtom);

    const onGenerate = async (promptWithContext: string) => {
      if (
        promptWithContext.length > MAX_PROMPT_LENGTH ||
        promptWithContext.length < MIN_PROMPT_LENGTH ||
        onTextSubmitInProgess ||
        rateLimits?.rateLimitRemaining === 0 ||
        // means this is not a text-to-diagram dialog (needed for TS only)
        "__fallback" in rest
      ) {
        if (promptWithContext.length < MIN_PROMPT_LENGTH) {
          setError(
            new Error(
              `Prompt is too short (min ${MIN_PROMPT_LENGTH} characters)`,
            ),
          );
        }
        if (promptWithContext.length > MAX_PROMPT_LENGTH) {
          setError(
            new Error(
              `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`,
            ),
          );
        }

        return;
      }

      // Add user message to chat
      addMessage({
        type: "user",
        content: prompt,
      });

      // Add loading message for AI response
      addMessage({
        type: "assistant",
        content: "",
        isGenerating: true,
      });

      try {
        setOnTextSubmitInProgess(true);

        trackEvent("ai", "generate", "ttd");

        const { generatedResponse, error, rateLimit, rateLimitRemaining } =
          await rest.onTextSubmit(promptWithContext);

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
          updateLastMessage({
            isGenerating: false,
            error: error.message,
          });
          setError(error);
          return;
        }
        if (!generatedResponse) {
          updateLastMessage({
            isGenerating: false,
            error: "Generation failed",
          });
          setError(new Error("Generation failed"));
          return;
        }

        // Update the AI message with the response
        updateLastMessage({
          isGenerating: false,
          content: generatedResponse,
        });

        try {
          await convertMermaidToExcalidraw({
            canvasRef: someRandomDivRef,
            data,
            mermaidToExcalidrawLib,
            setError,
            mermaidDefinition: generatedResponse,
          });
          trackEvent("ai", "mermaid parse success", "ttd");

          // Save snapshot after successful AI response and diagram generation
          saveSnapshot();
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
          updateLastMessage({
            isGenerating: false,
            error:
              "Generated an invalid diagram :(. You may also try a different prompt.",
          });
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
        updateLastMessage({
          isGenerating: false,
          error: message,
        });
        setError(new Error(message));
      } finally {
        setOnTextSubmitInProgess(false);
      }
    };

    const handleSendMessage = (message: string) => {
      onGenerate(message);
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

    // Restore diagram data when switching back to text-to-diagram tab
    useEffect(() => {
      if (tab === "text-to-diagram" && ttdGeneration?.generatedResponse) {
        // Use a small delay to ensure the DOM element is rendered
        const timeoutId = setTimeout(() => {
          if (someRandomDivRef.current && ttdGeneration.generatedResponse) {
            convertMermaidToExcalidraw({
              canvasRef: someRandomDivRef,
              data,
              mermaidToExcalidrawLib,
              setError,
              mermaidDefinition: ttdGeneration.generatedResponse,
            }).catch((err) => {
              console.error("Failed to restore diagram", err);
            });
          }
        }, 100);

        return () => clearTimeout(timeoutId);
      }
    }, [tab, ttdGeneration?.generatedResponse, mermaidToExcalidrawLib]);

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
        <TTDDialogTabs dialog="ttd" tab={tab}>
          {"__fallback" in rest && rest.__fallback ? (
            <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
          ) : (
            <TTDDialogTabTriggers>
              <TTDDialogTabTrigger tab="text-to-diagram">
                <div style={{ display: "flex", alignItems: "center" }}>
                  {t("labels.textToDiagram")}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1px 6px",
                      marginLeft: "10px",
                      fontSize: 10,
                      borderRadius: "12px",
                      background: "var(--color-promo)",
                      color: "var(--color-surface-lowest)",
                    }}
                  >
                    AI Beta
                  </div>
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
              <TTDDialogPanels>
                <TTDDialogPanel
                  label={
                    <div style={{ display: "flex", gap: 5 }}>
                      <label>Chat</label>
                      <Tooltip
                        label={
                          "Currently we use Mermaid as a middle step, so you'll get best results if you describe a diagram, workflow, flow chart, and similar."
                        }
                        long
                      >
                        <button
                          type="button"
                          aria-label="Text-to-diagram help"
                          className="ttd-dialog-info"
                        >
                          {HelpIconThin}
                        </button>
                      </Tooltip>
                    </div>
                  }
                >
                  <ChatInterface
                    messages={chatHistory.messages}
                    currentPrompt={chatHistory.currentPrompt}
                    onPromptChange={handlePromptChange}
                    onSendMessage={handleSendMessage}
                    isGenerating={onTextSubmitInProgess}
                    rateLimits={rateLimits}
                    onViewAsMermaid={() => {
                      if (
                        typeof ttdGeneration?.generatedResponse === "string"
                      ) {
                        saveMermaidDataToStorage(
                          ttdGeneration.generatedResponse,
                        );
                        setAppState({
                          openDialog: { name: "ttd", tab: "mermaid" },
                        });
                      }
                    }}
                    generatedResponse={ttdGeneration?.generatedResponse}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={
                      undoStack.length > 0 &&
                      undoStack.some((snapshot) =>
                        snapshot.messages.some(
                          (msg) => msg.type === "assistant" && msg.content,
                        ),
                      )
                    }
                    canRedo={
                      redoStack.length > 0 &&
                      redoStack.some((snapshot) =>
                        snapshot.messages.some(
                          (msg) => msg.type === "assistant" && msg.content,
                        ),
                      )
                    }
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
