import { useRef } from "react";

import { randomId } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtom, useAtomValue } from "../../editor-jotai";

import { useApp, useExcalidrawSetAppState } from "../App";

import { useChatAgent } from "./Chat";

import {
  convertMermaidToExcalidraw,
  insertToEditor,
  saveMermaidDataToStorage,
} from "./common";
import { chatHistoryAtom, errorAtom, showPreviewAtom } from "./TTDContext";

import { TTDChatPanel } from "./Chat/TTDChatPanel";
import { useChatManagement } from "./hooks/useChatManagement";
import { useMermaidRenderer } from "./hooks/useMermaidRenderer";
import { useTextGeneration } from "./hooks/useTextGeneration";
import { TTDPreviewPanel } from "./TTDPreviewPanel";
import { useTTDChatStorage } from "./useTTDChatStorage";

import { getLastAssistantMessage } from "./utils/chat";

import type { BinaryFiles } from "../../types";
import type {
  MermaidToExcalidrawLibProps,
  TChat,
  TTDPersistenceAdapter,
  TTTDDialog,
} from "./types";

const TextToDiagramContent = ({
  mermaidToExcalidrawLib,
  onTextSubmit,
  renderWelcomeScreen,
  renderWarning,
  persistenceAdapter,
}: {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  onTextSubmit: (
    props: TTTDDialog.OnTextSubmitProps,
  ) => Promise<TTTDDialog.OnTextSubmitRetValue>;
  renderWelcomeScreen?: TTTDDialog.renderWelcomeScreen;
  renderWarning?: TTTDDialog.renderWarning;
  persistenceAdapter: TTDPersistenceAdapter;
}) => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useAtom(errorAtom);
  const [chatHistory, setChatHistory] = useAtom(chatHistoryAtom);
  const showPreview = useAtomValue(showPreviewAtom);

  const { savedChats, deleteChat } = useTTDChatStorage({ persistenceAdapter });

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
  } = useChatManagement({ persistenceAdapter });

  const onViewAsMermaid = () => {
    if (typeof lastAssistantMessage?.content === "string") {
      saveMermaidDataToStorage(lastAssistantMessage.content);
      setAppState({
        openDialog: { name: "ttd", tab: "mermaid" },
      });
    }
  };

  const handleMermaidTabClick = (message: TChat.ChatMessage) => {
    const mermaidContent = message.content || "";
    if (mermaidContent) {
      saveMermaidDataToStorage(mermaidContent);
      setAppState({
        openDialog: { name: "ttd", tab: "mermaid" },
      });
    }
  };

  const handleInsertMessage = async (message: TChat.ChatMessage) => {
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
      theme: app.state.theme,
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

  const handleAiRepairClick = async (message: TChat.ChatMessage) => {
    const mermaidContent = message.content || "";
    const errorMessage = message.error || "";

    if (!mermaidContent) {
      return;
    }

    const repairPrompt = `Fix the error in this Mermaid diagram. The diagram is:\n\n\`\`\`mermaid\n${mermaidContent}\n\`\`\`\n\nThe exception/error is: ${errorMessage}\n\nPlease fix the Mermaid syntax and regenerate a valid diagram.`;

    await onGenerate({ prompt: repairPrompt, isRepairFlow: true });
  };

  const handleRetry = async (message: TChat.ChatMessage) => {
    const messageIndex = chatHistory.messages.findIndex(
      (msg) => msg.id === message.id,
    );

    if (messageIndex > 0) {
      const previousMessage = chatHistory.messages[messageIndex - 1];
      if (
        previousMessage.type === "user" &&
        typeof previousMessage.content === "string"
      ) {
        setLastRetryAttempt();
        await onGenerate({
          prompt: previousMessage.content,
          isRepairFlow: true,
        });
      }
    }
  };

  const handleInsertToEditor = () => {
    insertToEditor({ app, data });
  };

  const handleDeleteMessage = async (messageId: string) => {
    const assistantMessageIndex = chatHistory.messages.findIndex(
      (msg) => msg.id === messageId && msg.type === "assistant",
    );

    if (assistantMessageIndex === -1) {
      return;
    }

    const remainingMessages = chatHistory.messages.slice(
      0,
      Math.max(0, assistantMessageIndex - 1),
    );

    if (remainingMessages.length === 0) {
      await deleteChat(chatHistory.id);
      setChatHistory({
        id: randomId(),
        messages: [],
        currentPrompt: "",
      });
      setError(null);
      // The history menu unmounts with zero saved chats; reset its open
      // state so it doesn't auto-open when the next chat is saved.
      handleMenuClose();
      return;
    }

    const nextHistory = {
      ...chatHistory,
      messages: remainingMessages,
    };
    setChatHistory(nextHistory);

    const nextLastAssistantMessage = getLastAssistantMessage(nextHistory);
    setError(
      nextLastAssistantMessage?.error
        ? new Error(nextLastAssistantMessage.error)
        : null,
    );
  };

  const handlePromptChange = (newPrompt: string) => {
    setChatHistory((prev) => ({
      ...prev,
      currentPrompt: newPrompt,
    }));
  };

  return (
    <div
      className={`ttd-dialog-layout ${showPreview
        ? "ttd-dialog-layout--split"
        : "ttd-dialog-layout--chat-only"
        }`}
    >
      <TTDChatPanel
        chatId={chatHistory.id}
        messages={chatHistory.messages}
        currentPrompt={chatHistory.currentPrompt}
        onPromptChange={handlePromptChange}
        onGenerate={onGenerate}
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
        renderWarning={renderWarning}
        renderWelcomeScreen={renderWelcomeScreen}
      />
      {showPreview && (
        <TTDPreviewPanel
          canvasRef={canvasRef}
          hideErrorDetails={lastAssistantMessage?.errorType === "parse"}
          error={error}
          loaded={mermaidToExcalidrawLib.loaded}
          onInsert={handleInsertToEditor}
        />
      )}
    </div>
  );
};

export const TextToDiagram = ({
  mermaidToExcalidrawLib,
  onTextSubmit,
  renderWelcomeScreen,
  renderWarning,
  persistenceAdapter,
}: {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  onTextSubmit(
    props: TTTDDialog.OnTextSubmitProps,
  ): Promise<TTTDDialog.OnTextSubmitRetValue>;
  renderWelcomeScreen?: TTTDDialog.renderWelcomeScreen;
  renderWarning?: TTTDDialog.renderWarning;
  persistenceAdapter: TTDPersistenceAdapter;
}) => {
  return (
    <TextToDiagramContent
      mermaidToExcalidrawLib={mermaidToExcalidrawLib}
      onTextSubmit={onTextSubmit}
      renderWelcomeScreen={renderWelcomeScreen}
      renderWarning={renderWarning}
      persistenceAdapter={persistenceAdapter}
    />
  );
};

export default TextToDiagram;
