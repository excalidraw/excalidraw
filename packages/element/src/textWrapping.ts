import { isDevEnv, isTestEnv } from "@excalidraw/common";

import { charWidth, getLineWidth } from "./textMeasurements";

import type { FontString } from "./types";

let cachedCjkRegex: RegExp | undefined;
let cachedLineBreakRegex: RegExp | undefined;
let cachedEmojiRegex: RegExp | undefined;

/**
 * Test if a given text contains any CJK characters (including symbols, punctuation, etc,).
 */
export const containsCJK = (text: string) => {
  if (!cachedCjkRegex) {
    cachedCjkRegex = Regex.class(...Object.values(CJK));
  }

  return cachedCjkRegex.test(text);
};

const getLineBreakRegex = () => {
  if (!cachedLineBreakRegex) {
    try {
      cachedLineBreakRegex = getLineBreakRegexAdvanced();
    } catch {
      cachedLineBreakRegex = getLineBreakRegexSimple();
    }
  }

  return cachedLineBreakRegex;
};

const getEmojiRegex = () => {
  if (!cachedEmojiRegex) {
    cachedEmojiRegex = getEmojiRegexUnicode();
  }

  return cachedEmojiRegex;
};

/**
 * Common symbols used across different languages.
 */
const COMMON = {
  /**
   * Natural breaking points for any grammars.
   *
   * Hello world
   *      ↑ BREAK ALWAYS " " → ["Hello", " ", "world"]
   * Hello-world
   *       ↑ BREAK AFTER "-" → ["Hello-", "world"]
   */
  WHITESPACE: /\s/u,
  HYPHEN: /-/u,
  /**
   * Generally do not break, unless closed symbol is followed by an opening symbol.
   *
   * Also, western punctation is often used in modern Korean and expects to be treated
   * similarly to the CJK opening and closing symbols.
   *
   * Hello(한글)→ ["Hello", "(한", "글)"]
   *      ↑ BREAK BEFORE "("
   *          ↑ BREAK AFTER ")"
   */
  OPENING: /<\(\[\{/u,
  CLOSING: />\)\]\}.,:;!\?…\//u,
};

/**
 * Characters and symbols used in Chinese, Japanese and Korean.
 */
const CJK = {
  /**
   * Every CJK breaks before and after, unless it's paired with an opening or closing symbol.
   *
   * Does not include every possible char used in CJK texts, such as currency, parentheses or punctuation.
   */
  CHAR: /\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}｀＇＾〃〰〆＃＆＊＋－ー／＼＝｜￤〒￢￣/u,
  /**
   * Opening and closing CJK punctuation breaks before and after all such characters (in case of many),
   * and creates pairs with neighboring characters.
   *
   * Hello た。→ ["Hello", "た。"]
   *        ↑ DON'T BREAK "た。"
   * * Hello「た」 World → ["Hello", "「た」", "World"]
   *       ↑ DON'T BREAK "「た"
   *        ↑ DON'T BREAK "た"
   *      ↑ BREAK BEFORE "「"
   *         ↑ BREAK AFTER "」"
   */
  // eslint-disable-next-line prettier/prettier
  OPENING:/（［｛〈《｟｢「『【〖〔〘〚＜〝/u,
  CLOSING: /）］｝〉》｠｣」』】〗〕〙〛＞。．，、〟‥？！：；・〜〞/u,
  /**
   * Currency symbols break before, not after
   *
   * Price￥100 → ["Price", "￥100"]
   *      ↑ BREAK BEFORE "￥"
   */
  CURRENCY: /￥￦￡￠＄/u,
};

const EMOJI = {
  FLAG: /\p{RI}\p{RI}/u,
  JOINER:
    /(?:\p{Emoji_Modifier}|\uFE0F\u20E3?|[\u{E0020}-\u{E007E}]+\u{E007F})?/u,
  ZWJ: /\u200D/u,
  ANY: /[\p{Emoji}]/u,
  MOST: /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u,
};

/**
 * Simple fallback for browsers (mainly Safari < 16.4) that don't support "Lookbehind assertion".
 *
 * Browser support as of 10/2024:
 * - 91% Lookbehind assertion https://caniuse.com/mdn-javascript_regular_expressions_lookbehind_assertion
 * - 94% Unicode character class escape https://caniuse.com/mdn-javascript_regular_expressions_unicode_character_class_escape
 *
 * Does not include advanced CJK breaking rules, but covers most of the core cases, especially for latin.
 */
