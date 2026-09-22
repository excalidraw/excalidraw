import React from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";

import { Popover } from "./Popover";

const mockPopoverDimensions = (width: number, height: number) => {
  const getBoundingClientRect = vi
    .spyOn(HTMLDivElement.prototype, "getBoundingClientRect")
    .mockReturnValue({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

  return () => {
    getBoundingClientRect.mockRestore();
  };
};

describe("Popover", () => {
  it("shifts overflowing content within its positioning container", () => {
    const restoreDimensions = mockPopoverDimensions(100, 80);

    try {
      const { container } = render(
        <Popover
          left={180}
          top={180}
          fitInViewport={true}
          viewportWidth={200}
          viewportHeight={200}
        />,
      );
      const popover = container.querySelector<HTMLDivElement>(".popover")!;

      expect(popover.style.left).toBe("90px");
      expect(popover.style.top).toBe("110px");
    } finally {
      restoreDimensions();
    }
  });

  it("resizes oversized content within the container gap", () => {
    const restoreDimensions = mockPopoverDimensions(250, 250);

    try {
      const { container } = render(
        <Popover
          left={180}
          top={180}
          fitInViewport={true}
          viewportWidth={200}
          viewportHeight={200}
        />,
      );
      const popover = container.querySelector<HTMLDivElement>(".popover")!;

      expect(popover.style.width).toBe("180px");
      expect(popover.style.height).toBe("180px");
      expect(popover.style.left).toBe("10px");
      expect(popover.style.top).toBe("10px");
      expect(popover.style.overflowX).toBe("scroll");
      expect(popover.style.overflowY).toBe("scroll");
    } finally {
      restoreDimensions();
    }
  });
});
