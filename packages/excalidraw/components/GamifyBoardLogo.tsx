import React from "react";

import "./GamifyBoardLogo.scss";

interface LogoProps {
  size?: "xs" | "small" | "normal" | "large" | "custom";
  withText?: boolean; // This prop will be ignored as the SVG already contains text
  style?: React.CSSProperties;
  isNotLink?: boolean; // This prop will be ignored
}

export const GamifyBoardLogo = ({
  style,
  size = "normal", // Default size, can be adjusted via CSS
  withText, // Ignored
  isNotLink, // Ignored
}: LogoProps) => {
  return (
    <div className={`GamifyBoardLogo is-${size}`} style={style}>
      {/* SVG content from public/gamifyboard-wordmark.svg */}
      <svg
        width="2818.8557"
        height="483.95673"
        viewBox="0 0 2818.8557 483.95673"
        version="1.1"
        id="svg1"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs id="defs1">
          <rect
            x="1367.0731"
            y="1131.3708"
            width="2068.9421"
            height="743.77161"
            id="rect4"
          />
        </defs>
        <g id="layer1" transform="translate(-302.25031,-242.30083)">
          <path
            id="path2"
            style={{ strokeWidth: "11.4716px" }}
            d="m 438.49277,242.30083 -136.24246,235.9784 136.24246,235.9784 h 272.48345 l 135.5834,-234.837 H 574.73441 v 79.7492 h 134.07591 l -43.687,75.6673 H 484.3455 l -90.38896,-156.5579 90.38896,-156.5579 h 180.77782 l 45.1946,78.2789 h 91.7063 l -91.048,-157.6994 z"
          />
          <text
            xmlSpace="preserve"
            id="text4"
            style={{
              fontSize: "192px",
              fontFamily: "'Baloo 2'",

              whiteSpace: "pre",

              fill: "#000000",
              strokeWidth: "29.3065px",
            }}
            transform="matrix(2.3631793,0,0,2.3631793,-2344.6075,-2392.9794)"
          >
            <tspan x="1367.0723" y="1283.4524" id="tspan1">
              amifyBoard
            </tspan>
          </text>
        </g>
      </svg>
    </div>
  );
};
