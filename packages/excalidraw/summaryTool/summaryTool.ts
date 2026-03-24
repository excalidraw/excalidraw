import { randomId } from "@excalidraw/common";
import {
  getContainerElement,
  refreshTextDimensions,
  newElementWith,
  isTextElement,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import type { AppState, TextLineLink } from "../types";

type SummaryToolRole = "summaryRoot" | "summaryBase";
type SummaryToolCommentsDisplayMode = "off" | "single" | "all";

type TextDecorationRange = {
  start: number;
  end: number;
  color: string;
};

type SummaryToolCustomData = {
  role?: SummaryToolRole;
  labelColor?: string;
  summaryTextColor?: string;
  commentsDisplayMode?: SummaryToolCommentsDisplayMode;
  syncedTextColorRanges?: TextDecorationRange[];
  lastStableSyncedTextColorAt?: number;
  syncedLineColorByKey?: Record<string, string>;
  syncedSummaryCommentColorRanges?: TextDecorationRange[];
  model?: SummaryToolModel;
  blocks?: Record<
    string,
    {
      lastRenderedLines: string[];
      commentsByLineText: Record<string, string[]>;
    }
  >;
};

type SummaryToolModel = {
  lists: Record<
    string,
    {
      lines: Array<{
        id: string;
        text: string;
      }>;
      display?: {
        mode?: "all" | "single";
        selectedCommentIndexByLineId?: Record<string, number>;
      };
      rendered?: {
        summaryLineNumberByLineId?: Record<string, number>;
        commentCountByLineId?: Record<string, number>;
        commentHintByLineId?: Record<string, string>;
        commentHintLineNumberByLineId?: Record<string, number>;
        commentHeaderTargetBySummaryLineNumber?: Record<
          string,
          { elementId: string; lineNumber: number }
        >;
      };
    }
  >;
};

type ParsedSynclist = {
  name: string;
  startLine: number;
  endLine: number;
  contentLines: string[];
};

const getSummaryToolData = (
  element: ExcalidrawElement,
): SummaryToolCustomData | null => {
  const customData = element.customData as any;
  const data = customData?.summaryTool;
  return data && typeof data === "object"
    ? (data as SummaryToolCustomData)
    : null;
};

const setSummaryToolData = (
  element: ExcalidrawElement,
  next: SummaryToolCustomData | null,
): ExcalidrawElement => {
  const prevCustomData = (element.customData ?? {}) as Record<string, any>;
  if (!next) {
    const { summaryTool: _removed, ...rest } = prevCustomData;
    return newElementWith(element as any, {
      customData: Object.keys(rest).length ? rest : undefined,
    });
  }
  return newElementWith(element as any, {
    customData: {
      ...prevCustomData,
      summaryTool: next,
    },
  });
};

export const getSummaryRootTextElement = (
  elements: readonly ExcalidrawElement[],
): ExcalidrawTextElement | null => {
  for (const el of elements) {
    if (!isTextElement(el) || el.isDeleted) {
      continue;
    }
    const data = getSummaryToolData(el);
    if (data?.role === "summaryRoot") {
      return el;
    }
  }
  return null;
};

export const getSummaryBaseTextElement = (
  elements: readonly ExcalidrawElement[],
): ExcalidrawTextElement | null => {
  for (const el of elements) {
    if (!isTextElement(el) || el.isDeleted) {
      continue;
    }
    const data = getSummaryToolData(el);
    if (data?.role === "summaryBase") {
      return el;
    }
  }
  return null;
};

export const parseSynclists = (text: string): ParsedSynclist[] => {
  const lines = (text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: ParsedSynclist[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const m = trimmed.match(/^\/\/synclist\((.+?)\)\{$/);
    if (!m) {
      continue;
    }
    const name = m[1];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (lines[j].trim() === "//}") {
        break;
      }
    }
    if (j >= lines.length) {
      continue;
    }
    blocks.push({
      name,
      startLine: i,
      endLine: j,
      contentLines: lines.slice(i + 1, j),
    });
    i = j;
  }
  return blocks;
};

const replaceBlock = (
  lines: string[],
  startLine: number,
  endLine: number,
  nextContentLines: string[],
) => {
  return [
    ...lines.slice(0, startLine + 1),
    ...nextContentLines,
    ...lines.slice(endLine),
  ];
};

const getEditableSyncLinesFromSummaryBlock = (
  listName: string,
  contentLines: string[],
) => {
  const syncLines: Array<{
    text: string;
    lineId: string | null;
    order: number;
  }> = [];
  let order = 0;
  const alphabetSet = new Set(SYNC_LINE_TAG_ALPHABET);
  const extractTagFromSuffix = (rawLine: string) => {
    let idx = rawLine.length;
    while (idx > 0 && alphabetSet.has(rawLine[idx - 1] as any)) {
      idx -= 1;
    }
    if (idx === rawLine.length) {
      return null;
    }
    const suffix = rawLine.slice(idx);
    if (suffix.length % 4 !== 0) {
      return null;
    }
    const payload = decodeSyncLineTagPayload(suffix);
    if (!payload) {
      return null;
    }
    const [payloadListName, lineId] = payload.split("|");
    if (!payloadListName || !lineId || payloadListName !== listName) {
      return null;
    }
    return { lineId, visibleLine: rawLine.slice(0, idx) };
  };
  for (const raw of contentLines) {
    if (raw.includes("\u2063\u2064")) {
      continue;
    }
    const extracted = extractSyncLineTagFromLine(raw);
    const fallback = extracted.tag ? null : extractTagFromSuffix(raw);
    const visibleLine = fallback?.visibleLine ?? extracted.visibleLine;
    const trimmed = visibleLine.trim();
    const lineId =
      extracted.tag && extracted.tag.listName === listName
        ? extracted.tag.lineId
        : fallback?.lineId ?? null;
    if (!trimmed) {
      if (lineId) {
        syncLines.push({ text: "", lineId, order });
        order += 1;
      }
      continue;
    }
    if (trimmed.startsWith("//")) {
      continue;
    }
    syncLines.push({ text: trimmed, lineId, order });
    order += 1;
  }
  return syncLines;
};

const reconcileListLineIds = (
  prevLines: Array<{ id: string; text: string }> | undefined,
  nextLines: Array<{ text: string; lineId: string | null; order: number }>,
) => {
  const queueByText = new Map<string, string[]>();
  const prevById = new Map<string, { id: string; text: string }>();
  for (const line of prevLines ?? []) {
    const q = queueByText.get(line.text) ?? [];
    q.push(line.id);
    queueByText.set(line.text, q);
    prevById.set(line.id, line);
  }
  const usedIds = new Set<string>();

  return nextLines.map((line) => {
    if (line.lineId && prevById.has(line.lineId) && !usedIds.has(line.lineId)) {
      usedIds.add(line.lineId);
      return { id: line.lineId, text: line.text };
    }
    const prevByOrder = prevLines?.[line.order];
    if (prevByOrder && !usedIds.has(prevByOrder.id)) {
      usedIds.add(prevByOrder.id);
      return { id: prevByOrder.id, text: line.text };
    }
    const q = queueByText.get(line.text);
    const id = q && q.length ? q.shift()! : randomId();
    usedIds.add(id);
    return { id, text: line.text };
  });
};

const buildOrUpdateModelOnSummaryRoot = (
  summaryRoot: ExcalidrawTextElement,
): { nextSummaryRoot: ExcalidrawTextElement; model: SummaryToolModel } => {
  const prevData = getSummaryToolData(summaryRoot) ?? {};
  const prevModel = prevData.model ?? { lists: {} };
  const blocks = parseSynclists(summaryRoot.text);

  const nextLists: SummaryToolModel["lists"] = { ...prevModel.lists };

  for (const block of blocks) {
    const nextLines = getEditableSyncLinesFromSummaryBlock(
      block.name,
      block.contentLines,
    );
    const prevLines = prevModel.lists[block.name]?.lines;
    const lines = reconcileListLineIds(prevLines, nextLines);
    const prevDisplay = prevModel.lists[block.name]?.display;
    nextLists[block.name] = {
      lines,
      display: prevDisplay ?? { mode: "all", selectedCommentIndexByLineId: {} },
    };
  }

  const model: SummaryToolModel = { lists: nextLists };
  const nextData: SummaryToolCustomData = {
    ...prevData,
    role: "summaryRoot",
    model,
  };

  return {
    nextSummaryRoot: setSummaryToolData(
      summaryRoot,
      nextData,
    ) as ExcalidrawTextElement,
    model,
  };
};

type CommentGroup = {
  sourceElementId: string;
  sourceAnchorLineNumber: number;
  sourceTitle: string;
  commentLines: string[];
  commentLineNumbers: number[];
};

const extractTitleFromText = (text: string) => {
  const first = (text ?? "").replace(/\r\n?/g, "\n").split("\n")[0] ?? "";
  return first.trim();
};

const normalizeKey = (value: string) => value.replace(/\r\n?/g, "\n");

const SYNC_LINE_TAG_PREFIX = "\u2063\u2063";
const COMMENT_LINE_TAG_PREFIX = "\u2063\u2064";
const SYNC_LINE_TAG_ALPHABET = [
  "\u200B",
  "\u200C",
  "\u200D",
  "\u2060",
] as const;

type SyncLineTag = { listName: string; lineId: string };
type ExtractedSyncLineTag = { visibleLine: string; tag: SyncLineTag | null };

const encodeSyncLineTag = (listName: string, lineId: string) => {
  const payload = `${listName}|${lineId}`;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);

  let encoded = "";
  for (const b of bytes) {
    const hi = (b >> 4) & 0xf;
    const lo = b & 0xf;
    const hiA = (hi >> 2) & 0x3;
    const hiB = hi & 0x3;
    const loA = (lo >> 2) & 0x3;
    const loB = lo & 0x3;
    encoded +=
      SYNC_LINE_TAG_ALPHABET[hiA] +
      SYNC_LINE_TAG_ALPHABET[hiB] +
      SYNC_LINE_TAG_ALPHABET[loA] +
      SYNC_LINE_TAG_ALPHABET[loB];
  }
  return `${SYNC_LINE_TAG_PREFIX}${encoded}`;
};

const encodeCommentLineTag = (
  sourceElementId: string,
  sourceLineNumber: number,
) => {
  const payload = `${sourceElementId}|${sourceLineNumber}`;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);

  let encoded = "";
  for (const b of bytes) {
    const hi = (b >> 4) & 0xf;
    const lo = b & 0xf;
    const hiA = (hi >> 2) & 0x3;
    const hiB = hi & 0x3;
    const loA = (lo >> 2) & 0x3;
    const loB = lo & 0x3;
    encoded +=
      SYNC_LINE_TAG_ALPHABET[hiA] +
      SYNC_LINE_TAG_ALPHABET[hiB] +
      SYNC_LINE_TAG_ALPHABET[loA] +
      SYNC_LINE_TAG_ALPHABET[loB];
  }
  return `${COMMENT_LINE_TAG_PREFIX}${encoded}`;
};

