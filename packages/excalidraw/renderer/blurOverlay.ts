import { isBlurLensElement } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { StaticCanvasAppState } from "../types";

/**
 * Paints blur "lens" shapes on top of the already-rendered scene canvas.
 *
 * Strategy:
 *   1. For each blurred element (in z-order), compute its axis-aligned
 *      bounding box in screen pixels.
 *   2. Copy that rectangle out of the scene canvas into an offscreen canvas
 *      with `ctx.filter = "blur(Npx)"` (Gaussian) or via downscale/upscale
 *      (pixelate). This sampling captures *every* element underneath,
 *      including text, images, and other shapes — exactly what the user
 *      asked for.
 *   3. Draw the blurred image back onto the scene canvas, clipped to the
 *      shape outline (rectangle / diamond / ellipse) at the correct angle.
 *
 * Performance:
 *   - We rely on the browser's native `filter: blur()` which is GPU
 *     accelerated; the JS work is just bbox math + two `drawImage` calls.
 *   - Pixelate uses nearest-neighbor downscale and is even cheaper.
 *   - Off-screen lenses are skipped via a viewport intersection test.
 */
export const applyBlurOverlays = (
  context: CanvasRenderingContext2D,
  visibleElements: readonly NonDeletedExcalidrawElement[],
  appState: StaticCanvasAppState,
  /** width / height of the scene canvas in *device* pixels */
  canvasWidthDevicePx: number,
  canvasHeightDevicePx: number,
  /** scale factor used by `bootstrapCanvas` (window.devicePixelRatio for
      on-screen canvases, `appState.exportScale` for export). */
  deviceScale: number,
) => {
  const lenses = visibleElements.filter(isBlurLensElement);
  if (lenses.length === 0) {
    return;
  }

  const sourceCanvas = context.canvas;
  const zoom = appState.zoom.value;

  for (const element of lenses) {
    // bbox in scene coordinates (pre-zoom)
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const halfDiag = Math.sqrt(element.width ** 2 + element.height ** 2) / 2;
    // expand by blur radius so we sample enough surrounding pixels for the
    // edges of the blur kernel
    const pad = element.blurRadius + 2;
    const bboxX = cx - halfDiag - pad;
    const bboxY = cy - halfDiag - pad;
    const bboxW = (halfDiag + pad) * 2;
    const bboxH = (halfDiag + pad) * 2;

    // convert to device pixels
    const sx = Math.floor((bboxX + appState.scrollX) * zoom * deviceScale);
    const sy = Math.floor((bboxY + appState.scrollY) * zoom * deviceScale);
    const sw = Math.ceil(bboxW * zoom * deviceScale);
    const sh = Math.ceil(bboxH * zoom * deviceScale);

    // viewport cull
    if (
      sx + sw <= 0 ||
      sy + sh <= 0 ||
      sx >= canvasWidthDevicePx ||
      sy >= canvasHeightDevicePx
    ) {
      continue;
    }

    // clamp to canvas bounds for the source rect
    const clampedSx = Math.max(0, sx);
    const clampedSy = Math.max(0, sy);
    const clampedSw = Math.min(
      canvasWidthDevicePx - clampedSx,
      sw - (clampedSx - sx),
    );
    const clampedSh = Math.min(
      canvasHeightDevicePx - clampedSy,
      sh - (clampedSy - sy),
    );
    if (clampedSw <= 0 || clampedSh <= 0) {
      continue;
    }

    // Halo around the captured region — gives the blur kernel valid
    // surrounding pixels so the blurred buffer doesn't fade to transparent
    // at the edges of the source area. We try to fill the halo with the
    // *actual* canvas content surrounding the lens so the blur is correct
    // for content on every side; only where the halo extends past the
    // canvas boundary do we fall back to the view background color.
    const blurDevicePx = element.blurRadius * deviceScale * zoom;
    const halo =
      element.blurStyle === "pixelate" ? 0 : Math.ceil(blurDevicePx * 2);

    // Desired sample rect = lens bbox extended by halo on each side.
    const wantSx = clampedSx - halo;
    const wantSy = clampedSy - halo;
    const wantSw = clampedSw + halo * 2;
    const wantSh = clampedSh + halo * 2;
    // Clamp the extended rect to canvas bounds.
    const extSx = Math.max(0, wantSx);
    const extSy = Math.max(0, wantSy);
    const extSw = Math.min(
      canvasWidthDevicePx - extSx,
      wantSw - (extSx - wantSx),
    );
    const extSh = Math.min(
      canvasHeightDevicePx - extSy,
      wantSh - (extSy - wantSy),
    );
    // Where to place the canvas-sampled pixels inside the temp buffer.
    const dstX = extSx - wantSx;
    const dstY = extSy - wantSy;

    const tmp = document.createElement("canvas");
    tmp.width = wantSw;
    tmp.height = wantSh;
    const tctx = tmp.getContext("2d");
    if (!tctx) {
      continue;
    }

    // Fill bg color as a final fallback so any never-painted pixel reads
    // as bg color rather than transparent black.
    if (halo > 0) {
      tctx.fillStyle = appState.viewBackgroundColor || "#ffffff";
      tctx.fillRect(0, 0, tmp.width, tmp.height);
    }

    // Extend canvas edge pixels into off-canvas halo regions
    // (analogue of SVG feGaussianBlur edgeMode="duplicate"). This avoids
    // the blur kernel pulling in bg-color from an empty halo at canvas
    // borders, which would otherwise create a bright band along the lens
    // edge that touches the page boundary.
    if (halo > 0 && extSw > 0 && extSh > 0) {
      // top: stretch top row up
      if (dstY > 0) {
        tctx.drawImage(
          sourceCanvas,
          extSx,
          extSy,
          extSw,
          1,
          dstX,
          0,
          extSw,
          dstY,
        );
      }
      // bottom
      const bottomDstY = dstY + extSh;
      const bottomGap = tmp.height - bottomDstY;
      if (bottomGap > 0) {
        tctx.drawImage(
          sourceCanvas,
          extSx,
          extSy + extSh - 1,
          extSw,
          1,
          dstX,
          bottomDstY,
          extSw,
          bottomGap,
        );
      }
      // left
      if (dstX > 0) {
        tctx.drawImage(
          sourceCanvas,
          extSx,
          extSy,
          1,
          extSh,
          0,
          dstY,
          dstX,
          extSh,
        );
      }
      // right
      const rightDstX = dstX + extSw;
      const rightGap = tmp.width - rightDstX;
      if (rightGap > 0) {
        tctx.drawImage(
          sourceCanvas,
          extSx + extSw - 1,
          extSy,
          1,
          extSh,
          rightDstX,
          dstY,
          rightGap,
          extSh,
        );
      }
      // corners (single-pixel sample stretched into the corner box)
      if (dstX > 0 && dstY > 0) {
        tctx.drawImage(sourceCanvas, extSx, extSy, 1, 1, 0, 0, dstX, dstY);
      }
      if (rightGap > 0 && dstY > 0) {
        tctx.drawImage(
          sourceCanvas,
          extSx + extSw - 1,
          extSy,
          1,
          1,
          rightDstX,
          0,
          rightGap,
          dstY,
        );
      }
      if (dstX > 0 && bottomGap > 0) {
        tctx.drawImage(
          sourceCanvas,
          extSx,
          extSy + extSh - 1,
          1,
          1,
          0,
          bottomDstY,
          dstX,
          bottomGap,
        );
      }
      if (rightGap > 0 && bottomGap > 0) {
        tctx.drawImage(
          sourceCanvas,
          extSx + extSw - 1,
          extSy + extSh - 1,
          1,
          1,
          rightDstX,
          bottomDstY,
          rightGap,
          bottomGap,
        );
      }
    }

    if (element.blurStyle === "pixelate") {
      const block = Math.max(2, Math.round(blurDevicePx));
      const dw = Math.max(1, Math.floor(clampedSw / block));
      const dh = Math.max(1, Math.floor(clampedSh / block));
      const small = document.createElement("canvas");
      small.width = dw;
      small.height = dh;
      const sctx = small.getContext("2d");
      if (!sctx) {
        continue;
      }
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(
        sourceCanvas,
        clampedSx,
        clampedSy,
        clampedSw,
        clampedSh,
        0,
        0,
        dw,
        dh,
      );
      // Pixelate writes into the inner region of the temp buffer so it
      // lines up with the same coordinate system used for Gaussian.
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(small, 0, 0, dw, dh, halo, halo, clampedSw, clampedSh);
    } else {
      // Draw the actual canvas content into the inner region (no blur yet).
      tctx.drawImage(
        sourceCanvas,
        extSx,
        extSy,
        extSw,
        extSh,
        dstX,
        dstY,
        extSw,
        extSh,
      );
      // Second pass: blur the assembled temp buffer (which now contains
      // the inner content surrounded by edge-duplicated halo) into a
      // second buffer, so the blur kernel reads valid pixels at the
      // source-rect boundaries instead of fading to transparent.
      const blurred = document.createElement("canvas");
      blurred.width = tmp.width;
      blurred.height = tmp.height;
      const bctx = blurred.getContext("2d");
      if (!bctx) {
        continue;
      }
      bctx.filter = `blur(${blurDevicePx}px)`;
      bctx.drawImage(tmp, 0, 0);
      // swap blurred result back into `tmp` so the downstream code that
      // composites from `tmp` keeps working unchanged.
      tctx.filter = "none";
      tctx.clearRect(0, 0, tmp.width, tmp.height);
      tctx.drawImage(blurred, 0, 0);
    }

    // Composite back, clipped to the shape outline. The main context is
    // currently scaled to (deviceScale * zoom); we want to draw raw device
    // pixels, so save & reset.
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);

    const shapeCx =
      (element.x + element.width / 2 + appState.scrollX) * zoom * deviceScale;
    const shapeCy =
      (element.y + element.height / 2 + appState.scrollY) * zoom * deviceScale;
    const halfW = (element.width / 2) * zoom * deviceScale;
    const halfH = (element.height / 2) * zoom * deviceScale;

    // Helper that traces the shape's outline (centered at origin) on the
    // current context. Used twice: once as a clip for the blurred image,
    // once as a stroke path for the visible border.
    const traceShapePath = () => {
      context.beginPath();
      if (element.type === "ellipse") {
        context.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
      } else if (element.type === "diamond") {
        context.moveTo(0, -halfH);
        context.lineTo(halfW, 0);
        context.lineTo(0, halfH);
        context.lineTo(-halfW, 0);
        context.closePath();
      } else {
        const r =
          element.roundness && context.roundRect
            ? Math.min(halfW, halfH) * 0.25
            : 0;
        if (r > 0 && context.roundRect) {
          context.roundRect(-halfW, -halfH, halfW * 2, halfH * 2, r);
        } else {
          context.rect(-halfW, -halfH, halfW * 2, halfH * 2);
        }
      }
    };

    // Pass 1: clip to shape outline and draw the blurred buffer.
    context.translate(shapeCx, shapeCy);
    context.rotate(element.angle);
    traceShapePath();
    context.clip();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = element.opacity / 100;
    // Draw only the inner (non-halo) region back at the captured position.
    context.drawImage(
      tmp,
      halo,
      halo,
      clampedSw,
      clampedSh,
      clampedSx,
      clampedSy,
      clampedSw,
      clampedSh,
    );
    context.restore();

    // Pass 2: paint the shape's stroke on top so the user keeps a visible
    // border (matching their strokeColor / strokeWidth / strokeStyle). If
    // they explicitly chose a transparent stroke, we render nothing.
    const strokeColor = element.strokeColor;
    const strokeIsTransparent =
      !strokeColor || strokeColor === "transparent" || strokeColor === "none";
    if (!strokeIsTransparent) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.translate(shapeCx, shapeCy);
      context.rotate(element.angle);
      context.strokeStyle = strokeColor;
      context.lineWidth = element.strokeWidth * zoom * deviceScale;
      context.lineCap = "round";
      context.lineJoin = "round";
      const dashUnit = Math.max(2, context.lineWidth);
      if (element.strokeStyle === "dashed") {
        context.setLineDash([dashUnit * 4, dashUnit * 2]);
      } else if (element.strokeStyle === "dotted") {
        context.setLineDash([dashUnit, dashUnit * 1.5]);
      } else {
        context.setLineDash([]);
      }
      context.globalAlpha = element.opacity / 100;
      traceShapePath();
      context.stroke();
      context.restore();
    }
  }
};
