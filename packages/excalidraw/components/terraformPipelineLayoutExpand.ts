/**
 * Compact pipeline cluster expand/collapse (click-to-reveal satellites).
 */

import {
  convertToExcalidrawElements,
  isFrameLikeElement,
  newElementWith,
} from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { mirrorAndDetachTerraformResourceLabels } from "./terraformElkLayout";
import { getTerraformImportPrepCache } from "./terraformImportPrepCache";
import {
  buildTopologyPrimaryClusterSkeletonForPipeline,
  type TopologyPrimaryClusterPlacement,
} from "./terraformTopologyLayout";
import {
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
  type TerraformVisibilityReconcileOverrides,
} from "./terraformVisibility";
import { injectTerraformAwsIconsIntoElements } from "./terraformAwsIcons";

const FRAME_PAD = 28;
const FALLBACK_W = 220;
const FALLBACK_H = 96;
const COMPACT_FRAME_W = FALLBACK_W + 2 * FRAME_PAD;
const COMPACT_FRAME_H = FALLBACK_H + 2 * FRAME_PAD;

function translateSkeleton(
  skeleton: ExcalidrawElementSkeleton[],
  dx: number,
  dy: number,
): ExcalidrawElementSkeleton[] {
  return skeleton.map((el) => ({
    ...el,
    x: (typeof el.x === "number" ? el.x : 0) + dx,
    y: (typeof el.y === "number" ? el.y : 0) + dy,
  }));
}

/**
 * Expand a compact pipeline primary cluster: builds the full satellite skeleton,
 * translates it to the existing cluster-frame position, and merges new satellite
 * elements into the scene while resizing the cluster frame in-place.
 */
export async function expandPipelineCluster(
  allElements: readonly ExcalidrawElement[],
  primaryCardElement: ExcalidrawElement,
  reconcileOverrides?: TerraformVisibilityReconcileOverrides,
): Promise<ExcalidrawElement[]> {
  const primaryAddr = primaryCardElement.customData?.terraformVisibilityKey as
    | string
    | undefined;
  const rawPlacement = primaryCardElement.customData
    ?.terraformPipelinePlacement as
    | TopologyPrimaryClusterPlacement
    | null
    | undefined;

  if (!primaryAddr || !rawPlacement) {
    return allElements as ExcalidrawElement[];
  }

  const cache = getTerraformImportPrepCache();
  if (!cache) {
    return allElements as ExcalidrawElement[];
  }

  const existingFrame = allElements.find(
    (el) =>
      !el.isDeleted &&
      isFrameLikeElement(el) &&
      el.customData?.terraformPrimaryAddress === primaryAddr,
  );
  if (!existingFrame) {
    return allElements as ExcalidrawElement[];
  }

  const placement: TopologyPrimaryClusterPlacement = {
    accountId: rawPlacement.accountId,
    region: rawPlacement.region,
    vpcId: rawPlacement.vpcId ?? null,
    subnetTier: rawPlacement.subnetTier ?? undefined,
    subnetSignature: rawPlacement.subnetSignature ?? undefined,
  };

  const fullBuild = buildTopologyPrimaryClusterSkeletonForPipeline(
    primaryAddr,
    cache.nodes,
    cache.mergedPlan,
    placement,
  );
  if (!fullBuild.skeleton.length) {
    return allElements as ExcalidrawElement[];
  }

  const frameX = typeof existingFrame.x === "number" ? existingFrame.x : 0;
  const frameY = typeof existingFrame.y === "number" ? existingFrame.y : 0;
  const translated = translateSkeleton(fullBuild.skeleton, frameX, frameY);

  let newEls = convertToExcalidrawElements(translated, {
    regenerateIds: true,
  }) as ExcalidrawElement[];
  newEls = mirrorAndDetachTerraformResourceLabels(newEls);
  newEls = await injectTerraformAwsIconsIntoElements(newEls);

  const newClusterFrame = newEls.find(
    (el) =>
      isFrameLikeElement(el) &&
      el.customData?.terraformPrimaryAddress === primaryAddr,
  );
  const newPrimaryCard = newEls.find(
    (el) =>
      !isFrameLikeElement(el) &&
      el.customData?.terraformVisibilityKey === primaryAddr,
  );

  const existingFrameId = existingFrame.id;
  const generatedFrameId = newClusterFrame?.id ?? existingFrameId;

  const satellites = newEls.filter(
    (el) => el !== newClusterFrame && el !== newPrimaryCard,
  );

  const reparentedSatellites = satellites.map((el) => {
    const asAny = el as ExcalidrawElement & { frameId?: string | null };
    if (asAny.frameId === generatedFrameId) {
      return newElementWith(el, {
        frameId: existingFrameId,
      } as Partial<ExcalidrawElement>);
    }
    return el;
  });

  const updatedAll = (allElements as ExcalidrawElement[]).map((el) => {
    if (el.id === existingFrameId) {
      return newElementWith(el, {
        width: fullBuild.width,
        height: fullBuild.height,
      } as Partial<ExcalidrawElement>);
    }
    if (el.id === primaryCardElement.id) {
      return newElementWith(el, {
        customData: {
          ...(el.customData ?? {}),
          terraformPipelineExpanded: true,
        },
      });
    }
    return el;
  });

  const merged = [...updatedAll, ...reparentedSatellites];
  return repairTerraformEdgeBindings(
    reconcileTerraformVisibility(merged, reconcileOverrides),
  );
}

/** Collapse an expanded pipeline cluster back to compact (primary card only). */
export function collapsePipelineCluster(
  allElements: readonly ExcalidrawElement[],
  primaryCardElement: ExcalidrawElement,
  reconcileOverrides?: TerraformVisibilityReconcileOverrides,
): ExcalidrawElement[] {
  const primaryAddr = primaryCardElement.customData?.terraformVisibilityKey as
    | string
    | undefined;
  if (!primaryAddr) {
    return allElements as ExcalidrawElement[];
  }

  const existingFrame = allElements.find(
    (el) =>
      !el.isDeleted &&
      isFrameLikeElement(el) &&
      el.customData?.terraformPrimaryAddress === primaryAddr,
  );

  const updated = (allElements as ExcalidrawElement[]).map((el) => {
    if (existingFrame && el.id === existingFrame.id) {
      return newElementWith(el, {
        width: COMPACT_FRAME_W,
        height: COMPACT_FRAME_H,
      } as Partial<ExcalidrawElement>);
    }
    if (el.id === primaryCardElement.id) {
      return newElementWith(el, {
        customData: {
          ...(el.customData ?? {}),
          terraformPipelineExpanded: false,
        },
      });
    }
    const parentAddr = el.customData?.terraformExplodeParent as
      | string
      | undefined;
    if (parentAddr === primaryAddr && !isFrameLikeElement(el)) {
      return newElementWith(el, { isDeleted: true });
    }
    return el;
  });

  return repairTerraformEdgeBindings(
    reconcileTerraformVisibility(updated, reconcileOverrides),
  );
}