const getLineBreakRegexSimple = () =>
  Regex.or(
    getEmojiRegex(),
    Break.On(COMMON.HYPHEN, COMMON.WHITESPACE, CJK.CHAR),
  );

/**
 * Specifies the line breaking rules based for alphabetic-based languages,
 * Chinese, Japanese, Korean and Emojis.
 *
 * "Hello-world" → ["Hello-", "world"]
 * "Hello 「世界。」🌎🗺" → ["Hello", " ", "「世", "界。」", "🌎", "🗺"]
 */
const getLineBreakRegexAdvanced = () =>
  Regex.or(
    // Unicode-defined regex for (multi-codepoint) Emojis
    getEmojiRegex(),
    // Rules for whitespace and hyphen
    Break.Before(COMMON.WHITESPACE).Build(),
    Break.After(COMMON.WHITESPACE, COMMON.HYPHEN).Build(),
    // Rules for CJK (chars, symbols, currency)
    Break.Before(CJK.CHAR, CJK.CURRENCY)
      .NotPrecededBy(COMMON.OPENING, CJK.OPENING)
      .Build(),
    Break.After(CJK.CHAR)
      .NotFollowedBy(COMMON.HYPHEN, COMMON.CLOSING, CJK.CLOSING)
      .Build(),
    // Rules for opening and closing punctuation
    Break.BeforeMany(CJK.OPENING).NotPrecededBy(COMMON.OPENING).Build(),
    Break.AfterMany(CJK.CLOSING).NotFollowedBy(COMMON.CLOSING).Build(),
    Break.AfterMany(COMMON.CLOSING).FollowedBy(COMMON.OPENING).Build(),
  );

/**
 * Matches various emoji types.
 *
 * 1. basic emojis (😀, 🌍)
 * 2. flags (🇨🇿)
 * 3. multi-codepoint emojis:
 *    - skin tones (👍🏽)
 *    - variation selectors (☂️)
 *    - keycaps (1️⃣)
 *    - tag sequences (🏴󠁧󠁢󠁥󠁮󠁧󠁿)
 *    - emoji sequences (👨‍👩‍👧‍👦, 👩‍🚀, 🏳️‍🌈)
 *
 * Unicode points:
 * - \uFE0F: presentation selector
 * - \u20E3: enclosing keycap
 * - \u200D: zero width joiner
 * - \u{E0020}-\u{E007E}: tags
 * - \u{E007F}: cancel tag
 *
 * @see https://unicode.org/reports/tr51/#EBNF_and_Regex, with changes:
 * - replaced \p{Emoji} with [\p{Extended_Pictographic}\p{Emoji_Presentation}], see more in `should tokenize emojis mixed with mixed text` test
 * - replaced \p{Emod} with \p{Emoji_Modifier} as some engines do not understand the abbreviation (i.e. https://devina.io/redos-checker)
 */
const getEmojiRegexUnicode = () =>
  Regex.group(
    Regex.or(
      EMOJI.FLAG,
      Regex.and(
        EMOJI.MOST,
        EMOJI.JOINER,
        Regex.build(
          `(?:${EMOJI.ZWJ.source}(?:${EMOJI.FLAG.source}|${EMOJI.ANY.source}${EMOJI.JOINER.source}))*`,
        ),
      ),
    ),
  );

/**
 * Regex utilities for unicode character classes.
 */
const Regex = {
  /**
   * Builds a regex from a string.
   */
  build: (regex: string): RegExp => new RegExp(regex, "u"),
  /**
   * Joins regexes into a single string.
   */
  join: (...regexes: RegExp[]): string => regexes.map((x) => x.source).join(""),
  /**
   * Joins regexes into a single regex as with "and" operator.
   */
  and: (...regexes: RegExp[]): RegExp => Regex.build(Regex.join(...regexes)),
  /**
   * Joins regexes into a single regex with "or" operator.
   */
  or: (...regexes: RegExp[]): RegExp =>
    Regex.build(regexes.map((x) => x.source).join("|")),
  /**
   * Puts regexes into a matching group.
   */
  group: (...regexes: RegExp[]): RegExp =>
    Regex.build(`(${Regex.join(...regexes)})`),
  /**
   * Puts regexes into a character class.
   */
  class: (...regexes: RegExp[]): RegExp =>
    Regex.build(`[${Regex.join(...regexes)}]`),
};

/**
 * Human-readable lookahead and lookbehind utilities for defining line break
 * opportunities between pairs of character classes.
 */
