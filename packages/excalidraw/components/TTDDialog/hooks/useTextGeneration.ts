import { useRef } from "react";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
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

import type { LLMMessage, TTTDDialog } from "../types";

const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 10000;

export const useTextGeneration = ({
  onTextSubmit,
}: {
  onTextSubmit: (
    props: TTTDDialog.OnTextSubmitProps,
  ) => Promise<TTTDDialog.OnTextSubmitRetValue>;
}) => {
  const [, setError] = useAtom(errorAtom);
  const [rateLimits, setRateLimits] = useAtom(rateLimitsAtom);
  const [chatHistory, setChatHistory] = useAtom(chatHistoryAtom);

  const { addUserMessage, addAssistantMessage, setAssistantError } =
    useChatAgent();

  const streamingAbortControllerRef = useRef<AbortController | null>(null);

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

  const getReadableErrorMsg = (msg: string) => {
    try {
      const content = JSON.parse(msg);

      const innerMessages = JSON.parse(content.message);

      return innerMessages
        .map((oneMsg: { message: string }) => oneMsg.message)
        .join("\n");
    } catch (err) {
      return msg;
    }
  };

  const handleError = (error: Error, errorType: "parse" | "network") => {
    if (errorType === "parse") {
      trackEvent("ai", "mermaid parse failed", "ttd");
    }

    const msg = getReadableErrorMsg(error.message);

    setAssistantError(msg, errorType);
    setError(error);
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

      if (error) {
        const isAborted =
          error.name === "AbortError" ||
          error.message === "Aborted" ||
          abortController.signal.aborted;

        // do nothing if the request was aborted by the user
        if (isAborted) {
          return;
        }

        if (error.status === 429) {
          setChatHistory((prev) => {
            const chatHistory = removeLastAssistantMessage(prev);

            return {
              ...chatHistory,
              messages: chatHistory.messages.filter(
                (msg) =>
                  msg.type !== "warning" ||
                  msg.warningType === "rateLimitExceeded" ||
                  msg.warningType === "messageLimitExceeded",
              ),
            };
          });

          setChatHistory((chatHistory) => {
            return addMessages(chatHistory, [
              {
                type: "warning",
                warningType:
                  rateLimitRemaining === 0
                    ? "messageLimitExceeded"
                    : "rateLimitExceeded",
              },
            ]);
          });

          return;
        } else if (rateLimitRemaining === 0) {
          setChatHistory((chatHistory) => {
            chatHistory = {
              ...chatHistory,
              messages: chatHistory.messages.filter(
                (msg) =>
                  msg.type !== "warning" ||
                  msg.warningType === "rateLimitExceeded" ||
                  msg.warningType === "messageLimitExceeded",
              ),
            };
            return addMessages(chatHistory, [
              {
                type: "warning",
                warningType: "messageLimitExceeded",
              },
            ]);
          });
        }

        handleError(error as Error, "network");
        return;
      }

      await parseMermaidToExcalidraw(generatedResponse ?? "");

      trackEvent("ai", "mermaid parse success", "ttd");
    } catch (error: unknown) {
      handleError(error as Error, "parse");
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
