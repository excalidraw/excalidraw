import React from "react";

import "./Spinner.scss";

const Spinner = ({
  size = "1em",
  circleWidth = 8,
  synchronized = false,
  className = "",
}: {
  size?: string | number;
  circleWidth?: number;
  synchronized?: boolean;
  className?: string;
}) => {
  const mountTime = React.useRef(Date.now());
  const mountDelay = -(mountTime.current % 1600);

  return (
    <div className={`Spinner ${className}`}>
      <svg
        viewBox="0 0 100 100"
        style={{
          width: size,
          height: size,
          // fix for remounting causing spinner flicker
          ["--spinner-delay" as any]: synchronized ? `${mountDelay}ms` : 0,
        }}
      >
        <circle
          cx="50"
          cy="50"
          r={50 - circleWidth / 2}
          strokeWidth={circleWidth}
          fill="none"
          strokeMiterlimit="10"
        />
      </svg>
    </div>
  );
};

export default Spinner;
