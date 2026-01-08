import React, { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { isChatPanelOpenAtom, isSidebarOpenAtom } from "./atoms";
import { TopBar } from "./TopBar";
import { ChatPanel } from "./ChatPanel";
import { SidebarDrawer } from "./SidebarDrawer";
import type { AgentAction, SelectionContextPayload } from "./types";
import type { Template } from "./templates";
import "./ChatCanvasShell.scss";

interface ChatCanvasShellProps {
  children: ReactNode;
  onSendMessage?: (message: string, context: SelectionContextPayload) => void;
  onApplyActions?: (actions: AgentAction[]) => void;
  onLoadTemplate?: (template: Template) => void;
  onExport?: () => void;
  onSettings?: () => void;
  title?: string;
}

export const ChatCanvasShell: React.FC<ChatCanvasShellProps> = ({
  children,
  onSendMessage,
  onApplyActions,
  onLoadTemplate,
  onExport,
  onSettings,
  title = "ChatCanvas",
}) => {
  const isChatPanelOpen = useAtomValue(isChatPanelOpenAtom);
  const isSidebarOpen = useAtomValue(isSidebarOpenAtom);

  return (
    <div className="chatcanvas-shell">
      {/* Top Bar */}
      <TopBar title={title} onExport={onExport} onSettings={onSettings} />

      {/* Main Content Area */}
      <div className="chatcanvas-shell__main">
        {/* Left Sidebar */}
        {isSidebarOpen && <SidebarDrawer onLoadTemplate={onLoadTemplate} />}

        {/* Canvas Area */}
        <div className="chatcanvas-shell__canvas-wrapper">{children}</div>

        {/* Right Chat Panel */}
        {isChatPanelOpen && (
          <ChatPanel
            onSendMessage={onSendMessage}
            onApplyActions={onApplyActions}
          />
        )}
      </div>
    </div>
  );
};

export { TopBar, ChatPanel, SidebarDrawer };
export * from "./atoms";
