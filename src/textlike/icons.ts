import { TEXT_SUBTYPE_MATH_ICON } from "./math/icon";
import { TEXT_SUBTYPE_MATH } from "./math/types";

import { TEXT_SUBTYPE_TEXT_ICON } from "./text/icon";
import { TEXT_SUBTYPE_TEXT } from "./text/types";

export const TEXT_SUBTYPE_ICONS = [
  { icon: TEXT_SUBTYPE_TEXT_ICON, value: TEXT_SUBTYPE_TEXT },
  { icon: TEXT_SUBTYPE_MATH_ICON, value: TEXT_SUBTYPE_MATH },
] as const;
