import React, { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { isSidebarOpenAtom } from "./atoms";
import { TopBar } from "./TopBar";
import "./ChatCanvasShell.scss";

interface ChatCanvasShellProps {
  children: ReactNode;
  sidebar?: ReactNode;
  inspector?: ReactNode;
  onExport?: () => void;
  onSettings?: () => void;
  title?: string;
}

export const ChatCanvasShell: React.FC<ChatCanvasShellProps> = ({
  children,
  sidebar,
  inspector,
  onExport,
  onSettings,
  title = "ChatCanvas",
}) => {
  const isSidebarOpen = useAtomValue(isSidebarOpenAtom);

  return (
    <div className="chatcanvas-shell">
      {/* Top Bar */}
      <TopBar title={title} onExport={onExport} onSettings={onSettings} />

      {/* Main Content Area */}
      <div className="chatcanvas-shell__main">
        {/* Left Sidebar */}
        {isSidebarOpen && sidebar}

        {/* Canvas Area */}
        <div className="chatcanvas-shell__canvas-wrapper">{children}</div>

        {/* Right Inspector Panel */}
        {inspector}
      </div>
    </div>
  );
};

export { TopBar };
export * from "./atoms";
