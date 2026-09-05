import { useLayoutEffect } from "react";
import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

import { FRAME_OPTIONS } from "@/config";
import { useParentSize } from "@/hooks/useParentSize";

interface RoughLineProps {
  orientation?: "horizontal" | "vertical";
  options?: Options;
  className?: string;
}

/** Hand-drawn rule spanning the element it is dropped into. */
export function RoughLine({
  orientation = "horizontal",
  options = FRAME_OPTIONS,
  className = "rough-line",
}: RoughLineProps) {
  const [svgRef, { width, height }] = useParentSize<SVGSVGElement>();

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || width === 0 || height === 0) {
      return;
    }

    const rc = rough.svg(svg);
    const line =
      orientation === "vertical"
        ? rc.line(width / 2, 0, width / 2, height, options)
        : rc.line(0, height / 2, width, height / 2, options);

    svg.replaceChildren(line);
  }, [svgRef, width, height, orientation, options]);

  return (
    <svg
      ref={svgRef}
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    />
  );
}

export default RoughLine;