const Break = {
  /**
   * Break on the given class of characters.
   */
  On: (...regexes: RegExp[]) => {
    const joined = Regex.join(...regexes);
    return Regex.build(`([${joined}])`);
  },
  /**
   * Break before the given class of characters.
   */
  Before: (...regexes: RegExp[]) => {
    const joined = Regex.join(...regexes);
    const builder = () => Regex.build(`(?=[${joined}])`);
    return Break.Chain(builder) as Omit<
      ReturnType<typeof Break.Chain>,
      "FollowedBy"
    >;
  },
  /**
   * Break after the given class of characters.
   */
  After: (...regexes: RegExp[]) => {
    const joined = Regex.join(...regexes);
    const builder = () => Regex.build(`(?<=[${joined}])`);
    return Break.Chain(builder) as Omit<
      ReturnType<typeof Break.Chain>,
      "PreceededBy"
    >;
  },
  /**
   * Break before one or multiple characters of the same class.
   */
  BeforeMany: (...regexes: RegExp[]) => {
    const joined = Regex.join(...regexes);
    const builder = () => Regex.build(`(?<![${joined}])(?=[${joined}])`);
    return Break.Chain(builder) as Omit<
      ReturnType<typeof Break.Chain>,
      "FollowedBy"
    >;
  },
  /**
   * Break after one or multiple character from the same class.
   */
  AfterMany: (...regexes: RegExp[]) => {
    const joined = Regex.join(...regexes);
    const builder = () => Regex.build(`(?<=[${joined}])(?![${joined}])`);
    return Break.Chain(builder) as Omit<
      ReturnType<typeof Break.Chain>,
      "PreceededBy"
    >;
  },
  /**
   * Do not break before the given class of characters.
   */
  NotBefore: (...regexes: RegExp[]) => {
    const joined = Regex.join(...regexes);
    const builder = () => Regex.build(`(?![${joined}])`);
    return Break.Chain(builder) as Omit<
      ReturnType<typeof Break.Chain>,
      "NotFollowedBy"
    >;
  },
  /**
   * Do not break after the given class of characters.
   */
  NotAfter: (...regexes: RegExp[]) => {
    const joined = Regex.join(...regexes);
    const builder = () => Regex.build(`(?<![${joined}])`);
    return Break.Chain(builder) as Omit<
      ReturnType<typeof Break.Chain>,
      "NotPrecededBy"
    >;
  },
  Chain: (rootBuilder: () => RegExp) => ({
    /**
     * Build the root regex.
     */
    Build: rootBuilder,
    /**
     * Specify additional class of characters that should precede the root regex.
     */
    PreceededBy: (...regexes: RegExp[]) => {
      const root = rootBuilder();
      const preceeded = Break.After(...regexes).Build();
      const builder = () => Regex.and(preceeded, root);
      return Break.Chain(builder) as Omit<
        ReturnType<typeof Break.Chain>,
        "PreceededBy"
      >;
    },
    /**
     * Specify additional class of characters that should follow the root regex.
     */
    FollowedBy: (...regexes: RegExp[]) => {
      const root = rootBuilder();
      const followed = Break.Before(...regexes).Build();
      const builder = () => Regex.and(root, followed);
      return Break.Chain(builder) as Omit<
        ReturnType<typeof Break.Chain>,
        "FollowedBy"
      >;
    },
    /**
     * Specify additional class of characters that should not precede the root regex.
     */
    NotPrecededBy: (...regexes: RegExp[]) => {
      const root = rootBuilder();
      const notPreceeded = Break.NotAfter(...regexes).Build();
      const builder = () => Regex.and(notPreceeded, root);
      return Break.Chain(builder) as Omit<
        ReturnType<typeof Break.Chain>,
        "NotPrecededBy"
      >;
    },
    /**
     * Specify additional class of characters that should not follow the root regex.
     */
    NotFollowedBy: (...regexes: RegExp[]) => {
      const root = rootBuilder();
      const notFollowed = Break.NotBefore(...regexes).Build();
      const builder = () => Regex.and(root, notFollowed);
      return Break.Chain(builder) as Omit<
        ReturnType<typeof Break.Chain>,
        "NotFollowedBy"
      >;
    },
  }),
};

/**
 * Breaks the line into the tokens based on the found line break opporutnities.
 */
export const parseTokens = (line: string) => {
  const breakLineRegex = getLineBreakRegex();

  // normalizing to single-codepoint composed chars due to canonical equivalence
  // of multi-codepoint versions for chars like č, で (~ so that we don't break a line in between c and ˇ)
  // filtering due to multi-codepoint chars like 👨‍👩‍👧‍👦, 👩🏽‍🦰
  return line.normalize("NFC").split(breakLineRegex).filter(Boolean);
};

