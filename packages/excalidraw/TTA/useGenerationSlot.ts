import { useCallback, useRef, useState } from "react";

/**
 * Single-flight slot for AI generations: at most one generation may hold the
 * slot at a time (tta_rewrite_final.md §2.3). The slot must be acquired
 * synchronously BEFORE any chat mutation so a concurrent send can never
 * mutate the conversation (C1), and releases are ownership-checked so a
 * canceled generation unwinding late can't clobber its successor's slot.
 */
export const useGenerationSlot = () => {
  const slotRef = useRef<symbol | null>(null);
  // render mirror of `slotRef` — drives `isSending` UI state
  const [isGenerationActive, setIsGenerationActive] = useState(false);

  const hasActiveGeneration = useCallback(() => slotRef.current !== null, []);

  /**
   * Returns a release function when the slot was free, `null` when a
   * generation is already in flight (caller must treat that as a no-op).
   * The release is ownership-checked: releasing after `releaseGenerationSlot`
   * (or after a successor acquired the slot) does nothing.
   */
  const acquireGenerationSlot = useCallback(() => {
    if (slotRef.current) {
      return null;
    }
    const slot = Symbol("tta-generation");
    slotRef.current = slot;
    setIsGenerationActive(true);
    return () => {
      if (slotRef.current === slot) {
        slotRef.current = null;
        setIsGenerationActive(false);
      }
    };
  }, []);

  /** Force-frees the slot (Stop / delete / cancel-and-replace). */
  const releaseGenerationSlot = useCallback(() => {
    slotRef.current = null;
    setIsGenerationActive(false);
  }, []);

  return {
    isGenerationActive,
    hasActiveGeneration,
    acquireGenerationSlot,
    releaseGenerationSlot,
  };
};
