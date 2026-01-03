import { t } from "../../../i18n";
import { ArrowRightIcon } from "../../icons";
import { ChatInterface } from "../../Chat";
import { InlineIcon } from "../../InlineIcon";
import { TTDDialogPanel } from "../TTDDialogPanel";

import { useAtom } from "../../../editor-jotai";

import { rateLimitsAtom } from "../TTDContext";

import { ChatHistoryMenu } from "./ChatHistoryMenu";

import type { SavedChat } from "../types";

import type { ChatMessageType } from "../../Chat";

interface TTDChatPanelProps {
  chatId: string;
  messages: ChatMessageType[];
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
  onSendMessage: (message: string, isRepairFlow?: boolean) => void;
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
  onMermaidTabClick: (message: ChatMessageType) => void;
  onAiRepairClick: (message: ChatMessageType) => void;
  onDeleteMessage: (messageId: string) => void;
  onInsertMessage: (message: ChatMessageType) => void;
  onRetry?: (message: ChatMessageType) => void;

  onViewAsMermaid: () => void;
}

export const TTDChatPanel = ({
  chatId,
  messages,
  currentPrompt,
  onPromptChange,
  onSendMessage,
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
}: TTDChatPanelProps) => {
  const [rateLimits] = useAtom(rateLimitsAtom);

  const getPanelActions = () => {
    const actions = [];
    if (rateLimits) {
      actions.push({
        label: t("chat.rateLimitRemaining", {
          count: rateLimits.rateLimitRemaining,
        }),
        variant: "rateLimit" as const,
      });
    }

    if (generatedResponse) {
      actions.push({
        action: onViewAsMermaid,
        label: t("chat.viewAsMermaid"),
        icon: <InlineIcon icon={ArrowRightIcon} />,
        variant: "link" as const,
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
        onSendMessage={onSendMessage}
        isGenerating={isGenerating}
        generatedResponse={generatedResponse}
        onAbort={onAbort}
        onMermaidTabClick={onMermaidTabClick}
        onAiRepairClick={onAiRepairClick}
        onDeleteMessage={onDeleteMessage}
        onInsertMessage={onInsertMessage}
        onRetry={onRetry}
        rateLimits={rateLimits}
        placeholder={{
          title: t("chat.placeholder.title"),
          description: t("chat.placeholder.description"),
          hint: t("chat.placeholder.hint"),
        }}
      />
    </TTDDialogPanel>
  );
};
