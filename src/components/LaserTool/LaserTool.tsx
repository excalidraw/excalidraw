import { useEffect, useRef } from "react";
import { LaserPathManager } from "./LaserPathManager";
import "./LaserToolOverlay.scss";

type LaserToolOverlayProps = {
  manager: LaserPathManager;
};

export const LaserToolOverlay = ({ manager }: LaserToolOverlayProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current) {
      manager.start(svgRef.current);
    }

    return () => {
      manager.stop();
    };
  }, [manager]);

  return (
    <div className="LaserToolOverlay">
      <svg ref={svgRef} className="LaserToolOverlayCanvas" />
    </div>
  );
};
