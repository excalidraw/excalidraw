import clsx from "clsx";
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useTunnels } from "../../context/tunnels";
import { t } from "../../i18n";
import DropdownMenu from "../dropdownMenu/DropdownMenu";
import { DotsHorizontalIcon } from "../icons";

import { renderRegionItemContent, sortRegionItems } from "./RegionRegistry";

import "./Region.scss";

import type {
  RegionArea,
  RegionItemEntry,
  RegionItemSpec,
} from "./RegionRegistry";

type ItemState = "expanded" | "collapsed" | "overflow";

/**
 * What a region's items have to fit into:
 *
 * - `region`  the region's own width (top regions — the region spans its
 *             column, whose width the top-row grid negotiates)
 * - `band`    half the footer band's width (bottom-left / bottom-right — a
 *             fixed per-side budget, so the two sides never trade width)
 * - `column`  the height left in the region's column below its top region
 *             (center regions)
 */
type Budget = "region" | "band" | "column";

/** sub-pixel slack, so rounding can't flip an item back and forth */
const TOLERANCE_PX = 0.5;

const FLOOR_VAR = "--exc-region-floor";
const FLOORED_ATTR = "data-exc-region-floored";

const useRegisteredItems = (area?: RegionArea): RegionItemEntry[] => {
  const { regions } = useTunnels();
  const entries = useSyncExternalStore(
    regions.subscribe,
    regions.getSnapshot,
    regions.getSnapshot,
  );
  return area ? entries.filter((entry) => entry.area === area) : [...entries];
};

const ItemWrapper = ({
  item,
  state,
  vertical,
}: {
  item: RegionItemSpec;
  state: ItemState;
  vertical?: boolean;
}) => (
  <div
    className={clsx(
      "exc-region-item",
      `exc-region-item--${item.collapse}`,
      {
        "exc-region-item--collapsed": state === "collapsed",
        "exc-region-item--vertical": vertical,
        "exc-region-item--scrolls": vertical && item.minHeight > 0,
      },
      item.className,
    )}
    data-region-item={item.id}
    style={
      {
        "--exc-region-item-min-width":
          item.collapse === "shrink" ? `${item.minWidth}px` : undefined,
        "--exc-region-item-min-height":
          vertical && item.minHeight > 0 ? `${item.minHeight}px` : undefined,
      } as React.CSSProperties
    }
  >
    {renderRegionItemContent(item.content, {
      collapsed: state === "collapsed",
      inOverflowMenu: false,
    })}
  </div>
);

