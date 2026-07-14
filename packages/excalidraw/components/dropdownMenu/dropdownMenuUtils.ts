import React from "react";

const getMenuComponent = (component: string) => (children: React.ReactNode) => {
  const comp = React.Children.toArray(children).find(
    (child) =>
      React.isValidElement(child) &&
      typeof child.type !== "string" &&
      //@ts-ignore
      child?.type.displayName &&
      //@ts-ignore
      child.type.displayName === component,
  );
  if (!comp) {
    return null;
  }
  //@ts-ignore
  return comp;
};

export const getMenuTriggerComponent = getMenuComponent("DropdownMenuTrigger");
export const getMenuContentComponent = getMenuComponent("DropdownMenuContent");
export const getSubMenuTriggerComponent = getMenuComponent(
  "DropdownMenuSubTrigger",
);
export const getSubMenuContentComponent = getMenuComponent(
  "DropdownMenuSubContent",
);
