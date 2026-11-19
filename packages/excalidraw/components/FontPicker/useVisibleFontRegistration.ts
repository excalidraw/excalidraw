import { useCallback, useEffect, useRef } from "react";

import { isCustomFontFamily } from "@excalidraw/common";

import type { CustomFontFamily, FontFamily } from "@excalidraw/common";

import { type Fonts } from "../../fonts";

interface VisibleFontRegistrationOptions {
  fonts: Fonts;
  registeredFonts: Fonts["registered"];
  failedResolutions: ReadonlyMap<string, unknown>;
  /**
   * without providers nothing is resolvable, so observing rows would only
   * dispatch guaranteed-`unsupported` registrations - disabled, the hook
   * costs nothing
   */
  enabled: boolean;
}

const noopRef = () => {};

/**
 * Resolve custom fonts lazily, as their rows scroll into view, so each renders
 * in its own typeface - resolving the whole catalog on open would fire one
 * provider request per available font.
 */
export const useVisibleFontRegistration = ({
  fonts,
  registeredFonts,
  failedResolutions,
  enabled,
}: VisibleFontRegistrationOptions) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const fontItemRefs = useRef(new Map<FontFamily, HTMLButtonElement>());
  const familiesByElement = useRef(new Map<Element, CustomFontFamily>());

  const shouldObserve = useCallback(
    (family: FontFamily): family is CustomFontFamily => {
      if (!isCustomFontFamily(family)) {
        return false;
      }

      // "registered" needs nothing and "failed" has its retry affordance.
      // "loading" is still dispatched: the in-flight resolution may be a
      // silent one (a probe or export, which never record failures), and
      // joining it attaches the user-visible failure semantics this row needs
      const status = fonts.getResolutionStatus(family);
      return status !== "registered" && status !== "failed";
    },
    [fonts],
  );

  const setScrollContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node || typeof IntersectionObserver === "undefined") {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const visibleFamilies: CustomFontFamily[] = [];
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }

            const family = familiesByElement.current.get(entry.target);
            if (family && shouldObserve(family)) {
              visibleFamilies.push(family);
            }
          }

          if (!visibleFamilies.length) {
            return;
          }

          // a repeat dispatch joins the pending resolution rather than
          // re-running the resolver, so racing callbacks are cheap
          void fonts.registerCustomFamilies(visibleFamilies).then((results) => {
            for (const { family } of results) {
              const element = fontItemRefs.current.get(family);
              if (element) {
                observerRef.current?.unobserve(element);
              }
            }
          });
        },
        {
          root: node,
          rootMargin: "50px 0px",
        },
      );
      observerRef.current = observer;

      for (const [family, element] of fontItemRefs.current) {
        if (shouldObserve(family)) {
          observer.observe(element);
        }
      }
    },
    [fonts, shouldObserve],
  );

  const setFontItemRef = useCallback(
    (family: FontFamily, node: HTMLButtonElement | null) => {
      const previousNode = fontItemRefs.current.get(family);
      if (previousNode) {
        observerRef.current?.unobserve(previousNode);
        familiesByElement.current.delete(previousNode);
        fontItemRefs.current.delete(family);
      }

      if (!node) {
        return;
      }

      fontItemRefs.current.set(family, node);
      if (isCustomFontFamily(family)) {
        familiesByElement.current.set(node, family);
      }
      if (shouldObserve(family)) {
        observerRef.current?.observe(node);
      }
    },
    [shouldObserve],
  );

  useEffect(() => {
    for (const [family, element] of fontItemRefs.current) {
      if (
        isCustomFontFamily(family) &&
        (registeredFonts.has(family) || failedResolutions.has(family))
      ) {
        observerRef.current?.unobserve(element);
      }
    }
  }, [failedResolutions, registeredFonts]);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
    },
    [],
  );

  if (!enabled) {
    return { setScrollContainerRef: noopRef, setFontItemRef: noopRef };
  }

  return { setScrollContainerRef, setFontItemRef };
};
