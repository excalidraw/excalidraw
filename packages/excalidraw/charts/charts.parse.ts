import { type ParseSpreadsheetResult } from "./charts.types";

/**
 * @private exported for testing
 */
export const tryParseNumber = (s: string): number | null => {
  const match =
    /^([-+]?)[$\u20AC\u00A3\u00A5\u20A9]?([-+]?)([\d.,]+)[%]?$/.exec(s);
  if (!match) {
    return null;
  }
  return parseFloat(`${(match[1] || match[2]) + match[3]}`.replace(/,/g, ""));
};

const isNumericColumn = (lines: string[][], columnIndex: number) =>
  lines.slice(1).every((line) => tryParseNumber(line[columnIndex]) !== null);

/**
 * @private exported for testing
 */
export const tryParseCells = (cells: string[][]): ParseSpreadsheetResult => {
  const numCols = cells[0].length;

  if (numCols > 2) {
    const hasHeader = cells[0].every((cell) => tryParseNumber(cell) === null);
    const rows = hasHeader ? cells.slice(1) : cells;

    if (rows.length < 1) {
      return { ok: false, reason: "No data rows" };
    }

    const invalidNumericColumn = rows.some((row) =>
      row.slice(1).some((value) => tryParseNumber(value) === null),
    );
    if (invalidNumericColumn) {
      return { ok: false, reason: "Value is not numeric" };
    }

    // When there are more value columns than data rows, the data is in
    // "wide" format — transpose so columns become labels (dimensions)
    // and rows become series. This enables e.g. radar charts for wide data.
    const numValueCols = numCols - 1;
    if (numValueCols > rows.length) {
      const labels = hasHeader ? cells[0].slice(1).map((h) => h.trim()) : null;
      const series = rows.map((row) => ({
        title: row[0]?.trim() || null,
        values: row.slice(1).map((v) => tryParseNumber(v)!),
      }));
      const title =
        series.length === 1
          ? series[0].title
          : hasHeader
          ? cells[0][0].trim() || null
          : null;
      return {
        ok: true,
        data: { title, labels, series },
      };
    }

    const series = cells[0].slice(1).map((seriesTitle, index) => {
      const valueColumnIndex = index + 1;
      const fallbackTitle = `Series ${valueColumnIndex}`;
      return {
        title: hasHeader ? seriesTitle.trim() || fallbackTitle : fallbackTitle,
        values: rows.map((row) => tryParseNumber(row[valueColumnIndex])!),
      };
    });

    return {
      ok: true,
      data: {
        title: hasHeader ? cells[0][0].trim() || null : null,
        labels: rows.map((row) => row[0]),
        series,
      },
    };
  }

  if (numCols === 1) {
    if (!isNumericColumn(cells, 0)) {
      return { ok: false, reason: "Value is not numeric" };
    }

    const hasHeader = tryParseNumber(cells[0][0]) === null;
    const title = hasHeader ? cells[0][0] : null;
    const values = (hasHeader ? cells.slice(1) : cells).map((line) =>
      tryParseNumber(line[0]),
    );

    if (values.length < 2) {
      return { ok: false, reason: "Less than two rows" };
    }

    return {
      ok: true,
      data: {
        title,
        labels: null,
        series: [{ title, values: values as number[] }],
      },
    };
  }

  const hasHeader = tryParseNumber(cells[0][1]) === null;
  const rows = hasHeader ? cells.slice(1) : cells;

  if (rows.length < 2) {
    return { ok: false, reason: "Less than 2 rows" };
  }

  const invalidNumericColumn = rows.some(
    (row) => tryParseNumber(row[1]) === null,
  );
  if (invalidNumericColumn) {
    return { ok: false, reason: "Value is not numeric" };
  }

  const title = hasHeader ? cells[0][1] : null;

  return {
    ok: true,
    data: {
      title,
      labels: rows.map((row) => row[0]),
      series: [{ title, values: rows.map((row) => tryParseNumber(row[1])!) }],
    },
  };
};

export const tryParseSpreadsheet = (text: string): ParseSpreadsheetResult => {
  // Copy/paste from excel, spreadsheets, TSV, CSV, semicolon-separated.
  const parseDelimitedLines = (delimiter: "\t" | "," | ";") =>
    text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => line.split(delimiter).map((cell) => cell.trim()));

  // Score each delimiter: prefer consistent column counts with the most columns.
  // A delimiter that produces all single-column rows likely isn't the right one.
  const candidates = (["\t", ",", ";"] as const).map((delimiter) => {
    const parsed = parseDelimitedLines(delimiter);
    const numCols = parsed[0]?.length ?? 0;
    const isConsistent =
      parsed.length > 0 && parsed.every((line) => line.length === numCols);
    return { delimiter, parsed, numCols, isConsistent };
  });

  // Prefer: consistent + most columns. Among ties, tab > comma > semicolon
  // (the array order already encodes this priority).
  const best =
    candidates.find((c) => c.isConsistent && c.numCols > 1) ??
    candidates.find((c) => c.isConsistent) ??
    candidates[0];

  const lines = best.parsed;

  if (lines.length === 0) {
    return { ok: false, reason: "No values" };
  }

  const numColsFirstLine = lines[0].length;
  const isSpreadsheet = lines.every((line) => line.length === numColsFirstLine);

  if (!isSpreadsheet) {
    return {
      ok: false,
      reason: "All rows don't have same number of columns",
    };
  }

  return tryParseCells(lines);
};
