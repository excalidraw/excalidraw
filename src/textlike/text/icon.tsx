import { Theme } from "../../element/types";
import { createIcon, iconFillColor } from "../../components/icons";

// We inline font-awesome icons in order to save on js size rather than including the font awesome react library
export const TEXT_SUBTYPE_TEXT_ICON = ({ theme }: { theme: Theme }) =>
  createIcon(
    <path
      fill={iconFillColor(theme)}
      // fa-font
      d="M432 416h-23.41L277.88 53.69A32 32 0 0 0 247.58 32h-47.16a32 32 0 0 0-30.3 21.69L39.41 416H16a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16h-19.58l23.3-64h152.56l23.3 64H304a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16zM176.85 272L224 142.51 271.15 272z"
    />,
    { width: 448, height: 512, mirror: true },
  );
