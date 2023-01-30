import { CHARACTER_WIDTH_IN_TEST, measureText, wrapText } from "./textElement";
import { FontString } from "./types";
import { faker } from "@faker-js/faker";

describe("Test wrapText", () => {
  const font = "20px Cascadia, width: Segoe UI Emoji" as FontString;

  it("shouldn't add new lines for trailing spaces", () => {
    const text = faker.lorem.paragraph();
    const maxWidth = text.length * CHARACTER_WIDTH_IN_TEST;
    const spaces = " ".repeat(faker.datatype.number({ min: 1, max: 10 }));
    const res = wrapText(text + spaces, font, maxWidth);
    expect(res).toBe(text + spaces);
  });

  it("should work with emojis", () => {
    const text = "😀";
    const maxWidth = CHARACTER_WIDTH_IN_TEST / 2;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("😀");
  });

  it("should show the text correctly when min width reached", () => {
    const text = `${faker.random.word()}😀`;
    const maxWidth = CHARACTER_WIDTH_IN_TEST;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe(Array.from(text).join("\n"));
  });

  describe("When text doesn't contain new lines", () => {
    const words = [
      faker.lorem.word(5),
      faker.lorem.word(3),
      faker.lorem.word(2),
    ];
    const text = words.join(" ");
    [
      {
        desc: "break all words when width of each word is less than container width",
        width: words[0].length * CHARACTER_WIDTH_IN_TEST,
        res: words.join(" \n"),
      },
      {
        desc: "break all characters when width of each character is less than container width",
        width: CHARACTER_WIDTH_IN_TEST * 1.5,
        res: words.map((word) => word.split("").join("\n")).join(" \n"),
      },
      {
        desc: "break words as per the width",
        width: `${words[0]} ${words[1]}`.length * CHARACTER_WIDTH_IN_TEST,
        res: `${words[0]} ${words[1]} \n${words[2]}`,
      },
      {
        desc: "fit the container",
        width: text.length * CHARACTER_WIDTH_IN_TEST,
        res: text,
      },
    ].forEach((data) => {
      it(`should ${data.desc}`, () => {
        const res = wrapText(text, font, data.width);
        expect(res).toEqual(data.res);
      });
    });
  });
  describe("When text contain new lines", () => {
    const words = [
      faker.lorem.word(5),
      faker.lorem.word(3),
      faker.lorem.word(2),
    ];
    const text = `${words[0]}\n${words[1]} ${words[2]}`;
    [
      {
        desc: "break all words when width of each word is less than container width",
        width: words[0].length * CHARACTER_WIDTH_IN_TEST,
        res: `${words[0]}\n${words[1]} \n${words[2]}`,
      },
      {
        desc: "break all characters when width of each character is less than container width",
        width: CHARACTER_WIDTH_IN_TEST * 1.5,
        res: `${words[0].split("").join("\n")}\n${words[1]
          .split("")
          .join("\n")} \n${words[2].split("").join("\n")}`,
      },
      {
        desc: "break words as per the width",
        width: `${words[1]} ${words[2]}`.length * CHARACTER_WIDTH_IN_TEST,
        res: text,
      },
      {
        desc: "fit the container",
        width: text.length * CHARACTER_WIDTH_IN_TEST,
        res: text,
      },
    ].forEach((data) => {
      it(`should respect new lines and ${data.desc}`, () => {
        const res = wrapText(text, font, data.width);
        expect(res).toEqual(data.res);
      });
    });
  });
  describe("When text is long", () => {
    const words = [
      faker.lorem.word(10),
      faker.lorem.word(5),
      faker.lorem.word(3),
      faker.lorem.word(2),
    ];
    const text = `${words[0].repeat(10)} ${words[1]} ${words[2]} ${words[3]}`; // 100 5 3 2
    [
      {
        desc: "fit characters of long string as per container width",
        width: words[0].length * CHARACTER_WIDTH_IN_TEST,
        res: `${Array(10).fill(words[0]).join("\n")} \n${words[1]} ${
          words[2]
        } \n${words[3]}`,
      },

      {
        desc: "fit characters of long string as per container width and break words as per the width",
        width: words[0].repeat(3).length * CHARACTER_WIDTH_IN_TEST,
        res: `${Array(3).fill(words[0].repeat(3)).join("\n")}\n${words[0]} ${
          words[1]
        } ${words[2]} ${words[3]}`,
      },
      {
        desc: "fit the long text when container width is greater than text length and move the rest to next line",

        width: words[0].repeat(10).length * CHARACTER_WIDTH_IN_TEST,
        res: `${words[0].repeat(10)} \n${words[1]} ${words[2]} ${words[3]}`,
      },
    ].forEach((data) => {
      it(`should ${data.desc}`, () => {
        const res = wrapText(text, font, data.width);
        expect(res).toEqual(data.res);
      });
    });
  });
});

describe("Test measureText", () => {
  const font = "20px Cascadia, width: Segoe UI Emoji" as FontString;
  const text = faker.lorem.paragraph(1);

  it("should add correct attributes when maxWidth is passed", () => {
    const maxWidth = text.length * CHARACTER_WIDTH_IN_TEST;
    const res = measureText(text, font, maxWidth);

    expect(res.container).toMatchInlineSnapshot(`
      <div
        style="position: absolute; white-space: pre-wrap; font: Emoji 20px 20px; min-height: 1em; width: ${
          maxWidth + 1
        }px; overflow: hidden; word-break: break-word; line-height: 0px;"
      >
        <span
          style="display: inline-block; overflow: hidden; width: 1px; height: 1px;"
        />
      </div>
    `);
  });

  it("should add correct attributes when maxWidth is not passed", () => {
    const res = measureText(text, font);

    expect(res.container).toMatchInlineSnapshot(`
      <div
        style="position: absolute; white-space: pre; font: Emoji 20px 20px; min-height: 1em;"
      >
        <span
          style="display: inline-block; overflow: hidden; width: 1px; height: 1px;"
        />
      </div>
    `);
  });
});
