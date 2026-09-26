import { useEffect, useState } from "react";

import clsx from "clsx";

import { KEYS, MIME_TYPES } from "@excalidraw/common";

import { useI18n } from "../i18n";

import { useApp, useExcalidrawContainer } from "./App";
import Trans from "./Trans";

import "./FileDropOverlay.scss";

type FileDropState = {
  shiftKey: boolean;
  kind: "scene" | "library";
};

export const FileDropOverlay = () => {
  const app = useApp();
  const { container } = useExcalidrawContainer();
  const { t } = useI18n();
  const [dragState, setDragState] = useState<FileDropState | null>(null);

  useEffect(() => {
    if (!container) {
      return;
    }

    let dragDepth = 0;
    const reset = () => {
      dragDepth = 0;
      setDragState(null);
    };
    const isFileDrag = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const update = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.items ?? []).filter(
        (item) => item.kind === "file",
      );
      // Filenames are protected until drop, so .excalidraw.png/.svg exports
      // cannot be distinguished here. Keep the canvas visible for all images.
      if (files.some((file) => file.type.startsWith("image/"))) {
        setDragState(null);
        return;
      }

      const kind: FileDropState["kind"] =
        files[0]?.type === MIME_TYPES.excalidrawlib ? "library" : "scene";

      setDragState((previous) =>
        previous?.shiftKey === event.shiftKey && previous.kind === kind
          ? previous
          : { shiftKey: event.shiftKey, kind },
      );
    };
    const onDragEnter = (event: DragEvent) => {
      if (isFileDrag(event)) {
        dragDepth++;
        update(event);
      }
    };
    const onDragOver = (event: DragEvent) => {
      if (isFileDrag(event)) {
        event.preventDefault();
        // Shift defaults the drag to "move" (and its cursor), but we only
        // ever copy the file in
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "copy";
        }
        dragDepth = Math.max(1, dragDepth);
        update(event);
      }
    };
    const onDragLeave = () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) {
        reset();
      }
    };
    const onKeyChange = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) {
        reset();
      } else if (event.key === "Shift") {
        setDragState((previous) =>
          previous ? { ...previous, shiftKey: event.shiftKey } : previous,
        );
      }
    };

    container.addEventListener("dragenter", onDragEnter);
    container.addEventListener("dragover", onDragOver);
    container.addEventListener("dragleave", onDragLeave);
    app.ownerDocument.addEventListener("drop", reset, true);
    app.ownerDocument.addEventListener("dragend", reset, true);
    app.ownerDocument.addEventListener("keydown", onKeyChange, true);
    app.ownerDocument.addEventListener("keyup", onKeyChange, true);
    app.ownerWindow.addEventListener("blur", reset);

    return () => {
      container.removeEventListener("dragenter", onDragEnter);
      container.removeEventListener("dragover", onDragOver);
      container.removeEventListener("dragleave", onDragLeave);
      app.ownerDocument.removeEventListener("drop", reset, true);
      app.ownerDocument.removeEventListener("dragend", reset, true);
      app.ownerDocument.removeEventListener("keydown", onKeyChange, true);
      app.ownerDocument.removeEventListener("keyup", onKeyChange, true);
      app.ownerWindow.removeEventListener("blur", reset);
    };
  }, [app, container]);

  if (!dragState) {
    return null;
  }

  const keepsContent = dragState.shiftKey || dragState.kind === "library";

  return (
    <div
      className={clsx("file-drop-overlay", {
        "file-drop-overlay--keep": keepsContent,
      })}
    >
      <div className="file-drop-overlay__card">
        <div role="status" aria-live="polite" aria-atomic="true">
          <div className="file-drop-overlay__title">
            {t(
              dragState.kind === "library"
                ? "fileDrop.importLibrary"
                : dragState.shiftKey
                ? "fileDrop.add"
                : "fileDrop.replace",
            )}
          </div>
          <div className="file-drop-overlay__hint">
            {keepsContent ? (
              t("fileDrop.keepHint")
            ) : (
              <Trans
                i18nKey="fileDrop.replaceHint"
                shift={(children) => <kbd>{children}</kbd>}
              />
            )}
          </div>
        </div>
        <div className="file-drop-overlay__illustration" aria-hidden="true">
          {(["back", "front"] as const).map((position) => (
            <svg
              key={position}
              className={`file-drop-overlay__file file-drop-overlay__file--${position}`}
              viewBox="0 0 100 128"
              fill="none"
            >
              <path
                className="file-drop-overlay__paper"
                d="M16 3h43l28 28v81c0 7-4 12-12 12H16c-8 0-12-5-12-12V15C4 7 8 3 16 3Z"
              />
              <path d="M59 3v20c0 6 3 8 9 8h19" />
              <path
                className="file-drop-overlay__lines"
                d="M24 61h43M24 77h43M24 93h26"
              />
              {position === "back" && (
                <path
                  className="file-drop-overlay__cross"
                  d="M18 44l24 24M42 44L18 68"
                />
              )}
            </svg>
          ))}
        </div>
      </div>
    </div>
  );
};
