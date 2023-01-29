import React, { useContext } from "react";
import { EVENT } from "../../constants";
import { composeEventHandlers } from "../../utils";

export const DropdownMenuContentPropsContext = React.createContext<{
  onSelect?: (event: Event) => void;
}>({});

export const getDropdownMenuItemClassName = (className = "") => {
  return `dropdown-menu-item dropdown-menu-item-base ${className}`.trim();
};

export const useHandleDropdownMenuItemClick = (
  origOnClick:
    | React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>
    | undefined,
  onSelect: ((event: Event) => void) | undefined,
) => {
  const DropdownMenuContentProps = useContext(DropdownMenuContentPropsContext);

  return composeEventHandlers(origOnClick, (event) => {
    const itemSelectEvent = new CustomEvent(EVENT.MENU_ITEM_SELECT, {
      bubbles: true,
      cancelable: true,
    });
    onSelect?.(itemSelectEvent);
    if (!itemSelectEvent.defaultPrevented) {
      DropdownMenuContentProps.onSelect?.(itemSelectEvent);
    }
  });
};
