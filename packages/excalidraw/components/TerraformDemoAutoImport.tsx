import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import { useApp, useExcalidrawSetAppState } from "./App";
import {
  isDemoPathname,
  parseTerraformDemoUrlParams,
} from "./terraformDemoUrlParams";
import { getTerraformImportPreset } from "./terraformImportPresets";
import {
  resolveModuleLayoutOptionsForDemo,
  runTerraformPresetImport,
} from "./terraformPresetImport";

import "./TerraformDemoAutoImport.scss";

import type { TerraformView } from "./terraformImportDialogUtils";

type TerraformDemoAutoImportProps = {
  onImportSuccess?: () => void;
  onImportFail?: () => void;
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
          pipelineLayoutVariant: params.pipelineVariant,
          pipelinePacked: params.packed,
          pipelinePackedPullLeft: params.packedPullLeft,
          signal,
          onLayoutProgress: (progress) => {
            const label =
              progress.total > 0
                ? `${progress.phase} (${progress.done}/${progress.total})`
                : progress.phase;
            setMessage(label);
          },
        });

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