/**
 * Wraps the original text into the lines based on the given width.
 */
export const wrapText = (
  text: string,
  font: FontString,
  maxWidth: number,
): string => {
  // if maxWidth is not finite or NaN which can happen in case of bugs in
  // computation, we need to make sure we don't continue as we'll end up
  // in an infinite loop
  if (!Number.isFinite(maxWidth) || maxWidth < 0) {
    return text;
  }

  const lines: Array<string> = [];
  const originalLines = text.split("\n");

  for (const originalLine of originalLines) {
    const currentLineWidth = getLineWidth(originalLine, font);

    if (currentLineWidth <= maxWidth) {
      lines.push(originalLine);
      continue;
    }

    const wrappedLine = wrapLine(originalLine, font, maxWidth);
    lines.push(...wrappedLine);
  }

  return lines.join("\n");
};

export const wrapTextPreservingWhitespace = (
  text: string,
  font: FontString,
  maxWidth: number,
): string => {
  if (!Number.isFinite(maxWidth) || maxWidth < 0) {
    return text;
  }

  const lines: Array<string> = [];
  const originalLines = text.split("\n");

  for (const originalLine of originalLines) {
    const currentLineWidth = getLineWidth(originalLine, font);

    if (currentLineWidth <= maxWidth) {
      lines.push(originalLine);
      continue;
    }

    const wrappedLine = wrapLinePreservingWhitespace(
      originalLine,
      font,
      maxWidth,
    );
    lines.push(...wrappedLine);
  }

  return lines.join("\n");
};

let domWrapElement: HTMLDivElement | null = null;

const canUseDomTextWrapping = () => {
  if (isTestEnv()) {
    return false;
  }
  if (typeof document === "undefined") {
    return false;
  }
  if (!document.body) {
    return false;
  }
  if (typeof document.createRange !== "function") {
    return false;
  }
  return true;
};

const getDomWrapElement = () => {
  if (domWrapElement && domWrapElement.isConnected) {
    return domWrapElement;
  }

  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    visibility: "hidden",
    pointerEvents: "none",
    padding: "0px",
    margin: "0px",
    border: "0px",
    boxSizing: "content-box",
    overflow: "hidden",
    overflowWrap: "break-word",
    wordBreak: "break-word",
  } as Partial<CSSStyleDeclaration>);

  document.body.appendChild(el);
  domWrapElement = el;
  return el;
};

const wrapTextPreservingWhitespaceWithExplicitNewlineMarkersUsingDom = (
  text: string,
  font: FontString,
  maxWidth: number,
): { lines: string[]; explicitNewlineAfterLine: boolean[] } => {
  const normalizedText = text.replace(/\r\n?/g, "\n");

  if (!Number.isFinite(maxWidth) || maxWidth < 0) {
    const originalLines = normalizedText.split("\n");
    return {
      lines: originalLines,
      explicitNewlineAfterLine: originalLines.map(
        (_line, index) => index < originalLines.length - 1,
      ),
    };
  }

  const el = getDomWrapElement();
  el.style.font = font;
  el.style.width = `${maxWidth}px`;

  const supportsBreakSpaces =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("white-space", "break-spaces");

  el.style.whiteSpace = supportsBreakSpaces ? "break-spaces" : "pre-wrap";

  el.textContent = normalizedText;

  const textNode = el.firstChild as Text | null;
  if (!textNode) {
    return { lines: [""], explicitNewlineAfterLine: [false] };
  }

  const codepoints: Array<{ ch: string; start: number; end: number }> = [];
  let offset = 0;
  for (const ch of normalizedText) {
    const start = offset;
    offset += ch.length;
    codepoints.push({ ch, start, end: offset });
  }

  const lines: string[] = [];
  const explicitNewlineAfterLine: boolean[] = [];

  let buffer = "";
  let currentTop: number | null = null;

  for (const { ch, start, end } of codepoints) {
    if (ch === "\n") {
      lines.push(buffer);
      explicitNewlineAfterLine.push(true);
      buffer = "";
      currentTop = null;
      continue;
    }

    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const rect = range.getBoundingClientRect();
    const top = Math.round(rect.top);

    if (currentTop === null) {
      currentTop = top;
      buffer += ch;
      continue;
    }

    if (top !== currentTop) {
      lines.push(buffer);
      explicitNewlineAfterLine.push(false);
      buffer = ch;
      currentTop = top;
      continue;
    }

    buffer += ch;
  }

  lines.push(buffer);
  explicitNewlineAfterLine.push(false);

  return { lines, explicitNewlineAfterLine };
};

