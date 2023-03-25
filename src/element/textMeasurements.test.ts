import { BOUND_TEXT_PADDING, FONT_FAMILY } from "../constants";
import { API } from "../tests/helpers/api";
import {
  detectLineHeight,
  getDefaultLineHeight,
  getLineHeightInPx,
  wrapText,
} from "./textMeasurements";
import { FontString } from "./types";

describe("Test wrapText", () => {
  const font = "20px Cascadia, width: Segoe UI Emoji" as FontString;

  it("shouldn't add new lines for trailing spaces", () => {
    const text = "Hello whats up     ";
    const maxWidth = 200 - BOUND_TEXT_PADDING * 2;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe(text);
  });

  it("should work with emojis", () => {
    const text = "😀";
    const maxWidth = 1;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("😀");
  });

  it("should show the text correctly when max width reached", () => {
    const text = "Hello😀";
    const maxWidth = 10;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("H\ne\nl\nl\no\n😀");
  });

  describe("When text doesn't contain new lines", () => {
    const text = "Hello whats up";

    [
      {
        desc: "break all words when width of each word is less than container width",
        width: 80,
        res: `Hello \nwhats \nup`,
      },
      {
        desc: "break all characters when width of each character is less than container width",
        width: 25,
        res: `H
e
l
l
o
w
h
a
t
s
u
p`,
      },
      {
        desc: "break words as per the width",

        width: 140,
        res: `Hello whats \nup`,
      },
      {
        desc: "fit the container",

        width: 250,
        res: "Hello whats up",
      },
      {
        desc: "should push the word if its equal to max width",
        width: 60,
        res: `Hello
whats
up`,
      },
    ].forEach((data) => {
      it(`should ${data.desc}`, () => {
        const res = wrapText(text, font, data.width - BOUND_TEXT_PADDING * 2);
        expect(res).toEqual(data.res);
      });
    });
  });

  describe("When text contain new lines", () => {
    const text = `Hello
whats up`;
    [
      {
        desc: "break all words when width of each word is less than container width",
        width: 80,
        res: `Hello\nwhats \nup`,
      },
      {
        desc: "break all characters when width of each character is less than container width",
        width: 25,
        res: `H
e
l
l
o
w
h
a
t
s
u
p`,
      },
      {
        desc: "break words as per the width",

        width: 150,
        res: `Hello
whats up`,
      },
      {
        desc: "fit the container",

        width: 250,
        res: `Hello
whats up`,
      },
    ].forEach((data) => {
      it(`should respect new lines and ${data.desc}`, () => {
        const res = wrapText(text, font, data.width - BOUND_TEXT_PADDING * 2);
        expect(res).toEqual(data.res);
      });
    });
  });

  describe("When text is long", () => {
    const text = `hellolongtextthisiswhatsupwithyouIamtypingggggandtypinggg break it now`;
    [
      {
        desc: "fit characters of long string as per container width",
        width: 170,
        res: `hellolongtextth\nisiswhatsupwith\nyouIamtypingggg\ngandtypinggg \nbreak it now`,
      },

      {
        desc: "fit characters of long string as per container width and break words as per the width",

        width: 130,
        res: `hellolongte
xtthisiswha
tsupwithyou
Iamtypinggg
ggandtyping
gg break it
now`,
      },
      {
        desc: "fit the long text when container width is greater than text length and move the rest to next line",

        width: 600,
        res: `hellolongtextthisiswhatsupwithyouIamtypingggggandtypinggg \nbreak it now`,
      },
    ].forEach((data) => {
      it(`should ${data.desc}`, () => {
        const res = wrapText(text, font, data.width - BOUND_TEXT_PADDING * 2);
        expect(res).toEqual(data.res);
      });
    });
  });

  it("should wrap the text correctly when word length is exactly equal to max width", () => {
    const text = "Hello Excalidraw";
    // Length of "Excalidraw" is 100 and exacty equal to max width
    const res = wrapText(text, font, 100);
    expect(res).toEqual(`Hello \nExcalidraw`);
  });

  it("should return the text as is if max width is invalid", () => {
    const text = "Hello Excalidraw";
    expect(wrapText(text, font, NaN)).toEqual(text);
    expect(wrapText(text, font, -1)).toEqual(text);
    expect(wrapText(text, font, Infinity)).toEqual(text);
  });
});
const textElement = API.createElement({
  type: "text",
  text: "Excalidraw is a\nvirtual \nopensource \nwhiteboard for \nsketching \nhand-drawn like\ndiagrams",
  fontSize: 20,
  fontFamily: 1,
  height: 175,
});

describe("Test detectLineHeight", () => {
  it("should return correct line height", () => {
    expect(detectLineHeight(textElement)).toBe(1.25);
  });
});

describe("Test getLineHeightInPx", () => {
  it("should return correct line height", () => {
    expect(
      getLineHeightInPx(textElement.fontSize, textElement.lineHeight),
    ).toBe(25);
  });
});

describe("Test getDefaultLineHeight", () => {
  it("should return line height using default font family when not passed", () => {
    //@ts-ignore
    expect(getDefaultLineHeight()).toBe(1.25);
  });
  it("should return correct line height", () => {
    expect(getDefaultLineHeight(FONT_FAMILY.Cascadia)).toBe(1.2);
  });
});
