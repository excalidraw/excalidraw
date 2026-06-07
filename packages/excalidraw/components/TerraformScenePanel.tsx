import React, { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Popover } from "radix-ui";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { actionShortcuts } from "../actions";
import { useTunnels } from "../context/tunnels";
import { t } from "../i18n";

import { Island } from "./Island";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";
import {
  useExcalidrawContainer,
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "./App";
import {
  collapseDownIcon,
  fullscreenIcon,
  gridIcon,
  HelpIcon,
  palette,
  resetZoom,
  RetryIcon,
  stackPushIcon,
} from "./icons";
import { TERRAFORM_ACTION_LEGEND } from "./terraformElkLayout";
import {
  clearTerraformImportSession,
  getTerraformImportSession,
  hasTerraformImportSession,
  updateTerraformImportSessionColorMode,
} from "./terraformImportSession";
import {
  refreshTerraformLayout,
  resetTerraformLayout,
  runTerraformImportFromSources,
} from "./terraformSceneApply";
import {
  TERRAFORM_COLOR_MODE_DEFAULT,
  TERRAFORM_HIERARCHY_LEGEND,
  TERRAFORM_RESOURCE_CATEGORY_LEGEND,
  applyTerraformColorModeToElements,
  type TerraformColorLegendEntry,
  type TerraformColorMode,
} from "./terraformPrimaryVisibility";

import "./TerraformScenePanel.scss";

import type { ActionManager } from "../actions/manager";
import type { AppClassProperties } from "../types";

const hasTerraformResourceNodes = (
  elements: ReadonlyArray<{ customData?: Record<string, unknown> }>,
) =>
  elements.some((el) => el.customData?.terraformVisibilityRole === "resource");

export const isTerraformSceneElements = hasTerraformResourceNodes;

const isTerraformPipelineScene = (
  elements: ReadonlyArray<{ customData?: Record<string, unknown> }>,
) => elements.some((el) => el.customData?.terraformPipelineView === true);

const LegendSwatch = ({
  strokeColor,
  backgroundColor,
}: Pick<TerraformColorLegendEntry, "strokeColor" | "backgroundColor">) => (
  <span
    className="terraform-scene-panel__swatch"
    style={{
      borderColor: strokeColor,
      backgroundColor,
    }}
    aria-hidden="true"
  />
);

const LegendSection = ({
  title,
  entries,
}: {
  title: string;
  entries: readonly TerraformColorLegendEntry[];
}) => (
  <section className="terraform-scene-panel__legend-section">
    <h3 className="terraform-scene-panel__legend-heading">{title}</h3>
    <ul className="terraform-scene-panel__legend-grid">
      {entries.map((entry) => (
        <li key={entry.id} className="terraform-scene-panel__legend-item">
          <LegendSwatch
            strokeColor={entry.strokeColor}
            backgroundColor={entry.backgroundColor}
          />
          <span className="terraform-scene-panel__legend-label">
            {entry.label}
          </span>
        </li>
      ))}
    </ul>
  </section>
);

const ColorModeSegment = ({
  colorMode,
  onChange,
}: {
  colorMode: TerraformColorMode;
  onChange: (mode: TerraformColorMode) => void;
}) => (
  <div
    className="terraform-scene-panel__segment"
    role="radiogroup"
    aria-label="Color mode"
  >
    {(
      [
        { id: "category" as const, label: "Category" },
        { id: "action" as const, label: "Plan action" },
      ] as const
    ).map(({ id, label }) => {
      const checked = colorMode === id;
      return (
        <label
          key={id}
          className={clsx("terraform-scene-panel__segment-btn", {
            "terraform-scene-panel__segment-btn--active": checked,
          })}
        >
          <input
            type="radio"
            name="terraform-color-mode"
            value={id}
            checked={checked}
            data-testid={`terraform-color-mode-${id}`}
            onChange={() => onChange(id)}
          />
          {label}
        </label>
      );
    })}
  </div>
);

const TerraformColorLegendPopover = ({
  colorMode,
  onColorModeChange,
}: {
  colorMode: TerraformColorMode;
  onColorModeChange: (mode: TerraformColorMode) => void;
}) => {
  const isCategoryMode = colorMode === "category";

  return (
    <div
      className="terraform-scene-panel__legend-popover"
      data-testid="terraform-color-legend"
      aria-label="Terraform diagram color legend"
    >
      <div className="terraform-scene-panel__legend-header">
        <h2 className="terraform-scene-panel__legend-title">Color key</h2>
        <ColorModeSegment colorMode={colorMode} onChange={onColorModeChange} />
      </div>
      <div className="terraform-scene-panel__legend-body">
        {isCategoryMode ? (
          <>
            <LegendSection
              title="Resources"
              entries={TERRAFORM_RESOURCE_CATEGORY_LEGEND}
            />
            <LegendSection
              title="Hierarchy"
              entries={TERRAFORM_HIERARCHY_LEGEND}
            />
          </>
        ) : (
          <LegendSection
            title="Plan actions"
            entries={TERRAFORM_ACTION_LEGEND}
          />
        )}
      </div>
    </div>
  );
};

export const TerraformScenePanel = ({
  app,
  actionManager,
  elements,
  renderWelcomeScreen = false,
}: {
  app: AppClassProperties;
  actionManager: ActionManager;
  elements: readonly NonDeletedExcalidrawElement[];
  renderWelcomeScreen?: boolean;
}) => {
  const setAppState = useExcalidrawSetAppState();
  const { container } = useExcalidrawContainer();
  const { WelcomeScreenHelpHintTunnel } = useTunnels();
  useExcalidrawElements();

  const [refreshing, setRefreshing] = useState(false);
  const [hasSession, setHasSession] = useState(hasTerraformImportSession);
  const [pipelineCompact, setPipelineCompact] = useState(
    () => getTerraformImportSession()?.pipelineCompact !== false,
  );
  const [togglingCompact, setTogglingCompact] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [colorMode, setColorMode] = useState<TerraformColorMode>(
    () =>
      getTerraformImportSession()?.colorMode ?? TERRAFORM_COLOR_MODE_DEFAULT,
  );

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

  useEffect(() => {
    setColorMode(
      getTerraformImportSession()?.colorMode ?? TERRAFORM_COLOR_MODE_DEFAULT,
    );
  }, [elements, isTerraformScene]);

  const syncSessionFlag = useCallback(() => {
    setHasSession(hasTerraformImportSession());
    setPipelineCompact(getTerraformImportSession()?.pipelineCompact !== false);
  }, []);

  const handleColorModeChange = useCallback(
    (nextMode: TerraformColorMode) => {
      if (nextMode === colorMode) {
        return;
      }
      setColorMode(nextMode);
      updateTerraformImportSessionColorMode(nextMode);
      const current = app.scene.getElementsIncludingDeleted();
      app.scene.replaceAllElements(
        applyTerraformColorModeToElements(current, nextMode),
      );
    },
    [app, colorMode],
  );

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
    <div className="terraform-scene-panel" data-testid="terraform-scene-panel">
      <Island padding={1} className="terraform-scene-panel__island">
        <div className="terraform-scene-panel__strip">
          <Tooltip label="Undo last canvas change">
            <div className="terraform-scene-panel__action">
              {actionManager.renderAction("undo")}
            </div>
          </Tooltip>
          <Tooltip
            label={
              sessionDisabled
                ? "Import Terraform to enable reset"
                : "Restore layout from last import"
            }
          >
            <ToolButton
              className="terraform-scene-panel__action"
              type="button"
              size="small"
              icon={resetZoom}
              aria-label="Reset Terraform layout"
              title="Reset Terraform layout"
              data-testid="terraform-debug-reset"
              disabled={sessionDisabled}
              onClick={handleReset}
            />
          </Tooltip>
          <Tooltip
            label={
              sessionDisabled
                ? "Import Terraform to enable refresh"
                : "Re-run parse and layout from last import sources"
            }
          >
            <ToolButton
              className="terraform-scene-panel__action"
              type="button"
              size="small"
              icon={RetryIcon}
              aria-label="Refresh Terraform layout"
              title="Refresh Terraform layout"
              data-testid="terraform-debug-refresh"
              disabled={sessionDisabled || refreshing}
              isLoading={refreshing}
              onClick={() => void handleRefresh()}
            />
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
                  className="terraform-scene-panel__action"
                  type="button"
                  size="small"
                  icon={pipelineCompact ? fullscreenIcon : gridIcon}
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
                />
              </Tooltip>
              <Tooltip label="Expand all pipeline clusters">
                <ToolButton
                  className="terraform-scene-panel__action"
                  type="button"
                  size="small"
                  icon={stackPushIcon}
                  aria-label="Expand all pipeline clusters"
                  title="Expand all pipeline clusters"
                  data-testid="terraform-debug-expand-all"
                  onClick={() => void handleExpandAll()}
                />
              </Tooltip>
              <Tooltip label="Collapse all pipeline clusters">
                <ToolButton
                  className="terraform-scene-panel__action"
                  type="button"
                  size="small"
                  icon={collapseDownIcon}
                  aria-label="Collapse all pipeline clusters"
                  title="Collapse all pipeline clusters"
                  data-testid="terraform-debug-collapse-all"
                  onClick={() => void handleCollapseAll()}
                />
              </Tooltip>
            </>
          )}

          <span className="terraform-scene-panel__divider" aria-hidden="true" />

          <Popover.Root open={legendOpen} onOpenChange={setLegendOpen}>
            <Tooltip label="Diagram color key">
              <Popover.Trigger asChild>
                <ToolButton
                  className="terraform-scene-panel__action"
                  type="button"
                  size="small"
                  icon={palette}
                  selected={legendOpen}
                  aria-label="Diagram color key"
                  aria-pressed={legendOpen}
                  title="Diagram color key"
                  data-testid="terraform-scene-panel-legend-trigger"
                />
              </Popover.Trigger>
            </Tooltip>
            <Popover.Portal container={container ?? undefined}>
              <Popover.Content
                className="terraform-scene-panel__popover-content focus-visible-none"
                side="top"
                align="end"
                sideOffset={8}
                collisionBoundary={container ?? undefined}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Island
                  padding={2}
                  className="terraform-scene-panel__popover-island"
                >
                  <TerraformColorLegendPopover
                    colorMode={colorMode}
                    onColorModeChange={handleColorModeChange}
                  />
                </Island>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <div className="terraform-scene-panel__help">
            {renderWelcomeScreen && <WelcomeScreenHelpHintTunnel.Out />}
            <Tooltip label={`${t("helpDialog.title")} — ?`}>
              <ToolButton
                className="terraform-scene-panel__action"
                type="button"
                size="small"
                icon={HelpIcon}
                aria-label={t("helpDialog.title")}
                title={`${t("helpDialog.title")} — ?`}
                data-testid="terraform-scene-panel-help"
                onClick={() => actionManager.executeAction(actionShortcuts)}
              />
            </Tooltip>
          </div>
        </div>
      </Island>
    </div>
  );
};

TerraformScenePanel.displayName = "TerraformScenePanel";
