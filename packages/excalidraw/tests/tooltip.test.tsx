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

describe("Tooltip", () => {
  it("hides the shared tooltip when disabled mid-hover", () => {
    const { rerender } = render(
      <Tooltip label="Help" disabled={false}>
        <button>hover me</button>
      </Tooltip>,
    );
    const wrapper = document.querySelector(".excalidraw-tooltip-wrapper");
    expect(wrapper).not.toBeNull();

    act(() => {
      fireEvent.pointerEnter(wrapper as HTMLElement);
    });
    const tooltip = getSharedTooltip(document);
    expect(tooltip).not.toBeNull();
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    rerender(
      <Tooltip label="Help" disabled>
        <button>hover me</button>
      </Tooltip>,
    );
    expect(document.querySelector(".excalidraw-tooltip-wrapper")).toBeNull();
    // the wrapper's onPointerLeave never fires once the node is gone,
    // so the component itself must clear the shared tooltip div
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });

  it("shows the tooltip again after re-enabling", () => {
    const { rerender } = render(
      <Tooltip label="Help" disabled>
        <button>hover me</button>
      </Tooltip>,
    );
    expect(document.querySelector(".excalidraw-tooltip-wrapper")).toBeNull();

    rerender(
      <Tooltip label="Help" disabled={false}>
        <button>hover me</button>
      </Tooltip>,
    );
    const wrapper = document.querySelector(".excalidraw-tooltip-wrapper");
    act(() => {
      fireEvent.pointerEnter(wrapper as HTMLElement);
    });
    const tooltip = getSharedTooltip(document);
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);
    expect(tooltip?.textContent).toBe("Help");
  });

  it("still hides the tooltip on unmount while hovered", () => {
    const { unmount } = render(
      <Tooltip label="Help">
        <button>hover me</button>
      </Tooltip>,
    );
    const wrapper = document.querySelector(".excalidraw-tooltip-wrapper");
    act(() => {
      fireEvent.pointerEnter(wrapper as HTMLElement);
    });
    const tooltip = getSharedTooltip(document);
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    unmount();
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });
});

describe("hyperlink tooltip", () => {
  const makeLink = (link: string) =>
    newTextElement({ x: 0, y: 0, text: "hello", link });

  const makeElementsMap = (element: ReturnType<typeof makeLink>) =>
    new Map([[element.id, element]]) as ElementsMap;

  const appState = {
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
    offsetLeft: 0,
    offsetTop: 0,
  } as AppState;

  const showAndRender = (link: string): HyperlinkTooltipOwner => {
    const element = makeLink(link);
    const elementsMap = makeElementsMap(element);
    const owner: HyperlinkTooltipOwner = {};
    act(() => {
      showHyperlinkTooltip(element, appState, elementsMap, document, owner);
      vi.advanceTimersByTime(HYPERLINK_TOOLTIP_DELAY + 1);
    });
    return owner;
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the tooltip only after the hover delay", () => {
    const element = makeLink("https://example.com");
    const elementsMap = makeElementsMap(element);
    const owner: HyperlinkTooltipOwner = {};

    act(() => {
      showHyperlinkTooltip(element, appState, elementsMap, document, owner);
    });
    expect(getSharedTooltip(document)).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);

    act(() => {
      vi.advanceTimersByTime(HYPERLINK_TOOLTIP_DELAY + 1);
    });
    const tooltip = getSharedTooltip(document);
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);
    expect(tooltip?.textContent).toBe(element.link);

    hideHyperlinkToolip(owner);
  });

  it("drops the tooltip when the owning window blurs", () => {
    showAndRender("https://example.com");
    const tooltip = getSharedTooltip(document);
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    // no in-window event will ever call hideHyperlinkToolip after the
    // window loses focus, so the window itself must drop the tooltip
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });

  it("drops the tooltip when the owning window is hidden", () => {
    showAndRender("https://example.com");
    const tooltip = getSharedTooltip(document);
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    // pagehide fires on window close even when blur is skipped (e.g.
    // programmatic close), so the globals must not retain the detached
    // document/window
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });

  it("drops a pending tooltip on blur before it renders", () => {
    const element = makeLink("https://example.com");
    const elementsMap = makeElementsMap(element);
    const owner: HyperlinkTooltipOwner = {};
    act(() => {
      showHyperlinkTooltip(element, appState, elementsMap, document, owner);
    });

    act(() => {
      window.dispatchEvent(new Event("blur"));
      vi.advanceTimersByTime(HYPERLINK_TOOLTIP_DELAY + 1);
    });
    expect(getSharedTooltip(document)).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });

  it("drops the tooltip when the pointer leaves the owning window", () => {
    showAndRender("https://example.com");
    const tooltip = getSharedTooltip(document);
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    // relatedTarget is null only when the pointer actually left the window
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseout"));
    });
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });

  it("keeps the tooltip when the pointer moves within the window", () => {
    const owner = showAndRender("https://example.com");
    const tooltip = getSharedTooltip(document);
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    const event = new MouseEvent("mouseout");
    Object.defineProperty(event, "relatedTarget", { value: document.body });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    hideHyperlinkToolip(owner);
  });

  it("lets a new owner take over from a stale one", () => {
    showAndRender("https://first.example");
    const tooltip = getSharedTooltip(document);
    expect(tooltip?.textContent).toBe("https://first.example");

    const element = makeLink("https://second.example");
    const elementsMap = makeElementsMap(element);
    const secondOwner: HyperlinkTooltipOwner = {};
    act(() => {
      showHyperlinkTooltip(
        element,
        appState,
        elementsMap,
        document,
        secondOwner,
      );
    });
    // the previous owner's tooltip is cleared immediately on takeover,
    // not left visible while the new one is pending
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
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    hideHyperlinkToolip({});
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    hideHyperlinkToolip();
    expect(tooltip).toHaveClass(TOOLTIP_VISIBLE_CLASS);

    hideHyperlinkToolip(owner);
    expect(tooltip).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
  });
});
