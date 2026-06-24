import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import { useApp, useExcalidrawSetAppState } from "./App";
import {
  isDemoPathname,
  parseTerraformDemoUrlParams,
  type TerraformDemoUrlParams,
} from "./terraformDemoUrlParams";
import { getTerraformImportPreset } from "./terraformImportPresets";
import {
  resolveModuleLayoutOptionsForDemo,
  runTerraformPresetImport,
} from "./terraformPresetImport";
import { patchTerraformRuntimePerformanceSettings } from "./terraformRuntimePerformance";
import {
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";
import {
  updateTerraformImportSessionLodEnabled,
  updateTerraformImportSessionLodPreset,
  updateTerraformImportSessionMinimapEnabled,
} from "./terraformImportSession";

import "./TerraformDemoAutoImport.scss";

import type { AppClassProperties, AppState } from "../types";
import type { TerraformView } from "./terraformImportDialogUtils";

type TerraformDemoAutoImportProps = {
  onImportSuccess?: () => void;
  onImportFail?: () => void;
};

/**
 * Apply the runtime view settings carried by a canvas-share URL once the scene is imported:
 * LOD/minimap/pins land in AppState (and the import session, so re-sharing stays faithful),
 * edge-layer pins additionally drive a visibility reconcile, and the dev canvas-performance
 * experiments patch their (localStorage-backed, dev-only) store.
 */
const applyCanvasViewSettings = (
  app: AppClassProperties,
  setAppState: ReturnType<typeof useExcalidrawSetAppState>,
  params: TerraformDemoUrlParams,
): void => {
  // Only the keys the URL carried — cast past the setter's non-partial `Pick` signature
  // (React merges the provided keys, leaving the rest untouched).
  const appStatePatch = {
    ...(params.lodEnabled !== undefined
      ? { terraformLodEnabled: params.lodEnabled }
      : {}),
    ...(params.lodPreset !== undefined
      ? { terraformLodPreset: params.lodPreset }
      : {}),
    ...(params.minimap !== undefined
      ? { terraformMinimapEnabled: params.minimap }
      : {}),
    ...(params.edgeLayerPins
      ? { terraformEdgeLayerPins: params.edgeLayerPins }
      : {}),
  };
  if (Object.keys(appStatePatch).length > 0) {
    setAppState(appStatePatch as Pick<AppState, keyof typeof appStatePatch>);
  }

  if (params.lodEnabled !== undefined) {
    updateTerraformImportSessionLodEnabled(params.lodEnabled);
  }
  if (params.lodPreset !== undefined) {
    updateTerraformImportSessionLodPreset(params.lodPreset);
  }
  if (params.minimap !== undefined) {
    updateTerraformImportSessionMinimapEnabled(params.minimap);
  }

  // Edge-layer pins only take visual effect once visibility is reconciled against the
  // freshly-imported elements (same path the "Terraform layers" menu uses).
  if (params.edgeLayerPins) {
    const allElements = app.scene.getElementsIncludingDeleted();
    app.scene.replaceAllElements(
      reconcileTerraformVisibility(repairTerraformEdgeBindings(allElements), {
        pins: params.edgeLayerPins,
        hoverPeekKey: null,
      }),
    );
  }

  if (params.runtimePerformance) {
    patchTerraformRuntimePerformanceSettings(params.runtimePerformance);
  }
};

type DemoImportStatus = "idle" | "loading" | "error";

export const TerraformDemoAutoImport = ({
  onImportSuccess,
  onImportFail,
}: TerraformDemoAutoImportProps) => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const layoutAbortRef = useRef<AbortController | null>(null);
  const startedForSearchRef = useRef<string | null>(null);
  const [status, setStatus] = useState<DemoImportStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      layoutAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !isDemoPathname(window.location.pathname)
    ) {
      return;
    }

    const search = window.location.search;
    const params = parseTerraformDemoUrlParams(search);
    if (!params) {
      setStatus("idle");
      setMessage(null);
      return;
    }

    if (startedForSearchRef.current === search) {
      return;
    }
    startedForSearchRef.current = search;

    layoutAbortRef.current?.abort();
    layoutAbortRef.current = new AbortController();
    const { signal } = layoutAbortRef.current;

    const run = async () => {
      setStatus("loading");
      setMessage(`Loading preset "${params.presetId}"…`);

      try {
        const preset = await getTerraformImportPreset(params.presetId);
        if (!preset) {
          throw new Error(`Preset "${params.presetId}" was not found.`);
        }

        const view: TerraformView = params.view ?? preset.view;
        const moduleLayoutOptions = resolveModuleLayoutOptionsForDemo(
          params.pack,
        );

        await runTerraformPresetImport(app, setAppState, preset, {
          view,
          moduleLayoutOptions,
          pipelineCompact: params.compact,
          pipelineLayoutVariant: params.pipelineVariant,
          pipelinePacked: params.packed,
          pipelinePackedPullLeft: params.packedPullLeft,
          pipelineIncludeAncillary: params.ancillary,
          pipelineSemanticPlacement: params.semanticPlace,
          pipelineSwimlaneLaneRise: params.swimlaneRise,
          pipelineReorder: params.reorder,
          pipelineCrossingMin: params.crossingMin,
          pipelineDeBandLevel: params.deBandLevel,
          pipelineSubnetDeBand: params.subnetDeBand,
          pipelineRankSeparate: params.rankSeparate,
          pipelineStraighten: params.straighten,
          pipelineDeDensify: params.deDensify,
          pipelineColumnPacking: params.columnPacking,
          pipelineLayoutProfile: params.profile,
          pipelineStaircaseBandOverlap: params.staircaseBandOverlap,
          signal,
          onLayoutProgress: (progress) => {
            const label =
              progress.total > 0
                ? `${progress.phase} (${progress.done}/${progress.total})`
                : progress.phase;
            setMessage(label);
          },
        });

        // Reapply the runtime view settings the share URL carried (LOD, minimap, edge
        // layers, dev canvas-performance) on top of the freshly-imported scene.
        applyCanvasViewSettings(app, setAppState, params);

        setStatus("idle");
        setMessage(null);
        onImportSuccess?.();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Demo auto-import error:", err);
        onImportFail?.();
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "Demo preset import failed.",
        );
      } finally {
        if (layoutAbortRef.current?.signal === signal) {
          layoutAbortRef.current = null;
        }
      }
    };

    void run();
  }, [app, onImportFail, onImportSuccess, setAppState]);

  if (status === "idle" || !message) {
    return null;
  }

  return (
    <div
      className={clsx(
        "TerraformDemoAutoImport",
        status === "error" && "TerraformDemoAutoImport--error",
      )}
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message}
    </div>
  );
};
