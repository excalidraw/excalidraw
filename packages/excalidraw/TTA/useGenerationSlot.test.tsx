import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useGenerationSlot } from "./useGenerationSlot";

describe("useGenerationSlot", () => {
  it("no-ops a second acquire while a generation is in flight (C1)", () => {
    const { result } = renderHook(() => useGenerationSlot());

    let release: (() => void) | null = null;
    act(() => {
      release = result.current.acquireGenerationSlot();
    });
    expect(release).not.toBeNull();
    expect(result.current.isGenerationActive).toBe(true);

    let secondRelease: (() => void) | null = null;
    act(() => {
      secondRelease = result.current.acquireGenerationSlot();
    });
    expect(secondRelease).toBeNull();
    expect(result.current.hasActiveGeneration()).toBe(true);
  });

  it("frees the slot on release and allows a new acquire", () => {
    const { result } = renderHook(() => useGenerationSlot());

    let release: (() => void) | null = null;
    act(() => {
      release = result.current.acquireGenerationSlot();
    });
    act(() => {
      release!();
    });
    expect(result.current.isGenerationActive).toBe(false);

    let next: (() => void) | null = null;
    act(() => {
      next = result.current.acquireGenerationSlot();
    });
    expect(next).not.toBeNull();
  });

  it("ignores a stale release after a force-release + new acquire (finally-clobber race)", () => {
    const { result } = renderHook(() => useGenerationSlot());

    let staleRelease: (() => void) | null = null;
    act(() => {
      staleRelease = result.current.acquireGenerationSlot();
    });

    // cancel-and-replace: force-free, then a successor takes the slot
    act(() => {
      result.current.releaseGenerationSlot();
    });
    act(() => {
      result.current.acquireGenerationSlot();
    });
    expect(result.current.isGenerationActive).toBe(true);

    // the canceled generation's finally fires late — must not free the
    // successor's slot
    act(() => {
      staleRelease!();
    });
    expect(result.current.isGenerationActive).toBe(true);
    expect(result.current.hasActiveGeneration()).toBe(true);
  });
});
