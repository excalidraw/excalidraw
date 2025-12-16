import { useEffect, useRef } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtom, useAtomValue } from "../../editor-jotai";

import { t } from "../../i18n";
import { useApp, useExcalidrawSetAppState } from "../App";

import { useChatAgent } from "../Chat";

import {
  convertMermaidToExcalidraw,
  insertToEditor,
  saveMermaidDataToStorage,
} from "./common";
import {
  errorAtom,
  rateLimitsAtom,
  chatHistoryAtom,
  showPreviewAtom,
} from "./TTDContext";

import { useTTDChatStorage } from "./useTTDChatStorage";
import { useMermaidRenderer } from "./hooks/useMermaidRenderer";
import { useTextGeneration } from "./hooks/useTextGeneration";
import { useChatManagement } from "./hooks/useChatManagement";
import { TTDChatPanel } from "./components/TTDChatPanel";
import { TTDPreviewPanel } from "./components/TTDPreviewPanel";
import mockChunks from "./mock";

import {
  addMessages,
  getLastAssistantMessage,
  updateAssistantContent,
} from "./utils/chat";

import type { ChatMessageType } from "../Chat";

import type { BinaryFiles } from "../../types";
import type {
  TTDPayload,
  OnTestSubmitRetValue,
  MermaidToExcalidrawLibProps,
} from "./types";

export type { OnTestSubmitRetValue, TTDPayload };

interface TextToDiagramContentProps {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  onTextSubmit: (payload: TTDPayload) => Promise<OnTestSubmitRetValue>;
}

