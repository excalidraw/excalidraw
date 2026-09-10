import { act, render } from "@testing-library/react";
import { vi } from "vitest";

import CollabError from "../collab/CollabError";

import type { ErrorIndicator } from "../collab/CollabError";

// Helper to create ErrorIndicator
const errorIndicator = (
  message: string | null,
  nonce = 0,
): ErrorIndicator => ({
  message,
  nonce,
});

describe("CollabError", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when message is null", () => {
    const { container } = render(
      <CollabError collabError={errorIndicator(null)} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders warning icon when message is set", () => {
    const { container } = render(
      <CollabError collabError={errorIndicator("Save failed")} />,
    );
    expect(container.querySelector(".collab-errors-button")).toBeTruthy();
  });

  it("applies shake animation on first render", () => {
    const { container } = render(
      <CollabError collabError={errorIndicator("Save failed")} />,
    );
    const button = container.querySelector(".collab-errors-button");
    expect(button?.classList.contains("collab-errors-button-shake")).toBe(
      true,
    );
  });

  it("clears shake animation after 1 second", () => {
    const { container } = render(
      <CollabError collabError={errorIndicator("Save failed")} />,
    );
    const button = container.querySelector(".collab-errors-button");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(button?.classList.contains("collab-errors-button-shake")).toBe(
      false,
    );
  });

  it("does NOT re-animate when same message is passed again", () => {
    const { container, rerender } = render(
      <CollabError collabError={errorIndicator("Save failed", 0)} />,
    );
    const button = container.querySelector(".collab-errors-button");

    // Animation starts on first render
    expect(button?.classList.contains("collab-errors-button-shake")).toBe(
      true,
    );

    // Clear animation
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(button?.classList.contains("collab-errors-button-shake")).toBe(
      false,
    );

    // Re-render with same message but different nonce (simulates retry)
    rerender(
      <CollabError collabError={errorIndicator("Save failed", 1)} />,
    );

    // Should NOT re-animate because message is the same
    expect(button?.classList.contains("collab-errors-button-shake")).toBe(
      false,
    );
  });

  it("re-animates when a different message is passed", () => {
    const { container, rerender } = render(
      <CollabError collabError={errorIndicator("Save failed")} />,
    );
    const button = container.querySelector(".collab-errors-button");

    // Animation starts
    expect(button?.classList.contains("collab-errors-button-shake")).toBe(
      true,
    );

    // Clear animation
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(button?.classList.contains("collab-errors-button-shake")).toBe(
      false,
    );

    // Re-render with different message
    rerender(
      <CollabError
        collabError={errorIndicator("Canvas too big, save locally")}
      />,
    );

    // Should re-animate because message changed
    expect(button?.classList.contains("collab-errors-button-shake")).toBe(
      true,
    );
  });

  it("re-animates when message changes from null to a value", () => {
    const { container, rerender } = render(
      <CollabError collabError={errorIndicator(null)} />,
    );
    expect(container.firstChild).toBeNull();

    rerender(<CollabError collabError={errorIndicator("Save failed")} />);

    const button = container.querySelector(".collab-errors-button-shake");
    expect(button).toBeTruthy();
  });

  it("does NOT animate when re-rendered with null message after showing error", () => {
    const { container, rerender } = render(
      <CollabError collabError={errorIndicator("Save failed")} />,
    );

    // Clear animation
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Re-render with null
    rerender(<CollabError collabError={errorIndicator(null)} />);

    // Should render nothing
    expect(container.firstChild).toBeNull();
  });
});
