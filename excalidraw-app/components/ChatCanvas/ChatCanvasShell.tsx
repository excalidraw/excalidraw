import React, { ReactNode } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  chatPanelWidthAtom,
  sidebarWidthAtom,
  isChatPanelOpenAtom,
  isSidebarOpenAtom,
  chatMessagesAtom,
  selectionContextAtom,
  isAgentLoadingAtom,
  agentErrorAtom,
  type ChatMessage,
} from "./atoms";
import { TopBar } from "./TopBar";
import { ChatPanel } from "./ChatPanel";
import { SidebarDrawer } from "./SidebarDrawer";
import "./ChatCanvasShell.scss";

interface ChatCanvasShellProps {
  children: ReactNode;
  onSendMessage?: (message: string, context?: any) => void;
  onLoadTemplate?: (template: any) => void;
  onExport?: () => void;
  onSettings?: () => void;
  title?: string;
}

export const ChatCanvasShell: React.FC<ChatCanvasShellProps> = ({
  children,
  onSendMessage,
  onLoadTemplate,
  onExport,
  onSettings,
  title = "ChatCanvas",
}) => {
  const chatPanelWidth = useAtomValue(chatPanelWidthAtom);
  const sidebarWidth = useAtomValue(sidebarWidthAtom);
  const isChatPanelOpen = useAtomValue(isChatPanelOpenAtom);
  const isSidebarOpen = useAtomValue(isSidebarOpenAtom);

  return (
    <div className="chatcanvas-shell">
      {/* Top Bar */}
      <TopBar
        title={title}
        onExport={onExport}
        onSettings={onSettings}
      />

      {/* Main Content Area */}
      <div className="chatcanvas-shell__main">
        {/* Left Sidebar */}
        {isSidebarOpen && (
          <SidebarDrawer onLoadTemplate={onLoadTemplate} />
        )}

        {/* Canvas Area */}
        <div className="chatcanvas-shell__canvas-wrapper">
          {children}
        </div>

        {/* Right Chat Panel */}
        {isChatPanelOpen && (
          <ChatPanel onSendMessage={onSendMessage} />
        )}
      </div>
    </div>
  );
};

export { TopBar, ChatPanel, SidebarDrawer };
export * from "./atoms";