const decodeSyncLineTagPayload = (encoded: string) => {
  const idxByChar = new Map<string, number>(
    SYNC_LINE_TAG_ALPHABET.map((c, i) => [c, i]),
  );
  const digits: number[] = [];
  for (const ch of encoded) {
    const v = idxByChar.get(ch);
    if (v == null) {
      return null;
    }
    digits.push(v);
  }
  if (digits.length % 4 !== 0) {
    return null;
  }

  const bytes: number[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    const hi = (digits[i] << 2) | digits[i + 1];
    const lo = (digits[i + 2] << 2) | digits[i + 3];
    bytes.push((hi << 4) | lo);
  }

  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
};

const decodeCommentLineTagPayload = (encoded: string) =>
  decodeSyncLineTagPayload(encoded);

export const extractSyncLineTagFromLine = (rawLine: string) => {
  const idx = rawLine.indexOf(SYNC_LINE_TAG_PREFIX);
  if (idx < 0) {
    return { visibleLine: rawLine, tag: null } as ExtractedSyncLineTag;
  }
  const encoded = rawLine.slice(idx + SYNC_LINE_TAG_PREFIX.length);
  const payload = decodeSyncLineTagPayload(encoded);
  if (!payload) {
    return {
      visibleLine: rawLine.slice(0, idx),
      tag: null,
    } as ExtractedSyncLineTag;
  }
  const [listName, lineId] = payload.split("|");
  if (!listName || !lineId) {
    return {
      visibleLine: rawLine.slice(0, idx),
      tag: null,
    } as ExtractedSyncLineTag;
  }
  return {
    visibleLine: rawLine.slice(0, idx),
    tag: { listName, lineId },
  } as ExtractedSyncLineTag;
};

const extractCommentLineTagFromLine = (rawLine: string) => {
  const idx = rawLine.indexOf(COMMENT_LINE_TAG_PREFIX);
  if (idx < 0) {
    return {
      visibleLine: rawLine,
      sourceElementId: null as string | null,
      sourceLineNumber: null as number | null,
    };
  }
  const encoded = rawLine.slice(idx + COMMENT_LINE_TAG_PREFIX.length);
  const payload = decodeCommentLineTagPayload(encoded);
  if (!payload) {
    return {
      visibleLine: rawLine.slice(0, idx),
      sourceElementId: null,
      sourceLineNumber: null,
    };
  }
  const [sourceElementId, sourceLineNumberRaw] = payload.split("|");
  const sourceLineNumber = sourceLineNumberRaw
    ? Number(sourceLineNumberRaw)
    : NaN;
  return {
    visibleLine: rawLine.slice(0, idx),
    sourceElementId: sourceElementId || null,
    sourceLineNumber: Number.isFinite(sourceLineNumber)
      ? sourceLineNumber
      : null,
  };
};

const stripInvisibleTagSuffixFromLine = (rawLine: string, prefix: string) => {
  const idx = rawLine.indexOf(prefix);
  return idx >= 0 ? rawLine.slice(0, idx) : rawLine;
};

