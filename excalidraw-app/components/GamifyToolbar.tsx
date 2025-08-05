// Datei: /var/www/gamifyboard/excalidraw-app/components/GamifyToolbar.tsx

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import type React from "react";

interface GamifyToolbarProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const GamifyToolbar: React.FC<GamifyToolbarProps> = ({
  excalidrawAPI,
}) => {
  return null; // Render nothing if no elements are selected
};
