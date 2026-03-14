import { wrapText, parseTokens } from "../src/textWrapping";

import type { FontString } from "../src/types";

describe("Test wrapText", () => {
  // font is irrelevant as jsdom does not support FontFace API
  // `measureText` width is mocked to return `text.length` by `jest-canvas-mock`
  // https://github.com/hustcc/jest-canvas-mock/blob/master/src/classes/TextMetrics.js
  const font = "10px Cascadia, Segoe UI Emoji" as FontString;

  it("should wrap the text correctly when word length is exactly equal to max width", () => {
    const text = "Hello Excalidraw";
    // Length of "Excalidraw" is 100 and exactly equal to max width
    const res = wrapText(text, font, 100);
    expect(res).toEqual(`Hello\nExcalidraw`);
  });

  it("should return the text as is if max width is invalid", () => {
    const text = "Hello Excalidraw";
    expect(wrapText(text, font, NaN)).toEqual(text);
    expect(wrapText(text, font, -1)).toEqual(text);
    expect(wrapText(text, font, Infinity)).toEqual(text);
  });

  it("should show the text correctly when max width reached", () => {
    const text = "Hello😀";
    const maxWidth = 10;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("H\ne\nl\nl\no\n😀");
  });

  it("should not wrap number when wrapping line", () => {
    const text = "don't wrap this number 99,100.99";
    const maxWidth = 300;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("don't wrap this number\n99,100.99");
  });

  it("should trim all trailing whitespaces", () => {
    const text = "Hello     ";
    const maxWidth = 50;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("Hello");
  });

  it("should trim all but one trailing whitespaces", () => {
    const text = "Hello     ";
    const maxWidth = 60;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("Hello ");
  });

  it("should keep preceding whitespaces and trim all trailing whitespaces", () => {
    const text = "  Hello  World";
    const maxWidth = 90;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("  Hello\nWorld");
  });

  it("should keep some preceding whitespaces, trim trailing whitespaces, but kep those that fit in the trailing line", () => {
    const text = "   Hello  World            ";
    const maxWidth = 90;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("   Hello\nWorld    ");
  });

  it("should trim keep those whitespace that fit in the trailing line", () => {
    const text = "Hello   Wo rl  d                     ";
    const maxWidth = 100;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("Hello   Wo\nrl  d     ");
  });

  it("should support multiple (multi-codepoint) emojis", () => {
    const text = "😀🗺🔥👩🏽‍🦰👨‍👩‍👧‍👦🇨🇿";
    const maxWidth = 1;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe("😀\n🗺\n🔥\n👩🏽‍🦰\n👨‍👩‍👧‍👦\n🇨🇿");
  });

  it("should wrap the text correctly when text contains hyphen", () => {
    let text =
      "Wikipedia is hosted by Wikimedia- Foundation, a non-profit organization that also hosts a range-of other projects";
    const res = wrapText(text, font, 110);
    expect(res).toBe(
      `Wikipedia\nis hosted\nby\nWikimedia-\nFoundation,\na non-\nprofit\norganizatio\nn that also\nhosts a\nrange-of\nother\nprojects`,
    );

    text = "Hello thereusing-now";
    expect(wrapText(text, font, 100)).toEqual("Hello\nthereusing\n-now");
  });

  it("should support wrapping nested lists", () => {
    const text = `\tA) one tab\t\t- two tabs        - 8 spaces`;

    const maxWidth = 100;
    const res = wrapText(text, font, maxWidth);
    expect(res).toBe(`\tA) one\ntab\t\t- two\ntabs\n- 8 spaces`);

    const maxWidth2 = 50;
    const res2 = wrapText(text, font, maxWidth2);
    expect(res2).toBe(`\tA)\none\ntab\n- two\ntabs\n- 8\nspace\ns`);
  });

  describe("When text is CJK", () => {
    it("should break each CJK character when width is very small", () => {
      // "안녕하세요" (Hangul) + "こんにちは世界" (Hiragana, Kanji) + "ｺﾝﾆﾁハ" (Katakana) + "你好" (Han) = "Hello Hello World Hello Hi"
      const text = "안녕하세요こんにちは世界ｺﾝﾆﾁハ你好";
      const maxWidth = 10;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe(
        "안\n녕\n하\n세\n요\nこ\nん\nに\nち\nは\n世\n界\nｺ\nﾝ\nﾆ\nﾁ\nハ\n你\n好",
      );
    });

    it("should break CJK text into longer segments when width is larger", () => {
      // "안녕하세요" (Hangul) + "こんにちは世界" (Hiragana, Kanji) + "ｺﾝﾆﾁハ" (Katakana) + "你好" (Han) = "Hello Hello World Hello Hi"
      const text = "안녕하세요こんにちは世界ｺﾝﾆﾁハ你好";
      const maxWidth = 30;
      const res = wrapText(text, font, maxWidth);

      // measureText is mocked, so it's not precisely what would happen in prod
      expect(res).toBe("안녕하\n세요こ\nんにち\nは世界\nｺﾝﾆ\nﾁハ你\n好");
    });

    it("should handle a combination of CJK, latin, emojis and whitespaces", () => {
      const text = `a醫 醫      bb  你好  world-i-😀🗺🔥`;

      const maxWidth = 150;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe(`a醫 醫      bb  你\n好  world-i-😀🗺\n🔥`);

      const maxWidth2 = 50;
      const res2 = wrapText(text, font, maxWidth2);
      expect(res2).toBe(`a醫 醫\nbb  你\n好\nworld\n-i-😀\n🗺🔥`);

      const maxWidth3 = 30;
      const res3 = wrapText(text, font, maxWidth3);
      expect(res3).toBe(`a醫\n醫\nbb\n你好\nwor\nld-\ni-\n😀\n🗺\n🔥`);
    });

    it("should break before and after a regular CJK character", () => {
      const text = "HelloたWorld";
      const maxWidth1 = 50;
      const res1 = wrapText(text, font, maxWidth1);
      expect(res1).toBe("Hello\nた\nWorld");

      const maxWidth2 = 60;
      const res2 = wrapText(text, font, maxWidth2);
      expect(res2).toBe("Helloた\nWorld");
    });

    it("should break before and after certain CJK symbols", () => {
      const text = "こんにちは〃世界";
      const maxWidth1 = 50;
      const res1 = wrapText(text, font, maxWidth1);
      expect(res1).toBe("こんにちは\n〃世界");

      const maxWidth2 = 60;
      const res2 = wrapText(text, font, maxWidth2);
      expect(res2).toBe("こんにちは〃\n世界");
    });

    it("should break after, not before for certain CJK pairs", () => {
      const text = "Hello た。";
      const maxWidth = 70;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe("Hello\nた。");
    });

    it("should break before, not after for certain CJK pairs", () => {
      const text = "Hello「たWorld」";
      const maxWidth = 60;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe("Hello\n「た\nWorld」");
    });

    it("should break after, not before for certain CJK character pairs", () => {
      const text = "「Helloた」World";
      const maxWidth = 70;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe("「Hello\nた」World");
    });

    it("should break Chinese sentences", () => {
      const text = `中国你好！这是一个测试。
我们来看看：人民币¥1234「很贵」
（括号）、逗号，句号。空格 换行　全角符号…—`;

      const maxWidth1 = 80;
      const res1 = wrapText(text, font, maxWidth1);
      expect(res1).toBe(`中国你好！这是一\n个测试。
我们来看看：人民\n币¥1234「很\n贵」
（括号）、逗号，\n句号。空格 换行\n全角符号…—`);

      const maxWidth2 = 50;
      const res2 = wrapText(text, font, maxWidth2);
      expect(res2).toBe(`中国你好！\n这是一个测\n试。
我们来看\n看：人民币\n¥1234\n「很贵」
（括号）、\n逗号，句\n号。空格\n换行　全角\n符号…—`);
    });

    it("should break Japanese sentences", () => {
      const text = `日本こんにちは！これはテストです。
  見てみましょう：円￥1234「高い」
  （括弧）、読点、句点。
  空白 改行　全角記号…ー`;

      const maxWidth1 = 80;
      const res1 = wrapText(text, font, maxWidth1);
      expect(res1).toBe(`日本こんにちは！\nこれはテストで\nす。
  見てみましょ\nう：円￥1234\n「高い」
  （括弧）、読\n点、句点。
  空白 改行\n全角記号…ー`);

      const maxWidth2 = 50;
      const res2 = wrapText(text, font, maxWidth2);
      expect(res2).toBe(`日本こんに\nちは！これ\nはテストで\nす。
  見てみ\nましょう：\n円\n￥1234\n「高い」
  （括\n弧）、読\n点、句点。
  空白\n改行　全角\n記号…ー`);
    });

    it("should break Korean sentences", () => {
      const text = `한국 안녕하세요! 이것은 테스트입니다.
우리 보자: 원화₩1234「비싸다」
(괄호), 쉼표, 마침표.
공백 줄바꿈　전각기호…—`;

      const maxWidth1 = 80;
      const res1 = wrapText(text, font, maxWidth1);
      expect(res1).toBe(`한국 안녕하세\n요! 이것은 테\n스트입니다.
우리 보자: 원\n화₩1234「비\n싸다」
(괄호), 쉼\n표, 마침표.
공백 줄바꿈　전\n각기호…—`);

      const maxWidth2 = 60;
      const res2 = wrapText(text, font, maxWidth2);
      expect(res2).toBe(`한국 안녕하\n세요! 이것\n은 테스트입\n니다.
우리 보자:\n원화\n₩1234\n「비싸다」
(괄호),\n쉼표, 마침\n표.
공백 줄바꿈\n전각기호…—`);
    });
  });

  describe("When text contains leading whitespaces", () => {
    const text = "  \t   Hello world";

    it("should preserve leading whitespaces", () => {
      const maxWidth = 120;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe("  \t   Hello\nworld");
    });

    it("should break and collapse leading whitespaces when line breaks", () => {
      const maxWidth = 60;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe("\nHello\nworld");
    });

    it("should break and collapse leading whitespaces when words break", () => {
      const maxWidth = 30;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe("\nHel\nlo\nwor\nld");
    });
  });

  describe("When text contains trailing whitespaces", () => {
    it("shouldn't add new lines for trailing spaces", () => {
      const text = "Hello whats up     ";
      const maxWidth = 190;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe(text);
    });

    it("should ignore trailing whitespaces when line breaks", () => {
      const text = "Hippopotomonstrosesquippedaliophobia        ??????";
      const maxWidth = 400;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe("Hippopotomonstrosesquippedaliophobia\n??????");
    });

    it("should not ignore trailing whitespaces when word breaks", () => {
      const text = "Hippopotomonstrosesquippedaliophobia        ??????";
      const maxWidth = 300;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe("Hippopotomonstrosesquippedalio\nphobia        ??????");
    });

    it("should ignore trailing whitespaces when word breaks and line breaks", () => {
      const text = "Hippopotomonstrosesquippedaliophobia        ??????";
      const maxWidth = 180;
      const res = wrapText(text, font, maxWidth);
      expect(res).toBe("Hippopotomonstrose\nsquippedaliophobia\n??????");
    });
  });

  describe("When text doesn't contain new lines", () => {
    const text = "Hello whats up";

    [
      {
        desc: "break all words when width of each word is less than container width",
        width: 70,
        res: `Hello\nwhats\nup`,
      },
      {
        desc: "break all characters when width of each character is less than container width",
        width: 15,
        res: `H\ne\nl\nl\no\nw\nh\na\nt\ns\nu\np`,
      },
      {
        desc: "break words as per the width",

        width: 130,
        res: `Hello whats\nup`,
      },
      {
        desc: "fit the container",

        width: 240,
        res: "Hello whats up",
      },
      {
        desc: "push the word if its equal to max width",
        width: 50,
        res: `Hello\nwhats\nup`,
      },
    ].forEach((data) => {
      it(`should ${data.desc}`, () => {
        const res = wrapText(text, font, data.width);
        expect(res).toEqual(data.res);
      });
    });
  });

  describe("When text contain new lines", () => {
    const text = `Hello\n  whats up`;
    [
      {
        desc: "break all words when width of each word is less than container width",
        width: 70,
        res: `Hello\n  whats\nup`,
      },
      {
        desc: "break all characters when width of each character is less than container width",
        width: 15,
        res: `H\ne\nl\nl\no\n\nw\nh\na\nt\ns\nu\np`,
      },
      {
        desc: "break words as per the width",
        width: 140,
        res: `Hello\n  whats up`,
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
        width: 160,
        res: `hellolongtextthi\nsiswhatsupwithyo\nuIamtypingggggan\ndtypinggg break\nit now`,
      },
      {
        desc: "fit characters of long string as per container width and break words as per the width",

        width: 120,
        res: `hellolongtex\ntthisiswhats\nupwithyouIam\ntypingggggan\ndtypinggg\nbreak it now`,
      },
      {
        desc: "fit the long text when container width is greater than text length and move the rest to next line",

        width: 590,
        res: `hellolongtextthisiswhatsupwithyouIamtypingggggandtypinggg\nbreak it now`,
      },
    ].forEach((data) => {
      it(`should ${data.desc}`, () => {
        const res = wrapText(text, font, data.width);
        expect(res).toEqual(data.res);
      });
    });
  });

  describe("Test parseTokens", () => {
    it("should tokenize latin", () => {
      let text = "Excalidraw is a virtual collaborative whiteboard";

      expect(parseTokens(text)).toEqual([
        "Excalidraw",
        " ",
        "is",
        " ",
        "a",
        " ",
        "virtual",
        " ",
        "collaborative",
        " ",
        "whiteboard",
      ]);

      text =
        "Wikipedia is hosted by Wikimedia- Foundation, a non-profit organization that also hosts a range-of other projects";
      expect(parseTokens(text)).toEqual([
        "Wikipedia",
        " ",
        "is",
        " ",
        "hosted",
        " ",
        "by",
        " ",
        "Wikimedia-",
        " ",
        "Foundation,",
        " ",
        "a",
        " ",
        "non-",
        "profit",
        " ",
        "organization",
        " ",
        "that",
        " ",
        "also",
        " ",
        "hosts",
        " ",
        "a",
        " ",
        "range-",
        "of",
        " ",
        "other",
        " ",
        "projects",
      ]);
    });

    it("should not tokenize number", () => {
      const text = "99,100.99";
      const tokens = parseTokens(text);
      expect(tokens).toEqual(["99,100.99"]);
    });

    it("should tokenize joined emojis", () => {
      const text = `😬🌍🗺🔥☂️👩🏽‍🦰👨‍👩‍👧‍👦👩🏾‍🔬🏳️‍🌈🧔‍♀️🧑‍🤝‍🧑🙅🏽‍♂️✅0️⃣🇨🇿🦅`;
      const tokens = parseTokens(text);

      expect(tokens).toEqual([
        "😬",
        "🌍",
        "🗺",
        "🔥",
        "☂️",
        "👩🏽‍🦰",
        "👨‍👩‍👧‍👦",
        "👩🏾‍🔬",
        "🏳️‍🌈",
        "🧔‍♀️",
        "🧑‍🤝‍🧑",
        "🙅🏽‍♂️",
        "✅",
        "0️⃣",
        "🇨🇿",
        "🦅",
      ]);
    });

    it("should tokenize emojis mixed with mixed text", () => {
      const text = `😬a🌍b🗺c🔥d☂️《👩🏽‍🦰》👨‍👩‍👧‍👦德👩🏾‍🔬こ🏳️‍🌈안🧔‍♀️g🧑‍🤝‍🧑h🙅🏽‍♂️e✅f0️⃣g🇨🇿10🦅#hash`;
      const tokens = parseTokens(text);

      expect(tokens).toEqual([
        "😬",
        "a",
        "🌍",
        "b",
        "🗺",
        "c",
        "🔥",
        "d",
        "☂️",
        "《",
        "👩🏽‍🦰",
        "》",
        "👨‍👩‍👧‍👦",
        "德",
        "👩🏾‍🔬",
        "こ",
        "🏳️‍🌈",
        "안",
        "🧔‍♀️",
        "g",
        "🧑‍🤝‍🧑",
        "h",
        "🙅🏽‍♂️",
        "e",
        "✅",
        "f0️⃣g", // bummer, but ok, as we traded kecaps not breaking (less common) for hash and numbers not breaking (more common)
        "🇨🇿",
        "10", // nice! do not break the number, as it's by default matched by \p{Emoji}
        "🦅",
        "#hash", // nice! do not break the hash, as it's by default matched by \p{Emoji}
      ]);
    });

    it("should tokenize decomposed chars into their composed variants", () => {
      // each input character is in a decomposed form
      const text = "čでäぴέ다й한";
      expect(text.normalize("NFC").length).toEqual(8);
      expect(text).toEqual(text.normalize("NFD"));

      const tokens = parseTokens(text);
      expect(tokens.length).toEqual(8);
      expect(tokens).toEqual(["č", "で", "ä", "ぴ", "έ", "다", "й", "한"]);
    });

    it("should tokenize artificial CJK", () => {
      const text = `《道德經》醫-醫こんにちは世界！안녕하세요세계；요』,다.다...원/달(((다)))[[1]]〚({((한))>)〛(「た」)た…[Hello] \t　World？ニューヨーク・￥3700.55す。090-1234-5678￥1,000〜＄5,000「素晴らしい！」〔重要〕＃１：Taro君30％は、（たなばた）〰￥110±￥570で20℃〜9:30〜10:00【一番】`;
      // [
      //   '《道',      '德',        '經》',           '醫-',
      //   '醫',        'こ',        'ん',             'に',
      //   'ち',        'は',        '世',             '界！',
      //   '안',        '녕',        '하',             '세',
      //   '요',        '세',        '계；',           '요』,',
      //   '다.',       '다...',     '원/',            '달',
      //   '(((다)))',  '[[1]]',     '〚({((한))>)〛', '(「た」)',
      //   'た…',       '[Hello]',   ' ',              '\t',
      //   '　',        'World？',   'ニ',             'ュ',
      //   'ー',        'ヨ',        'ー',             'ク・',
      //   '￥3700.55', 'す。',      '090-',           '1234-',
      //   '5678',      '￥1,000〜', '＄5,000',        '「素',
      //   '晴',        'ら',        'し',             'い！」',
      //   '〔重',      '要〕',      '＃',             '１：',
      //   'Taro',      '君',        '30％',           'は、',
      //   '（た',      'な',        'ば',             'た）',
      //   '〰',        '￥110±',    '￥570',          'で',
      //   '20℃〜',     '9:30〜',    '10:00',          '【一',
      //   '番】'
      // ]
      const tokens = parseTokens(text);

      // Latin
      expect(tokens).toContain("[[1]]");
      expect(tokens).toContain("[Hello]");
      expect(tokens).toContain("World？");
      expect(tokens).toContain("Taro");

      // Chinese
      expect(tokens).toContain("《道");
      expect(tokens).toContain("德");
      expect(tokens).toContain("經》");
      expect(tokens).toContain("醫-");
      expect(tokens).toContain("醫");

      // Japanese
      expect(tokens).toContain("こ");
      expect(tokens).toContain("ん");
      expect(tokens).toContain("に");
      expect(tokens).toContain("ち");
      expect(tokens).toContain("は");
      expect(tokens).toContain("世");
      expect(tokens).toContain("ク・");
      expect(tokens).toContain("界！");
      expect(tokens).toContain("た…");
      expect(tokens).toContain("す。");
      expect(tokens).toContain("ュ");
      expect(tokens).toContain("「素");
      expect(tokens).toContain("晴");
      expect(tokens).toContain("ら");
      expect(tokens).toContain("し");
      expect(tokens).toContain("い！」");
      expect(tokens).toContain("君");
      expect(tokens).toContain("は、");
      expect(tokens).toContain("（た");
      expect(tokens).toContain("な");
      expect(tokens).toContain("ば");
      expect(tokens).toContain("た）");
      expect(tokens).toContain("で");
      expect(tokens).toContain("【一");
      expect(tokens).toContain("番】");

      // Check for Korean
      expect(tokens).toContain("안");
      expect(tokens).toContain("녕");
      expect(tokens).toContain("하");
      expect(tokens).toContain("세");
      expect(tokens).toContain("요");
      expect(tokens).toContain("세");
      expect(tokens).toContain("계；");
      expect(tokens).toContain("요』,");
      expect(tokens).toContain("다.");
      expect(tokens).toContain("다...");
      expect(tokens).toContain("원/");
      expect(tokens).toContain("달");
      expect(tokens).toContain("(((다)))");
      expect(tokens).toContain("〚({((한))>)〛");
      expect(tokens).toContain("(「た」)");

      // Numbers and units
      expect(tokens).toContain("￥3700.55");
      expect(tokens).toContain("090-");
      expect(tokens).toContain("1234-");
      expect(tokens).toContain("5678");
      expect(tokens).toContain("￥1,000〜");
      expect(tokens).toContain("＄5,000");
      expect(tokens).toContain("１：");
      expect(tokens).toContain("30％");
      expect(tokens).toContain("￥110±");
      expect(tokens).toContain("20℃〜");
      expect(tokens).toContain("9:30〜");
      expect(tokens).toContain("10:00");

      // Punctuation and symbols
      expect(tokens).toContain(" ");
      expect(tokens).toContain("\t");
      expect(tokens).toContain("　");
      expect(tokens).toContain("ニ");
      expect(tokens).toContain("ー");
      expect(tokens).toContain("ヨ");
      expect(tokens).toContain("〰");
      expect(tokens).toContain("＃");
    });
  });
});
