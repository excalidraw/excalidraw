import React from "react";
import { Footer } from "../../packages/excalidraw/index";
import { EncryptedIcon } from "./EncryptedIcon";
import { ExcalidrawPlusAppLink } from "./ExcalidrawPlusAppLink";
import { isExcalidrawPlusSignedUser } from "../app_constants";
// #if [DEV]
import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
// #endif

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {
            // #if [DEV]
            isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />
            // #endif
          }
          {isExcalidrawPlusSignedUser ? (
            <ExcalidrawPlusAppLink />
          ) : (
            <EncryptedIcon />
          )}
        </div>
      </Footer>
    );
  },
);
