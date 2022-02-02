import React, { useEffect, useState } from "react";
import { usePopper } from "react-popper";
import "./ToolDropdownButton.scss";
import { ToolButton, ToolButtonProps } from "./ToolButton";

export type ToolDropdownOption = {
  label: string;
  onClick: () => void;
  confirmDialog?: (closeDialog: () => void) => React.ReactNode;
};

type Props = ToolButtonProps & {
  options: ToolDropdownOption[];
};

const TableDropdownButton: React.FC<Props> = ({
  icon,
  title,
  keyBindingLabel,
  label,
  options,
  ...rest
}) => {
  const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);
  const [referenceElement, setReferenceElement] =
    useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null,
  );

  const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    const onClick = (e: any) => {
      if (
        popperElement?.contains(e.target) ||
        referenceElement?.contains(e.target)
      ) {
        return;
      }
      setDropdownVisible(false);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [referenceElement, popperElement, setDropdownVisible]);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    modifiers: [
      {
        name: "offset",
        enabled: true,
        options: {
          offset: [0, 10],
        },
      },
    ],
  });

  const dropdown = (
    <div ref={setPopperElement} style={styles.popper} {...attributes.popper}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
        className="toolbar-dropdown"
      >
        {options.map(({ label, onClick, confirmDialog }, idx) => {
          return (
            <div
              key={label}
              className="item"
              onClick={(e) => {
                e.preventDefault();
                setDropdownVisible(false);
                if (confirmDialog) {
                  setConfirmDialogOpen(true);
                }
                onClick && onClick();
              }}
            >
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
  const confirmDialog = options.find((o) => o.confirmDialog)?.confirmDialog;
  return (
    <>
      <ToolButton
        className="Shape"
        ref={setReferenceElement}
        key="table"
        type={"button"}
        onClick={(e) => {
          if (popperElement?.contains(e.target as any)) {
            return;
          }
          setDropdownVisible(true);
        }}
        icon={icon}
        name="editor-current-shape"
        title={title}
        keyBindingLabel={keyBindingLabel}
        aria-label={rest["aria-label"]}
        aria-keyshortcuts={rest["aria-keyshortcuts"]}
        data-testid={rest["data-testid"]}
      />
      {dropdownVisible && dropdown}
      {confirmDialog &&
        confirmDialogOpen &&
        confirmDialog(() => setConfirmDialogOpen(false))}
    </>
  );
};

export default TableDropdownButton;
