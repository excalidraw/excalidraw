import clsx from "clsx";
import { useEffect, useRef } from "react";
import { DEFAULT_EXPORT_PADDING } from "../constants";
import { canvasToBlob } from "../data/blob";
import { NonDeletedExcalidrawElement } from "../element/types";
import { useSuspendable } from "../hooks/useSuspendable";
import { t } from "../i18n";
import { exportToCanvas } from "../packages/utils";
import { BinaryFiles, UIAppState } from "../types";

const ErrorCanvasPreview = () => {
  return (
    <div>
      <h3>{t("canvasError.cannotShowPreview")}</h3>
      <p>
        <span>{t("canvasError.canvasTooBig")}</span>
      </p>
      <em>({t("canvasError.canvasTooBigTip")})</em>
    </div>
  );
};

type CanvasPreviewProps = {
  appState: UIAppState;
  files: BinaryFiles;
  elements: readonly NonDeletedExcalidrawElement[];
};

export const CanvasPreview = ({
  appState,
  files,
  elements,
}: CanvasPreviewProps) => {
  const [canvasData, canvasError, canvasStatus, suspendCanvas, pendingPromise] =
    useSuspendable<HTMLCanvasElement>();

  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const maxWidth = previewNode.offsetWidth;
    const maxHeight = previewNode.offsetHeight;

    const maxWidthOrHeight = Math.min(maxWidth, maxHeight);

    if (!maxWidth) {
      return;
    }

    const promise = exportToCanvas({
      elements,
      appState,
      files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight,
    }).then((canvas) => {
      // if converting to blob fails, there's some problem that will
      // likely prevent preview and export (e.g. canvas too big)
      return canvasToBlob(canvas).then(() => {
        return canvas;
      });
    });

    suspendCanvas(promise);
  }, [appState, files, elements, suspendCanvas]);

  useEffect(() => {
    if (!canvasData || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;

    canvas.width = canvasData.width;
    canvas.height = canvasData.height;

    const context = canvas.getContext("2d");
    context!.drawImage(canvasData, 0, 0);
  }, [canvasData]);

  if (canvasStatus === "pending" && pendingPromise) {
    throw pendingPromise;
  }

  if (canvasStatus === "rejected") {
    console.error(canvasError);
    return <ErrorCanvasPreview />;
  }

  return (
    <div
      className={clsx("ImageExportModal__preview__canvas", {
        "ImageExportModal__preview__canvas--img-bcg":
          appState.exportBackground &&
          appState.fancyBackgroundImageKey !== "solid",
      })}
      ref={previewRef}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};
