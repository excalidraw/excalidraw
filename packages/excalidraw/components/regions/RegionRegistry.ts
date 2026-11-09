import type React from "react";

/**
 * Regions a host can place UI into. `top-center` (the toolbar) and
 * `bottom-center` (`<Footer>`) are not open to region items.
 */
export type RegionArea =
  | "top-left"
  | "top-right"
  | "center-left"
  | "center-right"
  | "bottom-left"
  | "bottom-right";

/**
 * How a region item gives up space when its region runs out of it — width
 * in the top and bottom regions, height in the center regions:
 *
 * - `rigid`    keeps its natural size (the default)
 * - `shrink`   top/bottom: takes the region's leftover width, down to
 *              `minWidth` — the item adapts itself (e.g. the collaborator
 *              list's "+N" pill). Center: like `rigid`.
 * - `render`   has a collapsed variant: `children` is a function receiving
 *              `{ collapsed }`
 * - `overflow` moves into the region's "⋯" menu
 *
 * In the center regions, an item with a `minHeight` first scrolls down to
 * that height before it (or a lower priority item) collapses.
 */
export type RegionItemCollapse = "rigid" | "shrink" | "render" | "overflow";

/**
 * How an item shows in the phone layout, which only has a top bar:
 *
 * - `same`     top-left / top-right items render in the top bar; items of
 *              the other areas go into the top bar's "⋯" menu (default)
 * - `overflow` always goes into the top bar's "⋯" menu
 * - `hide`     isn't shown on phones
 */
export type RegionItemMobile = "same" | "overflow" | "hide";

export type RegionItemRenderState = {
  /** `collapse="render"` items: render the collapsed variant */
  collapsed: boolean;
  /** `collapse="overflow"` items: rendering inside the region's "⋯" menu */
  inOverflowMenu: boolean;
};

export type RegionItemContent =
  | React.ReactNode
  | ((state: RegionItemRenderState) => React.ReactNode);

export type RegionItemSpec = {
  id: string;
  /**
   * Lower priority gives up space first. Ties: the item registered last
   * gives up space first.
   */
  priority: number;
  collapse: RegionItemCollapse;
  /**
   * Position within the region, ascending. Editor items: top-left — host
   * `renderTopLeftUI` -10, main menu 0; top-right — collaborator list 0,
   * host `renderTopRightUI` 10, sidebar trigger 100; center-left — styles
   * panel 0, pen mode button 1; center-right — stats 0; bottom-left —
   * zoom/undo 0; bottom-right — help 100. Host items default to 10.
   */
  order: number;
  /** `collapse="shrink"` items: the width they never shrink below */
  minWidth: number;
  /**
   * center regions: the item scrolls down to this height (px) before
   * collapsing (0: it doesn't scroll)
   */
  minHeight: number;
  mobile: RegionItemMobile;
  className?: string;
  content: RegionItemContent;
  /** registration order (tie-breaker) */
  seq: number;
};

export type RegionItemEntry = RegionItemSpec & { area: RegionArea };

/**
 * Per-editor store of host-registered region items (`<Region.Item>`), read
 * by the region renderers in LayerUI / MobileMenu.
 */
export class RegionRegistry {
  private entries = new Map<string, RegionItemEntry>();
  private snapshot: readonly RegionItemEntry[] = [];
  private listeners = new Set<() => void>();
  private seq = 0;

  nextSeq = () => this.seq++;

  set = (entry: RegionItemEntry) => {
    this.entries.set(entry.id, entry);
    this.emit();
  };

  delete = (id: string) => {
    if (this.entries.delete(id)) {
      this.emit();
    }
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private emit() {
    this.snapshot = [...this.entries.values()];
    this.listeners.forEach((listener) => listener());
  }
}

export const renderRegionItemContent = (
  content: RegionItemContent,
  state: RegionItemRenderState,
) => (typeof content === "function" ? content(state) : content);

export const sortRegionItems = <T extends RegionItemSpec>(items: T[]) =>
  items.sort((a, b) => a.order - b.order || a.seq - b.seq);
