import { newElementWith } from "@excalidraw/excalidraw";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * Slides are the scene's native Excalidraw frames — no separate format.
 * Order is stored on each frame as `customData.slide`, which round-trips through
 * persistence, collaboration and JSON export like any other element property.
 */
export interface Slide {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const slideNo = (el: any): number | null => {
  const n = el?.customData?.slide;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

const isFrame = (el: any) =>
  !el.isDeleted && (el.type === "frame" || el.type === "magicframe");

/** Explicitly ordered frames first (by number), then the rest in reading order. */
export const getSlideElements = (elements: readonly any[]): any[] =>
  elements.filter(isFrame).sort((a, b) => {
    const na = slideNo(a);
    const nb = slideNo(b);
    if (na !== null && nb !== null && na !== nb) {
      return na - nb;
    }
    if (na !== null && nb === null) {
      return -1;
    }
    if (na === null && nb !== null) {
      return 1;
    }
    // reading order: rows (with tolerance), then left to right
    return Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x;
  });

export const getSlides = (elements: readonly any[]): Slide[] =>
  getSlideElements(elements).map((f, i) => ({
    id: f.id,
    name: f.name || `Slide ${i + 1}`,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
  }));

/** Returns the elements array with `customData.slide` rewritten to match a new order. */
export const applySlideOrder = (
  elements: readonly any[],
  orderedIds: readonly string[],
): any[] => {
  const position = new Map(orderedIds.map((id, i) => [id, i]));
  return elements.map((el) => {
    const pos = position.get(el.id);
    if (pos === undefined || slideNo(el) === pos) {
      return el;
    }
    return newElementWith(
      el as ExcalidrawElement,
      {
        customData: { ...(el.customData ?? {}), slide: pos },
      } as any,
    );
  });
};

export const moveSlide = (ids: readonly string[], from: number, to: number) => {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= ids.length ||
    to >= ids.length
  ) {
    return [...ids];
  }
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
};

export const renameSlide = (
  elements: readonly any[],
  id: string,
  name: string,
): any[] =>
  elements.map((el) =>
    el.id === id
      ? newElementWith(el as ExcalidrawElement, { name } as any)
      : el,
  );

export const SLIDE_SIZE = { width: 1280, height: 720 };
export const SLIDE_GAP = 80;

/** Where a new slide goes: right of the last one, or at the given fallback point. */
export const nextSlideRect = (
  slides: readonly Slide[],
  fallback: { x: number; y: number },
) => {
  const last = slides[slides.length - 1];
  return last
    ? { x: last.x + last.width + SLIDE_GAP, y: last.y, ...SLIDE_SIZE }
    : {
        x: fallback.x - SLIDE_SIZE.width / 2,
        y: fallback.y - SLIDE_SIZE.height / 2,
        ...SLIDE_SIZE,
      };
};
