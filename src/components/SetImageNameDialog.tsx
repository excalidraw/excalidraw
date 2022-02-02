import React, { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { DialogProps } from "./Dialog";

interface Props
  extends Omit<DialogProps, "onCloseRequest" | "title" | "children"> {
  onConfirm: (imagename: string) => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  initialValue?: string;
}

const SetImageNameDialog: React.FC<Props> = (props) => {
  const [imagename, setImagename] = useState<string>(
    props.initialValue ?? "new-image",
  );
  const [errorMessage, setErrorMessage] = useState<string>();
  return (
    <ConfirmDialog
      title="Set table name"
      onCancel={props.onCancel}
      onConfirm={() => {
        if (imagename.trim().length === 0) {
          setErrorMessage("Please name your image :-)");
          return;
        }
        props.onConfirm(imagename);
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
          name="imagename"
          className="TextInput"
          placeholder="new-image"
          value={imagename}
          style={{ width: "80%" }}
          onChange={(event) => setImagename(event.target.value)}
        />
        {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
      </div>
    </ConfirmDialog>
  );
};

export default SetImageNameDialog;
