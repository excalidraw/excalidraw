import type { VizItemSlot } from "@luzmo/dashboard-contents-types";

/** Slot names that represent measures (numeric values being aggregated) */
const MEASURE_SLOT_NAMES = ["measure", "value", "size", "target"] as const;

/** Slot names that represent primary dimensions (the "BY" part) */
const DIMENSION_SLOT_NAMES = [
  "category",
  "x-axis",
  "y-axis",
  "row",
  "column",
  "levels",
  "geo",
  "hierarchy",
  "dimension",
  "time",
  "source",
  "destination",
  "evolution",
  "identifier",
  "open",
  "high",
  "low",
  "close",
  "order",
  "route",
  "coordinates",
] as const;

/** Slot names that represent group-by/breakdown (the "AND" part) */
const GROUP_BY_SLOT_NAMES = ["legend", "color"] as const;

/** Human-readable slot name fallback when content has no label */
const SLOT_DISPLAY_NAMES: Record<string, string> = {
  "x-axis": "X-Axis",
  "y-axis": "Y-Axis",
  category: "Category",
  measure: "Measure",
  legend: "Legend",
  color: "Color",
  row: "Row",
  column: "Column",
  levels: "Levels",
  geo: "Geography",
  dimension: "Dimension",
  time: "Time",
  source: "Source",
  destination: "Destination",
  target: "Target",
  value: "Value",
  size: "Size",
  hierarchy: "Hierarchy",
  evolution: "Evolution",
};

function getSlotLabels(slot: VizItemSlot): string[] {
  if (!Array.isArray(slot.content) || slot.content.length === 0) {
    return [];
  }
  return slot.content.map((item) => {
    const label = (item as { label?: Record<string, string> })?.label?.en;
    return label?.trim() || SLOT_DISPLAY_NAMES[slot.name] || slot.name;
  });
}

/**
 * Build default chart title from slots: "MEASURE(s) BY DIMENSION(s) (AND GROUP_BY(s))".
 * Returns empty string if no slots with content.
 */
export function buildDefaultTitleFromSlots(
  slots: VizItemSlot[] | null | undefined,
): string {
  if (!slots || slots.length === 0) {
    return "";
  }

  const measureNames = new Set(MEASURE_SLOT_NAMES as readonly string[]);
  const dimensionNames = new Set(DIMENSION_SLOT_NAMES as readonly string[]);
  const groupByNames = new Set(GROUP_BY_SLOT_NAMES as readonly string[]);

  const measureLabels: string[] = [];
  const dimensionLabels: string[] = [];
  const groupByLabels: string[] = [];

  for (const slot of slots) {
    const labels = getSlotLabels(slot);
    if (labels.length === 0) {
      continue;
    }

    if (measureNames.has(slot.name)) {
      measureLabels.push(...labels);
    } else if (dimensionNames.has(slot.name)) {
      dimensionLabels.push(...labels);
    } else if (groupByNames.has(slot.name)) {
      groupByLabels.push(...labels);
    } else {
      // Unknown slot type - treat as dimension
      dimensionLabels.push(...labels);
    }
  }

  if (
    measureLabels.length === 0 &&
    dimensionLabels.length === 0 &&
    groupByLabels.length === 0
  ) {
    return "";
  }

  const measurePart = measureLabels.join(", ");
  const dimensionPart = dimensionLabels.join(", ");
  const groupByPart =
    groupByLabels.length > 0 ? `(and ${groupByLabels.join(", ")})` : "";

  if (measurePart && dimensionPart) {
    return [measurePart, "by", dimensionPart, groupByPart]
      .filter(Boolean)
      .join(" ");
  }
  if (measurePart && groupByPart) {
    return [measurePart, groupByPart].join(" ");
  }
  if (dimensionPart && groupByPart) {
    return [dimensionPart, groupByPart].join(" ");
  }
  return measurePart || dimensionPart || groupByPart;
}
