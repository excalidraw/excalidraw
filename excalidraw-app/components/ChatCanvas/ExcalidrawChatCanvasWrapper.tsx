import React, { ReactNode } from "react";
import { ChatCanvasShell } from "./ChatCanvasShell";
import { useSelectionContext } from "./useSelectionContext";
import { useAgentResponse } from "./useAgentResponse";
import { useTemplateLoader } from "./useTemplateLoader";
import type { SelectionContextPayload } from "./types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface ExcalidrawChatCanvasWrapperProps {
  children: ReactNode;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onExport?: () => void;
  onSettings?: () => void;
  title?: string;
}

/**
 * This component wraps Excalidraw with ChatCanvas functionality.
 * It should be used inside the Excalidraw component as a child.
 */
export const ExcalidrawChatCanvasWrapper: React.FC<
  ExcalidrawChatCanvasWrapperProps
> = ({
  children,
  excalidrawAPI,
  onExport,
  onSettings,
  title = "ChatCanvas",
}) => {
  // Track selection changes
  useSelectionContext(excalidrawAPI);

  // Handle agent responses
  const { handleAgentResponse, applyAgentActions } =
    useAgentResponse(excalidrawAPI);

  // Handle template loading
  const handleLoadTemplate = useTemplateLoader(excalidrawAPI);

  const handleSendMessage = (
    message: string,
    context: SelectionContextPayload,
  ) => {
    handleAgentResponse(message, context);
  };

  return (
    <ChatCanvasShell
      title={title}
      onExport={onExport}
      onSettings={onSettings}
      onSendMessage={handleSendMessage}
      onApplyActions={applyAgentActions}
      onLoadTemplate={handleLoadTemplate}
    >
      {children}
    </ChatCanvasShell>
  );
};
