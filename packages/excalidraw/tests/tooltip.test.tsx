import { render as renderComponent, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import { Tooltip, hideTooltip } from "../components/Tooltip";

import { act } from "./test-utils";

const TOOLTIP_DELAY = 500;
const TOOLTIP_WARM_WINDOW = 300;

const getTooltip = () =>
  document.querySelector<HTMLDivElement>(".excalidraw-tooltip");

const isTooltipVisible = () =>
  !!getTooltip()?.classList.contains("excalidraw-tooltip--visible");

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

  it("shows right away without `delay`", () => {
    const { container } = renderComponent(<Harness labels={["a"]} />);

    fireEvent.pointerEnter(wrapperOf(container, "a"));
    expect(isTooltipVisible()).toBe(true);
    expect(getTooltip()!.textContent).toBe("a");
  });

  it("shows only after TOOLTIP_DELAY with `delay`", () => {
    const { container } = renderComponent(<Harness labels={["a"]} delay />);

    fireEvent.pointerEnter(wrapperOf(container, "a"));
    expect(isTooltipVisible()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY - 1);
    });
    expect(isTooltipVisible()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(isTooltipVisible()).toBe(true);
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

  it("goes back to delaying once the warm window has passed", () => {
    const { container } = renderComponent(
      <Harness labels={["a", "b"]} delay />,
    );

    fireEvent.pointerEnter(wrapperOf(container, "a"));
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY);
    });
    fireEvent.pointerLeave(wrapperOf(container, "a"));

    act(() => {
      vi.advanceTimersByTime(TOOLTIP_WARM_WINDOW + 1);
    });

    fireEvent.pointerEnter(wrapperOf(container, "b"));
    expect(isTooltipVisible()).toBe(false);
  });

  it("an unrelated Tooltip unmounting doesn't cancel a pending tooltip", () => {
    const { container, rerender } = renderComponent(
      <Harness labels={["a", "b"]} delay />,
    );

    fireEvent.pointerEnter(wrapperOf(container, "a"));

    // "b" unmounts for its own reasons (e.g. a collaborator leaving)
    rerender(<Harness labels={["a"]} delay />);

    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY);
    });
    expect(isTooltipVisible()).toBe(true);
    expect(getTooltip()!.textContent).toBe("a");
  });

  it("an unrelated Tooltip unmounting doesn't hide a visible tooltip", () => {
    const { container, rerender } = renderComponent(
      <Harness labels={["a", "b"]} />,
    );

    fireEvent.pointerEnter(wrapperOf(container, "a"));
    expect(isTooltipVisible()).toBe(true);

    rerender(<Harness labels={["a"]} />);

    expect(isTooltipVisible()).toBe(true);
    expect(getTooltip()!.textContent).toBe("a");
  });

  it("hides when the Tooltip showing it unmounts", () => {
    const { container, rerender } = renderComponent(
      <Harness labels={["a", "b"]} />,
    );

    fireEvent.pointerEnter(wrapperOf(container, "a"));
    expect(isTooltipVisible()).toBe(true);

    rerender(<Harness labels={["b"]} />);

    expect(isTooltipVisible()).toBe(false);
  });
});
