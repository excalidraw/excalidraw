import { useAtom } from "../../../editor-jotai";
import { chatHistoryAtom } from "../../TTDDialog/TTDContext";
import {
  addMessages,
  updateAssistantContent,
} from "../../TTDDialog/utils/chat";

export const useChatAgent = () => {
  const [chatHistory, setChatHistory] = useAtom(chatHistoryAtom);

  const addUserMessage = (content: string) => {
    setChatHistory((prev) =>
      addMessages(prev, [
        {
          type: "user",
          content,
        },
      ]),
    );
  };

  const addAssistantMessage = () => {
    setChatHistory((prev) =>
      addMessages(prev, [
        {
          type: "assistant",
          content: "",
          isGenerating: true,
        },
      ]),
    );
  };

  const setLastRetryAttempt = () => {
    setChatHistory((prev) =>
      updateAssistantContent(prev, {
        lastAttemptAt: Date.now(),
      }),
    );
  };

  const setAssistantError = (
    errorMessage: string,
    errorType: "parse" | "network" | "other" = "other",
    errorDetails?: Error | unknown,
  ) => {
    const serializedErrorDetails = errorDetails
      ? JSON.stringify({
          name: errorDetails instanceof Error ? errorDetails.name : "Error",
          message:
            errorDetails instanceof Error
              ? errorDetails.message
              : String(errorDetails),
          stack: errorDetails instanceof Error ? errorDetails.stack : undefined,
        })
      : undefined;

    setChatHistory((prev) =>
      updateAssistantContent(prev, {
        isGenerating: false,
        error: errorMessage,
        errorType,
        errorDetails: serializedErrorDetails,
      }),
    );
  };

  return {
    addUserMessage,
    addAssistantMessage,
    setAssistantError,
    chatHistory,
    setChatHistory,
    setLastRetryAttempt,
  };
};
