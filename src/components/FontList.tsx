import "./FontList.scss";

const FONTS = [
  { name: "BLOKLETTERS", path: "/fonts/Blokletters-Potlood.ttf" },
  { name: "GelPen", path: "/fonts/GelPenLight.ttf" },
  { name: "Swagger", path: "/fonts/swaggerlight.ttf" },
];

export const FontList = ({
  onChange,
}: {
  onChange: (value: string) => void;
}) => (
  <select
    className="FontList"
    onChange={({ target }) => onChange(target.value)}
  >
    {FONTS.map((font) => (
      <option key={font.name} value={font.path}>
        {font.name}
      </option>
    ))}
  </select>
);
