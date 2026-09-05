import { useLayoutEffect } from "react";
import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

import { FRAME_OPTIONS } from "@/config";
import { useParentSize } from "@/hooks/useParentSize";

interface RoughBoxProps {
  options?: Options;
  className?: string;
  /** Keeps the sketchy edges from being clipped by the parent. */
  inset?: number;
  /** Horizontal rules inside the box, as fractions of its height (0–1). */
  dividers?: number[];
}

/** Hand-drawn rectangle that fills whichever element it is dropped into. */
export function RoughBox({
  options = FRAME_OPTIONS,
  className = "rough-box",
  inset = 2,
  dividers,
}: RoughBoxProps) {
  const [svgRef, { width, height }] = useParentSize<SVGSVGElement>();
  const dividerKey = dividers?.join(",") ?? "";

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || width === 0 || height === 0) {
      return;
    }

    const rc = rough.svg(svg);
    const shapes = [
      rc.rectangle(inset, inset, width - inset * 2, height - inset * 2, options),
    ];

    for (const fraction of dividerKey === "" ? [] : dividerKey.split(",")) {
      const y = Math.round(height * Number(fraction));
      shapes.push(rc.line(inset, y, width - inset, y, options));
    }

    svg.replaceChildren(...shapes);
  }, [svgRef, width, height, inset, options, dividerKey]);

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

export default RoughBox;
