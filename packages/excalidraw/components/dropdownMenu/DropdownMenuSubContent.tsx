import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import clsx from "clsx";

import { useDevice } from "../App";
import Stack from "../Stack";
import { Island } from "../Island";

const DropdownMenuSubContent = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const device = useDevice();

  const classNames = clsx(`dropdown-menu dropdown-submenu ${className}`, {
    "dropdown-menu--mobile": device.editor.isMobile,
  }).trim();

  return (
    <DropdownMenuPrimitive.SubContent
      className={classNames}
      sideOffset={8}
      alignOffset={-4}
    >
      {device.editor.isMobile ? (
        <Stack.Col className="dropdown-menu-container">{children}</Stack.Col>
      ) : (
        <Island
          className="dropdown-menu-container"
          padding={1}
          style={{ zIndex: 1 }}
        >
          {children}
        </Island>
      )}
    </DropdownMenuPrimitive.SubContent>
  );
};

export default DropdownMenuSubContent;
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
