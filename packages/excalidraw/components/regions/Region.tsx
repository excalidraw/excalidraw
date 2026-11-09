import React, { useContext, useId, useLayoutEffect, useRef } from "react";

import { isDevEnv } from "@excalidraw/common";

import { useTunnels } from "../../context/tunnels";

import type {
  RegionArea,
  RegionItemCollapse,
  RegionItemContent,
  RegionItemMobile,
} from "./RegionRegistry";

const RegionAreaContext = React.createContext<RegionArea | null>(null);

/**
 * Places host UI into one of the editor's layout regions. Render it as a
 * child of `<Excalidraw>`, with `<Region.Item>` children:
 *
 * ```tsx
 * <Excalidraw>
 *   <Region area="top-right">
 *     <Region.Item priority={10} collapse="render">
 *       {({ collapsed }) => (collapsed ? <ShareIcon /> : <ShareButton />)}
 *     </Region.Item>
 *     <Region.Item priority={1} collapse="overflow">
 *       <PromoBanner />
 *     </Region.Item>
 *   </Region>
 * </Excalidraw>
 * ```
 *
 * See `RegionItemCollapse` for how items give up space.
 */
export const Region = ({
  area,
  children,
}: {
  area: RegionArea;
  children?: React.ReactNode;
}) => (
  <RegionAreaContext.Provider value={area}>
    {children}
  </RegionAreaContext.Provider>
);

const RegionItem = ({
  priority = 0,
  collapse = "rigid",
  order = 10,
  minWidth = 0,
  minHeight = 0,
  mobile = "same",
  className,
  children,
}: {
  /** lower priority gives up space first (default 0) */
  priority?: number;
  /** how the item gives up space (default "rigid") */
  collapse?: RegionItemCollapse;
  /** position within the region, ascending (default 10) */
  order?: number;
  /** `collapse="shrink"`: the width (px) the item never shrinks below */
  minWidth?: number;
  /**
   * center regions: the height (px) the item scrolls down to before it
   * collapses (default 0: doesn't scroll)
   */
  minHeight?: number;
  /** how the item shows in the phone layout (default "same") */
  mobile?: RegionItemMobile;
  className?: string;
  children?: RegionItemContent;
}) => {
  const area = useContext(RegionAreaContext);
  const { regions } = useTunnels();
  const id = useId();
  const seqRef = useRef<number | null>(null);
  if (seqRef.current === null) {
    seqRef.current = regions.nextSeq();
  }

  if (isDevEnv()) {
    if (!area) {
      console.warn("<Region.Item> must be rendered inside <Region area>");
    }
    if (collapse === "render" && typeof children !== "function") {
      console.warn(
        '<Region.Item collapse="render"> expects a function child ({ collapsed }) => ReactNode',
      );
    }
  }

  // re-registers on every render, so the region always renders the latest
  // children (like a tunnel)
  useLayoutEffect(() => {
    if (!area) {
      return;
    }
    regions.set({
      id,
      area,
      priority,
      collapse,
      order,
      minWidth,
      minHeight,
      mobile,
      className,
      content: children,
      seq: seqRef.current!,
    });
  });

  useLayoutEffect(() => () => regions.delete(id), [regions, id]);

  return null;
};
RegionItem.displayName = "Region.Item";

Region.Item = RegionItem;
Region.displayName = "Region";
