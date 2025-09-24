import { tryParseSpreadsheet } from "../charts";

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

  it("parses multiple columns into multiple series", () => {
    const input = `Week Index\tUsers\tAdmins\tGuests
Week 1\t100\t5\t20
Week 2\t200\t8\t25
Week 3\t150\t6\t30`;

    const result = tryParseSpreadsheet(input);

    // snapshot the full parsed structure (title, labels or series)
    expect(result).toMatchSnapshot();
  });
});
