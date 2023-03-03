import { BOUND_TEXT_PADDING } from "../constants";
import { API } from "../tests/helpers/api";
import {
  computeContainerDimensionForBoundText,
  getContainerCoords,
  getMaxContainerWidth,
  getMaxContainerHeight,
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
        width: 80,
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

        width: 140,
        res: `Hello whats 
up`,
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
  describe("Test getContainerCoords", () => {
    const params = { width: 200, height: 100, x: 10, y: 20 };

    it("should compute coords correctly when ellipse", () => {
      const element = API.createElement({
        type: "ellipse",
        ...params,
      });
      expect(getContainerCoords(element)).toEqual({
        x: 44.2893218813452455,
        y: 39.64466094067262,
      });
    });

    it("should compute coords correctly when rectangle", () => {
      const element = API.createElement({
        type: "rectangle",
        ...params,
      });
      expect(getContainerCoords(element)).toEqual({
        x: 15,
        y: 25,
      });
    });

    it("should compute coords correctly when diamond", () => {
      const element = API.createElement({
        type: "diamond",
        ...params,
      });
      expect(getContainerCoords(element)).toEqual({
        x: 65,
        y: 50,
      });
    });
  });

  describe("Test computeContainerDimensionForBoundText", () => {
    const params = {
      width: 178,
      height: 194,
    };

    it("should compute container height correctly for rectangle", () => {
      const element = API.createElement({
        type: "rectangle",
        ...params,
      });
      expect(computeContainerDimensionForBoundText(150, element.type)).toEqual(
        160,
      );
    });

    it("should compute container height correctly for ellipse", () => {
      const element = API.createElement({
        type: "ellipse",
        ...params,
      });
      expect(computeContainerDimensionForBoundText(150, element.type)).toEqual(
        226,
      );
    });

    it("should compute container height correctly for diamond", () => {
      const element = API.createElement({
        type: "diamond",
        ...params,
      });
      expect(computeContainerDimensionForBoundText(150, element.type)).toEqual(
        320,
      );
    });
  });

  describe("Test getMaxContainerWidth", () => {
    const params = {
      width: 178,
      height: 194,
    };

    it("should return max width when container is rectangle", () => {
      const container = API.createElement({ type: "rectangle", ...params });
      expect(getMaxContainerWidth(container)).toBe(168);
    });

    it("should return max width when container is ellipse", () => {
      const container = API.createElement({ type: "ellipse", ...params });
      expect(getMaxContainerWidth(container)).toBe(116);
    });

    it("should return max width when container is diamond", () => {
      const container = API.createElement({ type: "diamond", ...params });
      expect(getMaxContainerWidth(container)).toBe(79);
    });
  });

  describe("Test getMaxContainerHeight", () => {
    const params = {
      width: 178,
      height: 194,
    };

    it("should return max height when container is rectangle", () => {
      const container = API.createElement({ type: "rectangle", ...params });
      expect(getMaxContainerHeight(container)).toBe(184);
    });

    it("should return max height when container is ellipse", () => {
      const container = API.createElement({ type: "ellipse", ...params });
      expect(getMaxContainerHeight(container)).toBe(127);
    });

    it("should return max height when container is diamond", () => {
      const container = API.createElement({ type: "diamond", ...params });
      expect(getMaxContainerHeight(container)).toBe(87);
    });
  });
});
