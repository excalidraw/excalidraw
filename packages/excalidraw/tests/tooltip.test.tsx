import React from "react";

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { HYPERLINK_TOOLTIP_DELAY } from "@excalidraw/common";
import { newTextElement } from "@excalidraw/element";

import type { ElementsMap } from "@excalidraw/element/types";

import {
  TOOLTIP_CLASS,
  TOOLTIP_VISIBLE_CLASS,
  Tooltip,
} from "../components/Tooltip";

import {
  hideHyperlinkToolip,
  showHyperlinkTooltip,
  type HyperlinkTooltipOwner,
} from "../components/hyperlink/Hyperlink";

import type { AppState } from "../types";

const getSharedTooltip = (ownerDocument: Document) =>
  ownerDocument.querySelector(`.${TOOLTIP_CLASS}`);

/**
 * The tooltip is a single div shared by every trigger in the process, shown
 * and hidden imperatively. Its bugs are all the same shape: the event that
 * would hide it never arrives (the trigger is gone, the window lost focus,
 * the owner is another editor), leaving a stale tooltip on screen. See also
 * the cross-document scoping covered in `hostAbstraction.test.tsx`.
 */
describe("Tooltip", () => {
  it("clears the shared tooltip when the trigger goes away mid-hover", () => {
    const { rerender, unmount } = render(
      <Tooltip label="Help" disabled={false}>
        <button>hover me</button>
      </Tooltip>,
    );

    const hover = () => {
      const wrapper = document.querySelector(".excalidraw-tooltip-wrapper");
      expect(wrapper).not.toBeNull();
      act(() => {
        fireEvent.pointerEnter(wrapper as HTMLElement);
      });
      const tooltip = getSharedTooltip(document);
      expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);
      return tooltip;
    };

    // the wrapper's onPointerLeave never fires once the node is gone, so the
    // component itself has to clear the shared div -- on disable...
    const tooltip = hover();
    rerender(
      <Tooltip label="Help" disabled>
        <button>hover me</button>
      </Tooltip>,
    );
    expect(document.querySelector(".excalidraw-tooltip-wrapper")).toBeNull();
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);

    // ...and on unmount
    rerender(
      <Tooltip label="Help" disabled={false}>
        <button>hover me</button>
      </Tooltip>,
    );
    expect(hover()?.textContent).toBe("Help");
    unmount();
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });
});

describe("hyperlink tooltip", () => {
  const appState = {
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
    offsetLeft: 0,
    offsetTop: 0,
  } as AppState;

  const show = (link: string, owner: HyperlinkTooltipOwner = {}) => {
    const element = newTextElement({ x: 0, y: 0, text: "hello", link });
    const elementsMap = new Map([[element.id, element]]) as ElementsMap;
    act(() => {
      showHyperlinkTooltip(element, appState, elementsMap, document, owner);
    });
    return owner;
  };

  const showAndRender = (link: string) => {
    const owner = show(link);
    act(() => {
      vi.advanceTimersByTime(HYPERLINK_TOOLTIP_DELAY + 1);
    });
    expect(getSharedTooltip(document)).toHaveClass(TOOLTIP_VISIBLE_CLASS);
    return owner;
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("drops the tooltip when its owning window goes away", () => {
    const tooltip = () => getSharedTooltip(document);

    // no in-window event will ever call `hideHyperlinkToolip` once the window
    // loses focus, so the window itself must drop the tooltip
    showAndRender("https://example.com");
    act(() => window.dispatchEvent(new Event("blur")));
    expect(tooltip()).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);

    // pagehide fires on window close even when blur is skipped (e.g. a
    // programmatic close), so the globals must not retain the detached
    // document/window
    showAndRender("https://example.com");
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(tooltip()).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);

    // a null relatedTarget means the pointer actually left the window...
    showAndRender("https://example.com");
    act(() => window.dispatchEvent(new MouseEvent("mouseout")));
    expect(tooltip()).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);

    // ...while a move within it must leave the tooltip alone
    const owner = showAndRender("https://example.com");
    const withinWindow = new MouseEvent("mouseout");
    Object.defineProperty(withinWindow, "relatedTarget", {
      value: document.body,
    });
    act(() => window.dispatchEvent(withinWindow));
    expect(tooltip()).toHaveClass(TOOLTIP_VISIBLE_CLASS);
    hideHyperlinkToolip(owner);

    // a tooltip still waiting out its hover delay must be dropped too, rather
    // than rendering into a window that is already gone
    show("https://example.com");
    act(() => {
      window.dispatchEvent(new Event("blur"));
      vi.advanceTimersByTime(HYPERLINK_TOOLTIP_DELAY + 1);
    });
    expect(tooltip()).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });

  it("lets a new owner take over from a stale one", () => {
    showAndRender("https://first.example");
    const tooltip = getSharedTooltip(document);
    expect(tooltip?.textContent).toBe("https://first.example");

    show("https://second.example");
    // the previous owner's tooltip is cleared immediately on takeover, not
    // left visible while the new one is pending
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);

    act(() => {
      vi.advanceTimersByTime(HYPERLINK_TOOLTIP_DELAY + 1);
    });
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);
    expect(tooltip?.textContent).toBe("https://second.example");
  });

  it("ignores hide calls from a foreign owner", () => {
    const owner = showAndRender("https://example.com");
    const tooltip = getSharedTooltip(document);

    // another editor's pointer leaving its own link must not tear down the
    // tooltip this one owns
    hideHyperlinkToolip({});
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);
    hideHyperlinkToolip();
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    hideHyperlinkToolip(owner);
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });
});
