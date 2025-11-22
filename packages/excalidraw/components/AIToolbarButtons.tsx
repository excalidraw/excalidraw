/**
 * AIToolbarButtons
 * 
 * Toolbar buttons for AI features
 */

import React, { useEffect, useState } from "react";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";
import { useAtom } from "../../../excalidraw-app/app-jotai";
import { aiConfigDialogOpenAtom, imageToMermaidDialogOpenAtom } from "../../../excalidraw-app/app-jotai";
import { aiConfigService } from "../services/AIConfigurationService";

// Simple SVG icons
const ConfigIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
  </svg>
);

const ImageImportIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
  </svg>
);

export const AIConfigButton: React.FC = () => {
  const [, setDialogOpen] = useAtom(aiConfigDialogOpenAtom);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Check if AI is configured
    aiConfigService.isConfigured().then(setIsConfigured);
  }, []);

  return (
    <Tooltip label="Configure AI (Ctrl+Shift+A)" style={{ height: "100%" }}>
      <ToolButton
        type="button"
        icon={<ConfigIcon />}
        title="Configure AI"
        aria-label="Configure AI"
        onClick={() => setDialogOpen(true)}
        className={!isConfigured ? "ai-not-configured" : ""}
      />
    </Tooltip>
  );
};

export const ImageImportButton: React.FC = () => {
  const [, setDialogOpen] = useAtom(imageToMermaidDialogOpenAtom);

  return (
    <Tooltip label="Import Image to Diagram (Ctrl+Shift+I)" style={{ height: "100%" }}>
      <ToolButton
        type="button"
        icon={<ImageImportIcon />}
        title="Import Image"
        aria-label="Import Image to Diagram"
        onClick={() => setDialogOpen(true)}
      />
    </Tooltip>
  );
};
