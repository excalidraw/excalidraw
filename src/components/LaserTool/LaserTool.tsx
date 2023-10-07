import { useEffect, useRef } from "react";
import { LaserPathManager } from "./LaserPathManager";
import "./LaserToolOverlay.scss";
import { UIAppState } from "../../types";

type LaserToolOverlayProps = {
  manager: LaserPathManager;
  appState: UIAppState;
};

export const LaserToolOverlay = ({
  manager,
  appState,
}: LaserToolOverlayProps) => {
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
    <div
      className="LaserToolOverlay"
      style={{
        top: `-${appState.offsetTop}px`,
        left: `-${appState.offsetLeft}px`,
      }}
    >
      <svg ref={svgRef} className="LaserToolOverlayCanvas" />
    </div>
  );
};
