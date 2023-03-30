import { FontFamilyValues } from "../element/types";
import { FontFamilyLaiIcon, FontFamilyLXIcon } from "./font-icon";
export const COYOTE_CUSTOM_FONT_FAMILY = {
  XiaolaiSC: 44,
  LXGWWenKai: 55,
};

export const addFontFamily = (origin: any) => {
  Object.entries(COYOTE_CUSTOM_FONT_FAMILY).forEach(([key, value]) => {
    origin[key] = value;
  });
};

export const appendFontFamilyOptions = (
  origin: {
    value: FontFamilyValues;
    text: string;
    icon: JSX.Element;
  }[],
) =>
  origin.concat([
    {
      value: COYOTE_CUSTOM_FONT_FAMILY.XiaolaiSC,
      text: "小赖",
      icon: FontFamilyLaiIcon,
    },
    {
      value: COYOTE_CUSTOM_FONT_FAMILY.LXGWWenKai,
      text: "霞鹜文楷",
      icon: FontFamilyLXIcon,
    },
  ]);
