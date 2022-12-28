import React from "react";
import * as MenuComponents from "./MenuDefaultItems";

export const getValidMenuChildren = (
  children: React.ReactNode,
  exclude?: Array<string>,
) => {
  const validMenuChildren = [
    ...Object.keys(MenuComponents),
    "MenuSeparator",
    "MenuSocials",
    "MenuItem",
    "MenuGroup",
  ].filter((item) => !exclude?.includes(item));
  const childrenComponents: React.ReactNode[] = [];
  React.Children.toArray(children).forEach((child) => {
    if (
      React.isValidElement(child) &&
      typeof child.type !== "string" &&
      //@ts-ignore
      child?.type.displayName &&
      //@ts-ignore
      validMenuChildren.includes(child.type.displayName)
    ) {
      childrenComponents.push(child);
    }
  });

  return childrenComponents;
};
