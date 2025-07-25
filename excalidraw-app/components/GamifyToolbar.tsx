// Datei: /var/www/gamifyboard/excalidraw-app/components/GamifyToolbar.tsx

import React from "react";
import { nanoid } from "nanoid";

import { newElement } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface GamifyToolbarProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const GamifyToolbar: React.FC<GamifyToolbarProps> = ({
  excalidrawAPI,
}) => {
  return null; // Render nothing if no elements are selected
};