const stripSyncTagFromLine = (rawLine: string) => {
  const withoutSync = stripInvisibleTagSuffixFromLine(
    rawLine,
    SYNC_LINE_TAG_PREFIX,
  );
  return stripInvisibleTagSuffixFromLine(withoutSync, COMMENT_LINE_TAG_PREFIX);
};

const stripSyncTag = (text: string) => {
  const normalized = (text ?? "").replace(/\r\n?/g, "\n");
  return normalized
    .split("\n")
    .map((l) => stripSyncTagFromLine(l))
    .join("\n");
};

const buildLineIdQueueByText = (
  modelLines: Array<{ id: string; text: string }>,
) => {
  const queueByText = new Map<string, string[]>();
  for (const line of modelLines) {
    const q = queueByText.get(line.text) ?? [];
    q.push(line.id);
    queueByText.set(line.text, q);
  }
  return queueByText;
};

const parseCommentsBySyncLineId = ({
  elementText,
  block,
  modelLines,
}: {
  elementText: string;
  block: ParsedSynclist;
  modelLines: Array<{ id: string; text: string }>;
}) => {
  const allLines = (elementText ?? "").replace(/\r\n?/g, "\n").split("\n");
  const contentLines = block.contentLines;
  const result: Record<
    string,
    Array<{
      anchorLineNumber: number;
      commentLines: string[];
      commentLineNumbers: number[];
    }>
  > = {};

  const hasAnyTag = contentLines.some((raw) => {
    const tag = extractSyncLineTagFromLine(raw ?? "").tag;
    return !!tag && tag.listName === block.name;
  });
  const strictByTag = hasAnyTag;

  const queueByText = buildLineIdQueueByText(modelLines);
  const knownSyncLineTexts = new Set(modelLines.map((l) => l.text));

  let currentAnchor: { lineId: string; anchorLineNumber: number } | null = null;
  let preAnchorComments: Array<{ text: string; lineNumber: number }> = [];
  let currentComments: Array<{ text: string; lineNumber: number }> = [];

  const pushGroup = (
    lineId: string,
    anchorLineNumber: number,
    comments: Array<{ text: string; lineNumber: number }>,
  ) => {
    const arr = result[lineId] ?? [];
    arr.push({
      anchorLineNumber,
      commentLines: comments.map((c) => c.text),
      commentLineNumbers: comments.map((c) => c.lineNumber),
    });
    result[lineId] = arr;
  };

  const flush = () => {
    if (!currentAnchor) {
      return;
    }
    pushGroup(
      currentAnchor.lineId,
      currentAnchor.anchorLineNumber,
      currentComments,
    );
    currentComments = [];
  };

  for (let i = 0; i < contentLines.length; i++) {
    const raw = contentLines[i] ?? "";
    const extracted = extractSyncLineTagFromLine(raw);
    const trimmed = extracted.visibleLine.trim();
    let lineId: string | null = null;
    if (extracted.tag && extracted.tag.listName === block.name) {
      lineId = extracted.tag.lineId;
    } else if (!strictByTag && knownSyncLineTexts.has(trimmed)) {
      const q = queueByText.get(trimmed);
      lineId = q && q.length ? q.shift()! : null;
    }

    if (lineId) {
      const anchorLineNumber = block.startLine + 1 + i + 1;
      if (currentAnchor) {
        flush();
      }
      currentAnchor = { lineId, anchorLineNumber };
      if (preAnchorComments.length) {
        pushGroup(lineId, anchorLineNumber, preAnchorComments);
        preAnchorComments = [];
      }
      continue;
    }
    const lineNumber = block.startLine + 1 + i + 1;
    if (!currentAnchor) {
      preAnchorComments.push({ text: raw, lineNumber });
    } else {
      currentComments.push({ text: raw, lineNumber });
    }
  }
  flush();

  const title = extractTitleFromText(allLines.join("\n"));
  return { byLineId: result, title };
};

const getTextDecorations = (element: ExcalidrawTextElement) => {
  const v = (element.customData as any)?.textDecorations;
  return v && typeof v === "object" ? (v as Record<string, any>) : null;
};

