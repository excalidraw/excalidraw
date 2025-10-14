import React from "react";

const MenuSeparator = () => (
  <div
    style={{
      height: "1px",
      backgroundColor: "var(--default-border-color)",
      margin: ".5rem 0",
      flex: "0 0 auto",
    }}
  />
);

export default MenuSeparator;
MenuSeparator.displayName = "DropdownMenuSeparator";
