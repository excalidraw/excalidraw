import { useLayoutEffect, useRef } from "react";
import rough from "roughjs";

import { BULLET_INSET, BULLET_OPTIONS, BULLET_SIZE } from "@/config";

interface BulletpointProps {
  size?: number;
  color?: string;
}

export function Bulletpoint({
  size = BULLET_SIZE,
  color = "currentColor",
}: BulletpointProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const rc = rough.svg(svg);
    const circle = rc.circle(size / 2, size / 2, size - BULLET_INSET, {
      ...BULLET_OPTIONS,
      stroke: color,
      fill: color,
    });

    svg.replaceChildren(circle);
  }, [size, color]);

  return (
    <svg
      ref={svgRef}
      className="bullet"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    />
  );
}

export default Bulletpoint;
