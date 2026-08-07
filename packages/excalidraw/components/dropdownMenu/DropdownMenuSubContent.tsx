import clsx from "clsx";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { useCallback, useState } from "react";

import { useTapClickFallback } from "../../hooks/useTapClickFallback";
import { useEditorInterface } from "../App";
import { Island } from "../Island";
import Stack from "../Stack";

const BASE_ALIGN_OFFSET = -4;
const BASE_SIDE_OFFSET = 4;

const DropdownMenuSubContent = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const editorInterface = useEditorInterface();

  // recover taps whose `click` got suppressed by an in-flight scroll animation
  // (momentum / rubber-band on iOS) — see issue #9204
  const tapClickFallbackRef = useTapClickFallback<HTMLDivElement>();

  const classNames = clsx(`dropdown-menu dropdown-submenu ${className}`, {
    "dropdown-menu--mobile": editorInterface.formFactor === "phone",
  }).trim();

  const callbacksRef = useCallback(
    (node: HTMLDivElement | null) => {
      tapClickFallbackRef(node);
      if (node) {
        const parentContainer = node.closest(".dropdown-menu-container");
        const parentRect = parentContainer?.getBoundingClientRect();
        if (parentRect) {
          const menuWidth = node.getBoundingClientRect().width;

          const viewportWidth = window.innerWidth;
          const spaceRemaining = viewportWidth - parentRect.right;
          if (spaceRemaining < menuWidth + 20) {
            setSideOffset(spaceRemaining - menuWidth + BASE_ALIGN_OFFSET);
            setAlignOffset(BASE_ALIGN_OFFSET + 8);
          }
        }
      }
    },
    [tapClickFallbackRef],
  );

  const [sideOffset, setSideOffset] = useState(BASE_SIDE_OFFSET);
  const [alignOffset, setAlignOffset] = useState(BASE_ALIGN_OFFSET);

  return (
    <DropdownMenuPrimitive.SubContent
      className={classNames}
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      collisionPadding={8}
      ref={callbacksRef}
    >
      {editorInterface.formFactor === "phone" ? (
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
