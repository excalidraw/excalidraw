import React from "react";
import * as MenuComponents from "./MenuComponents";

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
      child?.type.name &&
      validMenuChildren.includes(child.type.name)
    ) {
      childrenComponents.push(child);
    }
  });

  return childrenComponents;
};
