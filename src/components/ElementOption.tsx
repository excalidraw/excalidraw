import React from "react";

type PropsElementOption = {
  label: string;
  value: string;
  onChange: Function;
};
function ElementOption(props: PropsElementOption) {
  const handleChangeInput = (e: React.FormEvent<HTMLInputElement>) => {
    props.onChange(e.currentTarget.value);
  };
  return (
    <>
      <label style={{ display: "flex", flexDirection: "row" }}>
        <span style={{ marginRight: 5, fontSize: 14, minWidth: 40 }}>
          {props.label}:
        </span>
        <input
          onChange={handleChangeInput}
          value={props.value}
          style={{ flex: 1 }}
        />
      </label>
    </>
  );
}

export default ElementOption;
