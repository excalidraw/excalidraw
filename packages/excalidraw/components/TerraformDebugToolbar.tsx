import React, { useCallback, useEffect, useState } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Island } from "./Island";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";
import { useExcalidrawElements, useExcalidrawSetAppState } from "./App";
import {
  clearTerraformImportSession,
  hasTerraformImportSession,
} from "./terraformImportSession";
import {
  refreshTerraformLayout,
  resetTerraformLayout,
} from "./terraformSceneApply";

import "./TerraformDebugToolbar.scss";

import type { ActionManager } from "../actions/manager";
import type { AppClassProperties } from "../types";

const hasTerraformResourceNodes = (
  elements: ReadonlyArray<{ customData?: Record<string, unknown> }>,
) =>
  elements.some((el) => el.customData?.terraformVisibilityRole === "resource");

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

  const isTerraformScene = hasTerraformResourceNodes(elements);

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
        </Stack.Col>
      </Island>
    </div>
  );
};

TerraformDebugToolbar.displayName = "TerraformDebugToolbar";
