import React from "react";
import { Footer } from "../../packages/excalidraw/index";
import { EncryptedIcon } from "./EncryptedIcon";
import { ExcalidrawPlusAppLink } from "./ExcalidrawPlusAppLink";
import { isExcalidrawPlusSignedUser } from "../app_constants";
import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";

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
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
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
