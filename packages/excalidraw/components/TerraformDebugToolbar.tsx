import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Island } from "./Island";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";
import { useExcalidrawElements, useExcalidrawSetAppState } from "./App";
import {
  clearTerraformImportSession,
  getTerraformImportSession,
  hasTerraformImportSession,
} from "./terraformImportSession";
import {
  refreshTerraformLayout,
  resetTerraformLayout,
  runTerraformImportFromSources,
} from "./terraformSceneApply";

import "./TerraformDebugToolbar.scss";

import type { ActionManager } from "../actions/manager";
import type { AppClassProperties } from "../types";

const hasTerraformResourceNodes = (
  elements: ReadonlyArray<{ customData?: Record<string, unknown> }>,
) =>
  elements.some((el) => el.customData?.terraformVisibilityRole === "resource");

const isTerraformPipelineScene = (
  elements: ReadonlyArray<{ customData?: Record<string, unknown> }>,
) => elements.some((el) => el.customData?.terraformPipelineView === true);

export const TerraformDebugToolbar = ({
  app,
  actionManager,
  elements,
}: {
  app: AppClassProperties;
  actionManager: ActionManager;
  elements: readonly NonDeletedExcalidrawElement[];
}) => {
  const setAppState = useExcalidrawSetAppState();
  useExcalidrawElements();
  const [refreshing, setRefreshing] = useState(false);
  const [hasSession, setHasSession] = useState(hasTerraformImportSession);
  const [pipelineCompact, setPipelineCompact] = useState(
    () => getTerraformImportSession()?.pipelineCompact !== false,
  );
  const [togglingCompact, setTogglingCompact] = useState(false);

  const isTerraformScene = hasTerraformResourceNodes(elements);
  const isPipelineScene = useMemo(
    () => isTerraformPipelineScene(elements),
    [elements],
  );

  useEffect(() => {
    if (!isTerraformScene) {
      clearTerraformImportSession();
      setHasSession(false);
      return;
    }
    setHasSession(hasTerraformImportSession());
  }, [isTerraformScene, elements]);

  const syncSessionFlag = useCallback(() => {
    setHasSession(hasTerraformImportSession());
    setPipelineCompact(getTerraformImportSession()?.pipelineCompact !== false);
  }, []);

  const handleReset = useCallback(() => {
    if (!resetTerraformLayout(app, setAppState)) {
      return;
    }
    syncSessionFlag();
  }, [app, setAppState, syncSessionFlag]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTerraformLayout(app, setAppState);
      syncSessionFlag();
    } catch (err) {
      setAppState({
        toast: {
          message:
            err instanceof Error
              ? err.message
              : "Terraform layout refresh failed",
          duration: 4000,
          closable: true,
        },
      });
    } finally {
      setRefreshing(false);
    }
  }, [app, setAppState, syncSessionFlag]);

  const handleToggleCompact = useCallback(async () => {
    const session = getTerraformImportSession();
    if (!session) {
      return;
    }
    setTogglingCompact(true);
    try {
      await runTerraformImportFromSources(app, setAppState, session.sources, {
        semanticLayout: session.semanticLayout,
        layoutMode: session.layoutMode,
        moduleLayoutOptions: session.moduleLayoutOptions,
        pipelineCompact: !pipelineCompact,
        importedTfdTexts: session.importedTfdTexts,
        preset: session.preset,
      });
      syncSessionFlag();
    } catch (err) {
      setAppState({
        toast: {
          message: err instanceof Error ? err.message : "Layout toggle failed",
          duration: 4000,
          closable: true,
        },
      });
    } finally {
      setTogglingCompact(false);
    }
  }, [app, setAppState, syncSessionFlag, pipelineCompact]);

  const handleExpandAll = useCallback(async () => {
    const allEls = app.scene.getElementsIncludingDeleted();
    const { buildTerraformReconcileOptionsForAppState } = await import(
      "./terraformVisibility"
    );
    const { expandPipelineCluster } = await import("./terraformPipelineLayout");
    const reconcileOpts = buildTerraformReconcileOptionsForAppState(
      app.state.terraformEdgeLayerPins,
      app.state.terraformEdgeHoverPeekKey,
    );
    const expandables = allEls.filter(
      (el) =>
        el.customData?.terraformPipelineExpandable === true &&
        el.customData?.terraformPipelineExpanded !== true &&
        !el.isDeleted,
    );
    let current =
      allEls as import("@excalidraw/element/types").ExcalidrawElement[];
    for (const card of expandables) {
      current = await expandPipelineCluster(current, card, reconcileOpts);
    }
    app.scene.replaceAllElements(current);
  }, [app]);

  const handleCollapseAll = useCallback(async () => {
    const allEls = app.scene.getElementsIncludingDeleted();
    const { buildTerraformReconcileOptionsForAppState } = await import(
      "./terraformVisibility"
    );
    const { collapsePipelineCluster } = await import(
      "./terraformPipelineLayout"
    );
    const reconcileOpts = buildTerraformReconcileOptionsForAppState(
      app.state.terraformEdgeLayerPins,
      app.state.terraformEdgeHoverPeekKey,
    );
    const expanded = allEls.filter(
      (el) =>
        el.customData?.terraformPipelineExpandable === true &&
        el.customData?.terraformPipelineExpanded === true &&
        !el.isDeleted,
    );
    let current =
      allEls as import("@excalidraw/element/types").ExcalidrawElement[];
    for (const card of expanded) {
      current = collapsePipelineCluster(current, card, reconcileOpts);
    }
    app.scene.replaceAllElements(current);
  }, [app]);

  if (!isTerraformScene) {
    return null;
  }

  const sessionDisabled = !hasSession;

  return (
    <div
      className="terraform-debug-toolbar"
      data-testid="terraform-debug-toolbar"
    >
      <Island padding={1} className="terraform-debug-toolbar__island">
        <Stack.Col gap={1}>
          <Tooltip label="Undo last canvas change">
            <div>{actionManager.renderAction("undo")}</div>
          </Tooltip>
          <Tooltip
            label={
              sessionDisabled
                ? "Import Terraform to enable reset"
                : "Restore layout from last import"
            }
          >
            <ToolButton
              type="button"
              size="small"
              aria-label="Reset Terraform layout"
              title="Reset Terraform layout"
              data-testid="terraform-debug-reset"
              disabled={sessionDisabled}
              onClick={handleReset}
            >
              Reset
            </ToolButton>
          </Tooltip>
          <Tooltip
            label={
              sessionDisabled
                ? "Import Terraform to enable refresh"
                : "Re-run parse and layout from last import sources"
            }
          >
            <ToolButton
              type="button"
              size="small"
              aria-label="Refresh Terraform layout"
              title="Refresh Terraform layout"
              data-testid="terraform-debug-refresh"
              disabled={sessionDisabled || refreshing}
              isLoading={refreshing}
              onClick={() => void handleRefresh()}
            >
              Refresh
            </ToolButton>
          </Tooltip>
          {isPipelineScene && (
            <>
              <Tooltip
                label={
                  sessionDisabled
                    ? "Import Terraform to toggle pipeline mode"
                    : pipelineCompact
                    ? "Switch to full pipeline view (show all satellites)"
                    : "Switch to compact pipeline view (satellites on click)"
                }
              >
                <ToolButton
                  type="button"
                  size="small"
                  aria-label={
                    pipelineCompact
                      ? "Pipeline: Full view"
                      : "Pipeline: Compact view"
                  }
                  title={
                    pipelineCompact
                      ? "Pipeline: Full view"
                      : "Pipeline: Compact view"
                  }
                  data-testid="terraform-debug-toggle-compact"
                  disabled={sessionDisabled || togglingCompact}
                  isLoading={togglingCompact}
                  onClick={() => void handleToggleCompact()}
                >
                  {pipelineCompact ? "Full" : "Compact"}
                </ToolButton>
              </Tooltip>
              <Tooltip label="Expand all pipeline clusters">
                <ToolButton
                  type="button"
                  size="small"
                  aria-label="Expand all pipeline clusters"
                  title="Expand all pipeline clusters"
                  data-testid="terraform-debug-expand-all"
                  onClick={() => void handleExpandAll()}
                >
                  Expand all
                </ToolButton>
              </Tooltip>
              <Tooltip label="Collapse all pipeline clusters">
                <ToolButton
                  type="button"
                  size="small"
                  aria-label="Collapse all pipeline clusters"
                  title="Collapse all pipeline clusters"
                  data-testid="terraform-debug-collapse-all"
                  onClick={() => void handleCollapseAll()}
                >
                  Collapse all
                </ToolButton>
              </Tooltip>
            </>
          )}
        </Stack.Col>
      </Island>
    </div>
  );
};

TerraformDebugToolbar.displayName = "TerraformDebugToolbar";
