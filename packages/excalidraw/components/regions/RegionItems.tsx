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

import type { RegionArea, RegionItemSpec } from "./RegionRegistry";

type ItemState = "expanded" | "collapsed" | "overflow";

/** sub-pixel slack, so rounding can't flip an item back and forth */
const TOLERANCE_PX = 0.5;

const FLOOR_VAR = "--exc-region-floor";
const FLOORED_ATTR = "data-exc-region-floored";

const useRegisteredItems = (area: RegionArea) => {
  const { regions } = useTunnels();
  const entries = useSyncExternalStore(
    regions.subscribe,
    regions.getSnapshot,
    regions.getSnapshot,
  );
  return entries.filter((entry) => entry.area === area);
};

const ItemWrapper = ({
  item,
  state,
}: {
  item: RegionItemSpec;
  state: ItemState;
}) => (
  <div
    className={clsx(
      "exc-region-item",
      `exc-region-item--${item.collapse}`,
      { "exc-region-item--collapsed": state === "collapsed" },
      item.className,
    )}
    data-region-item={item.id}
    style={
      item.collapse === "shrink"
        ? ({
            "--exc-region-item-min-width": `${item.minWidth}px`,
          } as React.CSSProperties)
        : undefined
    }
  >
    {renderRegionItemContent(item.content, {
      collapsed: state === "collapsed",
      inOverflowMenu: false,
    })}
  </div>
);

/**
 * Renders a region's items expanded, in order, with no collapsing — for
 * regions that don't share a row with the toolbar, and the phone layout.
 */
export const RegionStaticItems = ({
  area,
  editorItems = [],
}: {
  area: RegionArea;
  editorItems?: RegionItemSpec[];
}) => {
  const items = sortRegionItems([...editorItems, ...useRegisteredItems(area)]);
  return (
    <>
      {items.map((item) => (
        <ItemWrapper key={item.id} item={item} state="expanded" />
      ))}
    </>
  );
};

/**
 * Renders a top region's items as a row (`className` is the row) and
 * collapses them by priority to fit the region's width.
 *
 * Each item's expanded and collapsed widths are measured and cached (a
 * `render` item is rendered collapsed for one pre-paint pass to learn its
 * collapsed width). The region's minimum width — what floors its column
 * against the toolbar — is set to the width of the FULLY collapsed row, so
 * it doesn't depend on the current collapse state and collapsing can't feed
 * back into the width it reacts to. Within that floor the region gets its
 * share of the top row, and items collapse, lowest priority first, until
 * the row fits it.
 *
 * Inert where layout isn't measurable (zero sizes, e.g. jsdom): everything
 * renders expanded and the region keeps its content-based minimum.
 */