const setManagedSyncedLineTextColors = ({
  element,
  summaryRoot,
  model,
}: {
  element: ExcalidrawTextElement;
  summaryRoot: ExcalidrawTextElement;
  model: SummaryToolModel;
}) => {
  console.log('🔍 setManagedSyncedLineTextColors 调试信息');
  console.log('当前元素ID:', element.id);
  console.log('Summary根节点ID:', summaryRoot.id);
  console.log('是否为Summary根节点:', element.id === summaryRoot.id);
  console.log('元素文本预览:', element.text?.substring(0, 100));
  console.log('Summary根节点strokeColor:', summaryRoot.strokeColor);
  
  const isSummaryRoot = element.id === summaryRoot.id;
  const summaryBaseFill = summaryRoot.strokeColor;
  
  const nextText = normalizeKey(element.text);
  const elementLines = nextText.split("\n");
  const elementLineStartIndices: number[] = [];
  let cursor = 0;
  for (let i = 0; i < elementLines.length; i++) {
    elementLineStartIndices.push(cursor);
    cursor += elementLines[i]?.length ?? 0;
    if (i < elementLines.length - 1) {
      cursor += 1;
    }
  }

  const summaryText = normalizeKey(summaryRoot.text);
  const summaryLines = summaryText.split("\n");
  const summaryLineStartIndices: number[] = [];
  let summaryCursor = 0;
  for (let i = 0; i < summaryLines.length; i++) {
    summaryLineStartIndices.push(summaryCursor);
    summaryCursor += summaryLines[i]?.length ?? 0;
    if (i < summaryLines.length - 1) {
      summaryCursor += 1;
    }
  }

  const summaryDecorations = getTextDecorations(summaryRoot) ?? {};
  const summaryTextColors =
    (summaryDecorations.textColors as TextDecorationRange[] | undefined) ?? [];
  const getSummaryColorAtIndex = (index: number) => {
    let color: string | null = null;
    for (const r of summaryTextColors) {
      const start = Math.min(r.start, r.end);
      const end = Math.max(r.start, r.end);
      if (start <= index && index < end) {
        color = r.color;
      }
    }
    return color ?? summaryBaseFill;
  };
  
  if (!isSummaryRoot) {
    console.log('🔒 强制颜色锁定 - 使用summary根节点颜色:', summaryBaseFill);

    const enforcedSyncedRanges: TextDecorationRange[] = [];
    const elementBlocks = parseSynclists(nextText);
    
    for (const block of elementBlocks) {
      const list = model.lists[block.name];
      if (!list) continue;
      
      const allowed = new Set(list.lines.map((l) => l.text));
      const queueByText = buildLineIdQueueByText(list.lines);
      
      for (let i = 0; i < block.contentLines.length; i++) {
        const raw = block.contentLines[i] ?? "";
        const extracted = extractSyncLineTagFromLine(raw);
        const visibleTrimmed = extracted.visibleLine.trim();
        
        if (!allowed.has(visibleTrimmed) || !visibleTrimmed || visibleTrimmed.startsWith("//")) {
          continue;
        }
        
        const lineId = extracted.tag && extracted.tag.listName === block.name
          ? extracted.tag.lineId
          : (() => {
              const q = queueByText.get(visibleTrimmed);
              return q && q.length ? q.shift()! : null;
            })();
            
        if (!lineId) continue;
        
        const absLineIndex = block.startLine + 1 + i;
        const lineStart = elementLineStartIndices[absLineIndex];
        if (lineStart === undefined) continue;
        
        const end = lineStart + extracted.visibleLine.length;
        if (end <= lineStart) continue;
        
        enforcedSyncedRanges.push({
          start: lineStart,
          end,
          color: summaryBaseFill,
        });
        
        console.log(`📍 同步行颜色设置: 行${i}, 颜色:${summaryBaseFill}, 文本:"${visibleTrimmed}"`);
      }
    }
    
    const prevCustomData = (element.customData ?? {}) as Record<string, any>;
    const prevDecorations = getTextDecorations(element) ?? {};
    const prevTextColors =
      (prevDecorations.textColors as TextDecorationRange[] | undefined) ?? [];
    const prevSummaryTool = (prevCustomData.summaryTool ??
      {}) as SummaryToolCustomData;
    const prevManaged = prevSummaryTool.syncedTextColorRanges ?? [];

    const rangesOverlap = (
      a: { start: number; end: number },
      b: { start: number; end: number },
    ) => {
      const aStart = Math.min(a.start, a.end);
      const aEnd = Math.max(a.start, a.end);
      const bStart = Math.min(b.start, b.end);
      const bEnd = Math.max(b.start, b.end);
      return aStart < bEnd && bStart < aEnd;
    };

    const filteredTextColors = prevTextColors.filter(
      (r) =>
        !prevManaged.some(
          (m) => m.start === r.start && m.end === r.end && m.color === r.color,
        ),
    );

    const filteredTextColorsWithoutSynced = enforcedSyncedRanges.length
      ? filteredTextColors.filter(
          (r) => !enforcedSyncedRanges.some((s) => rangesOverlap(r, s)),
        )
      : filteredTextColors;

    const nextTextColors = [
      ...filteredTextColorsWithoutSynced,
      ...enforcedSyncedRanges,
    ];
    const nextDecorations = {
      ...prevDecorations,
      ...(nextTextColors.length ? { textColors: nextTextColors } : {}),
    } as Record<string, any>;
    
    if (!nextTextColors.length) {
      delete nextDecorations.textColors;
    }
    
    const nextSummaryTool: SummaryToolCustomData = {
      ...prevSummaryTool,
      syncedTextColorRanges: enforcedSyncedRanges,
      lastStableSyncedTextColorAt: Date.now(),
      syncedLineColorByKey: {},
    };
    
    console.log('✅ 颜色锁定完成 - 应用了', enforcedSyncedRanges.length, '个颜色范围');
    
    return newElementWith(element, {
      customData: {
        ...prevCustomData,
        textDecorations: Object.keys(nextDecorations).length ? nextDecorations : undefined,
        summaryTool: nextSummaryTool,
      },
    }) as ExcalidrawTextElement;
  }
  
  console.log('📋 处理summary根节点 - 保持原有逻辑');

  const summaryColorByListAndLineId = new Map<string, Map<string, string>>();
  const summaryBlocks = parseSynclists(summaryRoot.text);
  for (const block of summaryBlocks) {
    const list = model.lists[block.name];
    if (!list) {
      continue;
    }
    const allowed = new Set(list.lines.map((l) => l.text));
    const queueByText = buildLineIdQueueByText(list.lines);
    const inner = summaryColorByListAndLineId.get(block.name) ?? new Map();
    for (let i = 0; i < block.contentLines.length; i++) {
      const raw = block.contentLines[i] ?? "";
      const trimmed = raw.trim();
      if (!allowed.has(trimmed)) {
        continue;
      }
      const q = queueByText.get(trimmed);
      const lineId = q && q.length ? q.shift()! : null;
      if (!lineId) {
        continue;
      }
      const absLineIndex = block.startLine + 1 + i;
      const lineStart = summaryLineStartIndices[absLineIndex] ?? 0;
      const firstNonSpace = (raw.match(/^\s*/) ?? [""])[0].length;
      inner.set(lineId, getSummaryColorAtIndex(lineStart + firstNonSpace));
    }
    summaryColorByListAndLineId.set(block.name, inner);
  }

  const newRanges: TextDecorationRange[] = [];
  const newSyncedLineColorByKey: Record<string, string> = {};
  const elementBlocks = parseSynclists(nextText);
  for (const block of elementBlocks) {
    const list = model.lists[block.name];
    if (!list) {
      continue;
    }
    const allowed = new Set(list.lines.map((l) => l.text));
    const queueByText = buildLineIdQueueByText(list.lines);
    const colorByLineId = summaryColorByListAndLineId.get(block.name);
    for (let i = 0; i < block.contentLines.length; i++) {
      const raw = block.contentLines[i] ?? "";
      const extracted = extractSyncLineTagFromLine(raw);
      const visibleTrimmed = extracted.visibleLine.trim();
      if (!allowed.has(visibleTrimmed)) {
        continue;
      }
      if (!visibleTrimmed || visibleTrimmed.startsWith("//")) {
        continue;
      }
      const lineId =
        extracted.tag && extracted.tag.listName === block.name
          ? extracted.tag.lineId
          : (() => {
              const q = queueByText.get(visibleTrimmed);
              return q && q.length ? q.shift()! : null;
            })();
      if (!lineId) {
        continue;
      }
      const absLineIndex = block.startLine + 1 + i;
      const lineStart = elementLineStartIndices[absLineIndex];
      if (lineStart === undefined) {
        continue;
      }
      const end = lineStart + extracted.visibleLine.length;
      if (end <= lineStart) {
        continue;
      }
      const computedColor = colorByLineId?.get(lineId) ?? summaryBaseFill;
      newSyncedLineColorByKey[`${block.name}|${lineId}`] = computedColor;
      newRanges.push({
        start: lineStart,
        end,
        color: computedColor,
      });
    }
  }

  const prevCustomData = (element.customData ?? {}) as Record<string, any>;
  const prevSummaryTool = (prevCustomData.summaryTool ??
    {}) as SummaryToolCustomData;
  const prevManaged = prevSummaryTool.syncedTextColorRanges ?? [];
  const prevColorByKey = prevSummaryTool.syncedLineColorByKey ?? {};

  const prevDecorations = getTextDecorations(element) ?? {};
  const prevTextColors =
    (prevDecorations.textColors as TextDecorationRange[] | undefined) ?? [];
  const filteredTextColors = prevTextColors.filter(
    (r) =>
      !prevManaged.some(
        (m) => m.start === r.start && m.end === r.end && m.color === r.color,
      ),
  );

  const taggedLinesInText: Array<{
    key: string;
    listName: string;
    lineId: string;
    start: number;
    end: number;
  }> = [];
  for (let i = 0; i < elementLines.length; i++) {
    const raw = elementLines[i] ?? "";
    if (!raw.includes(SYNC_LINE_TAG_PREFIX)) {
      continue;
    }
    const extracted = extractSyncLineTagFromLine(raw);
    if (!extracted.tag) {
      continue;
    }
    const start = elementLineStartIndices[i];
    if (start === undefined) {
      continue;
    }
    const end = start + extracted.visibleLine.length;
    if (end <= start) {
      continue;
    }
    taggedLinesInText.push({
      key: `${extracted.tag.listName}|${extracted.tag.lineId}`,
      listName: extracted.tag.listName,
      lineId: extracted.tag.lineId,
      start,
      end,
    });
  }

  const taggedLineCount = taggedLinesInText.length;
  const now = Date.now();
  const graceMs = 350;
  const lastStableAt = prevSummaryTool.lastStableSyncedTextColorAt ?? 0;
  const shouldKeepPrevManaged =
    prevManaged.length > 0 &&
    ((taggedLineCount > 0 && newRanges.length < taggedLineCount) ||
      (taggedLineCount === 0 && now - lastStableAt < graceMs));

  const isStable = taggedLineCount > 0 && newRanges.length === taggedLineCount;
  const stableColorByKey = isStable ? newSyncedLineColorByKey : prevColorByKey;

  const enforcedSyncedRanges: TextDecorationRange[] =
    taggedLineCount > 0
      ? taggedLinesInText.map((t) => ({
          start: t.start,
          end: t.end,
          color:
            summaryColorByListAndLineId.get(t.listName)?.get(t.lineId) ??
            stableColorByKey[t.key] ??
            summaryBaseFill,
        }))
      : [];

  const rangesOverlap = (
    a: { start: number; end: number },
    b: { start: number; end: number },
  ) => {
    const aStart = Math.min(a.start, a.end);
    const aEnd = Math.max(a.start, a.end);
    const bStart = Math.min(b.start, b.end);
    const bEnd = Math.max(b.start, b.end);
    return aStart < bEnd && bStart < aEnd;
  };

  const filteredTextColorsWithoutSynced = enforcedSyncedRanges.length
    ? filteredTextColors.filter(
        (r) => !enforcedSyncedRanges.some((s) => rangesOverlap(r, s)),
      )
    : filteredTextColors;

  const nextManagedRanges = shouldKeepPrevManaged
    ? taggedLineCount > 0
      ? enforcedSyncedRanges
      : prevManaged
    : newRanges;

  const nextTextColors = shouldKeepPrevManaged
    ? taggedLineCount > 0
      ? [...filteredTextColorsWithoutSynced, ...enforcedSyncedRanges]
      : prevTextColors
    : [...filteredTextColors, ...newRanges];
  const nextDecorations = {
    ...prevDecorations,
    ...(nextTextColors.length ? { textColors: nextTextColors } : {}),
  } as Record<string, any>;
  if (!nextTextColors.length) {
    delete nextDecorations.textColors;
  }

  const nextSummaryTool: SummaryToolCustomData = {
    ...prevSummaryTool,
    syncedTextColorRanges: nextManagedRanges,
    lastStableSyncedTextColorAt: isStable
      ? now
      : prevSummaryTool.lastStableSyncedTextColorAt,
    syncedLineColorByKey: isStable ? newSyncedLineColorByKey : prevColorByKey,
  };

  return newElementWith(element, {
    customData: {
      ...prevCustomData,
      textDecorations: Object.keys(nextDecorations).length
        ? nextDecorations
        : undefined,
      summaryTool: nextSummaryTool,
    },
  }) as ExcalidrawTextElement;
};

