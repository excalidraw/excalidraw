import { tryParseCells, tryParseNumber, VALID_SPREADSHEET } from "./charts";

import type { Spreadsheet } from "./charts";

describe("charts", () => {
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

      expect(result.type).toBe(VALID_SPREADSHEET);

      const { title, labels, series : [ { values } ] } = (
        result as { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet }
      ).spreadsheet;

      expect(title).toEqual("value");
      expect(labels).toEqual([
        "01:00",
        "02:00",
        "03:00",
        "04:00",
        "05:00",
        "06:00",
      ]);
      expect(values).toEqual([61, -60, 85, -67, 54, 95]);
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

      expect(result.type).toBe(VALID_SPREADSHEET);

      const { title, labels, series : [ { values } ] } = (
        result as { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet }
      ).spreadsheet;

      expect(title).toEqual("value");
      expect(labels).toEqual([
        "01:00",
        "02:00",
        "03:00",
        "04:00",
        "05:00",
        "06:00",
      ]);
      expect(values).toEqual([61, -60, 85, -67, 54, 95]);
    });

    it("should create multiple series with labels and headers", () => {
      const cells = [
        ["Day", "Visitors", "Signups"],
        ["Mon", "100", "10"],
        ["Tue", "150", "15"],
        ["Wed", "120", "12"],
      ];

      const result = tryParseCells(cells);

      expect(result.type).toBe(VALID_SPREADSHEET);

      const { title, labels, series } = (
        result as { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet }
      ).spreadsheet;

      expect(title).toEqual("Visitors, Signups");
      expect(labels).toEqual(["Mon", "Tue", "Wed"]);
      expect(series).toEqual([
        { name: "Visitors", values: [100, 150, 120] },
        { name: "Signups", values: [10, 15, 12] },
      ]);
    });

    it("should create multiple series without labels and with headers", () => {
      const cells = [
        ["Visitors", "Signups", "Guests"],
        ["100", "10", "20"],
        ["150", "15", "25"],
        ["120", "12", "30"],
      ];

      const result = tryParseCells(cells);
      expect(result.type).toBe(VALID_SPREADSHEET);

      const { title, labels, series } = (
        result as { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet }
      ).spreadsheet;

      expect(title).toEqual("Visitors, Signups, Guests");
      expect(labels).toBeNull();
      expect(series).toEqual([
        { name: "Visitors", values: [100, 150, 120] },
        { name: "Signups", values: [10, 15, 12] },
        { name: "Guests", values: [20, 25, 30] },
      ]);
    });

    it("should create multiple series with labels and without headers", () => {
      const cells = [
        ["Mon", "100", "10"],
        ["Tue", "150", "15"],
        ["Wed", "120", "12"],
      ];
      
      const result = tryParseCells(cells);
      expect(result.type).toBe(VALID_SPREADSHEET);
      
      const { title, labels, series } = (
        result as { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet }
      ).spreadsheet;
      expect(title).toBeNull();
      expect(labels).toEqual(["Mon", "Tue", "Wed"]);
      expect(series).toEqual([
        { name: null, values: [100, 150, 120] },
        { name: null, values: [10, 15, 12] },
      ]);
    });

    it("should create single series without labels and without headers", () => {
      const cells = [
        ["100"],
        ["150"],
        ["120"],
      ];
      
      const result = tryParseCells(cells);
      expect(result.type).toBe(VALID_SPREADSHEET);
      
      const { title, labels, series } = (
        result as { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet }
      ).spreadsheet;
      expect(title).toBeNull();
      expect(labels).toBeNull();
      expect(series).toEqual([
        { name: null, values: [100, 150, 120] },
      ]);
    });

    it("should create multiple series without labels and without headers", () => {
      const cells = [
        ["100", "10", "20"],
        ["150", "15", "25"],
        ["120", "12", "30"],
      ];
      
      const result = tryParseCells(cells);
      expect(result.type).toBe(VALID_SPREADSHEET);
      
      const { title, labels, series } = (
        result as { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet }
      ).spreadsheet;
      expect(title).toBeNull();
      expect(labels).toBeNull();
      expect(series).toEqual([
        { name: null, values: [100, 150, 120] },
        { name: null, values: [10, 15, 12] },
        { name: null, values: [20, 25, 30] },
      ]);
    });

    it("should fail to parse non-numeric data", () => {
      const cells = [
        ["Day", "Visitors", "Signups"],
        ["Mon", "one hundred", "10"],
        ["Tue", "150", "fifteen"],
        ["Wed", "120", "12"],
      ];

      const result = tryParseCells(cells);
      expect(result.type).toBe("NOT_SPREADSHEET");
    });
  });
});
