import { useOutsideClickHook } from "../../hooks/useOutsideClick";
import { Island } from "../Island";

import { useDevice } from "../App";
import { getValidMenuChildren } from "./menuUtils";
import clsx from "clsx";
import Stack from "../Stack";

const MenuContent = ({
  children,
  onClickOutside,
  className = "",
  style,
}: {
  children?: React.ReactNode;
  onClickOutside?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const device = useDevice();
  const menuRef = useOutsideClickHook(() => {
    onClickOutside?.();
  });

  const menuChildren = getValidMenuChildren(children);
  const classNames = clsx(`menu ${className}`, {
    "menu--mobile": device.isMobile,
  }).trim();
  return (
    <div ref={menuRef} className={classNames} style={style} data-testid="menu">
      {/* the zIndex ensures this menu has higher stacking order,
    see https://github.com/excalidraw/excalidraw/pull/1445 */}
      {device.isMobile ? (
        <Stack.Col className="menu-container">{menuChildren}</Stack.Col>
      ) : (
        <Island className="menu-container" padding={2} style={{ zIndex: 1 }}>
          {menuChildren}
        </Island>
      )}
    </div>
  );
};
export default MenuContent;
MenuContent.displayName = "MenuContent";
