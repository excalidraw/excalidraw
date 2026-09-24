import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useCopyStatus } from "../hooks/useCopiedIndicator";

describe("useCopyStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("transitions to 'success' on onCopy and back to null after TIMEOUT", () => {
    const { result } = renderHook(() => useCopyStatus());

    expect(result.current.copyStatus).toBe(null);

    act(() => {
      result.current.onCopy();
    });
    expect(result.current.copyStatus).toBe("success");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copyStatus).toBe(null);
  });

  it("clears the pending timeout on unmount so it does not fire on an unmounted component", () => {
    // jsdom has no real DOM cleanup, but we can observe that once the
    // consumer unmounts, the scheduled setTimeout callback has been cancelled
    // (i.e. no pending timers remain). without the cleanup effect, a call
    // to `onCopy` leaves a live setTimeout that would later call
    // `setCopyStatus(null)` on an unmounted component.
    const { result, unmount } = renderHook(() => useCopyStatus());

    act(() => {
      result.current.onCopy();
    });

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
