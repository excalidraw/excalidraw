import type { ChartType } from "@excalidraw/element/types";

import type { RenderEnvironment } from "@excalidraw/element";

import { renderBarChart } from "./charts.bar";
import { renderLineChart } from "./charts.line";
import {
  tryParseCells,
  tryParseNumber,
  tryParseSpreadsheet,
} from "./charts.parse";
import { renderRadarChart } from "./charts.radar";

import type { ChartElements, Spreadsheet } from "./charts.types";

export {
  type ParseSpreadsheetResult,
  type Spreadsheet,
  type SpreadsheetSeries,
  type ChartElements,
} from "./charts.types";

export { isSpreadsheetValidForChartType } from "./charts.helpers";
export { tryParseCells, tryParseNumber, tryParseSpreadsheet };

export const renderSpreadsheet = (
  chartType: ChartType,
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  colorSeed?: number,
  renderEnvironment?: RenderEnvironment,
): ChartElements | null => {
  if (chartType === "line") {
    return renderLineChart(spreadsheet, x, y, colorSeed, renderEnvironment);
  }
  if (chartType === "radar") {
    return renderRadarChart(spreadsheet, x, y, colorSeed, renderEnvironment);
  }
  return renderBarChart(spreadsheet, x, y, colorSeed, renderEnvironment);
};
