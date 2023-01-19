import { Spreadsheet, tryParseCells, VALID_SPREADSHEET } from "./charts";

describe("table", () => {
  const spreadsheet = [
    ["time", "value1", "value2"],
    ["01:00", "61", "34"],
    ["02:00", "-60", "-49"],
    ["03:00", "85", "44"],
    ["04:00", "-67", "33"],
    ["05:00", "54", "-98"],
    ["06:00", "95", "33"],
  ];
  it("Accept more tan tow column as a valid spreadsheet", () => {
    const result = tryParseCells(spreadsheet);
    expect(result.type).toBe(VALID_SPREADSHEET);
  });
  it("Spreadsheet object must be populated correctly with more than two columns", () => {
    const result = tryParseCells(spreadsheet) as {
      type: typeof VALID_SPREADSHEET;
      spreadsheet: Spreadsheet;
    };
    expect(result.spreadsheet.title).toBeNull();
    expect(result.spreadsheet.labels).toBeNull();
    expect(result.spreadsheet.values).toBeNull();
    expect(result.spreadsheet.cells).toEqual(spreadsheet);
  });
  it("Spreadsheet object must be populated correctly with two columns", () => {
    const spreadsheet = [
      ["time", "value"],
      ["01:00", "61"],
      ["02:00", "-60"],
      ["03:00", "85"],
      ["04:00", "-67"],
      ["05:00", "54"],
      ["06:00", "95"],
    ];
    const result = tryParseCells(spreadsheet) as {
      type: typeof VALID_SPREADSHEET;
      spreadsheet: Spreadsheet;
    };
    expect(result.spreadsheet.title).toBeTruthy();
    expect(result.spreadsheet.labels).toBeTruthy();
    expect(result.spreadsheet.values).toBeTruthy();
    expect(result.spreadsheet.cells).toEqual(spreadsheet);
  });
});
