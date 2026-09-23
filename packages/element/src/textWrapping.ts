import { isDevEnv, isTestEnv } from "@excalidraw/common";

import { charWidth, getLineWidth } from "./textMeasurements";

import type { FontString } from "./types";

/**
 * This module approximates browser-like soft wrapping for Excalidraw text.
 *
 * The flow is:
 * 1. `parseTokens()` splits a hard line into breakable tokens using a unicode-aware regex.
 * 2. `getWrappedTextLines()` reflows each hard line into one or more visual lines and
 *    records where each visual line came from in the source text.
 * 3. `wrapLine()` assembles tokens into lines, and `wrapWord()` handles a single token
 *    that is wider than the available width.
 * 4. `trimLine()` / `trimLineEndAtSoftBreak()` mirror browser behavior around trailing
 *    whitespace so the rendered text stays consistent with what users see on canvas.
 *
 * Mostly, you'll want to use wrapText(). getWrappedTextLines() is for callers
 * that need metadata such as mapping visual lines back to `originalText`
 * for caret placement or future editor features.
 */
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
 *
 * Note: tokenization normalizes to NFC first so decomposed graphemes are treated as
 * their composed variants for wrapping. Any code that needs exact source offsets should
 * keep in mind that this assumes the input text is already NFC-normalized.
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
 *
 * This is a convenience adapter over `getWrappedTextLines()` for call sites
 * that only need the rendered wrapped string and not the source offsets.
 */
export const wrapText = (
  text: string,
  font: FontString,
  maxWidth: number,
): string => {
  return getWrappedTextLines(text, font, maxWidth)
    .map((line) => line.text)
    .join("\n");
};

/**
 * A single rendered visual line produced from the original text.
 *
 * `start` and `end` are end-exclusive code-unit offsets into the original text, and do
 * not include synthetic soft line breaks inserted by this module. If trailing whitespace
 * was trimmed away at a wrap boundary, `end` points to the last rendered character.
 */
export type WrappedTextLine = {
  text: string;
  start: number;
  end: number;
};

/**
 * Splits only on existing hard line breaks and preserves original offsets.
 */
const getHardLineBreaks = (text: string): WrappedTextLine[] => {
  let offset = 0;

  return text.split("\n").map((line) => {
    const start = offset;
    const end = start + line.length;

    offset = end + 1;

    return {
      text: line,
      start,
      end,
    };
  });
};

/**
 * Returns the rendered visual lines together with their source offsets.
 *
 * This is the source-of-truth wrapping pipeline for callers that need more than the
 * final wrapped string, for example caret placement or future editor/rich-text mapping.
 */
export const getWrappedTextLines = (
  text: string,
  font: FontString,
  maxWidth: number,
): WrappedTextLine[] => {
  // if maxWidth is not finite or NaN which can happen in case of bugs in
  // computation, we need to make sure we don't continue as we'll end up
  // in an infinite loop
  if (!Number.isFinite(maxWidth) || maxWidth < 0) {
    return getHardLineBreaks(text);
  }

  const lines: WrappedTextLine[] = [];
  let offset = 0;

  for (const originalLine of text.split("\n")) {
    const originalLineWidth = getLineWidth(originalLine, font);

    if (originalLineWidth <= maxWidth) {
      lines.push({
        text: originalLine,
        start: offset,
        end: offset + originalLine.length,
      });
    } else {
      lines.push(...wrapLine(originalLine, font, maxWidth, offset));
    }

    offset += originalLine.length + 1;
  }

  return lines;
};

/**
 * Wraps a single hard line into one or more visual lines.
 *
 * The line-local offsets are tracked in original-text code units so
 * we can map the visual line back to the source.
 */
