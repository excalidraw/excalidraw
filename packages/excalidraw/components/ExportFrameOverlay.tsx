import {
  EXPORT_IMAGE_TYPES,
  cloneJSON,
  isFirefox,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import React, {
  type CSSProperties,
  useCallback,
  useMemo,
  useState,
} from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { probablySupportsClipboardBlob } from "../clipboard";
import { t } from "../i18n";

import "./ExportFrameOverlay.scss";

import { copyIcon, downloadIcon } from "./icons";
import { FilledButton } from "./FilledButton";
import { Island } from "./Island";

import type { ExportedElements } from "../data";
import type { AppClassProperties, AppState, ExportCropRegion } from "../types";

const MIN_SIDE_PX = 24;

const sceneCoordsFromClient = (
  clientX: number,
  clientY: number,
  appState: Pick<
    AppState,
    "zoom" | "scrollX" | "scrollY" | "offsetLeft" | "offsetTop"
  >,
) => viewportCoordsToSceneCoords({ clientX, clientY }, appState);

const sceneRegionToPxBox = (
  region: ExportCropRegion,
  appState: Pick<AppState, "zoom" | "scrollX" | "scrollY">,
): { left: number; top: number; width: number; height: number } => ({
  left: (region.x + appState.scrollX) * appState.zoom.value,
  top: (region.y + appState.scrollY) * appState.zoom.value,
  width: region.width * appState.zoom.value,
  height: region.height * appState.zoom.value,
});

const draftToRegion = (
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): ExportCropRegion => {
  const x = Math.min(sx, ex);
  const y = Math.min(sy, ey);
  return {
    x,
    y,
    width: Math.abs(ex - sx),
    height: Math.abs(ey - sy),
  };
};

export const ExportFrameOverlay = ({
  appState,
  elements,
  setAppState,
  onExportImage,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  setAppState: React.Component<any, AppState>["setState"];
  onExportImage: AppClassProperties["onExportImage"];
}) => {
  const [dragCorners, setDragCorners] = useState<null | {
    sx: number;
    sy: number;
    ex: number;
    ey: number;
  }>(null);

  const overlayBox = useMemo((): CSSProperties => {
    return {
      position: "absolute",
      top: appState.offsetTop,
      left: appState.offsetLeft,
      width: appState.width,
      height: appState.height,
      zIndex: 5,
    };
  }, [
    appState.offsetTop,
    appState.offsetLeft,
    appState.width,
    appState.height,
  ]);

  const normalizedDragRegion =
    dragCorners &&
    draftToRegion(
      dragCorners.sx,
      dragCorners.sy,
      dragCorners.ex,
      dragCorners.ey,
    );

  const displayRegion =
    appState.exportFrameMode === "selecting"
      ? normalizedDragRegion && normalizedDragRegion.width > 0
        ? normalizedDragRegion
        : null
      : appState.exportCropRegion;

  const pxDisplay = displayRegion
    ? sceneRegionToPxBox(displayRegion, appState)
    : null;

  const clearExportFrameMode = useCallback(() => {
    setAppState({
      exportFrameMode: "idle",
      exportCropRegion: null,
    });
    setDragCorners(null);
  }, [setAppState]);

  const runExportFromCrop = useCallback(
    async (type: keyof typeof EXPORT_IMAGE_TYPES, region: ExportCropRegion) => {
      const cropBounds = [
        region.x,
        region.y,
        region.x + region.width,
        region.y + region.height,
      ] as [number, number, number, number];
      const exportedElements = cloneJSON(elements) as ExportedElements;
      try {
        await onExportImage(type, exportedElements, {
          exportingFrame: null,
          cropBounds,
        });
      } finally {
        clearExportFrameMode();
      }
    },
    [clearExportFrameMode, elements, onExportImage],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    // Once a region is committed, redraw only via Cancel + Export frame.
    if (appState.exportFrameMode === "selected") {
      return;
    }

    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
    const scene = sceneCoordsFromClient(event.clientX, event.clientY, appState);
    setDragCorners({
      sx: scene.x,
      sy: scene.y,
      ex: scene.x,
      ey: scene.y,
    });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragCorners) {
      return;
    }

    event.preventDefault();
    const scene = sceneCoordsFromClient(event.clientX, event.clientY, appState);
    setDragCorners((prev) =>
      prev ? { ...prev, ex: scene.x, ey: scene.y } : prev,
    );
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (!dragCorners) {
      return;
    }

    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    event.preventDefault();

    const scene = sceneCoordsFromClient(event.clientX, event.clientY, appState);

    const next = draftToRegion(
      dragCorners.sx,
      dragCorners.sy,
      scene.x,
      scene.y,
    );

    const wPx = next.width * appState.zoom.value;
    const hPx = next.height * appState.zoom.value;

    setDragCorners(null);

    if (wPx < MIN_SIDE_PX || hPx < MIN_SIDE_PX) {
      setAppState({
        toast: {
          message: t("imageExportDialog.exportFrameTooSmall"),
          duration: 2000,
        },
      });
      return;
    }

    setAppState({
      exportCropRegion: next,
      exportFrameMode: "selected",
    });
  };

  const onPointerCaptureLost = () => {
    setDragCorners(null);
  };

  if (appState.exportFrameMode === "idle") {
    return null;
  }

  return (
    <div style={overlayBox}>
      {/* Dimming */}
      {(appState.exportFrameMode === "selecting" || pxDisplay?.width) &&
        pxDisplay &&
        pxDisplay.width > 0 &&
        pxDisplay.height > 0 && (
          <div className="ExportFrameOverlay__dimming" aria-hidden>
            {/* four bands */}
            <div
              className="ExportFrameOverlay__dimStrip"
              style={{ top: 0, height: pxDisplay.top, left: 0, right: 0 }}
            />
            <div
              className="ExportFrameOverlay__dimStrip"
              style={{
                top: pxDisplay.top + pxDisplay.height,
                bottom: 0,
                left: 0,
                right: 0,
              }}
            />
            <div
              className="ExportFrameOverlay__dimStrip"
              style={{
                top: pxDisplay.top,
                left: 0,
                width: pxDisplay.left,
                height: pxDisplay.height,
              }}
            />
            <div
              className="ExportFrameOverlay__dimStrip"
              style={{
                top: pxDisplay.top,
                left: pxDisplay.left + pxDisplay.width,
                right: 0,
                height: pxDisplay.height,
              }}
            />
          </div>
        )}

      {appState.exportFrameMode === "selecting" && (
        <div
          className="ExportFrameOverlay__interaction"
          role="presentation"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onLostPointerCapture={onPointerCaptureLost}
        />
      )}

      {appState.exportFrameMode === "selected" && (
        <div className="ExportFrameOverlay__blocker" role="presentation" />
      )}

      {pxDisplay && pxDisplay.width > 0 && pxDisplay.height > 0 && (
        <div
          className="ExportFrameOverlay__frameBorder"
          style={{
            transform: `translate(${pxDisplay.left}px, ${pxDisplay.top}px)`,
            width: pxDisplay.width,
            height: pxDisplay.height,
          }}
        />
      )}

      <div className="ExportFrameOverlay__hintIsland">
        {appState.exportFrameMode === "selecting" &&
          !dragCorners &&
          t("imageExportDialog.exportFrameInstructions")}
        {appState.exportFrameMode === "selected" &&
          appState.exportCropRegion &&
          t("imageExportDialog.exportFrameConfirm")}
      </div>

      {appState.exportFrameMode === "selected" && appState.exportCropRegion && (
        <Island padding={2} className="ExportFrameOverlay__actions">
          <FilledButton
            size="medium"
            label={t("imageExportDialog.title.exportToPng")}
            variant="filled"
            onClick={() =>
              runExportFromCrop(
                EXPORT_IMAGE_TYPES.png,
                appState.exportCropRegion!,
              )
            }
            icon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToPng")}
          </FilledButton>
          <FilledButton
            size="medium"
            label={t("imageExportDialog.title.exportToSvg")}
            variant="filled"
            onClick={() =>
              runExportFromCrop(
                EXPORT_IMAGE_TYPES.svg,
                appState.exportCropRegion!,
              )
            }
            icon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToSvg")}
          </FilledButton>
          {(probablySupportsClipboardBlob || isFirefox) && (
            <FilledButton
              size="medium"
              label={t("imageExportDialog.title.copyPngToClipboard")}
              variant="filled"
              onClick={() =>
                runExportFromCrop(
                  EXPORT_IMAGE_TYPES.clipboard,
                  appState.exportCropRegion!,
                )
              }
              icon={copyIcon}
            >
              {t("imageExportDialog.button.copyPngToClipboard")}
            </FilledButton>
          )}
          <FilledButton
            size="medium"
            variant="outlined"
            onClick={(e) => {
              e.preventDefault();
              clearExportFrameMode();
            }}
          >
            {t("imageExportDialog.exportFrameCancel")}
          </FilledButton>
        </Island>
      )}
    </div>
  );
};
