import { useEffect, useRef } from "react";
import { LaserPathManager } from "./LaserPathManager";
import "./LaserToolOverlay.scss";
import { AnimatedTrail } from "../../animated-trail";

type LaserToolOverlayProps = {
  manager: LaserPathManager;
  trails: AnimatedTrail[];
};

export const LaserToolOverlay = ({
  manager,
  trails,
}: LaserToolOverlayProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current) {
      manager.start(svgRef.current);

      for (const trail of trails) {
        trail.start(svgRef.current);
      }
    }

    return () => {
      manager.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, ...trails]);

  return (
    <div className="LaserToolOverlay">
      <svg ref={svgRef} className="LaserToolOverlayCanvas" />
    </div>
  );
};
