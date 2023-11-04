import clsx from "clsx";
import { useDevice } from "../App";
import { Button } from "../Button";

const MenuTrigger = ({
  className = "",
  children,
  onToggle,
  title,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  onToggle: () => void;
  title?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) => {
  const device = useDevice();
  const classNames = clsx(
    `dropdown-menu-button ${className}`,
    "zen-mode-transition",
    {
      "dropdown-menu-button--mobile": device.isMobile,
    },
  ).trim();
  return (
    <Button
      onSelect={onToggle}
      className={classNames}
      data-prevent-outside-click
      data-testid="dropdown-menu-button"
      title={title}
      {...rest}
    >
      {children}
    </Button>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "DropdownMenuTrigger";
