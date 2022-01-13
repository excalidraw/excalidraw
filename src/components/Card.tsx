import OpenColor from "open-color";

import "./Card.scss";

export const Card: React.FC<{
  color: keyof OpenColor | "primary";
}> = ({ children, color }) => {
  return (
    <div
      className="Card"
      style={{
        ["--card-color" as any]:
          color === "primary" ? "var(--color-primary)" : OpenColor[color][7],
        ["--card-color-darker" as any]:
          color === "primary"
            ? "var(--color-primary-darker)"
            : OpenColor[color][8],
        ["--card-color-darkest" as any]:
          color === "primary"
            ? "var(--color-primary-darkest)"
            : OpenColor[color][9],
      }}
    >
      {children}
    </div>
  );
};
