import { tryParseSpreadsheet } from "../charts";
import { splitRow } from "../charts/charts.parse";

describe("tryParseSpreadsheet", () => {
  it("works for numbers with comma in them", () => {
    const result = tryParseSpreadsheet(
      `Week Index${"\t"}Users
Week 1${"\t"}814
Week 2${"\t"}10,301
Week 3${"\t"}4,264`,
    );
    expect(result).toMatchSnapshot();
  });

  it("parses multi-series CSV for radar charts", () => {
    const result = tryParseSpreadsheet(
      `Metric,Player A,Player B,Player C
Speed,80,60,75
Strength,65,85,70
Agility,90,70,88
Intelligence,70,88,92
Stamina,85,75,80`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Metric",
        labels: ["Speed", "Strength", "Agility", "Intelligence", "Stamina"],
        series: [
          { title: "Player A", values: [80, 65, 90, 70, 85] },
          { title: "Player B", values: [60, 85, 70, 88, 75] },
          { title: "Player C", values: [75, 70, 88, 92, 80] },
        ],
      },
    });
  });

  it("parses TSV with empty chart-name header cell", () => {
    const result = tryParseSpreadsheet(
      `\tDunk\tEgg
Physical Strength\t10\t2
Swordsmanship\t8\t1
Political Instinct\t3\t9`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: null,
        labels: ["Physical Strength", "Swordsmanship", "Political Instinct"],
        series: [
          { title: "Dunk", values: [10, 8, 3] },
          { title: "Egg", values: [2, 1, 9] },
        ],
      },
    });
  });

  it("parses 2-row multi-series TSV without transposing", () => {
    const result = tryParseSpreadsheet(
      `Physical Strength\t10\t2
Swordsmanship skill\t8\t1`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: null,
        labels: ["Physical Strength", "Swordsmanship skill"],
        series: [
          { title: "Series 1", values: [10, 8] },
          { title: "Series 2", values: [2, 1] },
        ],
      },
    });
  });

  it("parses semicolon-separated values", () => {
    const result = tryParseSpreadsheet(
      `Metric;Player A;Player B
Speed;80;60
Strength;65;85
Agility;90;70`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Metric",
        labels: ["Speed", "Strength", "Agility"],
        series: [
          { title: "Player A", values: [80, 65, 90] },
          { title: "Player B", values: [60, 85, 70] },
        ],
      },
    });
  });

  it("transposes wide data (more value cols than rows) into series-per-row", () => {
    const result = tryParseSpreadsheet(
      `trait,Dunk,Egg,Daeron
Physical,10,2,7
Mental,10,2,7`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: "trait",
        labels: ["Dunk", "Egg", "Daeron"],
        series: [
          { title: "Physical", values: [10, 2, 7] },
          { title: "Mental", values: [10, 2, 7] },
        ],
      },
    });
  });

  it("transposes single data row with header into single series", () => {
    const result = tryParseSpreadsheet(
      `trait,Dunk,Egg,Daeron
Physical,10,2,7`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Physical",
        labels: ["Dunk", "Egg", "Daeron"],
        series: [{ title: "Physical", values: [10, 2, 7] }],
      },
    });
  });

  it("transposes single data row without header into single series", () => {
    const result = tryParseSpreadsheet(`Physical,10,2,7`);

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Physical",
        labels: null,
        series: [{ title: "Physical", values: [10, 2, 7] }],
      },
    });
  });

  it("prefers tab over comma/semicolon when tabs produce multiple columns", () => {
    const result = tryParseSpreadsheet(
      `Label\tValue
A\t10
B\t20`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Value",
        labels: ["A", "B"],
        series: [{ title: "Value", values: [10, 20] }],
      },
    });
  });
});

