import React from "react";
import { Footer } from "../../packages/excalidraw/index";
import { EncryptedIcon } from "./EncryptedIcon";
import { MaxSizeExceededIcon } from "./MaxSizeExceededIcon";
import { ExcalidrawPlusAppLink } from "./ExcalidrawPlusAppLink";
import { isExcalidrawPlusSignedUser } from "../app_constants";

export const AppFooter: React.FC<{ maxSizeExceeded: boolean }> = React.memo(
  (props) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {props.maxSizeExceeded && <MaxSizeExceededIcon />}
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
