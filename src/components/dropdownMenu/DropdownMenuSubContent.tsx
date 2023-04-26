import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { useDevice } from "../App";
import Stack from "../Stack";
import { Island } from "../Island";
import clsx from "clsx";

const DropdownMenuSubContent = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const device = useDevice();

  const classNames = clsx(`dropdown-menu ${className}`, {
    "dropdown-menu--mobile": device.isMobile,
  }).trim();

  return (
    <DropdownMenuPrimitive.SubContent className={classNames}>
      {device.isMobile ? (
        <Stack.Col className="dropdown-menu-container">{children}</Stack.Col>
      ) : (
        <Island
          className="dropdown-menu-container"
          padding={2}
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
