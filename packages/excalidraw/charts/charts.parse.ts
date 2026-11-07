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

/** a single space stands for any run of spaces */
type Delimiter = "\t" | "," | ";" | " ";

// order = priority: tab > comma > semicolon > space
const DELIMITERS: readonly Delimiter[] = ["\t", ",", ";", " "];

const QUOTE = '"';

const splitRowNaively = (line: string, delimiter: Delimiter) =>
  delimiter === " " ? line.trim().split(/ +/) : line.split(delimiter);

/**
 * Splits a row into trimmed cells, following CSV quoting rules: a cell
 * wrapped in double quotes can contain the delimiter, and `""` inside it
 * stands for a literal quote.
 *
 * A quote left open (e.g. `5" screen`) is most likely not CSV quoting,
 * so in that case the row is split ignoring quotes.
 *
 * @private exported for testing
 */
export const splitRow = (line: string, delimiter: Delimiter): string[] => {
  const input = delimiter === " " ? line.trim() : line;
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char !== QUOTE) {
        cell += char;
      } else if (input[i + 1] === QUOTE) {
        cell += QUOTE;
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
      if (delimiter === " ") {
        while (input[i + 1] === " ") {
          i++;
        }
      }
    } else if (char === QUOTE && cell.trim() === "") {
      // only a quote at the start of a cell opens a quoted cell
      inQuotes = true;
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);

  return (inQuotes ? splitRowNaively(line, delimiter) : cells).map((c) =>
    c.trim(),
  );
};

const hasHeaderRow = (rows: string[][]) =>
  rows.length > 1 &&
  rows[0].slice(1).every((cell) => tryParseNumber(cell) === null);

/**
 * Parses text copied from Excel, Google Sheets, or written as TSV, CSV,
 * semicolon- or space-separated values.
 */
export const tryParseSpreadsheet = (text: string): ParseSpreadsheetResult => {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { ok: false, reason: "No values" };
  }

  const candidates = DELIMITERS.map((delimiter) => {
    const rows = lines.map((line) => splitRow(line, delimiter));
    const numCols = rows[0].length;
    const isConsistent = rows.every((row) => row.length === numCols);
    return { delimiter, rows, numCols, isConsistent };
  }).filter(
    // plain text has spaces too: only take spaces as columns when the first
    // row looks like a header, so a list such as "Step 1\nStep 2" stays text
    (c) => c.delimiter !== " " || hasHeaderRow(c.rows),
  );

  // Prefer the first delimiter (in priority order) that splits every row into
  // the same number of columns, and more than one. Otherwise accept a single
  // column, which every delimiter not present in the text produces.
  const best =
    candidates.find((c) => c.isConsistent && c.numCols > 1) ??
    candidates.find((c) => c.isConsistent);

  if (!best) {
    return {
      ok: false,
      reason: "All rows don't have same number of columns",
    };
  }

  return tryParseCells(best.rows);
};