// https://github.com/excalidraw/excalidraw/issues/5156
describe("splitRow", () => {
  it("splits on the delimiter and trims cells", () => {
    expect(splitRow(" a , b,c ", ",")).toEqual(["a", "b", "c"]);
  });

  it("keeps the delimiter inside quoted cells", () => {
    expect(splitRow('Jan,"1,000"', ",")).toEqual(["Jan", "1,000"]);
    expect(splitRow('"Rio, RJ";"2;5"', ";")).toEqual(["Rio, RJ", "2;5"]);
  });

  it("turns doubled quotes inside a quoted cell into one quote", () => {
    expect(splitRow('"say ""hi""",1', ",")).toEqual(['say "hi"', "1"]);
  });

  it("treats a quote in the middle of a cell as a normal character", () => {
    expect(splitRow('5" screen,10', ",")).toEqual(['5" screen', "10"]);
  });

  it("ignores quoting when a quote is left open", () => {
    expect(splitRow('"open,10', ",")).toEqual(['"open', "10"]);
  });

  it("treats runs of spaces as one delimiter, ignoring outer spaces", () => {
    expect(splitRow("  a   b  c ", " ")).toEqual(["a", "b", "c"]);
  });

  it("keeps multiple words together when quoted with the space delimiter", () => {
    expect(splitRow('"hello world" "1,000"', " ")).toEqual([
      "hello world",
      "1,000",
    ]);
  });

  it("keeps empty cells", () => {
    expect(splitRow("\tDunk\tEgg", "\t")).toEqual(["", "Dunk", "Egg"]);
    expect(splitRow('a,"",c', ",")).toEqual(["a", "", "c"]);
  });
});

describe("tryParseSpreadsheet with quoted and space-separated values", () => {
  it("parses CSV with quoted values containing commas", () => {
    const result = tryParseSpreadsheet(
      `Month,Sales
Jan,"1,000"
Feb,"2,500"
"Mar, partial",700`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Sales",
        labels: ["Jan", "Feb", "Mar, partial"],
        series: [{ title: "Sales", values: [1000, 2500, 700] }],
      },
    });
  });

  it("parses space-separated values, with quotes grouping words", () => {
    const result = tryParseSpreadsheet(
      `greeting points
"hello world" "1,000"
hi 300`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: "points",
        labels: ["hello world", "hi"],
        series: [{ title: "points", values: [1000, 300] }],
      },
    });
  });

  it("parses multi-series space-separated values aligned with spaces", () => {
    const result = tryParseSpreadsheet(
      `Metric   A    B
Speed    80   60
Power    65   85`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Metric",
        labels: ["Speed", "Power"],
        series: [
          { title: "A", values: [80, 65] },
          { title: "B", values: [60, 85] },
        ],
      },
    });
  });

  it("prefers comma over space when both split the rows evenly", () => {
    const result = tryParseSpreadsheet(
      `City name,Population
New York,800
Los Angeles,400`,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Population",
        labels: ["New York", "Los Angeles"],
        series: [{ title: "Population", values: [800, 400] }],
      },
    });
  });

  it("does not take spaces as columns without a header row", () => {
    expect(tryParseSpreadsheet("Step 1\nStep 2\nStep 3").ok).toBe(false);
  });

  it("does not parse a single line of plain text", () => {
    expect(tryParseSpreadsheet("hello world").ok).toBe(false);
  });

  it("fails when words without quotes break the space columns", () => {
    expect(
      tryParseSpreadsheet(`city count
Rio de Janeiro 300
Recife 200`).ok,
    ).toBe(false);
  });

  it("parses the same data once the multi-word label is quoted", () => {
    const result = tryParseSpreadsheet(`city count
"Rio de Janeiro" 300
Recife 200`);

    expect(result).toEqual({
      ok: true,
      data: {
        title: "count",
        labels: ["Rio de Janeiro", "Recife"],
        series: [{ title: "count", values: [300, 200] }],
      },
    });
  });

  it("still reports empty input", () => {
    expect(tryParseSpreadsheet("  \n \n")).toEqual({
      ok: false,
      reason: "No values",
    });
  });
});