const rebuildSynclistBlockInTarget = ({
  listName,
  currentBlock,
  currentElementText,
  modelLines,
  previousState: _previousState,
}: {
  listName: string;
  currentBlock: ParsedSynclist;
  currentElementText: string;
  modelLines: Array<{ id: string; text: string }>;
  previousState: {
    lastRenderedLines?: string[];
    commentsByLineText?: Record<string, string[]>;
    lastRenderedLineIds?: string[];
    commentsByLineId?: Record<string, string[]>;
  } | null;
}) => {
  const modelById = new Map(modelLines.map((l) => [l.id, l] as const));
  const modelIdsInOrder = modelLines.map((l) => l.id);
  const allowedTexts = new Set(modelLines.map((l) => l.text));

  let nextContentLines = [...currentBlock.contentLines];

  const anchors: Array<{ index: number; lineId: string }> = [];
  for (let i = 0; i < nextContentLines.length; i++) {
    const extracted = extractSyncLineTagFromLine(nextContentLines[i] ?? "");
    if (
      extracted.tag &&
      extracted.tag.listName === listName &&
      modelById.has(extracted.tag.lineId)
    ) {
      anchors.push({ index: i, lineId: extracted.tag.lineId });
    }
  }

  if (!anchors.length) {
    const queueByText = buildLineIdQueueByText(modelLines);
    for (let i = 0; i < nextContentLines.length; i++) {
      const raw = nextContentLines[i] ?? "";
      const extracted = extractSyncLineTagFromLine(raw);
      const trimmed = extracted.visibleLine.trim();
      if (!trimmed || trimmed.startsWith("//")) {
        continue;
      }
      if (!allowedTexts.has(trimmed)) {
        continue;
      }
      const q = queueByText.get(trimmed);
      const lineId = q && q.length ? q.shift()! : null;
      if (!lineId) {
        continue;
      }
      nextContentLines[i] = `${extracted.visibleLine}${encodeSyncLineTag(
        listName,
        lineId,
      )}`;
      anchors.push({ index: i, lineId });
    }
    anchors.sort((a, b) => a.index - b.index);
  }

  const presentIdsInOrder = anchors
    .map((a) => a.lineId)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);
  const presentIds = new Set(presentIdsInOrder);
  const missingIds = modelIdsInOrder.filter((id) => !presentIds.has(id));

  for (const anchor of anchors) {
    const line = modelById.get(anchor.lineId);
    if (!line) {
      continue;
    }
    nextContentLines[anchor.index] = `${line.text}${encodeSyncLineTag(
      listName,
      line.id,
    )}`;
  }

  if (!presentIdsInOrder.length) {
    nextContentLines = [
      ...modelLines.map((l) => `${l.text}${encodeSyncLineTag(listName, l.id)}`),
      ...nextContentLines,
    ];
  } else if (missingIds.length) {
    const missingTaggedLines = missingIds
      .map((id) => {
        const line = modelById.get(id);
        return line
          ? `${line.text}${encodeSyncLineTag(listName, line.id)}`
          : null;
      })
      .filter((v): v is string => !!v);
    nextContentLines = [...nextContentLines, ...missingTaggedLines];
  }

  const parsed = parseCommentsBySyncLineId({
    elementText: stripSyncTag(currentElementText),
    block: { ...currentBlock, contentLines: nextContentLines },
    modelLines,
  });

  const nextState = {
    lastRenderedLineIds: [...presentIdsInOrder, ...missingIds],
    commentsByLineId: Object.fromEntries(
      Object.entries(parsed.byLineId).map(([lineId, groups]) => [
        lineId,
        groups.flatMap((g) => g.commentLines),
      ]),
    ),
  };

  return { nextContentLines, nextState };
};

