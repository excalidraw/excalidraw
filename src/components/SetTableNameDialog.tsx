import React, { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { DialogProps } from "./Dialog";

interface Props
  extends Omit<DialogProps, "onCloseRequest" | "title" | "children"> {
  onConfirm: (tablename: string) => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  initialValue?: string;
}

const SetTableNameDialog: React.FC<Props> = (props) => {
  const [tablename, setTablename] = useState<string>(
    props.initialValue ?? "new-table.csv",
  );
  const [errorMessage, setErrorMessage] = useState<string>();
  return (
    <ConfirmDialog
      title="Set table name"
      onCancel={props.onCancel}
      onConfirm={() => {
        if (tablename.endsWith(".csv")) {
          setErrorMessage("");
          props.onConfirm(tablename);
        } else {
          setErrorMessage("Invalid name of the table, please try again");
        }
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "8px",
          marginBottom: "16px",
          flexDirection: "column",
        }}
      >
        <input
          type="text"
          name="tablename"
          className="TextInput"
          placeholder="filename.csv"
          value={tablename}
          style={{ width: "80%" }}
          onChange={(event) => setTablename(event.target.value)}
        />
        {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
      </div>
    </ConfirmDialog>
  );
};

export default SetTableNameDialog;
