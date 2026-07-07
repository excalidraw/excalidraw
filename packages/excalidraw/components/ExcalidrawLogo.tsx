import "./ExcalidrawLogo.scss";

/** Adobe corporate "A" mark — red rounded square with white glyph. */
const LogoIcon = () => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="ExcalidrawLogo-icon"
  >
    <rect width="40" height="40" rx="6" fill="currentColor" />
    <path
      d="M15.5 10 L24.5 10 L32 30 L26 30 L24 24.5 L16 24.5 L14 30 L8 30 Z M17.6 20 L22.4 20 L20 12.8 Z"
      fill="#fff"
    />
  </svg>
);

/** Adobe wordmark rendered as SVG text so it inherits --color-logo-text. */
const LogoText = () => (
  <svg
    viewBox="0 0 120 40"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    className="ExcalidrawLogo-text"
  >
    <text
      x="0"
      y="30"
      fontFamily="'Adobe Clean', 'Helvetica Neue', Arial, sans-serif"
      fontWeight="700"
      fontSize="32"
      fill="currentColor"
    >
      Adobe
    </text>
  </svg>
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom" | "mobile";

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
