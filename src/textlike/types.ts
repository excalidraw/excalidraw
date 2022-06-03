import {
  TextActionNameText,
  TextOptsText,
  TextShortcutNameText,
  TEXT_SUBTYPE_TEXT,
} from "./text/types";

// Types to export, union over all ExcalidrawTextElement subtypes
export type TextOpts = TextOptsText;
export type TextActionName = TextActionNameText;
export type TextShortcutName = TextShortcutNameText;

const textSubtype = [TEXT_SUBTYPE_TEXT] as const;
export type TextSubtype = typeof textSubtype[number];
export const TEXT_SUBTYPE_DEFAULT = TEXT_SUBTYPE_TEXT;

export const getTextElementSubtypes = (): readonly TextSubtype[] => {
  return textSubtype;
};

export type TextMethods = {
  clean: Function;
  measure: Function;
  render: Function;
  renderSvg: Function;
  wrap: Function;
};

export type TextOmitProps =
  | "id"
  | "isDeleted"
  | "type"
  | "baseline"
  | "width"
  | "height"
  | "angle"
  | "seed"
  | "version"
  | "versionNonce"
  | "groupIds"
  | "boundElements"
  | "containerId"
  | "updated"
  | "link";
