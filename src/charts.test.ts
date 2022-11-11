import {
  Spreadsheet,
  sortSpreadsheet,
  tryParseCells,
  tryParseNumber,
  VALID_SPREADSHEET,
} from "./charts";

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

      const { title, labels, values } = (
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

      const { title, labels, values } = (
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

      expect(result.type).toBe(VALID_SPREADSHEET);

      const { title, labels, values } = (
        result as { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet }
      ).spreadsheet;

      expect(title).toEqual("value");
      expect(labels).toEqual(["01", "02", "03", "04", "05", "06"]);
      expect(values).toEqual([61, -60, 85, -67, 54, 95]);
    });
  });

  describe("sortSpreadsheet", () => {
    it("sorts strictly numerical labels columns in ascending order", () => {
      const spreadsheet = [
        ["x", "y"],
        ["1°", "1"],
        ["9°", "2"],
        ["3°", "3"],
        ["6°", "4"],
      ];

      const result = tryParseCells(spreadsheet);

      expect(result.type).toBe(VALID_SPREADSHEET);

      const { title, labels, values } = sortSpreadsheet(
        (result as { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet })
          .spreadsheet,
      );

      expect(title).toEqual("y");
      expect(labels).toEqual(["1°", "3°", "6°", "9°"]);
      expect(values).toEqual([1, 3, 4, 2]);
    });
  });
});
