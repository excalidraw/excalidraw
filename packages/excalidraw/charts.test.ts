import { FONT_FAMILY } from "@excalidraw/common";
import {
  DEFAULT_CHART_COLOR_INDEX,
  getAllColorsSpecificShade,
} from "@excalidraw/common";

import type {
  ExcalidrawLineElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import {
  isSpreadsheetValidForChartType,
  renderSpreadsheet,
  tryParseCells,
  tryParseNumber,
} from "./charts";

import type { Spreadsheet } from "./charts";

describe("charts", () => {
  const getRotatedBounds = (element: ExcalidrawTextElement) => {
    const cos = Math.abs(Math.cos(element.angle));
    const sin = Math.abs(Math.sin(element.angle));
    const rotatedWidth = element.width * cos + element.height * sin;
    const rotatedHeight = element.width * sin + element.height * cos;
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    return {
      left: centerX - rotatedWidth / 2,
      right: centerX + rotatedWidth / 2,
      top: centerY - rotatedHeight / 2,
      bottom: centerY + rotatedHeight / 2,
      centerX,
    };
  };

  describe("tryParseNumber", () => {
    it.each<[string, number]>([
      ["1", 1],
      ["0", 0],
      ["-1", -1],
      ["0.1", 0.1],
      [".1", 0.1],
      ["1.", 1],
      ["424.", 424],
      ["$1", 1],
      ["-.1", -0.1],
      ["-$1", -1],
      ["$-1", -1],
    ])("should correctly identify %s as numbers", (given, expected) => {
      expect(tryParseNumber(given)).toEqual(expected);
    });

    it.each<[string]>([["a"], ["$"], ["$a"], ["-$a"]])(
      "should correctly identify %s as not a number",
      (given) => {
        expect(tryParseNumber(given)).toBeNull();
      },
    );
  });

  describe("tryParseCells", () => {
    it("Successfully parses a spreadsheet", () => {
      const spreadsheet = [
        ["time", "value"],
        ["01:00", "61"],
        ["02:00", "-60"],
        ["03:00", "85"],
        ["04:00", "-67"],
        ["05:00", "54"],
        ["06:00", "95"],
      ];

      const result = tryParseCells(spreadsheet);

      expect(result.ok).toBe(true);

      const { title, labels, series } = (
        result as { ok: true; data: Spreadsheet }
      ).data;

      expect(title).toEqual("value");
      expect(labels).toEqual([
        "01:00",
        "02:00",
        "03:00",
        "04:00",
        "05:00",
        "06:00",
      ]);
      expect(series).toEqual([
        { title: "value", values: [61, -60, 85, -67, 54, 95] },
      ]);
    });

    it("Uses the second column as the label if it is not a number", () => {
      const spreadsheet = [
        ["time", "value"],
        ["01:00", "61"],
        ["02:00", "-60"],
        ["03:00", "85"],
        ["04:00", "-67"],
        ["05:00", "54"],
        ["06:00", "95"],
      ];

      const result = tryParseCells(spreadsheet);

      expect(result.ok).toBe(true);

      const { title, labels, series } = (
        result as { ok: true; data: Spreadsheet }
      ).data;

      expect(title).toEqual("value");
      expect(labels).toEqual([
        "01:00",
        "02:00",
        "03:00",
        "04:00",
        "05:00",
        "06:00",
      ]);
      expect(series).toEqual([
        { title: "value", values: [61, -60, 85, -67, 54, 95] },
      ]);
    });

    it("treats the first column as labels if both columns are numbers", () => {
      const spreadsheet = [
        ["time", "value"],
        ["01", "61"],
        ["02", "-60"],
        ["03", "85"],
        ["04", "-67"],
        ["05", "54"],
        ["06", "95"],
      ];

      const result = tryParseCells(spreadsheet);

      expect(result.ok).toBe(true);

      const { title, labels, series } = (
        result as { ok: true; data: Spreadsheet }
      ).data;

      expect(title).toEqual("value");
      expect(labels).toEqual(["01", "02", "03", "04", "05", "06"]);
      expect(series).toEqual([
        { title: "value", values: [61, -60, 85, -67, 54, 95] },
      ]);
    });

    it("parses multi-series cells for radar charts", () => {
      const spreadsheet = [
        ["Metric", "Player A", "Player B", "Player C"],
        ["Speed", "80", "60", "75"],
        ["Strength", "65", "85", "70"],
        ["Agility", "90", "70", "88"],
        ["Intelligence", "70", "88", "92"],
        ["Stamina", "85", "75", "80"],
      ];

      const result = tryParseCells(spreadsheet);

      expect(result.ok).toBe(true);

      const parsed = (result as { ok: true; data: Spreadsheet }).data;

      expect(parsed.title).toEqual("Metric");
      expect(parsed.labels).toEqual([
        "Speed",
        "Strength",
        "Agility",
        "Intelligence",
        "Stamina",
      ]);
      expect(parsed.series).toEqual([
        { title: "Player A", values: [80, 65, 90, 70, 85] },
        { title: "Player B", values: [60, 85, 70, 88, 75] },
        { title: "Player C", values: [75, 70, 88, 92, 80] },
      ]);
    });

    it("treats first row as title+series headers only when all cells are non-numeric", () => {
      const spreadsheet = [
        ["Trait", "10", "20"],
        ["Physical Strength", "4", "8"],
        ["Strategy", "6", "9"],
        ["Charisma", "7", "5"],
      ];

      const result = tryParseCells(spreadsheet);
      expect(result.ok).toBe(true);

      const parsed = (result as { ok: true; data: Spreadsheet }).data;

      expect(parsed.title).toBeNull();
      expect(parsed.labels?.[0]).toEqual("Trait");
      expect(parsed.series[0].title).toEqual("Series 1");
      expect(parsed.series[1].title).toEqual("Series 2");
    });

    it("supports header row with series labels but no chart title", () => {
      const spreadsheet = [
        ["", "Dunk", "Egg"],
        ["Physical Strength", "10", "2"],
        ["Swordsmanship", "8", "1"],
        ["Political Instinct", "3", "9"],
      ];

      const result = tryParseCells(spreadsheet);
      expect(result.ok).toBe(true);

      const parsed = (result as { ok: true; data: Spreadsheet }).data;

      expect(parsed.title).toBeNull();
      expect(parsed.labels).toEqual([
        "Physical Strength",
        "Swordsmanship",
        "Political Instinct",
      ]);
      expect(parsed.series).toEqual([
        { title: "Dunk", values: [10, 8, 3] },
        { title: "Egg", values: [2, 1, 9] },
      ]);
    });

    it("parses 2-row multi-series data with header row", () => {
      const spreadsheet = [
        ["trait", "Dunk", "Egg"],
        ["Physical Strength", "10", "2"],
        ["Swordsmanship skill", "8", "1"],
      ];

      const result = tryParseCells(spreadsheet);
      expect(result.ok).toBe(true);

      const parsed = (result as { ok: true; data: Spreadsheet }).data;

      expect(parsed.title).toEqual("trait");
      expect(parsed.labels).toEqual([
        "Physical Strength",
        "Swordsmanship skill",
      ]);
      expect(parsed.series).toEqual([
        { title: "Dunk", values: [10, 8] },
        { title: "Egg", values: [2, 1] },
      ]);
    });

    it("parses 2-row multi-series data without header and keeps first column as labels", () => {
      const spreadsheet = [
        ["Physical Strength", "10", "2"],
        ["Swordsmanship skill", "8", "1"],
      ];

      const result = tryParseCells(spreadsheet);
      expect(result.ok).toBe(true);

      const parsed = (result as { ok: true; data: Spreadsheet }).data;

      expect(parsed.title).toBeNull();
      expect(parsed.labels).toEqual([
        "Physical Strength",
        "Swordsmanship skill",
      ]);
      expect(parsed.series).toEqual([
        { title: "Series 1", values: [10, 8] },
        { title: "Series 2", values: [2, 1] },
      ]);
    });

    it("always interprets 2-column data as label in first column and numeric value in second", () => {
      const spreadsheet = [
        ["10", "2"],
        ["8", "Swordsmanship skill"],
        ["6", "3"],
      ];

      const result = tryParseCells(spreadsheet);
      expect(result).toEqual({
        ok: false,
        reason: "Value is not numeric",
      });
    });
  });

  describe("isSpreadsheetValidForChartType", () => {
    it("rejects radar charts with only 2 dimensions", () => {
      const spreadsheet: Spreadsheet = {
        title: "trait",
        labels: ["Physical Strength", "Swordsmanship skill"],
        series: [
          { title: "Dunk", values: [10, 8] },
          { title: "Egg", values: [2, 1] },
        ],
      };

      expect(isSpreadsheetValidForChartType(spreadsheet, "radar")).toBe(false);
      expect(isSpreadsheetValidForChartType(spreadsheet, "bar")).toBe(true);
      expect(isSpreadsheetValidForChartType(spreadsheet, "line")).toBe(true);
    });

    it("accepts radar charts with 3 or more dimensions", () => {
      const spreadsheet: Spreadsheet = {
        title: "trait",
        labels: [
          "Physical Strength",
          "Swordsmanship skill",
          "Political Instinct",
        ],
        series: [
          { title: "Dunk", values: [10, 8, 3] },
          { title: "Egg", values: [2, 1, 9] },
        ],
      };

      expect(isSpreadsheetValidForChartType(spreadsheet, "radar")).toBe(true);
    });
  });

  describe("renderSpreadsheet", () => {
    it("renders grouped bars and legend for multi-series bar charts", () => {
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: ["A", "B", "C", "D", "E"],
        series: [
          { title: "Dunk", values: [10, 8, 3, 2.5, 5] },
          { title: "Egg", values: [2, 1, 9, 8, 9] },
          { title: "Aerion", values: [7, 8, 7, 4, 5] },
        ],
      };

      const elements = renderSpreadsheet("bar", spreadsheet, 0, 0);
      const bars = elements!.filter(
        (element) =>
          element.type === "rectangle" &&
          element.strokeWidth === 1 &&
          element.opacity === 100 &&
          !element.roundness,
      );
      const textElements = elements!.filter(
        (element) => element.type === "text",
      );
      const axisLabels = textElements.filter((element) =>
        spreadsheet.labels?.includes(element.originalText || ""),
      );
      const legendLabels = textElements.filter((element) =>
        spreadsheet.series.some(
          (series) => series.title === element.originalText,
        ),
      );

      const axisBottomY = Math.max(
        ...axisLabels.map((axisLabel) => axisLabel.y + axisLabel.height),
      );
      const legendTopY = Math.min(
        ...legendLabels.map((legendLabel) => legendLabel.y),
      );

      expect(bars).toHaveLength(
        spreadsheet.series.length * spreadsheet.series[0].values.length,
      );
      expect(legendLabels).toHaveLength(spreadsheet.series.length);
      expect(legendTopY).toBeGreaterThan(axisBottomY + 2);
    });

    it("spreads grouped bar series colors across palette", () => {
      const palette = getAllColorsSpecificShade(DEFAULT_CHART_COLOR_INDEX);
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: ["A", "B", "C", "D", "E"],
        series: [
          { title: "S1", values: [1, 2, 3, 4, 5] },
          { title: "S2", values: [2, 3, 4, 5, 1] },
          { title: "S3", values: [3, 4, 5, 1, 2] },
          { title: "S4", values: [4, 5, 1, 2, 3] },
        ],
      };

      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
      const elements = renderSpreadsheet("bar", spreadsheet, 0, 0);
      randomSpy.mockRestore();

      const bars = elements!.filter(
        (element) =>
          element.type === "rectangle" &&
          element.strokeWidth === 1 &&
          element.opacity === 100 &&
          !element.roundness,
      );
      const uniqueColors = Array.from(
        new Set(bars.map((bar) => bar.backgroundColor)),
      );
      const colorIndices = uniqueColors.map((color) =>
        palette.findIndex((paletteColor) => paletteColor === color),
      );

      expect(uniqueColors).toHaveLength(spreadsheet.series.length);
      expect(colorIndices.every((index) => index >= 0)).toBe(true);

      const circularDistance = (first: number, second: number) => {
        const absoluteDistance = Math.abs(first - second);
        return Math.min(absoluteDistance, palette.length - absoluteDistance);
      };
      const minDistance = Math.min(
        ...colorIndices.flatMap((index, i) =>
          colorIndices
            .slice(i + 1)
            .map((other) => circularDistance(index, other)),
        ),
      );
      expect(minDistance).toBeGreaterThan(1);
    });

    it("renders grouped bars for parsed multi-series cells without header row", () => {
      const cells = [
        ["Physical Strength", "10", "2", "7"],
        ["Swordsmanship", "8", "1", "8"],
        ["Political Instinct", "3", "9", "7"],
        ["Book Knowledge", "2.5", "8", "4"],
      ];
      const parsedResult = tryParseCells(cells);
      expect(parsedResult.ok).toBe(true);
      const parsedSpreadsheet = (
        parsedResult as {
          ok: true;
          data: Spreadsheet;
        }
      ).data;

      const elements = renderSpreadsheet("bar", parsedSpreadsheet, 0, 0);
      const bars = elements!.filter(
        (element) =>
          element.type === "rectangle" &&
          element.strokeWidth === 1 &&
          element.opacity === 100 &&
          !element.roundness,
      );
      const textElements = elements!.filter(
        (element) => element.type === "text",
      );
      const legendLabels = textElements
        .map((element) => element.originalText)
        .filter((text): text is string => typeof text === "string");

      expect(bars).toHaveLength(
        parsedSpreadsheet.series[0].values.length *
          parsedSpreadsheet.series.length,
      );
      expect(legendLabels).toContain("Series 1");
      expect(legendLabels).toContain("Series 2");
      expect(legendLabels).toContain("Series 3");
    });

    it("makes multi-series bar charts wider than single-series bar charts", () => {
      const singleSeries: Spreadsheet = {
        title: "Trait",
        labels: ["A", "B", "C", "D"],
        series: [{ title: "Trait", values: [10, 8, 3, 2.5] }],
      };
      const multiSeries: Spreadsheet = {
        title: "Trait",
        labels: ["A", "B", "C", "D"],
        series: [
          { title: "Dunk", values: [10, 8, 3, 2.5] },
          { title: "Egg", values: [2, 1, 9, 8] },
          { title: "Aerion", values: [7, 8, 7, 4] },
        ],
      };

      const singleElements = renderSpreadsheet("bar", singleSeries, 0, 0);
      const multiElements = renderSpreadsheet("bar", multiSeries, 0, 0);
      const getXAxisWidth = (elements: ReturnType<typeof renderSpreadsheet>) =>
        elements!.find(
          (element): element is ExcalidrawLineElement =>
            element.type === "line" &&
            element.strokeStyle === "solid" &&
            element.points[0][1] === 0 &&
            element.points[1][1] === 0 &&
            element.points[1][0] > 0,
        )?.width || 0;

      expect(getXAxisWidth(multiElements)).toBeGreaterThan(
        getXAxisWidth(singleElements),
      );
    });

    it("makes multi-series line charts wider than single-series line charts", () => {
      const singleSeries: Spreadsheet = {
        title: "Trait",
        labels: ["A", "B", "C", "D"],
        series: [{ title: "Trait", values: [10, 8, 3, 2.5] }],
      };
      const multiSeries: Spreadsheet = {
        title: "Trait",
        labels: ["A", "B", "C", "D"],
        series: [
          { title: "Dunk", values: [10, 8, 3, 2.5] },
          { title: "Egg", values: [2, 1, 9, 8] },
          { title: "Aerion", values: [7, 8, 7, 4] },
        ],
      };

      const singleElements = renderSpreadsheet("line", singleSeries, 0, 0);
      const multiElements = renderSpreadsheet("line", multiSeries, 0, 0);
      const getXAxisWidth = (elements: ReturnType<typeof renderSpreadsheet>) =>
        elements!.find(
          (element): element is ExcalidrawLineElement =>
            element.type === "line" &&
            element.strokeStyle === "solid" &&
            element.points[0][1] === 0 &&
            element.points[1][1] === 0 &&
            element.points[1][0] > 0,
        )?.width || 0;

      expect(getXAxisWidth(multiElements)).toBeGreaterThan(
        getXAxisWidth(singleElements),
      );
    });

    it("wraps grouped bar labels with spaces and still ellipsifies long single words", () => {
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: [
          "Supercalifragilisticexpialidocious",
          "Data Flow",
          "Logic Layer",
        ],
        series: [
          { title: "Dunk", values: [8, 3, 2.5] },
          { title: "Egg", values: [1, 9, 8] },
          { title: "Aerion", values: [8, 7, 4] },
        ],
      };

      const elements = renderSpreadsheet("bar", spreadsheet, 0, 0);
      const longWordLabel = elements!.find(
        (element): element is ExcalidrawTextElement =>
          element.type === "text" &&
          Math.abs(element.angle) > 0 &&
          element.text.includes("..."),
      );
      const spacedLabels = elements!.filter(
        (element): element is ExcalidrawTextElement =>
          element.type === "text" &&
          (element.originalText === "Data Flow" ||
            element.originalText === "Logic Layer"),
      );

      expect(longWordLabel).toBeDefined();
      expect(longWordLabel?.text).toContain("...");
      expect(longWordLabel?.originalText).toBe(longWordLabel?.text);
      expect(
        (longWordLabel?.text || "").replace("...", "").length,
      ).toBeGreaterThan(0);
      expect(spacedLabels.some((label) => label.text.includes("\n"))).toBe(
        true,
      );
      expect(
        spacedLabels.every(
          (label) => !!label.originalText && !label.originalText.includes("\n"),
        ),
      ).toBe(true);
    });

    it("keeps single-series bar x-axis labels below axis and avoids neighbor overlap", () => {
      const spreadsheet: Spreadsheet = {
        title: "Dunk",
        labels: [
          "Physical Strength",
          "Swordsmanship",
          "Political Instinct",
          "Book Knowledge",
          "Strategic Thinking",
          "charisma",
          "courage",
          "Stubbornness",
          "Empathy",
          "Practical Survival Skills",
        ],
        series: [{ title: "Dunk", values: [10, 8, 3, 2.5, 5, 7, 9, 8, 8, 9] }],
      };

      const elements = renderSpreadsheet("bar", spreadsheet, 0, 0);
      const axisLabels = elements!.filter(
        (element): element is ExcalidrawTextElement =>
          element.type === "text" && Math.abs(element.angle) > 0,
      );

      expect(axisLabels).toHaveLength(spreadsheet.labels!.length);

      const bounds = axisLabels.map(getRotatedBounds);
      for (const bound of bounds) {
        expect(bound.top).toBeGreaterThan(0);
      }

      const sortedBounds = bounds.sort(
        (left, right) => left.centerX - right.centerX,
      );
      for (let index = 1; index < sortedBounds.length; index++) {
        expect(sortedBounds[index - 1].right).toBeLessThanOrEqual(
          sortedBounds[index].left + 2,
        );
      }
    });

    it("renders one line per series and one dot per data point for multi-series line charts", () => {
      const spreadsheet: Spreadsheet = {
        title: "Scores",
        labels: ["alpha", "beta", "gamma", "delta", "epsilon"],
        series: [
          { title: "Team A", values: [42150, 8300, 95400, 7820, 310500] },
          { title: "Team B", values: [63400, 3150, 51200, 4670, 125800] },
        ],
      };

      const elements = renderSpreadsheet("line", spreadsheet, 0, 0);
      const seriesLines = elements!.filter(
        (element): element is ExcalidrawLineElement =>
          element.type === "line" && element.strokeWidth === 2,
      );
      const dots = elements!.filter(
        (element) => element.type === "ellipse" && element.strokeWidth === 2,
      );

      expect(seriesLines).toHaveLength(spreadsheet.series.length);
      expect(dots).toHaveLength(
        spreadsheet.series.length * spreadsheet.series[0].values.length,
      );
    });

    it("spreads line series colors across palette to avoid similar adjacent colors", () => {
      const palette = getAllColorsSpecificShade(DEFAULT_CHART_COLOR_INDEX);
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: ["A", "B", "C", "D", "E"],
        series: [
          { title: "S1", values: [1, 2, 3, 4, 5] },
          { title: "S2", values: [2, 3, 4, 5, 1] },
          { title: "S3", values: [3, 4, 5, 1, 2] },
          { title: "S4", values: [4, 5, 1, 2, 3] },
        ],
      };

      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
      const elements = renderSpreadsheet("line", spreadsheet, 0, 0);
      randomSpy.mockRestore();

      const seriesLines = elements!.filter(
        (element) => element.type === "line" && element.strokeWidth === 2,
      );
      const colorIndices = seriesLines.map((line) =>
        palette.findIndex((color) => color === line.strokeColor),
      );

      expect(colorIndices.every((index) => index >= 0)).toBe(true);

      const circularDistance = (first: number, second: number) => {
        const absoluteDistance = Math.abs(first - second);
        return Math.min(absoluteDistance, palette.length - absoluteDistance);
      };
      const minDistance = Math.min(
        ...colorIndices.flatMap((index, i) =>
          colorIndices
            .slice(i + 1)
            .map((other) => circularDistance(index, other)),
        ),
      );

      expect(minDistance).toBeGreaterThan(1);
    });

    it("uses colorSeed to deterministically pick chart colors", () => {
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: ["A", "B", "C", "D"],
        series: [
          { title: "S1", values: [1, 2, 3, 4] },
          { title: "S2", values: [4, 3, 2, 1] },
          { title: "S3", values: [2, 3, 4, 1] },
        ],
      };

      const getSeriesLineColors = (seed: number) => {
        const elements = renderSpreadsheet("line", spreadsheet, 0, 0, seed);
        return elements!
          .filter(
            (element): element is ExcalidrawLineElement =>
              element.type === "line" && element.strokeWidth === 2,
          )
          .map((line) => line.strokeColor);
      };

      expect(getSeriesLineColors(0.125)).toEqual(getSeriesLineColors(0.125));
      expect(getSeriesLineColors(0.125)).not.toEqual(
        getSeriesLineColors(0.875),
      );
    });

    it("renders multi-series line legend below axis labels with clearance", () => {
      const spreadsheet: Spreadsheet = {
        title: "Scores",
        labels: ["alpha", "beta", "gamma", "delta", "epsilon"],
        series: [
          { title: "Team A", values: [42150, 8300, 95400, 12600, 310500] },
          { title: "Team B", values: [63400, 3150, 51200, 9200, 125800] },
        ],
      };

      const elements = renderSpreadsheet("line", spreadsheet, 0, 0);
      const textElements = elements!.filter(
        (element) => element.type === "text",
      );
      const axisLabels = textElements.filter((element) =>
        spreadsheet.labels?.includes(element.originalText || ""),
      );
      const legendLabels = textElements.filter((element) =>
        spreadsheet.series.some(
          (series) => series.title === element.originalText,
        ),
      );

      const axisBottomY = Math.max(
        ...axisLabels.map((axisLabel) => axisLabel.y + axisLabel.height),
      );
      const legendTopY = Math.min(
        ...legendLabels.map((legendLabel) => legendLabel.y),
      );

      expect(axisLabels.length).toBeGreaterThan(0);
      expect(legendLabels.length).toBe(2);
      expect(legendTopY).toBeGreaterThan(axisBottomY + 2);
    });

    it("keeps multi-series line x-axis labels below axis and avoids neighbor overlap", () => {
      const spreadsheet: Spreadsheet = {
        title: "trait",
        labels: [
          "Physical Strength",
          "Swordsmanship",
          "Political Instinct",
          "Book Knowledge",
          "Strategic Thinking",
          "charisma",
          "courage",
          "Stubbornness",
          "Empathy",
          "Practical Survival Skills",
        ],
        series: [
          { title: "Dunk", values: [10, 8, 3, 2.5, 5, 7, 9, 8, 8, 9] },
          { title: "Egg", values: [2, 1, 9, 8, 9, 8, 7, 9, 8, 4] },
        ],
      };

      const elements = renderSpreadsheet("line", spreadsheet, 0, 0);
      const axisLabels = elements!.filter(
        (element): element is ExcalidrawTextElement =>
          element.type === "text" && Math.abs(element.angle) > 0,
      );

      expect(axisLabels).toHaveLength(spreadsheet.labels!.length);

      const bounds = axisLabels.map(getRotatedBounds);
      for (const bound of bounds) {
        expect(bound.top).toBeGreaterThan(0);
      }

      const sortedBounds = bounds.sort(
        (left, right) => left.centerX - right.centerX,
      );
      for (let index = 1; index < sortedBounds.length; index++) {
        expect(sortedBounds[index - 1].right).toBeLessThanOrEqual(
          sortedBounds[index].left + 2,
        );
      }
    });

    it("renders one closed polygon line per radar series", () => {
      const spreadsheet: Spreadsheet = {
        title: "Metric",
        labels: ["Speed", "Strength", "Agility", "Intelligence", "Stamina"],
        series: [
          { title: "Player A", values: [80, 65, 90, 70, 85] },
          { title: "Player B", values: [60, 85, 70, 88, 75] },
          { title: "Player C", values: [75, 70, 88, 92, 80] },
        ],
      };

      const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
      const seriesPolygons = elements!.filter(
        (element): element is ExcalidrawLineElement =>
          element.type === "line" &&
          "polygon" in element &&
          element.polygon === true &&
          element.strokeWidth === 2,
      );

      expect(seriesPolygons).toHaveLength(3);
      for (const polygon of seriesPolygons) {
        expect(polygon.points[0]).toEqual(
          polygon.points[polygon.points.length - 1],
        );
      }
    });

    it("normalizes multi-series radar values with global scale", () => {
      const spreadsheet: Spreadsheet = {
        title: "Scores",
        labels: ["alpha", "beta", "gamma", "delta", "epsilon"],
        series: [
          { title: "Series 1", values: [40000, 8300, 95400, 7820, 5000000] },
          { title: "Series 2", values: [76000, 3150, 51200, 4670, 60000] },
        ],
      };

      const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
      const seriesPolygons = elements!.filter(
        (element): element is ExcalidrawLineElement =>
          element.type === "line" &&
          "polygon" in element &&
          element.polygon === true &&
          element.strokeWidth === 2,
      );

      const series1 = seriesPolygons[0];
      const series2 = seriesPolygons[1];
      const getRadius = (point: readonly [number, number]) =>
        Math.hypot(point[0], point[1]);

      // On alpha axis, second series is about ~1.9x first series.
      const alphaRatio =
        getRadius(series2.points[0]!) / getRadius(series1.points[0]!);
      expect(alphaRatio).toBeCloseTo(76000 / 40000, 1);

      // On epsilon axis, first series should dominate strongly.
      const epsilonRatio =
        getRadius(series1.points[4]!) / getRadius(series2.points[4]!);
      expect(epsilonRatio).toBeGreaterThan(50);
    });

    // it("always renders radar step rings regardless of axis scale ratio", () => {
    //   const spreadsheet: Spreadsheet = {
    //     title: "Scores",
    //     labels: ["alpha", "beta", "gamma", "delta", "epsilon"],
    //     series: [
    //       { title: "Series 1", values: [40000, 8300, 95400, 7820, 5000000] },
    //       { title: "Series 2", values: [76000, 3150, 51200, 4670, 60000] },
    //     ],
    //   };

    //   const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
    //   const stepRings = elements!.filter(
    //     (element) =>
    //       element.type === "line" &&
    //       "polygon" in element &&
    //       element.polygon &&
    //       element.strokeStyle === "solid" &&
    //       element.strokeWidth === 1,
    //   );

    //   expect(stepRings).toHaveLength(4);
    // });

    it("uses log normalization for highly skewed single-series radar data", () => {
      const spreadsheet: Spreadsheet = {
        title: "Scores",
        labels: ["alpha", "beta", "gamma", "delta", "epsilon"],
        series: [
          {
            title: "Scores",
            values: [40000, 8300, 95400, 7820, 5000000],
          },
        ],
      };

      const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
      const seriesPolygons = elements!.filter(
        (element): element is ExcalidrawLineElement =>
          element.type === "line" &&
          "polygon" in element &&
          element.polygon === true &&
          element.strokeWidth === 2,
      );

      const polygon = seriesPolygons[0];
      const getRadius = (point: readonly [number, number]) =>
        Math.hypot(point[0], point[1]);

      const alphaRadius = getRadius(polygon.points[0]!);
      const epsilonRadius = getRadius(polygon.points[4]!);

      // With linear scaling this would collapse near 0; log keeps it visible.
      expect(alphaRadius).toBeGreaterThan(40);
      expect(epsilonRadius).toBeGreaterThan(alphaRadius);
    });

    it("does not render 0/max value labels for radar charts", () => {
      const spreadsheet: Spreadsheet = {
        title: "Scores",
        labels: ["alpha", "beta", "gamma", "delta", "epsilon"],
        series: [
          {
            title: "Scores",
            values: [40000, 8300, 95400, 7820, 5000000],
          },
        ],
      };

      const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
      const textElements = elements!.filter(
        (element) => element.type === "text",
      );

      expect(textElements.some((element) => element.text === "0")).toBe(false);
      expect(
        textElements.some(
          (element) =>
            element.text ===
            Math.max(...spreadsheet.series[0].values).toLocaleString(),
        ),
      ).toBe(false);
    });

    it("wraps long radar axis labels instead of ellipsifying", () => {
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: [
          "Physical Strength",
          "Swordsmanship",
          "Political Instinct",
          "Book Knowledge",
          "Strategic Thinking",
          "Charisma",
          "Courage",
          "Stubbornness",
          "Empathy",
          "Practical Survival Skills",
        ],
        series: [
          { title: "Dunk", values: [10, 8, 3, 2.5, 5, 7, 9, 8, 8, 9] },
          { title: "Egg", values: [2, 1, 9, 8, 9, 8, 7, 9, 8, 4] },
        ],
      };

      const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
      const textElements = elements!.filter(
        (element) => element.type === "text",
      );
      const wrappedAxisLabels = textElements.filter(
        (element) =>
          element.text.includes("\n") &&
          element.text !== "Trait" &&
          element.text !== "Dunk" &&
          element.text !== "Egg",
      );

      expect(wrappedAxisLabels.length).toBeGreaterThan(0);
      expect(
        wrappedAxisLabels.every(
          (element) =>
            typeof element.originalText === "string" &&
            !element.originalText.includes("\n"),
        ),
      ).toBe(true);
      expect(
        textElements.some(
          (element) => element.text.includes("...") && element.text !== "Dunk",
        ),
      ).toBe(false);
      expect(
        textElements.some(
          (element) =>
            element.originalText === "Stubbornness" &&
            !element.text.includes("\n") &&
            element.text === "Stubbornness",
        ),
      ).toBe(true);
      expect(
        textElements.some(
          (element) =>
            element.originalText === "Physical Strength" &&
            element.text.includes("Physical\nStrength"),
        ),
      ).toBe(true);

      const topLabel = textElements.find(
        (element) => element.originalText === "Physical Strength",
      );
      const topSpokeY = Math.min(
        ...elements!
          .filter(
            (element): element is ExcalidrawLineElement =>
              element.type === "line" &&
              "polygon" in element &&
              !element.polygon &&
              element.strokeStyle === "solid" &&
              element.strokeWidth === 1,
          )
          .map((element) => element.y + element.points[1][1]),
      );
      expect(topLabel).toBeDefined();
      expect(topLabel!.y + topLabel!.height).toBeLessThan(topSpokeY - 2);
    });

    it("renders radar title and series legend labels in Lilita One", () => {
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: ["Physical Strength", "Swordsmanship", "Strategy", "Charisma"],
        series: [
          { title: "Dunk", values: [10, 8, 5, 7] },
          { title: "Egg", values: [2, 1, 9, 8] },
        ],
      };

      const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
      const textElements = elements!.filter(
        (element) => element.type === "text",
      );
      const title = textElements.find((element) =>
        element.text.includes("Trait"),
      );
      const dunkLabel = textElements.find((element) => element.text === "Dunk");
      const eggLabel = textElements.find((element) => element.text === "Egg");

      expect(title?.fontFamily).toBe(FONT_FAMILY["Lilita One"]);
      expect(title?.originalText).toBe("Trait");
      expect(dunkLabel?.fontFamily).toBe(FONT_FAMILY["Lilita One"]);
      expect(eggLabel?.fontFamily).toBe(FONT_FAMILY["Lilita One"]);
    });

    it("positions radar title with vertical clearance above axis labels", () => {
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: [
          "Physical Strength",
          "Swordsmanship",
          "Political Instinct",
          "Book Knowledge",
          "Strategic Thinking",
          "Charisma",
          "Courage",
          "Stubbornness",
          "Empathy",
          "Practical Survival Skills",
        ],
        series: [
          { title: "Dunk", values: [10, 8, 3, 2.5, 5, 7, 9, 8, 8, 9] },
          { title: "Egg", values: [2, 1, 9, 8, 9, 8, 7, 9, 8, 4] },
        ],
      };

      const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
      const textElements = elements!.filter(
        (element) => element.type === "text",
      );
      const title = textElements.find(
        (element) => element.fontFamily === FONT_FAMILY["Lilita One"],
      );
      const axisLabels = textElements.filter(
        (element) =>
          element.fontFamily === FONT_FAMILY.Excalifont &&
          element.text !== "Dunk" &&
          element.text !== "Egg",
      );
      const topAxisLabelY = Math.min(...axisLabels.map((element) => element.y));

      expect(title).toBeDefined();
      expect(title!.y + title!.height).toBeLessThan(topAxisLabelY - 4);
    });

    it("spreads radar series colors across palette to avoid similar adjacent colors", () => {
      const palette = getAllColorsSpecificShade(DEFAULT_CHART_COLOR_INDEX);
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: ["A", "B", "C", "D", "E"],
        series: [
          { title: "S1", values: [1, 2, 3, 4, 5] },
          { title: "S2", values: [2, 3, 4, 5, 1] },
          { title: "S3", values: [3, 4, 5, 1, 2] },
          { title: "S4", values: [4, 5, 1, 2, 3] },
        ],
      };

      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
      const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
      randomSpy.mockRestore();

      const seriesPolygons = elements!.filter(
        (element) =>
          element.type === "line" &&
          "polygon" in element &&
          element.polygon === true &&
          element.strokeWidth === 2,
      );
      const colorIndices = seriesPolygons.map((polygon) =>
        palette.findIndex((color) => color === polygon.strokeColor),
      );

      expect(colorIndices.every((index) => index >= 0)).toBe(true);

      const circularDistance = (first: number, second: number) => {
        const absoluteDistance = Math.abs(first - second);
        return Math.min(absoluteDistance, palette.length - absoluteDistance);
      };
      const minDistance = Math.min(
        ...colorIndices.flatMap((index, i) =>
          colorIndices
            .slice(i + 1)
            .map((other) => circularDistance(index, other)),
        ),
      );

      expect(minDistance).toBeGreaterThan(1);
    });

    it("positions series legend below the lowest axis label with clearance", () => {
      const spreadsheet: Spreadsheet = {
        title: "Trait",
        labels: [
          "Psychological Warfare",
          "Divine Favor",
          "Confidence",
          "Morale",
          "Armor Protection long wrapped label from above",
          "Accuracy",
          "Agility",
          "Weapon Reach",
        ],
        series: [
          { title: "David", values: [6, 7, 8, 9, 7, 8, 6, 9] },
          { title: "Goliath", values: [9, 3, 2, 6, 10, 2, 8, 1] },
        ],
      };

      const elements = renderSpreadsheet("radar", spreadsheet, 0, 0);
      const textElements = elements!.filter(
        (element) => element.type === "text",
      );
      const axisLabels = textElements.filter((element) =>
        spreadsheet.labels?.includes(element.originalText),
      );
      const legendLabels = textElements.filter((element) =>
        spreadsheet.series.some(
          (series) => series.title === element.originalText,
        ),
      );

      const axisBottomY = Math.max(
        ...axisLabels.map((axisLabel) => axisLabel.y + axisLabel.height),
      );
      const legendTopY = Math.min(
        ...legendLabels.map((legendLabel) => legendLabel.y),
      );

      expect(axisLabels.length).toBeGreaterThan(0);
      expect(legendLabels.length).toBeGreaterThan(0);
      expect(legendTopY).toBeGreaterThan(axisBottomY + 2);
    });
  });
});
