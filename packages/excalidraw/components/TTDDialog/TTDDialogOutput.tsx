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
  renderError?: string | null; // TTD panel syntax error display
}

export const TTDDialogOutput = ({
  error,
  canvasRef,
  loaded,
  hasContent = false,
  showMermaidCode = false,
  mermaidCode = "",
  onMermaidCodeChange,
  renderError = null,
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
      {!hasContent && !renderError && (
        <div className="ttd-dialog-output-placeholder">
          <DiagramPlaceholder />
        </div>
      )}
      {renderError && (
        <div className="ttd-dialog-output-syntax-error">
          <div className="ttd-dialog-output-syntax-error__icon">⚠️</div>
          <div className="ttd-dialog-output-syntax-error__title">
            Syntax Error
          </div>
          <div className="ttd-dialog-output-syntax-error__message">
            {renderError}
          </div>
        </div>
      )}
      {error && <ErrorDisplay error={error.message} />}
      {loaded ? (
        <div
          ref={canvasRef}
          className={clsx("ttd-dialog-output-canvas-container", {
            "ttd-dialog-output-canvas-container--error": !!error,
            "ttd-dialog-output-canvas-container--hidden": !!renderError,
          })}
        />
      ) : (
        <Spinner size="2rem" />
      )}
    </div>
  );
};
