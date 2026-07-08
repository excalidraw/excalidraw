import { InlineIcon } from "../InlineIcon";
import { collapseDownIcon, collapseUpIcon } from "../icons";

interface CollapsibleProps {
  label: React.ReactNode;
  // having it controlled so that the state is managed outside
  // this is to keep the user's previous choice even when the
  // Collapsible is unmounted
  open: boolean;
  openTrigger: () => void;
  children: React.ReactNode;
  className?: string;
  showCollapsedIcon?: boolean;
}

const Collapsible = ({
  label,
  open,
  openTrigger,
  children,
  className,
  showCollapsedIcon = true,
}: CollapsibleProps) => {
  return (
    <>
      <div
        style={{
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        className={className}
        onClick={openTrigger}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTrigger();
          }
        }}
      >
        {label}
        {showCollapsedIcon && (
          <InlineIcon icon={open ? collapseUpIcon : collapseDownIcon} />
        )}
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      )}
    </>
  );
};

export default Collapsible;