export const RegionCluster = ({
  area,
  editorItems,
  className,
  menuAlign,
}: {
  area: "top-left" | "top-right";
  editorItems: RegionItemSpec[];
  className: string;
  /** which side of its trigger the "⋯" menu opens toward */
  menuAlign: "start" | "end";
}) => {
  const items = sortRegionItems([...editorItems, ...useRegisteredItems(area)]);

  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef(
    new Map<string, { expanded?: number; collapsed?: number }>(),
  );
  const menuWidthRef = useRef(0);

  const stateOf = (id: string): ItemState => states[id] ?? "expanded";

  const hasOverflowItems = items.some((item) => item.collapse === "overflow");
  const overflowed = items.filter((item) => stateOf(item.id) === "overflow");
  const isMenuIdle = overflowed.length === 0;

  const latest = useRef({ items, states });
  latest.current = { items, states };

  const measureRef = useRef<() => void>(() => {});
  measureRef.current = () => {
    const row = rowRef.current;
    const region = row?.closest<HTMLElement>(".exc-region");
    if (!row || !region) {
      return;
    }
    const { items, states } = latest.current;
    const stateOf = (id: string): ItemState => states[id] ?? "expanded";
    const widths = widthsRef.current;

    for (const element of row.querySelectorAll<HTMLElement>(
      ":scope > [data-region-item]",
    )) {
      const id = element.dataset.regionItem!;
      const width = element.getBoundingClientRect().width;
      const cached = widths.get(id) ?? {};
      cached[stateOf(id) === "collapsed" ? "collapsed" : "expanded"] = width;
      widths.set(id, cached);
    }
    const menu = row.querySelector<HTMLElement>(
      ":scope > .exc-region-overflow",
    );
    if (menu) {
      menuWidthRef.current = menu.getBoundingClientRect().width;
    }

    const available = region.getBoundingClientRect().width;
    if (!available) {
      return;
    }

    // learn the collapsed width of `render` items before deciding anything
    const unprobed = items.filter(
      (item) =>
        item.collapse === "render" &&
        widths.get(item.id)?.collapsed === undefined &&
        stateOf(item.id) !== "collapsed",
    );
    if (unprobed.length) {
      setStates((prev) => ({
        ...prev,
        ...Object.fromEntries(unprobed.map((item) => [item.id, "collapsed"])),
      }));
      return;
    }

    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const widthOf = (item: RegionItemSpec, state: ItemState) => {
      if (item.collapse === "shrink") {
        return item.minWidth;
      }
      const cached = widths.get(item.id);
      if (state === "overflow") {
        return 0;
      }
      if (state === "collapsed") {
        return cached?.collapsed ?? cached?.expanded ?? 0;
      }
      return cached?.expanded ?? 0;
    };
    const rowWidth = (next: Record<string, ItemState>) => {
      let sum = 0;
      let count = 0;
      for (const item of items) {
        const width = widthOf(item, next[item.id] ?? "expanded");
        if (width > 0) {
          sum += width;
          count++;
        }
      }
      if (items.some((item) => next[item.id] === "overflow")) {
        sum += menuWidthRef.current;
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
      if (rowWidth(next) <= available + TOLERANCE_PX) {
        break;
      }
      next[item.id] = collapsedState(item);
    }

    const floor = Math.ceil(
      rowWidth(
        Object.fromEntries(
          candidates.map((item) => [item.id, collapsedState(item)]),
        ),
      ),
    );
    if (region.style.getPropertyValue(FLOOR_VAR) !== `${floor}px`) {
      region.style.setProperty(FLOOR_VAR, `${floor}px`);
    }
    region.setAttribute(FLOORED_ATTR, "");

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

  // and whenever the region or an item resizes
  useEffect(() => {
    const row = rowRef.current;
    const region = row?.closest<HTMLElement>(".exc-region");
    const ResizeObserver = row?.ownerDocument.defaultView?.ResizeObserver;
    if (!row || !region || !ResizeObserver) {
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
    const observed = new Set<Element>();
    const observeItems = () => {
      for (const element of row.querySelectorAll(
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
    mutations.observe(row, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      region.removeAttribute(FLOORED_ATTR);
      region.style.removeProperty(FLOOR_VAR);
    };
  }, []);

  useEffect(() => {
    if (isMenuIdle) {
      setIsMenuOpen(false);
    }
  }, [isMenuIdle]);

  // the "⋯" menu sits on the row's canvas-facing end
  const overflowMenu = hasOverflowItems && (
    <div
      key="exc-region-overflow"
      className={clsx("exc-region-overflow", {
        "exc-region-overflow--idle": isMenuIdle,
      })}
      aria-hidden={isMenuIdle || undefined}
    >
      <DropdownMenu open={isMenuOpen && !isMenuIdle}>
        <DropdownMenu.Trigger
          className="exc-region-overflow__trigger"
          onToggle={() => setIsMenuOpen((open) => !open)}
          title={t("labels.regionOverflow")}
          aria-label={t("labels.regionOverflow")}
          tabIndex={isMenuIdle ? -1 : undefined}
        >
          {DotsHorizontalIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          className="exc-region-overflow__menu"
          align={menuAlign}
          onClickOutside={() => setIsMenuOpen(false)}
        >
          {overflowed.map((item) => (
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

  const inRow = items.filter((item) => stateOf(item.id) !== "overflow");

  return (
    <div className={className} ref={rowRef}>
      {area === "top-right" && overflowMenu}
      {inRow.map((item) => (
        <ItemWrapper key={item.id} item={item} state={stateOf(item.id)} />
      ))}
      {area === "top-left" && overflowMenu}
    </div>
  );
};
