import { t } from "../../../i18n";
import { ArrowRightIcon } from "../../icons";

import { InlineIcon } from "../../InlineIcon";

import { TTDDialogPanel } from "../TTDDialogPanel";

import { useAtom } from "../../../editor-jotai";

import { rateLimitsAtom } from "../TTDContext";

import { ChatHistoryMenu } from "./ChatHistoryMenu";

import { ChatInterface } from ".";

import type { TTDPanelAction } from "../TTDDialogPanel";

import type { SavedChat, TChat, TTTDDialog } from "../types";

export const TTDChatPanel = ({
  chatId,
  messages,
  currentPrompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  generatedResponse,
  isMenuOpen,
  onMenuToggle,
  onMenuClose,
  onNewChat,
  onRestoreChat,
  onDeleteChat,
  savedChats,
  activeSessionId,
  onAbort,
  onMermaidTabClick,
  onAiRepairClick,
  onDeleteMessage,
  onInsertMessage,
  onRetry,
  onViewAsMermaid,
  renderWelcomeScreen,
  renderWarning,
}: {
  chatId: string;
  messages: TChat.ChatMessage[];
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerate: TTTDDialog.OnGenerate;
  isGenerating: boolean;
  generatedResponse: string | null | undefined;

  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onNewChat: () => void;
  onRestoreChat: (chat: SavedChat) => void;
  onDeleteChat: (chatId: string, event: React.MouseEvent) => void;
  savedChats: SavedChat[];
  activeSessionId: string;

  onAbort: () => void;
  onMermaidTabClick: (message: TChat.ChatMessage) => void;
  onAiRepairClick: (message: TChat.ChatMessage) => void;
  onDeleteMessage: (messageId: string) => void;
  onInsertMessage: (message: TChat.ChatMessage) => void;
  onRetry?: (message: TChat.ChatMessage) => void;

  onViewAsMermaid: () => void;

  renderWelcomeScreen?: TTTDDialog.renderWelcomeScreen;
  renderWarning?: TTTDDialog.renderWarning;
}) => {
  const [rateLimits] = useAtom(rateLimitsAtom);

  const getPanelActions = () => {
    const actions: TTDPanelAction[] = [];
    if (rateLimits) {
      actions.push({
        label: t("chat.rateLimitRemaining", {
          count: rateLimits.rateLimitRemaining,
        }),
        variant: "rateLimit",
        className:
          rateLimits.rateLimitRemaining < 5
            ? "ttd-dialog-panel__rate-limit--danger"
            : "",
      });
    }

    if (generatedResponse) {
      actions.push({
        action: onViewAsMermaid,
        label: t("chat.viewAsMermaid"),
        icon: <InlineIcon icon={ArrowRightIcon} />,
        variant: "link",
      });
    }

    return actions;
  };
  const actions = getPanelActions();

  const getPanelActionFlexProp = () => {
    if (actions.length === 2) {
      return "space-between";
    }
    if (actions.length === 1 && actions[0].variant === "rateLimit") {
      return "flex-start";
    }

    return "flex-end";
  };

  return (
    <TTDDialogPanel
      label={
        <div className="ttd-dialog-panel__label-wrapper">
          <div className="ttd-dialog-panel__label-group"></div>
          <div className="ttd-dialog-panel__header-right">
            <ChatHistoryMenu
              isNewChatBtnVisible={!!messages.length}
              isOpen={isMenuOpen}
              onToggle={onMenuToggle}
              onClose={onMenuClose}
              onNewChat={onNewChat}
              onRestoreChat={onRestoreChat}
              onDeleteChat={onDeleteChat}
              savedChats={savedChats}
              activeSessionId={activeSessionId}
              disabled={isGenerating}
            />
          </div>
        </div>
      }
      className="ttd-dialog-chat-panel"
      panelActionJustifyContent={getPanelActionFlexProp()}
      panelActions={actions}
    >
      <ChatInterface
        chatId={chatId}
        messages={messages}
        currentPrompt={currentPrompt}
        onPromptChange={onPromptChange}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
        generatedResponse={generatedResponse}
        onAbort={onAbort}
        onMermaidTabClick={onMermaidTabClick}
        onAiRepairClick={onAiRepairClick}
        onDeleteMessage={onDeleteMessage}
        onInsertMessage={onInsertMessage}
        onRetry={onRetry}
        rateLimits={rateLimits}
        renderWelcomeScreen={renderWelcomeScreen}
        renderWarning={renderWarning}
      />
    </TTDDialogPanel>
  );
};
