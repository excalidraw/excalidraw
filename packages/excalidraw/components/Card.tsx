import "./Card.scss";

// for open-color see https://github.com/yeun/open-color/blob/master/open-color.scss
const COLOR_MAP = {
  primary: {
    base: "var(--color-primary)",
    darker: "var(--color-primary-darker)",
    darkest: "var(--color-primary-darkest)",
  },
  lime: {
    base: "#74b816", // open-color lime[7]
    darker: "#66a80f", // open-color lime[8]
    darkest: "#5c940d", // open-color lime[9]
  },
  pink: {
    base: "#d6336c", // open-color pink[7]
    darker: "#c2255c", // open-color pink[8]
    darkest: "#a61e4d", // open-color pink[9]
  },
};

export const Card: React.FC<{
  color: "primary" | "lime" | "pink";
  children?: React.ReactNode;
}> = ({ children, color }) => {
  return (
    <div
      className="Card"
      style={{
        ["--card-color" as any]: COLOR_MAP[color].base,
        ["--card-color-darker" as any]: COLOR_MAP[color].darker,
        ["--card-color-darkest" as any]: COLOR_MAP[color].darkest,
      }}
    >
      {children}
    </div>
  );
};