const rebuildSynclistBlockInSummaryRoot = ({
  listName,
  summaryRoot,
  modelLines,
  commentGroupsByLineId,
}: {
  listName: string;
  summaryRoot: ExcalidrawTextElement;
  modelLines: Array<{ id: string; text: string }>;
  commentGroupsByLineId: Record<string, CommentGroup[]>;
}) => {
  const data = getSummaryToolData(summaryRoot) ?? {};
  const model = data.model ?? { lists: {} };
  const display = model.lists[listName]?.display ?? {
    mode: "all" as const,
    selectedCommentIndexByLineId: {},
  };
  const modeFromList = display.mode ?? "all";
  const mode =
    data.commentsDisplayMode === "off" ||
    data.commentsDisplayMode === "single" ||
    data.commentsDisplayMode === "all"
      ? data.commentsDisplayMode
      : modeFromList;
  const selectedIdxById = display.selectedCommentIndexByLineId ?? {};

  const summaryLineNumberByLineId: Record<string, number> = {};
  const commentCountByLineId: Record<string, number> = {};
  const commentHintByLineId: Record<string, string> = {};
  const commentHintLineNumberByLineId: Record<string, number> = {};
  const commentHeaderTargetBySummaryLineNumber: Record<
    string,
    { elementId: string; lineNumber: number }
  > = {};

  const nextContentLines: string[] = [];
  let logicalLineNumber = 0;
  const bumpLine = () => {
    logicalLineNumber += 1;
    return logicalLineNumber;
  };

  for (const line of modelLines) {
    nextContentLines.push(`${line.text}${encodeSyncLineTag(listName, line.id)}`);
    summaryLineNumberByLineId[line.id] = bumpLine();

    const groups = commentGroupsByLineId[line.id] ?? [];
    commentCountByLineId[line.id] = groups.length;
    if (!groups.length || mode === "off") {
      continue;
    }

    if (mode === "all") {
      for (let idx = 0; idx < groups.length; idx++) {
        const g = groups[idx];
        for (let j = 0; j < g.commentLines.length; j++) {
          const cl = g.commentLines[j];
          const sourceLineNumber =
            g.commentLineNumbers[j] ?? g.sourceAnchorLineNumber;
          const normalized = String(cl).replace(/^\s*\/\/\s?/, "");
          nextContentLines.push(
            `${normalized}${encodeCommentLineTag(
              g.sourceElementId,
              sourceLineNumber,
            )}`,
          );
          const commentLineNumber = bumpLine();
          commentHeaderTargetBySummaryLineNumber[String(commentLineNumber)] = {
            elementId: g.sourceElementId,
            lineNumber: g.sourceAnchorLineNumber,
          };
        }
      }
    } else {
      const currentIdx = Math.max(
        0,
        Math.min(groups.length - 1, selectedIdxById[line.id] ?? 0),
      );
      const g = groups[currentIdx];
      commentHintByLineId[line.id] = `(${g.sourceAnchorLineNumber};${
        g.sourceTitle
      }) ${currentIdx + 1}/${groups.length}`;
      let isFirstCommentLine = true;
      for (let j = 0; j < g.commentLines.length; j++) {
        const cl = g.commentLines[j];
        const sourceLineNumber =
          g.commentLineNumbers[j] ?? g.sourceAnchorLineNumber;
        const normalized = String(cl).replace(/^\s*\/\/\s?/, "");
        nextContentLines.push(
          `${normalized}${encodeCommentLineTag(
            g.sourceElementId,
            sourceLineNumber,
          )}`,
        );
        const commentLineNumber = bumpLine();
        commentHeaderTargetBySummaryLineNumber[String(commentLineNumber)] = {
          elementId: g.sourceElementId,
          lineNumber: g.sourceAnchorLineNumber,
        };
        if (isFirstCommentLine) {
          commentHintLineNumberByLineId[line.id] = commentLineNumber;
          isFirstCommentLine = false;
        }
      }
    }
  }

  return {
    nextContentLines,
    rendered: {
      summaryLineNumberByLineId,
      commentCountByLineId,
      commentHintByLineId,
      commentHintLineNumberByLineId,
      commentHeaderTargetBySummaryLineNumber,
    },
  };
};

export type SummaryToolSyncResult = {
  elements: ExcalidrawElement[];
  appState: Pick<AppState, "textLineLinks">;
  didUpdate: boolean;
};

