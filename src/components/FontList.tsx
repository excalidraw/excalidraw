import "./FontList.scss";

const FONTS = [
  { name: "Virgil" },
  { name: "Architects Daughter", path: "/fonts/ArchitectsDaughter.ttf" },
  { name: "BLOKLETTERS", path: "/fonts/Blokletters-Potlood.ttf" },
  { name: "Caveat", path: "/fonts/Caveat-VariableFont_wght.ttf" },
  { name: "Comic Relief", path: "/fonts/ComicRelief.ttf" },
  { name: "Fewriter", path: "/fonts/fewriter_memesbruh03.ttf" },
  { name: "GelPen", path: "/fonts/GelPenLight.ttf" },
  { name: "Swagger", path: "/fonts/swaggerlight.ttf" },
  { name: "Xarrovv", path: "/fonts/Xarrovv.otf" },
];

const css = ({ name, path }: typeof FONTS[number]) => /* CSS */ `
@font-face {
  font-family: "${name}";
  src: url("${path}");
  font-display: swap;
}
`;

const style = document.createElement("style");
document.head.appendChild(style);

export const FontList = ({
  onChange,
}: {
  onChange: (value: typeof FONTS[number]) => void;
}) => (
  <>
    <select
      className="FontList"
      onChange={({ target }) => {
        const meta = FONTS.find((f) => f.name === target.value)!;
        if (meta.path) {
          style.textContent = css(meta);
        }
        onChange(meta);
      }}
    >
      {FONTS.map((font) => (
        <option key={font.name} value={font.name}>
          {font.name}
        </option>
      ))}
    </select>
    <a
      className="suggest-link"
      href="https://github.com/excalidraw/excalidraw/issues/2945"
      target="_blank"
      rel="noreferrer"
    >
      {"Suggest yours on GitHub"}
    </a>
  </>
);