export const wrapTextPreservingWhitespaceWithExplicitNewlineMarkers = (
  text: string,
  font: FontString,
  maxWidth: number,
): { lines: string[]; explicitNewlineAfterLine: boolean[] } => {
  // 说明：
  // - `wrapTextPreservingWhitespace()` 会把“软换行”(自动换行)转换成多行输出（通过插入 `\n` 分隔行），
  //   这在绘制文本是正确的，但在可视化“换行符(↵)”时会产生误判：
  //   软换行并不存在真实的 `\n`，因此不应该显示换行符提示。
  // - 这里返回两份信息：
  //   1) `lines`：用于渲染的最终行（包含软换行拆分出的行）
  //   2) `explicitNewlineAfterLine`：仅当该行后面跟着“真实输入的 \n”时为 true
  //
  // 这样渲染层可以做到：
  // - 文本照常自动换行
  // - 仅在用户真实输入的换行处显示 ↵（不会在自动换行处显示）

  if (canUseDomTextWrapping()) {
    return wrapTextPreservingWhitespaceWithExplicitNewlineMarkersUsingDom(
      text,
      font,
      maxWidth,
    );
  }

  const normalizedText = text.replace(/\r\n?/g, "\n");

  // maxWidth 不可用时，按原文逐行返回，但仍需标记真实换行位置
  if (!Number.isFinite(maxWidth) || maxWidth < 0) {
    const originalLines = normalizedText.split("\n");
    return {
      lines: originalLines,
      explicitNewlineAfterLine: originalLines.map(
        (_line, index) => index < originalLines.length - 1,
      ),
    };
  }

  const lines: string[] = [];
  const explicitNewlineAfterLine: boolean[] = [];
  const originalLines = normalizedText.split("\n");

  for (
    let originalLineIndex = 0;
    originalLineIndex < originalLines.length;
    originalLineIndex++
  ) {
    const originalLine = originalLines[originalLineIndex];
    const currentLineWidth = getLineWidth(originalLine, font);

    const wrappedLines =
      currentLineWidth <= maxWidth
        ? [originalLine]
        : wrapLinePreservingWhitespace(originalLine, font, maxWidth);

    for (const line of wrappedLines) {
      lines.push(line);
      explicitNewlineAfterLine.push(false);
    }

    // 原文每个 `\n` 会把文本分成 originalLines；除最后一段外，段末必有一个真实换行符。
    // 真实换行符应该渲染在“该段最后一行”的末尾，而不是段内的软换行行尾。
    if (originalLineIndex < originalLines.length - 1) {
      explicitNewlineAfterLine[explicitNewlineAfterLine.length - 1] = true;
    }
  }

  return { lines, explicitNewlineAfterLine };
};

/**
 * Wraps the original line into the lines based on the given width.
 */
