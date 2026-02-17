import clsx from "clsx";

import Spinner from "../Spinner";
import { t } from "../../i18n";
import { alertTriangleIcon } from "../icons";

interface TTDDialogOutputProps {
  error: Error | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  loaded: boolean;
  hideErrorDetails?: boolean;
}

export const TTDDialogOutput = ({
  error,
  canvasRef,
  loaded,
  hideErrorDetails,
}: TTDDialogOutputProps) => {
  return (
    <div
      className={`ttd-dialog-output-wrapper ${
        error ? "ttd-dialog-output-wrapper--error" : ""
      }`}
    >
      {error && (
        <div
          key="error"
          data-testid="ttd-dialog-output-error"
          className="ttd-dialog-output-error"
        >
          <div className="ttd-dialog-output-error-content">
            <div className="ttd-dialog-output-error-icon">
              {alertTriangleIcon}
            </div>
            <div className="ttd-dialog-output-error-title">
              {t("ttd.error")}
            </div>
            <div className="ttd-dialog-output-error-message">
              {hideErrorDetails
                ? t("chat.errors.mermaidParseError")
                : error.message}
            </div>
          </div>
        </div>
      )}
      {loaded ? (
        <div
          key="canvas"
          className={clsx("ttd-dialog-output-canvas-container", {
            invisible: !!error,
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
