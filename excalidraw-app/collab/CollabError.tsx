import { Tooltip } from "../../packages/excalidraw/components/Tooltip";
import { warning } from "../../packages/excalidraw/components/icons";

import clsx from "clsx";

import "./CollabError.scss";
import { Button } from "../../packages/excalidraw";
import { useEffect, useRef, useState } from "react";

export type CollabErrorType = {
  message: string;
  timestamp: number;
};

export const DEFAULT_COLLAB_ERROR = {
  message: "",
  timestamp: 0,
};

const CollabError = ({ collabError }: { collabError: CollabErrorType }) => {
  const [shakeAnimation, setShakeAnimation] = useState(
    "collab-errors-button-shake",
  );
  const clearAnimationRef = useRef<string | number | NodeJS.Timeout>();

  useEffect(() => {
    setShakeAnimation("collab-errors-button-shake");
    clearTimeout(clearAnimationRef.current);

    clearAnimationRef.current = setTimeout(() => {
      setShakeAnimation("");
    }, 1000);
  }, [collabError.message, collabError.timestamp]);

  return (
    <Tooltip label={collabError.message} long={true}>
      <Button
        className={clsx("collab-errors-button", shakeAnimation)}
        type="button"
        style={{
          position: "relative",
        }}
        onSelect={() => {}}
      >
        {warning}
      </Button>
    </Tooltip>
  );
};

CollabError.displayName = "CollabError";

export default CollabError;