const wrapLine = (
  line: string,
  font: FontString,
  maxWidth: number,
): string[] => {
  const lines: Array<string> = [];
  const tokens = parseTokens(line);
  const tokenIterator = tokens[Symbol.iterator]();

  let currentLine = "";
  let currentLineWidth = 0;

  let iterator = tokenIterator.next();

  while (!iterator.done) {
    const token = iterator.value;
    const testLine = currentLine + token;

    // cache single codepoint whitespace, CJK or emoji width calc. as kerning should not apply here
    const testLineWidth = isSingleCharacter(token)
      ? currentLineWidth + charWidth.calculate(token, font)
      : getLineWidth(testLine, font);

    if (testLineWidth <= maxWidth) {
      currentLine = testLine;
      currentLineWidth = testLineWidth;
      iterator = tokenIterator.next();
      continue;
    }

    if (!currentLine) {
      if (/^\s+$/.test(token)) {
        const whitespaceLines = wrapWhitespace(token, font, maxWidth);
        const trailingLine = whitespaceLines[whitespaceLines.length - 1] ?? "";
        const precedingLines = whitespaceLines.slice(0, -1);

        lines.push(...precedingLines);
        currentLine = trailingLine;
        currentLineWidth = getLineWidth(trailingLine, font);
      } else {
        const wrappedWord = wrapWord(token, font, maxWidth);
        const trailingLine = wrappedWord[wrappedWord.length - 1] ?? "";
        const precedingLines = wrappedWord.slice(0, -1);

        lines.push(...precedingLines);
        currentLine = trailingLine;
        currentLineWidth = getLineWidth(trailingLine, font);
      }
      iterator = tokenIterator.next();
    } else {
      // push & reset, but don't iterate on the next token, as we didn't use it yet!
      lines.push(currentLine);

      // purposefully not iterating and not setting `currentLine` to `token`, so that we could use a simple !currentLine check above
      currentLine = "";
      currentLineWidth = 0;
    }
  }

  // iterator done, push the trailing line if exists
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const wrapLinePreservingWhitespace = (
  line: string,
  font: FontString,
  maxWidth: number,
): string[] => {
  const lines: Array<string> = [];
  const tokens = parseTokens(line);
  const tokenIterator = tokens[Symbol.iterator]();

  let currentLine = "";
  let currentLineWidth = 0;

  let iterator = tokenIterator.next();

  while (!iterator.done) {
    const token = iterator.value;
    const testLine = currentLine + token;

    const testLineWidth = isSingleCharacter(token)
      ? currentLineWidth + charWidth.calculate(token, font)
      : getLineWidth(testLine, font);

    if (testLineWidth <= maxWidth) {
      currentLine = testLine;
      currentLineWidth = testLineWidth;
      iterator = tokenIterator.next();
      continue;
    }

    if (!currentLine) {
      if (/^\s+$/.test(token)) {
        const whitespaceLines = wrapWhitespace(token, font, maxWidth);
        const trailingLine = whitespaceLines[whitespaceLines.length - 1] ?? "";
        const precedingLines = whitespaceLines.slice(0, -1);

        lines.push(...precedingLines);
        currentLine = trailingLine;
        currentLineWidth = getLineWidth(trailingLine, font);
        iterator = tokenIterator.next();
      } else {
        const wrappedWord = wrapWord(token, font, maxWidth);
        const trailingLine = wrappedWord[wrappedWord.length - 1] ?? "";
        const precedingLines = wrappedWord.slice(0, -1);

        lines.push(...precedingLines);
        currentLine = trailingLine;
        currentLineWidth = getLineWidth(trailingLine, font);
        iterator = tokenIterator.next();
      }
    } else {
      lines.push(currentLine);
      currentLine = "";
      currentLineWidth = 0;
    }
  }

  if (currentLine !== "") {
    lines.push(currentLine);
  }

  return lines;
};

const wrapWhitespace = (
  whitespace: string,
  font: FontString,
  maxWidth: number,
) => {
  const chars = Array.from(whitespace);
  const lines: Array<string> = [];

  let currentLine = "";
  let currentLineWidth = 0;

  for (const char of chars) {
    const _charWidth = charWidth.calculate(char, font);
    const testLineWidth = currentLineWidth + _charWidth;

    if (testLineWidth <= maxWidth || !currentLine) {
      currentLine = currentLine + char;
      currentLineWidth = testLineWidth;
      continue;
    }

    lines.push(currentLine);
    currentLine = char;
    currentLineWidth = _charWidth;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

/**
 * Wraps the word into the lines based on the given width.
 */
const wrapWord = (
  word: string,
  font: FontString,
  maxWidth: number,
): Array<string> => {
  // multi-codepoint emojis are already broken apart and shouldn't be broken further
  if (getEmojiRegex().test(word)) {
    return [word];
  }

  satisfiesWordInvariant(word);

  const lines: Array<string> = [];
  const chars = Array.from(word);

  let currentLine = "";
  let currentLineWidth = 0;

  for (const char of chars) {
    const _charWidth = charWidth.calculate(char, font);
    const testLineWidth = currentLineWidth + _charWidth;

    if (testLineWidth <= maxWidth) {
      currentLine = currentLine + char;
      currentLineWidth = testLineWidth;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = char;
    currentLineWidth = _charWidth;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

/**
 * Check if the given string is a single character.
 *
 * Handles multi-byte chars (é, 中) and purposefully does not handle multi-codepoint char (👨‍👩‍👧‍👦, 👩🏽‍🦰).
 */
const isSingleCharacter = (maybeSingleCharacter: string) => {
  return (
    maybeSingleCharacter.codePointAt(0) !== undefined &&
    maybeSingleCharacter.codePointAt(1) === undefined
  );
};

/**
 * Invariant for the word wrapping algorithm.
 */
const satisfiesWordInvariant = (word: string) => {
  if (isTestEnv() || isDevEnv()) {
    if (/\s/.test(word)) {
      throw new Error("Word should not contain any whitespaces!");
    }
  }
};
