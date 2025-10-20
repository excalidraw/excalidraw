import clsx from "clsx";
import Spinner from "../Spinner";
import { DiagramPlaceholder } from "./assets/DiagramPlaceholder";

interface ErrorDisplayProps {
  error: string;
}

const ErrorDisplay = ({ error }: ErrorDisplayProps) => {
  return (
    <div
      data-testid="ttd-dialog-output-error"
      className="ttd-dialog-output-error"
    >
      Error!
      <p>{error}</p>
    </div>
  );
};

interface TTDDialogOutputProps {
  error: Error | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  loaded: boolean;
  hasContent?: boolean;
  showMermaidCode?: boolean;
  mermaidCode?: string;
  onMermaidCodeChange?: (code: string) => void;
}

export const TTDDialogOutput = ({
  error,
  canvasRef,
  loaded,
  hasContent = false,
  showMermaidCode = false,
  mermaidCode = "",
  onMermaidCodeChange,
}: TTDDialogOutputProps) => {
  if (showMermaidCode && mermaidCode) {
    return (
      <textarea
        className="ttd-dialog-mermaid-code"
        value={mermaidCode}
        onChange={(e) => onMermaidCodeChange?.(e.target.value)}
      />
    );
  }

  return (
    <div className="ttd-dialog-output-wrapper">
      {!hasContent && (
        <div className="ttd-dialog-output-placeholder">
          <DiagramPlaceholder />
        </div>
      )}
      {error && <ErrorDisplay error={error.message} />}
      {loaded ? (
        <div
          ref={canvasRef}
          className={clsx("ttd-dialog-output-canvas-container", {
            "ttd-dialog-output-canvas-container--error": !!error,
          })}
        />
      ) : (
        <Spinner size="2rem" />
      )}
    </div>
  );
};