const TextToDiagramContent = ({
  mermaidToExcalidrawLib,
  onTextSubmit,
}: TextToDiagramContentProps) => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useAtom(errorAtom);
  const [rateLimits] = useAtom(rateLimitsAtom);
  const [chatHistory, setChatHistory] = useAtom(chatHistoryAtom);
  const showPreview = useAtomValue(showPreviewAtom);

  const { savedChats } = useTTDChatStorage();

  const lastAssistantMessage = getLastAssistantMessage(chatHistory);

  const { setLastRetryAttempt } = useChatAgent();

  const { data } = useMermaidRenderer({
    canvasRef,
    mermaidToExcalidrawLib,
  });

  const { onGenerate, handleAbort } = useTextGeneration({
    onTextSubmit,
  });

  const {
    isMenuOpen,
    onRestoreChat,
    handleDeleteChat,
    handleNewChat,
    handleMenuToggle,
    handleMenuClose,
  } = useChatManagement();

  useEffect(() => {
    if (rateLimits?.rateLimitRemaining === 0) {
      const hasRateLimitMessage = chatHistory.messages.some(
        (msg) =>
          msg.type === "system" &&
          msg.content.includes(t("chat.rateLimit.message")),
      );

      if (!hasRateLimitMessage) {
        setChatHistory(
          addMessages(chatHistory, [
            {
              type: "system",
              content: t("chat.rateLimit.message"),
            },
          ]),
        );
      }
    }
  }, [
    rateLimits?.rateLimitRemaining,
    chatHistory.messages,
    chatHistory,
    setChatHistory,
  ]);

  // TODO:: just for testing
  const onReplay = async () => {
    setChatHistory((prev) => {
      return updateAssistantContent(prev, {
        isGenerating: true,
        content: "",
      });
    });
    for (const chunk of mockChunks) {
      setChatHistory((prev) => {
        const lastAssistantMessage = getLastAssistantMessage(prev);
        return updateAssistantContent(prev, {
          content: lastAssistantMessage.content + chunk,
        });
      });
      const delay = Math.floor(Math.random() * 5) + 1;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    setChatHistory((prev) =>
      updateAssistantContent(prev, {
        isGenerating: false,
      }),
    );
  };

  const onViewAsMermaid = () => {
    if (typeof lastAssistantMessage?.content === "string") {
      saveMermaidDataToStorage(lastAssistantMessage.content);
      setAppState({
        openDialog: { name: "ttd", tab: "mermaid" },
      });
    }
  };

  const handleMermaidTabClick = (message: ChatMessageType) => {
    const mermaidContent = message.content || "";
    if (mermaidContent) {
      saveMermaidDataToStorage(mermaidContent);
      setAppState({
        openDialog: { name: "ttd", tab: "mermaid" },
      });
    }
  };

  const handleInsertMessage = async (message: ChatMessageType) => {
    const mermaidContent = message.content || "";
    if (!mermaidContent.trim() || !mermaidToExcalidrawLib.loaded) {
      return;
    }

    const tempDataRef = {
      current: {
        elements: [] as readonly NonDeletedExcalidrawElement[],
        files: null as BinaryFiles | null,
      },
    };

    const result = await convertMermaidToExcalidraw({
      canvasRef,
      data: tempDataRef,
      mermaidToExcalidrawLib,
      setError,
      mermaidDefinition: mermaidContent,
    });

    if (result.success) {
      insertToEditor({
        app,
        data: tempDataRef,
        text: mermaidContent,
        shouldSaveMermaidDataToStorage: true,
      });
    }
  };

  const handleAiRepairClick = async (message: ChatMessageType) => {
    const mermaidContent = message.content || "";
    const errorMessage = message.error || "";

    if (!mermaidContent) {
      return;
    }

    const repairPrompt = `Fix the error in this Mermaid diagram. The diagram is:\n\n\`\`\`mermaid\n${mermaidContent}\n\`\`\`\n\nThe exception/error is: ${errorMessage}\n\nPlease fix the Mermaid syntax and regenerate a valid diagram.`;

    await onGenerate(repairPrompt, true);
  };

  const handleRetry = async (message: ChatMessageType) => {
    const messageIndex = chatHistory.messages.findIndex(
      (msg) => msg.id === message.id,
    );

    if (messageIndex > 0) {
      const previousMessage = chatHistory.messages[messageIndex - 1];
      if (previousMessage.type === "user") {
        setLastRetryAttempt();
        await onGenerate(previousMessage.content, true);
      }
    }
  };

  const handleInsertToEditor = () => {
    insertToEditor({ app, data });
  };

  const handleDeleteMessage = (messageId: string) => {
    const assistantMessageIndex = chatHistory.messages.findIndex(
      (msg) => msg.id === messageId && msg.type === "assistant",
    );

    const remainingMessages = chatHistory.messages.slice(
      0,
      assistantMessageIndex - 1,
    );

    setChatHistory({
      ...chatHistory,
      messages: remainingMessages,
    });
  };

  const handlePromptChange = (newPrompt: string) => {
    setChatHistory((prev) => ({
      ...prev,
      currentPrompt: newPrompt,
    }));
  };

  return (
    <div
      className={`ttd-dialog-layout ${
        showPreview
          ? "ttd-dialog-layout--split"
          : "ttd-dialog-layout--chat-only"
      }`}
    >
      <TTDChatPanel
        chatId={chatHistory.id}
        messages={chatHistory.messages}
        currentPrompt={chatHistory.currentPrompt}
        onPromptChange={handlePromptChange}
        onSendMessage={onGenerate}
        isGenerating={lastAssistantMessage?.isGenerating ?? false}
        generatedResponse={lastAssistantMessage?.content}
        isMenuOpen={isMenuOpen}
        onMenuToggle={handleMenuToggle}
        onMenuClose={handleMenuClose}
        onNewChat={handleNewChat}
        onRestoreChat={onRestoreChat}
        onDeleteChat={handleDeleteChat}
        savedChats={savedChats}
        activeSessionId={chatHistory.id}
        onAbort={handleAbort}
        onMermaidTabClick={handleMermaidTabClick}
        onAiRepairClick={handleAiRepairClick}
        onDeleteMessage={handleDeleteMessage}
        onInsertMessage={handleInsertMessage}
        onRetry={handleRetry}
        onViewAsMermaid={onViewAsMermaid}
      />
      {showPreview && (
        <TTDPreviewPanel
          canvasRef={canvasRef}
          hideErrorDetails={lastAssistantMessage?.errorType === "parse"}
          error={error}
          loaded={mermaidToExcalidrawLib.loaded}
          onInsert={handleInsertToEditor}
          onReplay={onReplay}
          isReplayDisabled={
            lastAssistantMessage?.isGenerating || mockChunks.length === 0
          }
        />
      )}
    </div>
  );
};

export const TextToDiagram = ({
  mermaidToExcalidrawLib,
  onTextSubmit,
}: {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  onTextSubmit(payload: TTDPayload): Promise<OnTestSubmitRetValue>;
}) => {
  return (
    <TextToDiagramContent
      mermaidToExcalidrawLib={mermaidToExcalidrawLib}
      onTextSubmit={onTextSubmit}
    />
  );
};

export default TextToDiagram;
