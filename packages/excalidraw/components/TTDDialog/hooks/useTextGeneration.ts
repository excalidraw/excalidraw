import { useEffect, useRef, useState } from "react";
import { isFiniteNumber } from "@excalidraw/math";

import { useAtom } from "../../../editor-jotai";

import { trackEvent } from "../../../analytics";
import { t } from "../../../i18n";

import { errorAtom, rateLimitsAtom, chatHistoryAtom } from "../TTDContext";
import { useChatAgent } from "../Chat";

import {
  addMessages,
  getLastAssistantMessage,
  getMessagesForLLM,
  removeLastAssistantMessage,
  updateAssistantContent,
} from "../utils/chat";
import { isModuleLoadError } from "../utils/mermaidError";

import type {
  LLMMessage,
  MermaidToExcalidrawLibProps,
  TTTDDialog,
} from "../types";

const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 10000;

export const useTextGeneration = ({
  onTextSubmit,
  mermaidToExcalidrawLib,
}: {
  onTextSubmit: (
    props: TTTDDialog.OnTextSubmitProps,
  ) => Promise<TTTDDialog.OnTextSubmitRetValue>;
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
}) => {
  const [, setError] = useAtom(errorAtom);
  const [rateLimits, setRateLimits] = useAtom(rateLimitsAtom);
  const [chatHistory, setChatHistory] = useAtom(chatHistoryAtom);

  const { addUserMessage, addAssistantMessage, setAssistantError } =
    useChatAgent();

  const streamingAbortControllerRef = useRef<AbortController | null>(null);

  // the lib may get reloaded (retry) while a generation is in flight, so
  // always validate against the latest one
  const mermaidToExcalidrawLibRef = useRef(mermaidToExcalidrawLib);
  mermaidToExcalidrawLibRef.current = mermaidToExcalidrawLib;

  // generated mermaid that couldn't be validated because the lib failed to
  // load (e.g. offline) -> validated once the lib loads
  const [pendingValidation, setPendingValidation] = useState<string | null>(
    null,
  );

  const validateMermaid = async (
    { parseMermaidToExcalidraw }: Awaited<MermaidToExcalidrawLibProps["api"]>,
    mermaidDefinition: string,
  ) => {
    try {
      await parseMermaidToExcalidraw(mermaidDefinition);
      trackEvent("ai", "mermaid parse success", "ttd");
    } catch (error: any) {
      if (isModuleLoadError(error)) {
        // not a syntax error, but a diagram chunk failing to load
        setPendingValidation(mermaidDefinition);
        return;
      }
      trackEvent("ai", "mermaid parse failed", "ttd");
      const _error = new Error(
        error.message || t("chat.errors.mermaidParseError"),
      );
      setAssistantError(_error.message, "parse");
      setError(_error);
    }
  };

  useEffect(() => {
    if (
      pendingValidation === null ||
      mermaidToExcalidrawLib.status !== "loaded"
    ) {
      return;
    }
    setPendingValidation(null);

    // skip if the user has moved on (new generation, switched chats, ...)
    const lastAssistantMessage = getLastAssistantMessage(chatHistory);
    if (
      lastAssistantMessage?.isGenerating ||
      lastAssistantMessage?.error ||
      (lastAssistantMessage?.content ?? "") !== pendingValidation
    ) {
      return;
    }

    mermaidToExcalidrawLib.api.then(
      (api) => validateMermaid(api, pendingValidation),
      () => {},
    );
    // validateMermaid only closes over stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingValidation, mermaidToExcalidrawLib, chatHistory]);

  const validatePrompt = (prompt: string): boolean => {
    if (
      prompt.length > MAX_PROMPT_LENGTH ||
      prompt.length < MIN_PROMPT_LENGTH ||
      rateLimits?.rateLimitRemaining === 0
    ) {
      if (prompt.length < MIN_PROMPT_LENGTH) {
        setError(
          new Error(
            t("chat.errors.promptTooShort", { min: MIN_PROMPT_LENGTH }),
          ),
        );
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        setError(
          new Error(t("chat.errors.promptTooLong", { max: MAX_PROMPT_LENGTH })),
        );
      }

      return false;
    }
    return true;
  };

  const onGenerate: TTTDDialog.OnGenerate = async ({
    prompt,
    isRepairFlow = false,
  }) => {
    if (!validatePrompt(prompt)) {
      return;
    }

    if (streamingAbortControllerRef.current) {
      streamingAbortControllerRef.current.abort();
    }

    setError(null);
    setPendingValidation(null);

    const abortController = new AbortController();
    streamingAbortControllerRef.current = abortController;

    if (!isRepairFlow) {
      addUserMessage(prompt);
      addAssistantMessage();
    } else {
      setChatHistory((prev) =>
        updateAssistantContent(prev, {
          isGenerating: true,
          content: "",
          error: undefined,
          errorType: undefined,
          errorDetails: undefined,
        }),
      );
    }

    try {
      trackEvent("ai", "generate", "ttd");

      const previousMessages = getMessagesForLLM(chatHistory);

      const messages: LLMMessage[] = [
        ...previousMessages.slice(-3),
        { role: "user", content: prompt },
      ];

      const { generatedResponse, error, rateLimit, rateLimitRemaining } =
        await onTextSubmit({
          messages,
          onStreamCreated: () => {
            if (isRepairFlow) {
              setChatHistory((prev) =>
                updateAssistantContent(prev, {
                  content: "",
                  error: "",
                  isGenerating: true,
                }),
              );
            }
          },
          onChunk: (chunk: string) => {
            setChatHistory((prev) => {
              const lastAssistantMessage = getLastAssistantMessage(prev);
              return updateAssistantContent(prev, {
                content: lastAssistantMessage.content + chunk,
              });
            });
          },
          signal: abortController.signal,
        });

      setChatHistory((prev) =>
        updateAssistantContent(prev, {
          isGenerating: false,
        }),
      );

      if (isFiniteNumber(rateLimit) && isFiniteNumber(rateLimitRemaining)) {
        setRateLimits({ rateLimit, rateLimitRemaining });
      }

      if (error?.status === 429 || rateLimitRemaining === 0) {
        setChatHistory((chatHistory) => {
          if (error?.status === 429) {
            chatHistory = removeLastAssistantMessage(chatHistory);
          }

          chatHistory = {
            ...chatHistory,
            messages: chatHistory.messages.filter(
              (msg) =>
                msg.type !== "warning" ||
                msg.warningType === "rateLimitExceeded" ||
                msg.warningType === "messageLimitExceeded",
            ),
          };
          const messages = addMessages(chatHistory, [
            {
              type: "warning",
              warningType:
                rateLimitRemaining === 0
                  ? "messageLimitExceeded"
                  : "rateLimitExceeded",
            },
          ]);
          return messages;
        });
      }

      if (error) {
        const isAborted =
          error.name === "AbortError" ||
          error.message === "Aborted" ||
          abortController.signal.aborted;

        // do nothing if the request was aborted by the user
        if (isAborted) {
          return;
        }

        const _error = new Error(
          error.message || t("chat.errors.requestFailed"),
        );
        if (error.status !== 429) {
          setAssistantError(_error.message, "network");
        }
        setError(_error);

        return;
      }

      let api;
      try {
        api = await mermaidToExcalidrawLibRef.current.api;
      } catch (error: any) {
        console.error("Failed to load mermaid-to-excalidraw", error);
        setPendingValidation(generatedResponse ?? "");
        return;
      }

      await validateMermaid(api, generatedResponse ?? "");
    } catch (error: any) {
      const _error = new Error(
        error.message || t("chat.errors.generationFailed"),
      );
      setAssistantError(_error.message, "other");
      setError(_error);
    } finally {
      streamingAbortControllerRef.current = null;
    }
  };

  const handleAbort = () => {
    if (streamingAbortControllerRef.current) {
      streamingAbortControllerRef.current.abort();
    }
  };

  return {
    onGenerate,
    handleAbort,
  };
};
