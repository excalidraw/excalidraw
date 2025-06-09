import "./ExcalidrawLogo.scss";

const LogoIcon = () => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 599.3311744531412 739.0656574304681"
    width="599.3311744531412"
    height="739.0656574304681"
  >
    <defs></defs>
    <rect
      x="0"
      y="0"
      width="599.3311744531412"
      height="739.0656574304681"
      fill="rgba(255,255,255,0)"
    ></rect>
    <g stroke-linecap="round">
      <g
        transform="translate(179.43255159229363 209.58584828886592) rotate(0 118.1324259250654 160.038425864094)"
        fill-rule="evenodd"
      >
        <path
          d="M0 0 C41.59 -33.23, 192.54 -205.98, 249.52 -199.4 C306.5 -192.83, 315.93 -23.07, 341.89 39.46 C367.84 102, 426.82 125.37, 405.24 175.82 C383.66 226.27, 268.51 284.87, 212.41 342.15 C156.31 399.43, 119.94 519.38, 68.63 519.48 C17.32 519.58, -55.86 389.26, -95.46 342.73 C-135.06 296.2, -174.1 311.68, -168.98 240.31 C-163.85 168.93, -92.86 -45.46, -64.7 -85.51 C-36.53 -125.56, -10.78 -14.25, 0 0"
          stroke="none"
          stroke-width="0"
          fill="#69db7c"
          fill-rule="evenodd"
        ></path>
        <path
          d="M0 0 C41.59 -33.23, 192.54 -205.98, 249.52 -199.4 C306.5 -192.83, 315.93 -23.07, 341.89 39.46 C367.84 102, 426.82 125.37, 405.24 175.82 C383.66 226.27, 268.51 284.87, 212.41 342.15 C156.31 399.43, 119.94 519.38, 68.63 519.48 C17.32 519.58, -55.86 389.26, -95.46 342.73 C-135.06 296.2, -174.1 311.68, -168.98 240.31 C-163.85 168.93, -92.86 -45.46, -64.7 -85.51 C-36.53 -125.56, -10.78 -14.25, 0 0 M0 0 C41.59 -33.23, 192.54 -205.98, 249.52 -199.4 C306.5 -192.83, 315.93 -23.07, 341.89 39.46 C367.84 102, 426.82 125.37, 405.24 175.82 C383.66 226.27, 268.51 284.87, 212.41 342.15 C156.31 399.43, 119.94 519.38, 68.63 519.48 C17.32 519.58, -55.86 389.26, -95.46 342.73 C-135.06 296.2, -174.1 311.68, -168.98 240.31 C-163.85 168.93, -92.86 -45.46, -64.7 -85.51 C-36.53 -125.56, -10.78 -14.25, 0 0"
          stroke="#868e96"
          stroke-width="1"
          fill="none"
        ></path>
      </g>
    </g>
    <mask></mask>
    <g transform="translate(96.91365983658444 309.16831017953973) rotate(0 199.20075071752126 57.08238701679636)">
      <text
        x="0"
        y="80.46333273887612"
        font-family="Excalifont, Xiaolai, Segoe UI Emoji"
        font-size="91.33181922687415px"
        fill="#1e1e1e"
        text-anchor="start"
        direction="ltr"
        dominant-baseline="alphabetic"
      >
        todo.txt
      </text>
    </g>
  </svg>
);

const LogoText = () => (
  <svg width="200" height="50">
    <text x="10" y="30" fontFamily="Verdana" fontSize="24" fill="#333">
      Todo.Png
    </text>
  </svg>
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
  /**
   * If true, the logo will not be wrapped in a Link component.
   * The link prop will be ignored as well.
   * It will merely be a plain div.
   */
  isNotLink?: boolean;
}

export const ExcalidrawLogo = ({
  style,
  size = "small",
  withText,
}: LogoProps) => {
  return (
    <div className={`ExcalidrawLogo is-${size}`} style={style}>
      <LogoIcon />
      {withText && <LogoText />}
    </div>
  );
};
