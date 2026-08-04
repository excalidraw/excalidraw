import {
  getBucketFillBackgroundColor,
  getSizeFromPoints,
} from "@excalidraw/common";
import { pointFrom, type GlobalPoint, type LocalPoint } from "@excalidraw/math";

import {
  computeBucketFillPolygon,
  isBucketFillCompatible,
  isFrameLikeElement,
  isRestylableFill,
  newLinearElement,
  ShapeCache,
} from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import type App from "./App";

type ScenePoint = {
  x: number;
  y: number;
};

/** Owns bucket-fill interaction and App-bound scene mutations. */
export class AppBucketFill {
  constructor(private app: App) {}

  /**
   * The click armed on pointer down, committed on pointer up. Deferring the
   * scene mutation to pointer up is what lets a pinch/pan second finger, a
   * long-press context menu, or a pointercancel abort the fill — on pointer
   * down the editor cannot yet know the gesture will stay a single-pointer
   * click.
   */
  private pending: ScenePoint | null = null;

  /** Arm a fill at the pointer-down position; nothing mutates yet. */
  handlePointerDown = (scenePointer: ScenePoint) => {
    this.pending = scenePointer;
  };

  /**
   * Commit the armed fill, at the pointer-DOWN position (what the user
   * aimed at). No-op when the gesture was aborted in the meantime.
   */
  handlePointerUp = () => {
    const scenePointer = this.pending;
    this.pending = null;
    if (scenePointer) {
      this.fill(scenePointer);
    }
  };

  /** Abort the armed fill (second finger, context menu, pointercancel). */
  cancel = () => {
    this.pending = null;
  };

  /**
   * Apply the current bucket fill settings to an existing fill-compatible
   * element (no-op when nothing would change). One undoable step.
   */
  private restyle = (element: NonDeletedExcalidrawElement) => {
    const backgroundColor = getBucketFillBackgroundColor(
      this.app.state.currentItemBackgroundColor,
    );
    if (
      element.backgroundColor === backgroundColor &&
      element.fillStyle === this.app.state.currentItemFillStyle &&
      element.opacity === this.app.state.currentItemOpacity
    ) {
      return;
    }
    this.app.scene.mutateElement(element, {
      backgroundColor,
      fillStyle: this.app.state.currentItemFillStyle,
      opacity: this.app.state.currentItemOpacity,
    });
    // the roughjs drawable is cached by element reference; in-place
    // mutation keeps the reference, so evict it or the canvas won't
    // reflect the new style
    ShapeCache.delete(element);
    this.app.scheduleCapture();
  };

  private fill = (scenePointer: ScenePoint) => {
    // shared with the generic shape background, but a transparent fill would
    // be invisible, so fall back to a real color (appState is not mutated)
    const backgroundColor = getBucketFillBackgroundColor(
      this.app.state.currentItemBackgroundColor,
    );

    const elements = this.app.scene.getNonDeletedElements();
    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const point = pointFrom<GlobalPoint>(scenePointer.x, scenePointer.y);

    const hitElement = this.app.getElementAtPosition(point[0], point[1]);

    // gap bridging is covered by the default gapTolerance (a bucket-specific
    // constant): connector edges close visual gaps without distorting the
    // shape, so no zoom-dependent tuning is needed
    const result = computeBucketFillPolygon({ point, elements, elementsMap });

    if (!result.ok) {
      // no region could be derived, but the click still landed on existing
      // paint (e.g. an orphaned fill whose boundaries were deleted, or a
      // hand-drawn strokeless bg polygon on empty canvas) — restyling it is
      // the sensible outcome, and beats a toast
      if (hitElement && isBucketFillCompatible(hitElement)) {
        this.restyle(hitElement);
        return;
      }
      if (result.reason === "too_complex") {
        this.app.setToast({
          message: t("bucketfill.tooComplex"),
          duration: 3000,
        });
      } else if (
        result.reason === "open_region" ||
        result.reason === "too_small" ||
        result.reason === "invalid_polygon"
      ) {
        this.app.setToast({
          message: t("bucketfill.noRegion"),
          duration: 3000,
        });
      }
      // "no_owner" stays silent — clicking empty canvas shouldn't nag
      return;
    }

    // re-clicking an already-filled region shouldn't stack a duplicate:
    // restyle the existing fill with the current settings, or no-op when
    // nothing would change
    if (
      hitElement &&
      isRestylableFill({
        hitElement,
        scenePoints: result.scenePoints,
        elementsMap,
      })
    ) {
      this.restyle(hitElement);
      return;
    }

    const { width, height } = getSizeFromPoints(result.scenePoints);
    // linear elements are normalized so points[0] must be [0, 0]; use the
    // first scene point as the element origin
    const [originX, originY] = result.scenePoints[0];
    const points = result.scenePoints.map((p) =>
      pointFrom<LocalPoint>(p[0] - originX, p[1] - originY),
    );

    const owner = result.ownerId ? elementsMap.get(result.ownerId) : null;
    // owner-less fills (regions formed by open lines) take their frame from
    // the click position and only inherit a group shared by every boundary
    const frameId = owner
      ? isFrameLikeElement(owner)
        ? owner.id
        : owner.frameId
      : this.app.getTopLayerFrameAtSceneCoords(scenePointer)?.id ?? null;
    const groupIds = owner
      ? owner.groupIds
      : result.boundaryElementIds
          .map((id) => elementsMap.get(id)?.groupIds)
          .filter((groupIds): groupIds is string[] => !!groupIds)
          .reduce(
            (common, groupIds) =>
              common === null
                ? groupIds
                : common.filter((groupId) => groupIds.includes(groupId)),
            null as string[] | null,
          ) ?? [];

    const fill = newLinearElement({
      type: "line",
      x: originX,
      y: originY,
      width,
      height,
      points,
      polygon: true,
      strokeColor: "transparent",
      backgroundColor,
      fillStyle: this.app.state.currentItemFillStyle,
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      roundness: null,
      opacity: this.app.state.currentItemOpacity,
      frameId,
      groupIds,
      // no marker: fills are recognized by shape (`isBucketFillCompatible`),
      // since metadata would go stale the moment the user restyles the fill
    });

    // resolve the geometry's relative placement against the
    // deleted-inclusive array that `insertElementsAtIndex` operates on
    const anchorIndex = this.app.scene
      .getElementsIncludingDeleted()
      .findIndex((el) => el.id === result.insertion.elementId);
    this.app.scene.insertElementsAtIndex(
      [fill],
      anchorIndex < 0
        ? null
        : result.insertion.placement === "above"
        ? anchorIndex + 1
        : anchorIndex,
    );

    // Keep the bucket fill tool active and do NOT select the new fill, so the
    // user can keep filling regions back-to-back without re-selecting the tool
    // (even when the tool isn't locked).
    this.app.scheduleCapture();
  };
}
