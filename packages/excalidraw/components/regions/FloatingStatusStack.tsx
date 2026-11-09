import React, { useEffect, useLayoutEffect, useRef } from "react";

/** clearance between the stack and the footer controls beside/below it */
const GAP_PX = 8;

const INSET_VAR = "--exc-status-inset";
const BOTTOM_VAR = "--exc-status-bottom";

/**
 * The desktop toast / scroll-back-to-content / viewport-status stack.
 *
 * It's centered on the canvas and overlays the footer band, between the
 * footer's left and right controls. Those vary in width (region items), so
 * it's inset symmetrically by the wider of the two — staying centered — and
 * when the space between them is narrower than the stack's content, it
 * moves up above the footer band instead (full width). In the band, its
 * bottom entry lines up with the footer controls.
 *
 * Both are decided from the footer rows' widths and the stack's content
 * width, neither of which depends on where the stack is.
 */
export const FloatingStatusStack = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const stackRef = useRef<HTMLDivElement>(null);

  const measureRef = useRef<() => void>(() => {});
  measureRef.current = () => {
    const stack = stackRef.current;
    const regions = stack?.closest<HTMLElement>(".exc-regions");
    if (!stack || !regions) {
      return;
    }
    const box = regions.getBoundingClientRect();
    if (!box.width) {
      return;
    }
    const leftRow = regions.querySelector(".exc-region-bottom-left > *");
    const rightRow = regions.querySelector(".exc-region-bottom-right > *");
    const band = regions.querySelector(".exc-region-bottom");

    const leftEdge = leftRow
      ? leftRow.getBoundingClientRect().right - box.left
      : 0;
    const rightEdge = rightRow
      ? box.right - rightRow.getBoundingClientRect().left
      : 0;
    const inset = Math.ceil(Math.max(leftEdge, rightEdge, 0) + GAP_PX);

    // natural widths (the scroll-back button doesn't wrap, the toast has
    // its own width bounds)
    const needed = Math.max(
      0,
      ...[...stack.children].map((child) =>
        Math.max(child.scrollWidth, child.getBoundingClientRect().width),
      ),
    );

    if (!band) {
      stack.style.setProperty(INSET_VAR, `${inset}px`);
      stack.style.removeProperty(BOTTOM_VAR);
      return;
    }
    const bandBox = band.getBoundingClientRect();

    if (box.width - 2 * inset >= needed) {
      // in the footer band: the bottom-most entry is centered on the band
      // like the footer controls (bottoms aligned if it's taller), so it
      // has the same distance from the editor edge as they do
      const last = stack.lastElementChild;
      const lastHeight = last ? last.getBoundingClientRect().height : 0;
      stack.style.setProperty(INSET_VAR, `${inset}px`);
      stack.style.setProperty(
        BOTTOM_VAR,
        `${Math.round(
          box.bottom -
            bandBox.bottom +
            Math.max(0, (bandBox.height - lastHeight) / 2),
        )}px`,
      );
    } else {
      stack.style.setProperty(INSET_VAR, "0px");
      stack.style.setProperty(
        BOTTOM_VAR,
        `${Math.ceil(box.bottom - bandBox.top + GAP_PX)}px`,
      );
    }
  };

  useLayoutEffect(() => {
    measureRef.current();
  });

  useEffect(() => {
    const stack = stackRef.current;
    const regions = stack?.closest<HTMLElement>(".exc-regions");
    const ResizeObserver = stack?.ownerDocument.defaultView?.ResizeObserver;
    if (!stack || !regions || !ResizeObserver) {
      return;
    }
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measureRef.current());
    });
    observer.observe(regions);
    observer.observe(stack);
    for (const selector of [
      ".exc-region-bottom",
      ".exc-region-bottom-left > *",
      ".exc-region-bottom-right > *",
    ]) {
      const element = regions.querySelector(selector);
      if (element) {
        observer.observe(element);
      }
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="floating-status-stack" ref={stackRef}>
      {children}
    </div>
  );
};