/** a "⋯" button whose menu renders `items` (expanded, `inOverflowMenu`) */
const RegionOverflowMenu = ({
  items,
  align,
  idle,
}: {
  items: RegionItemSpec[];
  align: "start" | "end";
  /** rendered (and measured) but hidden, while nothing overflows */
  idle?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (idle) {
      setIsOpen(false);
    }
  }, [idle]);

  return (
    <div
      className={clsx("exc-region-overflow", {
        "exc-region-overflow--idle": idle,
      })}
      aria-hidden={idle || undefined}
    >
      <DropdownMenu open={isOpen && !idle}>
        <DropdownMenu.Trigger
          className="exc-region-overflow__trigger"
          onToggle={() => setIsOpen((open) => !open)}
          title={t("labels.regionOverflow")}
          aria-label={t("labels.regionOverflow")}
          tabIndex={idle ? -1 : undefined}
        >
          {DotsHorizontalIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          className="exc-region-overflow__menu"
          align={align}
          onClickOutside={() => setIsOpen(false)}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={clsx("exc-region-overflow__item", item.className)}
            >
              {renderRegionItemContent(item.content, {
                collapsed: false,
                inOverflowMenu: true,
              })}
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};

/**
 * Phone top bar: a region's `mobile="same"` items, expanded, no collapsing.
 */
export const RegionPhoneItems = ({
  area,
}: {
  area: "top-left" | "top-right";
}) => {
  const items = sortRegionItems(
    useRegisteredItems(area).filter((item) => item.mobile === "same"),
  );
  return (
    <>
      {items.map((item) => (
        <ItemWrapper key={item.id} item={item} state="expanded" />
      ))}
    </>
  );
};

/**
 * Phone top bar: the "⋯" menu for items that don't render in the top bar —
 * `mobile="overflow"` items, and `mobile="same"` items of the areas the
 * phone layout doesn't have (center, bottom).
 */
export const RegionPhoneOverflowMenu = () => {
  const items = sortRegionItems(
    useRegisteredItems().filter(
      (item) =>
        item.mobile === "overflow" ||
        (item.mobile === "same" &&
          item.area !== "top-left" &&
          item.area !== "top-right"),
    ),
  );
  if (!items.length) {
    return null;
  }
  return <RegionOverflowMenu items={items} align="end" />;
};

/**
 * Renders a region's items (editor + host `<Region.Item>`s, by `order`) and
 * collapses them by priority to fit the region's budget — width for a row
 * (top, bottom regions), height for a stack (center regions).
 *
 * Each item's expanded and collapsed sizes are measured and cached (a
 * `render` item is rendered collapsed for one pre-paint pass to learn its
 * collapsed size). Items then collapse — lowest priority first — until the
 * row/stack fits the budget. An item with a `minHeight` (center regions)
 * counts with that height: it scrolls down to it first.
 *
 * Top regions (`floor`): the region's minimum width — what floors its
 * column against the toolbar — is set to the width of the FULLY collapsed
 * row, so it doesn't depend on the current collapse state and collapsing
 * can't feed back into the width it reacts to.
 *
 * Inert where layout isn't measurable (zero sizes, e.g. jsdom): everything
 * renders expanded.
 */
export const RegionCluster = ({
  area,
  editorItems,
  className,
  menuAlign,
  menuPosition,
  budget,
  floor = false,
}: {
  area: RegionArea;
  editorItems: RegionItemSpec[];
  /** the row/stack element's class; for center regions, the stack is
   * `display: contents`, so items are the region grid's own items */
  className?: string;
  /** which side of its trigger the "⋯" menu opens toward */
  menuAlign: "start" | "end";
  /** where the "⋯" button sits among the items */
  menuPosition: "first" | "last";
  budget: Budget;
  floor?: boolean;
}) => {
  const vertical = budget === "column";
  const items = sortRegionItems([...editorItems, ...useRegisteredItems(area)]);

  const [states, setStates] = useState<Record<string, ItemState>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef(
    new Map<string, { expanded?: number; collapsed?: number }>(),
  );
  const menuSizeRef = useRef(0);

  const stateOf = (id: string): ItemState => states[id] ?? "expanded";

  const hasOverflowItems = items.some((item) => item.collapse === "overflow");
  const overflowed = items.filter((item) => stateOf(item.id) === "overflow");

  const latest = useRef({ items, states });
  latest.current = { items, states };

  /** what the items must fit into, or 0 if not measurable */
  const getBudget = (region: HTMLElement) => {
    if (budget === "region") {
      return region.getBoundingClientRect().width;
    }
    if (budget === "band") {
      const band = region.closest<HTMLElement>(".exc-region-bottom");
      return band ? band.getBoundingClientRect().width / 2 : 0;
    }
    // the region's column: its top region, a gap, then this region
    const column = region.parentElement;
    const top = region.previousElementSibling;
    if (!column || !top) {
      return 0;
    }
    return (
      column.getBoundingClientRect().height -
      top.getBoundingClientRect().height -
      (parseFloat(getComputedStyle(column).rowGap) || 0) -
      (parseFloat(getComputedStyle(region).marginBottom) || 0)
    );
  };

  const measureRef = useRef<() => void>(() => {});
  measureRef.current = () => {
    const container = containerRef.current;
    const region = container?.closest<HTMLElement>(".exc-region");
    if (!container || !region) {
      return;
    }
    const { items, states } = latest.current;
    const stateOf = (id: string): ItemState => states[id] ?? "expanded";
    const sizes = sizesRef.current;
    const sizeOf = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return vertical ? rect.height : rect.width;
    };

    for (const element of container.querySelectorAll<HTMLElement>(
      ":scope > [data-region-item]",
    )) {
      const id = element.dataset.regionItem!;
      const cached = sizes.get(id) ?? {};
      cached[stateOf(id) === "collapsed" ? "collapsed" : "expanded"] =
        sizeOf(element);
      sizes.set(id, cached);
    }
    const menu = container.querySelector(":scope > .exc-region-overflow");
    if (menu) {
      menuSizeRef.current = sizeOf(menu);
    }

    const available = getBudget(region);
    if (!(available > 0)) {
      return;
    }

    // learn the collapsed size of `render` items before deciding anything
    const unprobed = items.filter(
      (item) =>
        item.collapse === "render" &&
        sizes.get(item.id)?.collapsed === undefined &&
        stateOf(item.id) !== "collapsed",
    );
    if (unprobed.length) {
      setStates((prev) => ({
        ...prev,
        ...Object.fromEntries(unprobed.map((item) => [item.id, "collapsed"])),
      }));
      return;
    }

    const style = getComputedStyle(vertical ? region : container);
    const gap = parseFloat(vertical ? style.rowGap : style.columnGap) || 0;
    const sizeIn = (item: RegionItemSpec, state: ItemState) => {
      if (state === "overflow") {
        return 0;
      }
      const cached = sizes.get(item.id);
      if (state === "collapsed") {
        return cached?.collapsed ?? cached?.expanded ?? 0;
      }
      if (!vertical && item.collapse === "shrink") {
        return item.minWidth;
      }
      if (vertical && item.minHeight > 0) {
        return Math.min(item.minHeight, cached?.expanded ?? item.minHeight);
      }
      return cached?.expanded ?? 0;
    };
    const total = (next: Record<string, ItemState>) => {
      let sum = 0;
      let count = 0;
      for (const item of items) {
        const size = sizeIn(item, next[item.id] ?? "expanded");
        if (size > 0) {
          sum += size;
          count++;
        }
      }
      if (items.some((item) => next[item.id] === "overflow")) {
        sum += menuSizeRef.current;
        count++;
      }
      return sum + gap * Math.max(0, count - 1);
    };

    const collapsedState = (item: RegionItemSpec): ItemState =>
      item.collapse === "render" ? "collapsed" : "overflow";
    const candidates = items
      .filter(
        (item) => item.collapse === "render" || item.collapse === "overflow",
      )
      .sort((a, b) => a.priority - b.priority || b.seq - a.seq);

    const next: Record<string, ItemState> = {};
    for (const item of candidates) {
      if (total(next) <= available + TOLERANCE_PX) {
        break;
      }
      next[item.id] = collapsedState(item);
    }

    if (floor) {
      const floorPx = `${Math.ceil(
        total(
          Object.fromEntries(
            candidates.map((item) => [item.id, collapsedState(item)]),
          ),
        ),
      )}px`;
      if (region.style.getPropertyValue(FLOOR_VAR) !== floorPx) {
        region.style.setProperty(FLOOR_VAR, floorPx);
      }
      region.setAttribute(FLOORED_ATTR, "");
    }

    const changed = items.some(
      (item) => stateOf(item.id) !== (next[item.id] ?? "expanded"),
    );
    if (changed) {
      setStates(next);
    }
  };

  // after every render: measure what's rendered now (and probe/decide)
  useLayoutEffect(() => {
    measureRef.current();
  });

  // and whenever the budget or an item resizes
  useEffect(() => {
    const container = containerRef.current;
    const region = container?.closest<HTMLElement>(".exc-region");
    const ResizeObserver = container?.ownerDocument.defaultView?.ResizeObserver;
    if (!container || !region || !ResizeObserver) {
      return;
    }
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      // deferred, so that reacting to a resize can't trip the
      // ResizeObserver loop limit
      frame = requestAnimationFrame(() => measureRef.current());
    });
    observer.observe(region);
    const budgetElement =
      budget === "band"
        ? region.closest(".exc-region-bottom")
        : budget === "column"
        ? region.parentElement
        : null;
    if (budgetElement) {
      observer.observe(budgetElement);
    }
    if (budget === "column" && region.previousElementSibling) {
      observer.observe(region.previousElementSibling);
    }
    const observed = new Set<Element>();
    const observeItems = () => {
      for (const element of container.querySelectorAll(
        ":scope > [data-region-item]",
      )) {
        if (!observed.has(element)) {
          observed.add(element);
          observer.observe(element);
        }
      }
    };
    observeItems();
    const mutations = new MutationObserver(observeItems);
    mutations.observe(container, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      if (floor) {
        region.removeAttribute(FLOORED_ATTR);
        region.style.removeProperty(FLOOR_VAR);
      }
    };
  }, [budget, floor]);

  const overflowMenu = hasOverflowItems && (
    <RegionOverflowMenu
      key="exc-region-overflow"
      items={overflowed}
      align={menuAlign}
      idle={overflowed.length === 0}
    />
  );

  return (
    <div
      className={clsx(className, { "exc-region-stack": vertical })}
      ref={containerRef}
    >
      {menuPosition === "first" && overflowMenu}
      {items
        .filter((item) => stateOf(item.id) !== "overflow")
        .map((item) => (
          <ItemWrapper
            key={item.id}
            item={item}
            state={stateOf(item.id)}
            vertical={vertical}
          />
        ))}
      {menuPosition === "last" && overflowMenu}
    </div>
  );
};
