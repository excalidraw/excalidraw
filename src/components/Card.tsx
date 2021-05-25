import OpenColor from "open-color";

import "./Card.scss";

export const Card: React.FC<{
  color: keyof OpenColor;
}> = ({ children, color }) => {
  return (
    <div
      className="Card"
      style={{
        ["--card-color" as any]: OpenColor[color][7],
        ["--card-color-darker" as any]: OpenColor[color][8],
        ["--card-color-darkest" as any]: OpenColor[color][9],
      }}
    >
      {children}
    </div>
  );
};
