import { render as renderComponent, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import { HYPERLINK_TOOLTIP_DELAY } from "@excalidraw/common";
import { newTextElement } from "@excalidraw/element";

import type { ElementsMap } from "@excalidraw/element/types";

import {
  TOOLTIP_CLASS,
  TOOLTIP_VISIBLE_CLASS,
  Tooltip,
  hideTooltip,
} from "../components/Tooltip";
import {
  hideHyperlinkToolip,
  showHyperlinkTooltip,
  type HyperlinkTooltipOwner,
} from "../components/hyperlink/Hyperlink";

import { act } from "./test-utils";

import type { AppState } from "../types";

const TOOLTIP_DELAY = 500;
const TOOLTIP_WARM_WINDOW = 300;

const getTooltip = () =>
  document.querySelector<HTMLDivElement>(`.${TOOLTIP_CLASS}`);

const isTooltipVisible = () =>
  !!getTooltip()?.classList.contains(TOOLTIP_VISIBLE_CLASS);

const wrapperOf = (container: HTMLElement, label: string) =>
  container.querySelector<HTMLDivElement>(`[data-testid="${label}"]`)!
    .parentElement!;

const Harness = ({ labels, delay }: { labels: string[]; delay?: boolean }) => (
  <>
    {labels.map((label) => (
      <Tooltip key={label} label={label} delay={delay}>
        <button data-testid={label} />
      </Tooltip>
    ))}
  </>
);

describe("Tooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // the tooltip state is shared by every instance (one tooltip node per
    // page), so start each test cold: nothing visible, warm window elapsed
    hideTooltip();
    vi.advanceTimersByTime(TOOLTIP_WARM_WINDOW + 1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not flash when the pointer only passes over", () => {
    const { container } = renderComponent(<Harness labels={["a"]} delay />);
    const wrapper = wrapperOf(container, "a");

    fireEvent.pointerEnter(wrapper);
    fireEvent.pointerLeave(wrapper);

    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY);
    });
    expect(isTooltipVisible()).toBe(false);
  });

  it("skips the delay while still warm from a tooltip that just hid", () => {
    const { container } = renderComponent(
      <Harness labels={["a", "b"]} delay />,
    );

    fireEvent.pointerEnter(wrapperOf(container, "a"));
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY);
    });
    expect(isTooltipVisible()).toBe(true);

    fireEvent.pointerLeave(wrapperOf(container, "a"));
    expect(isTooltipVisible()).toBe(false);

    fireEvent.pointerEnter(wrapperOf(container, "b"));
    expect(isTooltipVisible()).toBe(true);
    expect(getTooltip()!.textContent).toBe("b");
  });

  it("an unrelated Tooltip unmounting doesn't hide a visible tooltip", async () => {
    const { container, rerender } = renderComponent(
      <Harness labels={["a", "b"]} />,
    );

    fireEvent.pointerEnter(wrapperOf(container, "a"));
    expect(isTooltipVisible()).toBe(true);

    // "b" unmounts for its own reasons (e.g. a collaborator leaving)
    rerender(<Harness labels={["a"]} />);
    await Promise.resolve();

    expect(isTooltipVisible()).toBe(true);
    expect(getTooltip()!.textContent).toBe("a");
  });

  it("hides when the Tooltip showing it unmounts", async () => {
    const { container, rerender } = renderComponent(
      <Harness labels={["a", "b"]} />,
    );

    fireEvent.pointerEnter(wrapperOf(container, "a"));
    expect(isTooltipVisible()).toBe(true);

    rerender(<Harness labels={["b"]} />);
    // retracted by the MutationObserver, whose callbacks run as a microtask
    await Promise.resolve();

    expect(isTooltipVisible()).toBe(false);
  });

  it("hides when the Tooltip showing it gets disabled", async () => {
    const { container, rerender } = renderComponent(
      <Tooltip label="a" disabled={false}>
        <button data-testid="a" />
      </Tooltip>,
    );

    fireEvent.pointerEnter(wrapperOf(container, "a"));
    expect(isTooltipVisible()).toBe(true);

    // a disabled Tooltip renders no wrapper, so its onPointerLeave never fires
    rerender(
      <Tooltip label="a" disabled>
        <button data-testid="a" />
      </Tooltip>,
    );
    await Promise.resolve();

    expect(isTooltipVisible()).toBe(false);
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
    expect(getTooltip()).toHaveClass(TOOLTIP_VISIBLE_CLASS);
    return owner;
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("drops the tooltip when its owning window goes away", () => {
    const tooltip = () => getTooltip();

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
    const tooltip = getTooltip();
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
    const tooltip = getTooltip();

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