const wrapLine = (
  line: string,
  font: FontString,
  maxWidth: number,
  lineStart: number,
): WrappedTextLine[] => {
  const lines: WrappedTextLine[] = [];
  const tokens = parseTokens(line);

  let currentLine = "";
  let currentLineStart = lineStart;
  let currentLineEnd = lineStart;
  let currentLineWidth = 0;
  // Tracks the next token's code-unit position in the original source string.
  let tokenOffset = lineStart;
  let tokenIndex = 0;

  while (tokenIndex < tokens.length) {
    const token = tokens[tokenIndex];
    const tokenStart = tokenOffset;
    const tokenEnd = tokenStart + token.length;
    const testLine = currentLine + token;

    // cache single codepoint whitespace, CJK or emoji width calc. as kerning should not apply here
    const testLineWidth = isSingleCharacter(token)
      ? currentLineWidth + charWidth.calculate(token, font)
      : getLineWidth(testLine, font);

    // build up the current line, skipping length check for possibly trailing whitespaces
    if (/\s/.test(token) || testLineWidth <= maxWidth) {
      if (!currentLine) {
        currentLineStart = tokenStart;
      }
      currentLine = testLine;
      currentLineEnd = tokenEnd;
      currentLineWidth = testLineWidth;
      tokenOffset = tokenEnd;
      tokenIndex++;
      continue;
    }

    // current line is empty => just the token (word) is longer than `maxWidth` and needs to be wrapped
    if (!currentLine) {
      const wrappedWord = wrapWord(token, font, maxWidth, tokenStart);
      const trailingLine = wrappedWord[wrappedWord.length - 1] ?? {
        text: "",
        start: tokenStart,
        end: tokenStart,
      };
      const precedingLines = wrappedWord.slice(0, -1);

      lines.push(...precedingLines);

      // trailing line of the wrapped word might still be joined with next token/s
      currentLine = trailingLine.text;
      currentLineStart = trailingLine.start;
      currentLineEnd = trailingLine.end;
      currentLineWidth = getLineWidth(trailingLine.text, font);
      tokenOffset = tokenEnd;
      tokenIndex++;
    } else {
      // push & reset, but don't iterate on the next token, as we didn't use it yet!
      lines.push(
        trimLineEndAtSoftBreak(currentLine, currentLineStart, currentLineEnd),
      );

      // purposefully not iterating and not setting `currentLine` to `token`, so that we could use a simple !currentLine check above
      currentLine = "";
      currentLineStart = tokenStart;
      currentLineEnd = tokenStart;
      currentLineWidth = 0;
    }
  }

  // iterator done, push the trailing line if exists
  if (currentLine) {
    const trailingLine = trimLine(
      currentLine,
      currentLineStart,
      currentLineEnd,
      font,
      maxWidth,
    );
    lines.push(trailingLine);
  }

  return lines;
};

/**
 * Wraps a single word that could not be placed on an empty line as-is.
 */
const wrapWord = (
  word: string,
  font: FontString,
  maxWidth: number,
  wordStart: number,
): WrappedTextLine[] => {
  // multi-codepoint emojis are already broken apart and shouldn't be broken further
  if (getEmojiRegex().test(word)) {
    return [
      {
        text: word,
        start: wordStart,
        end: wordStart + word.length,
      },
    ];
  }

  satisfiesWordInvariant(word);

  const lines: WrappedTextLine[] = [];
  const chars = Array.from(word);

  let currentLine = "";
  let currentLineStart = wordStart;
  let currentLineEnd = wordStart;
  let currentLineWidth = 0;
  let offset = wordStart;

  for (const char of chars) {
    const charStart = offset;
    const charEnd = charStart + char.length;
    const _charWidth = charWidth.calculate(char, font);
    const testLineWidth = currentLineWidth + _charWidth;

    if (testLineWidth <= maxWidth) {
      if (!currentLine) {
        currentLineStart = charStart;
      }
      currentLine = currentLine + char;
      currentLineEnd = charEnd;
      currentLineWidth = testLineWidth;
      offset = charEnd;
      continue;
    }

    if (currentLine) {
      lines.push({
        text: currentLine,
        start: currentLineStart,
        end: currentLineEnd,
      });
    }

    currentLine = char;
    currentLineStart = charStart;
    currentLineEnd = charEnd;
    currentLineWidth = _charWidth;
    offset = charEnd;
  }

  if (currentLine) {
    lines.push({
      text: currentLine,
      start: currentLineStart,
      end: currentLineEnd,
    });
  }

  return lines;
};

/**
 * Trims trailing whitespace that is exceeding the `maxWidth`.
 *
 * Used for the trailing visual line of a hard line, where some trailing
 * whitespace may still be visible if it fits into the available width.
 */
const trimLine = (
  line: string,
  start: number,
  end: number,
  font: FontString,
  maxWidth: number,
): WrappedTextLine => {
  const shouldTrimWhitespaces = getLineWidth(line, font) > maxWidth;

  if (!shouldTrimWhitespaces) {
    return {
      text: line,
      start,
      end,
    };
  }

  // defensively default to `trimeEnd` in case the regex does not match
  let [, trimmedLine, whitespaces] = line.match(/^(.+?)(\s+)$/) ?? [
    line,
    line.trimEnd(),
    "",
  ];

  let trimmedLineWidth = getLineWidth(trimmedLine, font);

  for (const whitespace of Array.from(whitespaces)) {
    const _charWidth = charWidth.calculate(whitespace, font);
    const testLineWidth = trimmedLineWidth + _charWidth;

    if (testLineWidth > maxWidth) {
      break;
    }

    trimmedLine = trimmedLine + whitespace;
    trimmedLineWidth = testLineWidth;
  }

  return {
    text: trimmedLine,
    start,
    end: end - (line.length - trimmedLine.length),
  };
};

/**
 * Used for internal soft-wrap boundaries, where trailing whitespace should not
 * survive into the rendered line even though it still exists in the original
 * text.
 */
const trimLineEndAtSoftBreak = (
  line: string,
  start: number,
  end: number,
): WrappedTextLine => {
  const trimmedLine = line.trimEnd();

  return {
    text: trimmedLine,
    start,
    end: end - (line.length - trimmedLine.length),
  };
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
