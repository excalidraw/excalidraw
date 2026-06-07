import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Island } from "./Island";
import { ToolButton } from "./ToolButton";
import { TERRAFORM_ACTION_LEGEND } from "./terraformElkLayout";
import {
  getTerraformImportSession,
  updateTerraformImportSessionColorMode,
} from "./terraformImportSession";
import {
  TERRAFORM_COLOR_MODE_DEFAULT,
  TERRAFORM_HIERARCHY_LEGEND,
  TERRAFORM_RESOURCE_CATEGORY_LEGEND,
  applyTerraformColorModeToElements,
  type TerraformColorLegendEntry,
  type TerraformColorMode,
} from "./terraformPrimaryVisibility";

import "./TerraformColorLegend.scss";

import type { AppClassProperties } from "../types";

const hasTerraformResourceNodes = (
  elements: ReadonlyArray<{ customData?: Record<string, unknown> }>,
) =>
  elements.some((el) => el.customData?.terraformVisibilityRole === "resource");

const LegendSwatch = ({
  strokeColor,
  backgroundColor,
}: Pick<TerraformColorLegendEntry, "strokeColor" | "backgroundColor">) => (
  <span
    className="terraform-color-legend__swatch"
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
  <section className="terraform-color-legend__section">
    <h3 className="terraform-color-legend__heading">{title}</h3>
    <ul className="terraform-color-legend__list">
      {entries.map((entry) => (
        <li key={entry.id} className="terraform-color-legend__item">
          <LegendSwatch
            strokeColor={entry.strokeColor}
            backgroundColor={entry.backgroundColor}
          />
          <span className="terraform-color-legend__label">{entry.label}</span>
        </li>
      ))}
    </ul>
  </section>
);

export const TerraformColorLegend = ({
  app,
  elements,
}: {
  app: AppClassProperties;
  elements: readonly NonDeletedExcalidrawElement[];
}) => {
  const [colorMode, setColorMode] = useState<TerraformColorMode>(
    () =>
      getTerraformImportSession()?.colorMode ?? TERRAFORM_COLOR_MODE_DEFAULT,
  );

  const isTerraformScene = useMemo(
    () => hasTerraformResourceNodes(elements),
    [elements],
  );

  useEffect(() => {
    setColorMode(
      getTerraformImportSession()?.colorMode ?? TERRAFORM_COLOR_MODE_DEFAULT,
    );
  }, [elements, isTerraformScene]);

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

  if (!isTerraformScene) {
    return null;
  }

  const isCategoryMode = colorMode === "category";

  return (
    <div
      className="terraform-color-legend"
      data-testid="terraform-color-legend"
      aria-label="Terraform diagram color legend"
    >
      <Island padding={1} className="terraform-color-legend__island">
        <div
          className="terraform-color-legend__mode"
          role="group"
          aria-label="Color mode"
        >
          <ToolButton
            type="button"
            size="small"
            aria-label="Category and hierarchy colors"
            aria-pressed={isCategoryMode}
            data-testid="terraform-color-mode-category"
            selected={isCategoryMode}
            onClick={() => handleColorModeChange("category")}
          >
            Category
          </ToolButton>
          <ToolButton
            type="button"
            size="small"
            aria-label="Plan action colors"
            aria-pressed={!isCategoryMode}
            data-testid="terraform-color-mode-action"
            selected={!isCategoryMode}
            onClick={() => handleColorModeChange("action")}
          >
            Plan action
          </ToolButton>
        </div>
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
          <LegendSection title="Plan actions" entries={TERRAFORM_ACTION_LEGEND} />
        )}
      </Island>
    </div>
  );
};

TerraformColorLegend.displayName = "TerraformColorLegend";
