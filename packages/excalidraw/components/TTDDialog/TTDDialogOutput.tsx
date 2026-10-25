import clsx from "clsx";

import { useApp } from "../App";
import { Button } from "../Button";
import Spinner from "../Spinner";
import { t } from "../../i18n";
import { alertTriangleIcon } from "../icons";

import {
  formatMermaidParseErrorMessage,
  getMermaidSyntaxErrorGuidance,
  isMermaidCaretLine,
  isModuleLoadError,
} from "./utils/mermaidError";

import type { MermaidToExcalidrawLibProps } from "./types";

interface TTDDialogOutputProps {
  error: Error | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  loadStatus: MermaidToExcalidrawLibProps["status"];
  loadErrorReloadRequired?: boolean;
  onRetryLoad?: () => void;
  hideErrorDetails?: boolean;
  sourceText?: string;
  autoFixAvailable?: boolean;
  onApplyAutoFix?: () => void;
}

export const TTDDialogOutput = ({
  error,
  canvasRef,
  loadStatus,
  loadErrorReloadRequired,
  onRetryLoad,
  hideErrorDetails,
  sourceText,
  autoFixAvailable,
  onApplyAutoFix,
}: TTDDialogOutputProps) => {
  const app = useApp();
  const loadFailed = loadStatus === "error";
  // a chunk failing to load is shown as a load failure (see `loadStatus`),
  // not as a syntax error
  const parseError = isModuleLoadError(error) ? null : error;

  const errorMessage = parseError
    ? hideErrorDetails
      ? t("chat.errors.mermaidParseError")
      : formatMermaidParseErrorMessage(parseError.message, sourceText)
    : null;
  const syntaxGuidance =
    parseError && !hideErrorDetails
      ? getMermaidSyntaxErrorGuidance(parseError.message, sourceText)
      : null;
  const showAutoFixButton =
    !!autoFixAvailable && !!onApplyAutoFix && !hideErrorDetails;

  const errorMessageLines = errorMessage?.split(/\r?\n/) ?? [];

  return (
    <div
      className={`ttd-dialog-output-wrapper ${
        parseError || loadFailed ? "ttd-dialog-output-wrapper--error" : ""
      }`}
    >
      {parseError && !loadFailed && (
        <div
          key="error"
          data-testid="ttd-dialog-output-error"
          className="ttd-dialog-output-error"
        >
          <div className="ttd-dialog-output-error-content">
            <div className="ttd-dialog-output-error-icon">
              {alertTriangleIcon}
            </div>
            {syntaxGuidance && (
              <div className="ttd-dialog-output-error-summary">
                <div className="ttd-dialog-output-error-summary__headline">
                  {syntaxGuidance.summary}
                </div>
                <div className="ttd-dialog-output-error-summary__label">
                  Likely causes:
                </div>
                <ul className="ttd-dialog-output-error-summary__causes">
                  {syntaxGuidance.likelyCauses.map((cause) => (
                    <li key={cause}>{cause}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="ttd-dialog-output-error-message">
              {errorMessageLines.map((line, index) => (
                <span
                  key={`error-line-${index}`}
                  className={
                    isMermaidCaretLine(line)
                      ? "ttd-dialog-output-error-message__caret"
                      : undefined
                  }
                >
                  {line}
                  {index < errorMessageLines.length - 1 ? "\n" : ""}
                </span>
              ))}
            </div>
            {!hideErrorDetails && (
              <div className="ttd-dialog-output-error-autofix-slot">
                {showAutoFixButton ? (
                  <Button
                    className="ttd-dialog-panel-button ttd-dialog-output-error-autofix"
                    onSelect={onApplyAutoFix}
                  >
                    {t("mermaid.autoFixAvailable")}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
      {loadFailed ? (
        <div
          key="load-error"
          data-testid="ttd-dialog-output-load-error"
          className="ttd-dialog-output-error"
        >
          <div className="ttd-dialog-output-error-content">
            <div className="ttd-dialog-output-error-icon">
              {alertTriangleIcon}
            </div>
            <div className="ttd-dialog-output-error-title">
              {loadErrorReloadRequired
                ? t("mermaid.loadErrorReload")
                : t("mermaid.loadError")}
            </div>
            {loadErrorReloadRequired ? (
              <Button
                className="ttd-dialog-panel-button"
                onSelect={() => app.ownerWindow.location.reload()}
              >
                {t("mermaid.reload")}
              </Button>
            ) : (
              onRetryLoad && (
                <Button
                  className="ttd-dialog-panel-button"
                  onSelect={onRetryLoad}
                >
                  {t("chat.retry")}
                </Button>
              )
            )}
          </div>
        </div>
      ) : loadStatus === "loaded" ? (
        <div
          key="canvas"
          className={clsx("ttd-dialog-output-canvas-container", {
            invisible: !!parseError,
          })}
        >
          <div ref={canvasRef} className="ttd-dialog-output-canvas-content" />
        </div>
      ) : (
        <Spinner size="2rem" />
      )}
    </div>
  );
};
