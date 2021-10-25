import { TextActionNameText, TextOptsText, TextShortcutNameText } from "./text";

// Types to export, union over all ExcalidrawTextElement subtypes
export type TextOpts = TextOptsText;
export type TextActionName = TextActionNameText;
export type TextShortcutName = TextShortcutNameText;
export const TEXT_SUBTYPE_DEFAULT = "text";
