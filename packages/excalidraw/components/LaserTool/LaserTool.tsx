import { useEffect, useMemo, useRef } from "react";
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoTrails = useMemo(() => trails, trails);

  useEffect(() => {
    if (svgRef.current) {
      manager.start(svgRef.current);

      for (const trail of memoTrails) {
        trail.start(svgRef.current);
      }
    }

    return () => {
      manager.stop();
    };
  }, [manager, memoTrails]);

  return (
    <div className="LaserToolOverlay">
      <svg ref={svgRef} className="LaserToolOverlayCanvas" />
    </div>
  );
};
