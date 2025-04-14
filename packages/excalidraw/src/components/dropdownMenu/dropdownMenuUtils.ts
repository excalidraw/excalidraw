import React from "react";

export const getMenuTriggerComponent = (children: React.ReactNode) => {
  const comp = React.Children.toArray(children).find(
    (child) =>
      React.isValidElement(child) &&
      typeof child.type !== "string" &&
      //@ts-ignore
      child?.type.displayName &&
      //@ts-ignore
      child.type.displayName === "DropdownMenuTrigger",
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
      child.type.displayName === "DropdownMenuContent",
  );
  if (!comp) {
    return null;
  }
  //@ts-ignore
  return comp;
};
