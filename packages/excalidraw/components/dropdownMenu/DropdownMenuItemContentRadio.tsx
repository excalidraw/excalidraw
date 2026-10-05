import { useEditorInterface } from "../App";
import { Ellipsify } from "../Ellipsify";
import { RadioGroup } from "../RadioGroup";

type Props<T> = {
  value: T;
  shortcut?: string;
  choices: {
    value: T;
    label: React.ReactNode;
    ariaLabel?: string;
  }[];
  onChange: (value: T) => void;
  children: React.ReactNode;
  name: string;
  icon?: React.ReactNode;
};

const DropdownMenuItemContentRadio = <T,>({
  value,
  shortcut,
  onChange,
  choices,
  children,
  name,
  icon,
}: Props<T>) => {
  const editorInterface = useEditorInterface();

  return (
    <>
      <div className="dropdown-menu-item-base dropdown-menu-item-bare">
        {icon && <div className="dropdown-menu-item__icon">{icon}</div>}
        <label className="dropdown-menu-item__text">
          <Ellipsify>{children}</Ellipsify>
        </label>
        <RadioGroup
          name={name}
          value={value}
          onChange={onChange}
          choices={choices}
        />
      </div>
      {shortcut && editorInterface.formFactor !== "phone" && (
        <div className="dropdown-menu-item__shortcut dropdown-menu-item__shortcut--orphaned">
          {shortcut}
        </div>
      )}
    </>
  );
};

DropdownMenuItemContentRadio.displayName = "DropdownMenuItemContentRadio";

export default DropdownMenuItemContentRadio;
