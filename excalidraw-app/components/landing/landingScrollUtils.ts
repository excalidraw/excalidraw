export const LANDING_CANVAS_SECTION_ID = "terraform-canvas";
export const LANDING_NAV_SCROLL_OFFSET = 72;

export const scrollToLandingTop = (behavior: ScrollBehavior = "auto"): void => {
  window.scrollTo({ top: 0, left: 0, behavior });
};

export const scrollToLandingCanvasSection = (
  behavior: ScrollBehavior = "auto",
): void => {
  const anchor =
    document.getElementById("terraform-canvas-heading") ??
    document.getElementById(LANDING_CANVAS_SECTION_ID);
  if (!anchor) {
    return;
  }

  const top =
    anchor.getBoundingClientRect().top +
    window.scrollY -
    LANDING_NAV_SCROLL_OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior });
};
