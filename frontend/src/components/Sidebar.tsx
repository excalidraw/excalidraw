import logo from "@/assets/icons/excalidraw.webp";
import settingsIcon from "@/assets/icons/settings.svg";
import Chatlist from "@/components/Chatlist";
import type { Conversation } from "@/types";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  /** Closes the drawer on small screens; the button is hidden on wide ones. */
  onClose: () => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onOpenSettings,
  onClose,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <header className="sidebar__brand">
        <img className="sidebar__logo" src={logo} alt="" width={34} height={34} />
        <span className="sidebar__name">Excalidraw-chat</span>
        <button
          className="sidebar__close"
          type="button"
          onClick={onClose}
          aria-label="Close menu"
        >
          ×
        </button>
      </header>

      <Chatlist
        conversations={conversations}
        activeId={activeId}
        onSelect={onSelect}
        onNewChat={onNewChat}
        onDelete={onDelete}
      />

      <button className="sidebar__settings" type="button" onClick={onOpenSettings}>
        <img className="sidebar__settings-icon" src={settingsIcon} alt="" width={36} height={36} />
        <span>Settings</span>
      </button>
    </aside>
  );
}

export default Sidebar;
