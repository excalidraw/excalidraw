import { useEffect, useRef, useState } from "react";

import AIResponseBox from "@/components/AIResponseBox";
import Chatbox from "@/components/Chatbox";
import ChatSettings from "@/components/ChatSettings";
import Sidebar from "@/components/Sidebar";
import UserResponseBox from "@/components/UserResponseBox";
import { useSomething } from "@/hooks/useSomething";
import type { Attachment } from "@/types";

export function Chat() {
  const {
    conversations,
    activeConversation,
    activeId,
    settings,
    setSettings,
    setActiveId,
    appendMessage,
    updateMessage,
    newChat,
    deleteConversation,
  } = useSomething();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const handleSend = (content: string, attachments: Attachment[]) => {
    appendMessage("user", content, { attachments });
    // TODO: replace with a real call through `services/api.ts`.
    appendMessage("assistant", "…");
  };

  /** On narrow screens the drawer gets out of the way once you pick something. */
  const closeMenuAfter = <T extends unknown[]>(action: (...args: T) => void) => (
    ...args: T
  ) => {
    action(...args);
    setMenuOpen(false);
  };

  return (
    <div className={menuOpen ? "chat chat--menu-open" : "chat"}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={closeMenuAfter(setActiveId)}
        onNewChat={closeMenuAfter(newChat)}
        onDelete={deleteConversation}
        onOpenSettings={closeMenuAfter(() => setSettingsOpen(true))}
        onClose={() => setMenuOpen(false)}
      />

      <div
        className="chat__scrim"
        onClick={() => setMenuOpen(false)}
        role="presentation"
      />

      <main className="chat__main">
        <header className="chat__bar">
          <button
            className="chat__menu"
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </header>

        <div className="thread">
          {messages.length === 0 ? (
            <p className="thread__empty">Start the conversation.</p>
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <UserResponseBox key={message.id} message={message} />
              ) : (
                <AIResponseBox
                  key={message.id}
                  message={message}
                  onEdit={updateMessage}
                />
              ),
            )
          )}
          <div ref={bottomRef} />
        </div>

        <Chatbox onSend={handleSend} disabled={!activeConversation} />
      </main>

      <ChatSettings
        values={settings}
        onChange={setSettings}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default Chat;
