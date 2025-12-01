import { useEditorInterface } from "../App";

import { Ellipsify } from "../Ellipsify";

import type { JSX } from "react";

const MenuItemContent = ({
  textStyle,
  icon,
  shortcut,
  children,
}: {
  icon?: JSX.Element;
  shortcut?: string;
  textStyle?: React.CSSProperties;
  children: React.ReactNode;
}) => {
  const editorInterface = useEditorInterface();
  return (
    <>
      {icon && <div className="dropdown-menu-item__icon">{icon}</div>}
      <div style={textStyle} className="dropdown-menu-item__text">
        <Ellipsify>{children}</Ellipsify>
      </div>
      {shortcut && editorInterface.formFactor !== "phone" && (
        <div className="dropdown-menu-item__shortcut">{shortcut}</div>
      )}
    </>
  );
};
export default MenuItemContent;
