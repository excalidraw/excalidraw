import { wrapText } from "./textElement";
import { FontString } from "./types";

describe("Test wrapText", () => {
  const font = "20px Cascadia, width: Segoe UI Emoji" as FontString;

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
        const res = wrapText(text, font, data.width);
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
        const res = wrapText(text, font, data.width);
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
        const res = wrapText(text, font, data.width);
        expect(res).toEqual(data.res);
      });
    });
  });
});
