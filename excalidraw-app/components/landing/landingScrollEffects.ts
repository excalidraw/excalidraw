const SCROLL_ANIMATION_SUPPORTS =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("(animation-timeline: scroll())") &&
  CSS.supports("(animation-range: 0% 100%)");

export const landingPageSupportsScrollAnimations = (): boolean =>
  SCROLL_ANIMATION_SUPPORTS;

export const initLandingScrollRevealFallback = (
  root: HTMLElement,
): (() => void) => {
  const targets = root.querySelectorAll<HTMLElement>("[data-lp-reveal]");
  if (targets.length === 0) {
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting && entry.intersectionRatio > 0.15) {
          el.classList.add("is-visible");
          el.style.setProperty(
            "--lp-reveal-progress",
            String(Math.min(1, entry.intersectionRatio * 2)),
          );
        }
      });
    },
    { threshold: [0, 0.15, 0.25, 0.5, 0.75, 1], rootMargin: "0px 0px -5% 0px" },
  );

  targets.forEach((el) => {
    if (!SCROLL_ANIMATION_SUPPORTS) {
      el.classList.add("lp-reveal-fallback");
    }
    observer.observe(el);
  });

  return () => observer.disconnect();
};
