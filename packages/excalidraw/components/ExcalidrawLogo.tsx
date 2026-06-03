import "./ExcalidrawLogo.scss";

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
      <img
        className="ExcalidrawLogo-icon"
        src="/tfdraw-logo.png"
        alt=""
        aria-hidden="true"
        width={512}
        height={512}
      />
      {withText && <span className="ExcalidrawLogo-text">tfdraw.dev</span>}
    </div>
  );
};
