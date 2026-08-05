import "pepjs";

import React from "react";

import { fireEvent, render, waitFor } from "@testing-library/react";

import { useTapClickFallback } from "./useTapClickFallback";

const TOUCH_POINTER = {
  pointerType: "touch",
  isPrimary: true,
  button: 0,
  clientX: 10,
  clientY: 10,
} as const;

const Harness = ({
  onButtonClick,
  disabled = false,
  onNonInteractiveClick,
}: {
  onButtonClick: () => void;
  disabled?: boolean;
  onNonInteractiveClick?: () => void;
}) => {
  const containerRef = useTapClickFallback<HTMLDivElement>();

  return (
    <div ref={containerRef} data-testid="container">
      <button
        type="button"
        data-testid="btn"
        disabled={disabled}
        onClick={onButtonClick}
      >
        button
      </button>
      <div data-testid="non-interactive" onClick={onNonInteractiveClick}>
        not interactive
      </div>
    </div>
  );
};

const getBtn = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="btn"]')!;
const getNonInteractive = () =>
  document.querySelector<HTMLElement>('[data-testid="non-interactive"]')!;

const tap = (element: HTMLElement) => {
  fireEvent.pointerDown(element, TOUCH_POINTER);
  fireEvent.pointerUp(element, TOUCH_POINTER);
};

const flushFallbackTimer = () =>
  new Promise((resolve) => setTimeout(resolve, 50));

describe("useTapClickFallback", () => {
  it("replays the click when the browser suppresses it and swallows a late native click", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Harness onButtonClick={onClick} />);

    // touch tap without a native click (the event sequence produced on iOS
    // when the tap interrupts a scroll animation)
    tap(getBtn());

    // fallback fires after one event-loop turn
    await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));

    // a late native click arriving after the fallback must be swallowed —
    // the button must not be activated a second time
    fireEvent.click(getBtn());
    expect(onClick).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("lets the native click win when it arrives before the fallback", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Harness onButtonClick={onClick} />);

    tap(getBtn());
    // native click arrives right after pointerup (settled menu)
    fireEvent.click(getBtn());
    expect(onClick).toHaveBeenCalledTimes(1);

    await flushFallbackTimer();
    expect(onClick).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("does not activate disabled controls", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Harness onButtonClick={onClick} disabled />);

    tap(getBtn());
    await flushFallbackTimer();

    expect(onClick).not.toHaveBeenCalled();

    unmount();
  });

  it("does not activate non-interactive elements", async () => {
    const onClick = vi.fn();
    const onNonInteractiveClick = vi.fn();
    const { unmount } = render(
      <Harness
        onButtonClick={onClick}
        onNonInteractiveClick={onNonInteractiveClick}
      />,
    );

    tap(getNonInteractive());
    await flushFallbackTimer();

    expect(onNonInteractiveClick).not.toHaveBeenCalled();

    unmount();
  });

  it("does not activate when the pointer moved (real drag/scroll)", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Harness onButtonClick={onClick} />);

    fireEvent.pointerDown(getBtn(), TOUCH_POINTER);
    // drag beyond the dragging threshold
    fireEvent.pointerMove(getBtn(), {
      ...TOUCH_POINTER,
      clientX: 10,
      clientY: 60,
    });
    fireEvent.pointerUp(getBtn(), { ...TOUCH_POINTER, clientY: 60 });
    await flushFallbackTimer();

    expect(onClick).not.toHaveBeenCalled();

    unmount();
  });

  it("ignores non-touch pointers (mouse/trackpad/pen are left alone)", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Harness onButtonClick={onClick} />);

    fireEvent.pointerDown(getBtn(), {
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(getBtn(), {
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    await flushFallbackTimer();

    // no fallback for mouse; a regular mouse click still works
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(getBtn());
    expect(onClick).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("cleans up after pointercancel and keeps working", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Harness onButtonClick={onClick} />);

    fireEvent.pointerDown(getBtn(), TOUCH_POINTER);
    fireEvent.pointerCancel(getBtn(), TOUCH_POINTER);
    await flushFallbackTimer();

    expect(onClick).not.toHaveBeenCalled();

    // no stale state: a subsequent normal click still works
    fireEvent.click(getBtn());
    expect(onClick).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("does not leave timers or listeners behind after unmount", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Harness onButtonClick={onClick} />);

    fireEvent.pointerDown(getBtn(), TOUCH_POINTER);
    unmount();
    await flushFallbackTimer();

    expect(onClick).not.toHaveBeenCalled();
  });

  it("disarms the latch on a new tap of the same element", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Harness onButtonClick={onClick} />);

    tap(getBtn());
    await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));

    // a new deliberate tap on the same element: its native click must not be
    // swallowed by the previous gesture's latch
    tap(getBtn());
    fireEvent.click(getBtn());
    expect(onClick).toHaveBeenCalledTimes(2);

    await flushFallbackTimer();
    expect(onClick).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("disarms the latch on keydown (keyboard activation not swallowed)", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Harness onButtonClick={onClick} />);

    tap(getBtn());
    await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));

    // keyboard activation dispatches a click without a pointerdown — the
    // keydown must disarm the latch so the click is not swallowed
    const container = document.querySelector<HTMLElement>(
      '[data-testid="container"]',
    )!;
    fireEvent.keyDown(container, { key: "Enter" });
    fireEvent.click(getBtn());
    expect(onClick).toHaveBeenCalledTimes(2);

    unmount();
  });
});
