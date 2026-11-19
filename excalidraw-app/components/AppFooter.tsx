import { Footer, useExcalidrawAPI } from "@excalidraw/excalidraw";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";
import { SheetManager } from "./SheetManager";

export const AppFooter = React.memo(
  ({
    onChange,
    excalidrawAPI: propExcalidrawAPI,
  }: {
    onChange: () => void;
    excalidrawAPI?: ExcalidrawImperativeAPI | null;
  }) => {
    const hookExcalidrawAPI = useExcalidrawAPI();
    const excalidrawAPI = propExcalidrawAPI || hookExcalidrawAPI;

    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
        </div>
        {excalidrawAPI && <SheetManager excalidrawAPI={excalidrawAPI} />}
      </Footer>
    );
  },
);
