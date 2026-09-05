import Bulletpoint from "@/components/Bulletpoint";
import RoughBox from "@/components/RoughBox";
import { SELECTION_OPTIONS } from "@/config";
import type { Conversation } from "@/types";

interface ChatlistProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}

export function Chatlist({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
}: ChatlistProps) {
  return (
    <div className="chatlist">
      <header className="chatlist__header">
        <h2 className="chatlist__title">Chats</h2>
        <button
          className="chatlist__new"
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
        >
          +
        </button>
      </header>

      <nav className="chatlist__items">
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeId;

          return (
            <div
              key={conversation.id}
              className={
                isActive ? "chatlist__row chatlist__row--active" : "chatlist__row"
              }
            >
              {isActive && (
                <RoughBox className="chatlist__highlight" options={SELECTION_OPTIONS} />
              )}

              <button
                className="chatlist__item"
                type="button"
                onClick={() => onSelect(conversation.id)}
              >
                <Bulletpoint />
                <span className="chatlist__label">{conversation.title}</span>
              </button>

              <button
                className="chatlist__delete"
                type="button"
                onClick={() => onDelete(conversation.id)}
                aria-label={`Delete ${conversation.title}`}
                title="Delete chat"
              >
                ×
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export default Chatlist;