export const applySummaryToolSync = ({
  elements,
  appState,
  elementsMap,
}: {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  elementsMap: NonDeletedSceneElementsMap;
}): SummaryToolSyncResult => {
  const summaryRoot = getSummaryRootTextElement(elements);
  if (!summaryRoot) {
    const filteredLinks = appState.textLineLinks.filter(
      (l) => !String(l.id).startsWith("summaryTool:"),
    );
    const didUpdate = filteredLinks.length !== appState.textLineLinks.length;
    return {
      elements: [...elements],
      appState: { textLineLinks: filteredLinks },
      didUpdate,
    };
  }

  const { nextSummaryRoot, model } =
    buildOrUpdateModelOnSummaryRoot(summaryRoot);

  let nextElements = elements.map((el) =>
    el.id === summaryRoot.id ? nextSummaryRoot : el,
  );

  const nextLinksById = new Map<string, TextLineLink>();

  const requiredLinkIds = new Set<string>();

  const pendingLinkAnchors: Array<{
    listName: string;
    targetElementId: string;
    lineId: string;
    targetLineNumber: number;
  }> = [];

  const commentGroupsByListAndLineId: Record<
    string,
    Record<string, CommentGroup[]>
  > = {};

  for (const listName of Object.keys(model.lists)) {
    commentGroupsByListAndLineId[listName] = {};
  }

  for (const el of nextElements) {
    if (!isTextElement(el) || el.isDeleted || el.id === summaryRoot.id) {
      continue;
    }
    const blocks = parseSynclists(el.text);
    if (!blocks.length) {
      continue;
    }
    const prevData = getSummaryToolData(el) ?? {};
    const prevBlocksState = (prevData as any).blocks ?? {};
    const nextBlocksState: Record<
      string,
      {
        lastRenderedLines?: string[];
        commentsByLineText?: Record<string, string[]>;
        lastRenderedLineIds?: string[];
        commentsByLineId?: Record<string, string[]>;
      }
    > = { ...prevBlocksState };

    let elementLines = normalizeKey(el.text).split("\n");

    let didChangeText = false;
    for (const block of blocks) {
      const list = model.lists[block.name];
      if (!list) {
        continue;
      }
      const previousState = prevBlocksState[block.name] ?? null;

      const { nextContentLines, nextState } = rebuildSynclistBlockInTarget({
        listName: block.name,
        currentBlock: block,
        currentElementText: el.text,
        modelLines: list.lines,
        previousState,
      });

      nextBlocksState[block.name] = nextState;

      const nextElementLines = replaceBlock(
        elementLines,
        block.startLine,
        block.endLine,
        nextContentLines,
      );
      didChangeText =
        didChangeText ||
        nextElementLines.join("\n") !== elementLines.join("\n");
      elementLines = nextElementLines;

      const parsed = parseCommentsBySyncLineId({
        elementText: elementLines.join("\n"),
        block: {
          ...block,
          contentLines: nextContentLines,
        },
        modelLines: list.lines,
      });

      const sourceTitle = extractTitleFromText(el.text);
      const groupsForList = commentGroupsByListAndLineId[block.name] ?? {};
      for (const [lineId, groups] of Object.entries(parsed.byLineId)) {
        for (const g of groups) {
          const filteredPairs = g.commentLines
            .map((text, idx) => ({
              text,
              lineNumber: g.commentLineNumbers[idx],
            }))
            .filter((p) => (p.text ?? "").trim() !== "");
          const entry: CommentGroup = {
            sourceElementId: el.id,
            sourceAnchorLineNumber: g.anchorLineNumber,
            sourceTitle: sourceTitle || parsed.title || el.id,
            commentLines: filteredPairs.map((p) => p.text),
            commentLineNumbers: filteredPairs
              .map((p) => p.lineNumber)
              .filter((n): n is number => typeof n === "number"),
          };
          groupsForList[lineId] = (groupsForList[lineId] ?? []).concat(entry);
        }
      }
      commentGroupsByListAndLineId[block.name] = groupsForList;

      let cursorLineNumber = block.startLine + 2;
      for (const l of nextContentLines) {
        const extracted = extractSyncLineTagFromLine(l);
        const lineId =
          extracted.tag && extracted.tag.listName === block.name
            ? extracted.tag.lineId
            : null;
        if (lineId) {
          pendingLinkAnchors.push({
            listName: block.name,
            targetElementId: el.id,
            lineId,
            targetLineNumber: cursorLineNumber,
          });
        }
        cursorLineNumber += 1;
      }
    }

    const nextData: SummaryToolCustomData = {
      ...prevData,
      summaryTextColor: summaryRoot.strokeColor,
      blocks: nextBlocksState as any,
    };

    const nextElWithData = setSummaryToolData(
      el,
      nextData,
    ) as ExcalidrawTextElement;

    const nextText = elementLines.join("\n");
    const shouldUpdateText = nextText !== normalizeKey(el.text);

    const container = getContainerElement(nextElWithData, elementsMap);
    const updatedBase =
      shouldUpdateText || nextElWithData.customData !== el.customData
        ? (newElementWith(nextElWithData, {
            text: nextText,
            originalText: nextText,
            ...refreshTextDimensions(
              nextElWithData,
              container,
              elementsMap,
              nextText,
            ),
          }) as ExcalidrawTextElement)
        : nextElWithData;
    const updated = setManagedSyncedLineTextColors({
      element: updatedBase,
      summaryRoot,
      model,
    });

    if (updated !== el) {
      nextElements = nextElements.map((candidate) =>
        candidate.id === el.id ? updated : candidate,
      );
    }

    didChangeText = didChangeText || shouldUpdateText;
  }

  const summaryBlocks = parseSynclists(nextSummaryRoot.text);
  let summaryLines = normalizeKey(nextSummaryRoot.text).split("\n");
  let didChangeSummaryText = false;
  const nextModel: SummaryToolModel = { ...model, lists: { ...model.lists } };

  for (const block of summaryBlocks) {
    const list = nextModel.lists[block.name];
    if (!list) {
      continue;
    }
    const modelLines = list.lines;
    const { nextContentLines, rendered } = rebuildSynclistBlockInSummaryRoot({
      listName: block.name,
      summaryRoot: nextSummaryRoot,
      modelLines,
      commentGroupsByLineId: commentGroupsByListAndLineId[block.name] ?? {},
    });
    summaryLines = replaceBlock(
      summaryLines,
      block.startLine,
      block.endLine,
      nextContentLines,
    );
    const contentStartLineNumber = block.startLine + 2;
    const summaryLineNumberByLineId: Record<string, number> = {};
    for (const [lineId, rel] of Object.entries(
      rendered.summaryLineNumberByLineId ?? {},
    )) {
      const r = Number(rel);
      if (Number.isFinite(r) && r >= 1) {
        summaryLineNumberByLineId[lineId] = contentStartLineNumber + r - 1;
      }
    }
    const commentHeaderTargetBySummaryLineNumber: Record<
      string,
      { elementId: string; lineNumber: number }
    > = {};
    for (const [relLine, target] of Object.entries(
      rendered.commentHeaderTargetBySummaryLineNumber ?? {},
    )) {
      const r = Number(relLine);
      if (Number.isFinite(r) && r >= 1) {
        commentHeaderTargetBySummaryLineNumber[
          String(contentStartLineNumber + r - 1)
        ] = target;
      }
    }
    const commentHintLineNumberByLineId: Record<string, number> = {};
    for (const [lineId, relLine] of Object.entries(
      rendered.commentHintLineNumberByLineId ?? {},
    )) {
      const r = Number(relLine);
      if (Number.isFinite(r) && r >= 1) {
        commentHintLineNumberByLineId[lineId] = contentStartLineNumber + r - 1;
      }
    }
    list.rendered = {
      summaryLineNumberByLineId,
      commentCountByLineId: rendered.commentCountByLineId ?? {},
      commentHintByLineId: rendered.commentHintByLineId ?? {},
      commentHintLineNumberByLineId,
      commentHeaderTargetBySummaryLineNumber,
    };
    didChangeSummaryText = true;
  }

  const nextSummaryText = summaryLines.join("\n");
  const summaryContainer = getContainerElement(nextSummaryRoot, elementsMap);
  const prevSummaryData = getSummaryToolData(nextSummaryRoot) ?? {};
  const nextSummaryData: SummaryToolCustomData = {
    ...(getSummaryToolData(nextSummaryRoot) ?? {}),
    role: "summaryRoot",
    model: nextModel,
  };

  const normalizedSummaryText = normalizeKey(nextSummaryText);
  const summaryTextLines = normalizedSummaryText.split("\n");
  const summaryLineStartIndices: number[] = [];
  let cursor = 0;
  for (let i = 0; i < summaryTextLines.length; i++) {
    summaryLineStartIndices.push(cursor);
    cursor += summaryTextLines[i]?.length ?? 0;
    if (i < summaryTextLines.length - 1) {
      cursor += 1;
    }
  }

  const commentColorRanges: TextDecorationRange[] = [];
  const sourceElementCache = new Map<
    string,
    {
      lines: string[];
      lineStarts: number[];
      textColors: TextDecorationRange[];
      strokeColor: string;
    }
  >();
  for (let i = 0; i < summaryTextLines.length; i++) {
    const raw = summaryTextLines[i] ?? "";
    if (!raw.includes(COMMENT_LINE_TAG_PREFIX)) {
      continue;
    }
    const extracted = extractCommentLineTagFromLine(raw);
    const start = summaryLineStartIndices[i];
    if (start === undefined) {
      continue;
    }
    const end = start + extracted.visibleLine.length;
    if (end <= start) {
      continue;
    }
    const sourceElement =
      extracted.sourceElementId && elementsMap.get(extracted.sourceElementId);

    const baseColor =
      sourceElement &&
      isTextElement(sourceElement) &&
      typeof sourceElement.strokeColor === "string"
        ? sourceElement.strokeColor
        : summaryRoot.strokeColor;

    commentColorRanges.push({ start, end, color: baseColor });

    if (
      !sourceElement ||
      !isTextElement(sourceElement) ||
      !extracted.sourceElementId ||
      !extracted.sourceLineNumber
    ) {
      continue;
    }

    const cached =
      sourceElementCache.get(extracted.sourceElementId) ??
      (() => {
        const normalized = normalizeKey(sourceElement.text);
        const lines = normalized.split("\n");
        const lineStarts: number[] = [];
        let cursor = 0;
        for (let j = 0; j < lines.length; j++) {
          lineStarts.push(cursor);
          cursor += lines[j]?.length ?? 0;
          if (j < lines.length - 1) {
            cursor += 1;
          }
        }
        const deco = getTextDecorations(sourceElement) ?? {};
        const textColors =
          (deco.textColors as TextDecorationRange[] | undefined) ?? [];
        const entry = {
          lines,
          lineStarts,
          textColors,
          strokeColor: sourceElement.strokeColor,
        };
        sourceElementCache.set(extracted.sourceElementId!, entry);
        return entry;
      })();

    const sourceLineIndex = extracted.sourceLineNumber - 1;
    const sourceRawLine = cached.lines[sourceLineIndex];
    const sourceLineStart = cached.lineStarts[sourceLineIndex];
    if (sourceRawLine === undefined || sourceLineStart === undefined) {
      continue;
    }

    const sourceNormalized = sourceRawLine.replace(/^\s*\/\/\s?/, "");
    const sourcePrefixLen = sourceRawLine.length - sourceNormalized.length;
    const sourceVisibleStart = sourceLineStart + sourcePrefixLen;
    const commonLen = Math.min(
      extracted.visibleLine.length,
      sourceNormalized.length,
    );
    const sourceVisibleEnd = sourceVisibleStart + commonLen;

    for (const r of cached.textColors) {
      const rStart = Math.min(r.start, r.end);
      const rEnd = Math.max(r.start, r.end);
      const overlapStart = Math.max(rStart, sourceVisibleStart);
      const overlapEnd = Math.min(rEnd, sourceVisibleEnd);
      if (overlapEnd <= overlapStart) {
        continue;
      }
      const mappedStart = start + (overlapStart - sourceVisibleStart);
      const mappedEnd = start + (overlapEnd - sourceVisibleStart);
      if (mappedEnd <= mappedStart) {
        continue;
      }
      commentColorRanges.push({
        start: mappedStart,
        end: mappedEnd,
        color: r.color,
      });
    }
  }

  const rangesOverlap = (
    a: { start: number; end: number },
    b: { start: number; end: number },
  ) => {
    const aStart = Math.min(a.start, a.end);
    const aEnd = Math.max(a.start, a.end);
    const bStart = Math.min(b.start, b.end);
    const bEnd = Math.max(b.start, b.end);
    return aStart < bEnd && bStart < aEnd;
  };

  const prevCustomData = (nextSummaryRoot.customData ?? {}) as Record<
    string,
    any
  >;
  const prevDecorations = getTextDecorations(nextSummaryRoot) ?? {};
  const prevTextColors =
    (prevDecorations.textColors as TextDecorationRange[] | undefined) ?? [];
  const prevManagedCommentRanges =
    prevSummaryData.syncedSummaryCommentColorRanges ?? [];
  const filteredTextColors = prevTextColors.filter(
    (r) =>
      !prevManagedCommentRanges.some(
        (m) => m.start === r.start && m.end === r.end && m.color === r.color,
      ),
  );
  const filteredTextColorsWithoutComments = commentColorRanges.length
    ? filteredTextColors.filter(
        (r) => !commentColorRanges.some((c) => rangesOverlap(r, c)),
      )
    : filteredTextColors;
  const nextTextColors = [
    ...filteredTextColorsWithoutComments,
    ...commentColorRanges,
  ];
  const nextDecorations = {
    ...prevDecorations,
    ...(nextTextColors.length ? { textColors: nextTextColors } : {}),
  } as Record<string, any>;
  if (!nextTextColors.length) {
    delete nextDecorations.textColors;
  }

  const nextSummaryDataWithCommentRanges: SummaryToolCustomData = {
    ...nextSummaryData,
    syncedSummaryCommentColorRanges: commentColorRanges,
  };

  const summaryRootWithData = setSummaryToolData(
    nextSummaryRoot,
    nextSummaryDataWithCommentRanges,
  ) as ExcalidrawTextElement;

  const updatedSummaryRoot = newElementWith(summaryRootWithData, {
    text: nextSummaryText,
    originalText: nextSummaryText,
    customData: {
      ...prevCustomData,
      textDecorations: Object.keys(nextDecorations).length
        ? nextDecorations
        : undefined,
      summaryTool: nextSummaryDataWithCommentRanges,
    },
    ...refreshTextDimensions(
      summaryRootWithData,
      summaryContainer,
      elementsMap,
      nextSummaryText,
    ),
  }) as ExcalidrawTextElement;

  nextElements = nextElements.map((el) =>
    el.id === summaryRoot.id ? updatedSummaryRoot : el,
  );

  for (const pending of pendingLinkAnchors) {
    const list = nextModel.lists[pending.listName];
    const renderedMap = list?.rendered?.summaryLineNumberByLineId;
    if (!list || !renderedMap) {
      continue;
    }
    const summaryLineNumber = renderedMap[pending.lineId];
    if (!summaryLineNumber) {
      continue;
    }
    const linkId = `summaryTool:${pending.listName}:${pending.lineId}:${pending.targetElementId}:${pending.targetLineNumber}`;
    requiredLinkIds.add(linkId);
    nextLinksById.set(linkId, {
      id: linkId,
      from: {
        elementId: summaryRoot.id,
        lineNumber: summaryLineNumber,
        side: "right",
      },
      to: {
        elementId: pending.targetElementId,
        lineNumber: pending.targetLineNumber,
        side: "left",
      },
    });
  }

  const preservedManualLinks = appState.textLineLinks.filter(
    (l) => !String(l.id).startsWith("summaryTool:"),
  );
  const existingManaged = appState.textLineLinks.filter((l) =>
    String(l.id).startsWith("summaryTool:"),
  );
  const mergedManaged: TextLineLink[] = [];
  for (const link of existingManaged) {
    if (requiredLinkIds.has(String(link.id))) {
      mergedManaged.push(nextLinksById.get(String(link.id)) ?? link);
    }
  }
  for (const [id, link] of nextLinksById.entries()) {
    if (!mergedManaged.some((l) => l.id === id)) {
      mergedManaged.push(link);
    }
  }

  const nextTextLineLinks = preservedManualLinks.concat(mergedManaged);

  const didUpdate =
    didChangeSummaryText ||
    nextElements.some((el, idx) => el !== elements[idx]) ||
    nextTextLineLinks.length !== appState.textLineLinks.length ||
    nextTextLineLinks.some((l, i) => l !== appState.textLineLinks[i]);

  return {
    elements: [...nextElements],
    appState: { textLineLinks: nextTextLineLinks },
    didUpdate,
  };
};
