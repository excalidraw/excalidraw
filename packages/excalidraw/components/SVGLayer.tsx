import { useEffect, useRef } from "react";

import "./SVGLayer.scss";

import type { Trail } from "../animated-trail";

type SVGLayerProps = {
  trails: Trail[];
};

export const SVGLayer = ({ trails }: SVGLayerProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const trailsRef = useRef(trails);
  trailsRef.current = trails;

  useEffect(() => {
    if (svgRef.current) {
      // Debug: check SVG element properties
      console.log("SVGLayer mounted, SVG element:", {
        width: svgRef.current.getAttribute("width"),
        height: svgRef.current.getAttribute("height"),
        style: svgRef.current.style.cssText,
        parent: svgRef.current.parentElement?.className,
      });

      for (const trail of trailsRef.current) {
        trail.start(svgRef.current);
      }
    }

    return () => {
      for (const trail of trailsRef.current) {
        trail.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="SVGLayer">
      <svg ref={svgRef} width="100%" height="100%" style={{ display: "block" }} />
    </div>
  );
};
