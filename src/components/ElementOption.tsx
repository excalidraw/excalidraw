import React from "react";

type PropsElementOption = {
  label: string;
  type?: string;
  options?: Array<string|number>;
  value: string;
  onChange: Function;
};
function ElementOption(props: PropsElementOption) {
  const handleChangeInput = (e: React.FormEvent<HTMLInputElement>) => {
    props.onChange(e.currentTarget.value);
  };
  const handleChangeSelect = (e: React.FormEvent<HTMLSelectElement>) => {
    props.onChange(e.currentTarget.value);
  };
  return (
    <div style={{marginTop: 5, marginBottom: 5}}>
      <label>
        <h5>{props.label}</h5>
        {props.type === 'select' ? (
          <select onChange={handleChangeSelect} value={props.value} style={{ flex: 1 }}>
            {props.options?.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input type={props.type || 'text'} onChange={handleChangeInput} value={props.value} />
        )}
      </label>
    </div>
  );
}

export default ElementOption;
