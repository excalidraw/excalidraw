import { useEffect, useRef } from "react";

import "./SVGLayer.scss";

import type { Trail } from "../animated-trail";

type SVGLayerProps = {
  trails: Trail[];
};

export const SVGLayer = ({ trails }: SVGLayerProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current) {
      for (const trail of trails) {
        trail.start(svgRef.current);
      }
    }

    return () => {
      for (const trail of trails) {
        trail.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, trails);

  return (
    <div className="SVGLayer">
      <svg ref={svgRef} />
    </div>
  );
};
