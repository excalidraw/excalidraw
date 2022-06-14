// Types to export, union over all ExcalidrawTextElement subtypes
export type CustomProps = never;
export type CustomShortcutName = never;

const customSubtype = [] as const;
export type CustomSubtype = typeof customSubtype[number];

const customActionName = [] as const;
export type CustomActionName = typeof customActionName[number];

export const isCustomActionName = (name: string) => {
  return (
    customActionName.includes(name as CustomActionName) &&
    !customSubtype.includes(name as CustomSubtype)
  );
};

export const getCustomSubtypes = (): readonly CustomSubtype[] => {
  return customSubtype;
};

export type CustomMethods = {
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
