import { ChangeEventHandler } from "react";

interface TTDDialogInputProps {
  input: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
}

export const TTDDialogInput = ({ input, onChange }: TTDDialogInputProps) => {
  return (
    <textarea className="ttd-dialog-input" onChange={onChange} value={input} />
  );
};
