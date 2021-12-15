import { useEffect, useState } from "react";
import { usePopper } from "react-popper";
import SetTableNameDialog from "./SetTableNameDialog";
import "./TableDropdownButton.scss";
import { ToolButton, ToolButtonProps } from "./ToolButton";

type Props = ToolButtonProps & {
  onNewTable: (tablename: string) => void;
  onUploadCSV: () => void;
};
const TableDropdownButton: React.FC<Props> = ({
  icon,
  title,
  keyBindingLabel,
  label,
  onNewTable,
  onUploadCSV,
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
        className="table-dropdown"
      >
        <div
          className="item"
          onClick={(e) => {
            e.preventDefault();
            onUploadCSV();
            setDropdownVisible(false);
          }}
        >
          Upload CSV
        </div>
        <hr />
        <div
          className="item"
          onClick={(e) => {
            e.preventDefault();
            setDropdownVisible(false);
            setConfirmDialogOpen(true);
          }}
        >
          New table
        </div>
      </div>
    </div>
  );
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
      {confirmDialogOpen && (
        <SetTableNameDialog
          onConfirm={(tablename) => {
            setConfirmDialogOpen(false);
            onNewTable(tablename);
          }}
          onCancel={() => {
            setConfirmDialogOpen(false);
          }}
        />
      )}
    </>
  );
};

export default TableDropdownButton;
