import React, { useMemo } from "react";

import { Island } from "./Island";
import {
  TERRAFORM_HIERARCHY_LEGEND,
  TERRAFORM_RESOURCE_CATEGORY_LEGEND,
  type TerraformColorLegendEntry,
} from "./terraformPrimaryVisibility";

import "./TerraformColorLegend.scss";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

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
  elements,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
}) => {
  const isTerraformScene = useMemo(
    () => hasTerraformResourceNodes(elements),
    [elements],
  );

  if (!isTerraformScene) {
    return null;
  }

  return (
    <div
      className="terraform-color-legend"
      data-testid="terraform-color-legend"
      aria-label="Terraform diagram color legend"
    >
      <Island padding={1} className="terraform-color-legend__island">
        <LegendSection
          title="Resources"
          entries={TERRAFORM_RESOURCE_CATEGORY_LEGEND}
        />
        <LegendSection
          title="Hierarchy"
          entries={TERRAFORM_HIERARCHY_LEGEND}
        />
      </Island>
    </div>
  );
};

TerraformColorLegend.displayName = "TerraformColorLegend";
