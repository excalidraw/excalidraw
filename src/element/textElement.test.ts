import { BOUND_TEXT_PADDING } from "../constants";
import { API } from "../tests/helpers/api";
import {
  computeContainerHeightForBoundText,
  getContainerCoords,
  measureText,
  wrapText,
} from "./textElement";
import { FontString } from "./types";

describe("Test wrapText", () => {
  const font = "20px Cascadia, width: Segoe UI Emoji" as FontString;

  it("shouldn't add new lines for trailing spaces", () => {
    const text = "Hello whats up     ";
    const maxWidth = 200 - BOUND_TEXT_PADDING * 2;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("Hello whats up    ");
  });

  it("should work with emojis", () => {
    const text = "😀";
    const maxWidth = 1;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("😀");
  });

  it("should show the text correctly when min width reached", () => {
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
        width: 90,
        res: `Hello 
whats 
up`,
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
        res: `Hello whats 
up`,
      },
      {
        desc: "fit the container",

        width: 250,
        res: "Hello whats up",
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
        width: 90,
        res: `Hello
whats 
up`,
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
        res: `hellolongtextth
isiswhatsupwith
youIamtypingggg
gandtypinggg 
break it now`,
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
        res: `hellolongtextthisiswhatsupwithyouIamtypingggggandtypinggg 
break it now`,
      },
    ].forEach((data) => {
      it(`should ${data.desc}`, () => {
        const res = wrapText(text, font, data.width - BOUND_TEXT_PADDING * 2);
        expect(res).toEqual(data.res);
      });
    });
  });
});

describe("Test measureText", () => {
  const font = "20px Cascadia, width: Segoe UI Emoji" as FontString;
  const text = "Hello World";

  it("should add correct attributes when maxWidth is passed", () => {
    const maxWidth = 200 - BOUND_TEXT_PADDING * 2;
    const res = measureText(text, font, maxWidth);

    expect(res.container).toMatchInlineSnapshot(`
      <div
        style="position: absolute; white-space: pre-wrap; font: Emoji 20px 20px; min-height: 1em; max-width: 191px; overflow: hidden; word-break: break-word; line-height: 0px;"
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

  describe("Test getContainerCoords", () => {
    const params = { width: 200, height: 100, x: 10, y: 20 };
    it("should compute coords correctly when ellipse", () => {
      const ellipse = API.createElement({
        type: "ellipse",
        ...params,
      });
      expect(getContainerCoords(ellipse)).toEqual({
        x: 44.2893218813452455,
        y: 39.64466094067262,
      });
    });
    it("should compute coords correctly when rectangle", () => {
      const rectangle = API.createElement({
        type: "rectangle",
        ...params,
      });
      expect(getContainerCoords(rectangle)).toEqual({
        x: 10,
        y: 20,
      });
    });
  });

  describe("Test computeContainerHeightForBoundText", () => {
    const params = {
      width: 178,
      height: 194,
    };
    it("should compute container height correctly for rectangle", () => {
      const element = API.createElement({
        type: "rectangle",
        ...params,
      });
      expect(computeContainerHeightForBoundText(element, 150)).toEqual(160);
    });
    it("should compute container height correctly for ellipse", () => {
      const element = API.createElement({
        type: "ellipse",
        ...params,
      });
      expect(computeContainerHeightForBoundText(element, 150)).toEqual(212);
    });
  });
});
