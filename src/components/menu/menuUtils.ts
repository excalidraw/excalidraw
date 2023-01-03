import React from "react";
import * as MenuComponents from "../hamburgerMenu/MenuDefaultItems";

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
    "Collaborators",
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

export const getMenuTriggerComponent = (children: React.ReactNode) => {
  const comp = React.Children.toArray(children).find(
    (child) =>
      React.isValidElement(child) &&
      typeof child.type !== "string" &&
      //@ts-ignore
      child?.type.displayName &&
      //@ts-ignore
      child.type.displayName === "MenuTrigger",
  );
  if (!comp) {
    return null;
  }
  //@ts-ignore
  return comp;
};

export const getMenuContentComponent = (children: React.ReactNode) => {
  const comp = React.Children.toArray(children).find(
    (child) =>
      React.isValidElement(child) &&
      typeof child.type !== "string" &&
      //@ts-ignore
      child?.type.displayName &&
      //@ts-ignore
      child.type.displayName === "MenuContent",
  );
  if (!comp) {
    return null;
  }
  //@ts-ignore
  return comp;
};
