import { useState } from "react";
import { Dialog } from "./Dialog";
import { TextField } from "./TextField";
import { MagicIcon, OpenAIIcon } from "./icons";

import "./MagicSettings.scss";
import { FilledButton } from "./FilledButton";
import { CheckboxItem } from "./CheckboxItem";
import { KEYS } from "../keys";
import { useUIAppState } from "../context/ui-appState";

const InlineButton = ({ icon }: { icon: JSX.Element }) => {
  return (
    <span
      style={{
        width: "1em",
        margin: "0 0.5ex 0 0.5ex",
        display: "inline-block",
        lineHeight: 0,
        verticalAlign: "middle",
      }}
    >
      {icon}
    </span>
  );
};

export const MagicSettings = (props: {
  openAIKey: string | null;
  isPersisted: boolean;
  onChange: (key: string, shouldPersist: boolean) => void;
  onConfirm: (key: string, shouldPersist: boolean) => void;
  onClose: () => void;
}) => {
  const { theme } = useUIAppState();
  const [keyInputValue, setKeyInputValue] = useState(props.openAIKey || "");
  const [shouldPersist, setShouldPersist] = useState<boolean>(
    props.isPersisted,
  );

  const onConfirm = () => {
    props.onConfirm(keyInputValue.trim(), shouldPersist);
  };

  return (
    <Dialog
      onCloseRequest={() => {
        props.onClose();
        props.onConfirm(keyInputValue.trim(), shouldPersist);
      }}
      title={
        <div style={{ display: "flex" }}>
          Diagram to Code (AI){" "}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.1rem 0.5rem",
              marginLeft: "1rem",
              fontSize: 14,
              borderRadius: "12px",
              background: theme === "light" ? "#FFCCCC" : "#703333",
            }}
          >
            Experimental
          </div>
        </div>
      }
      className="MagicSettings"
      autofocus={false}
    >
      <p
        style={{
          display: "inline-flex",
          alignItems: "center",
          marginBottom: 0,
        }}
      >
        For the diagram-to-code feature we use{" "}
        <InlineButton icon={OpenAIIcon} />
        OpenAI.
      </p>
      <p>
        While the OpenAI API is in beta, its use is strictly limited — as such
        we require you use your own API key. You can create an{" "}
        <a
          href="https://platform.openai.com/login?launch"
          rel="noopener noreferrer"
          target="_blank"
        >
          OpenAI account
        </a>
        , add a small credit (5 USD minimum), and{" "}
        <a
          href="https://platform.openai.com/api-keys"
          rel="noopener noreferrer"
          target="_blank"
        >
          generate your own API key
        </a>
        .
      </p>
      <p>
        Your OpenAI key does not leave the browser, and you can also set your
        own limit in your OpenAI account dashboard if needed.
      </p>
      <TextField
        isPassword
        value={keyInputValue}
        placeholder="Paste your API key here"
        label="OpenAI API key"
        onChange={(value) => {
          setKeyInputValue(value);
          props.onChange(value.trim(), shouldPersist);
        }}
        selectOnRender
        onKeyDown={(event) => event.key === KEYS.ENTER && onConfirm()}
      />
      <p>
        By default, your API token is not persisted anywhere so you'll need to
        insert it again after reload. But, you can persist locally in your
        browser below.
      </p>

      <CheckboxItem checked={shouldPersist} onChange={setShouldPersist}>
        Persist API key in browser storage
      </CheckboxItem>

      <p>
        Once API key is set, you can use the <InlineButton icon={MagicIcon} />{" "}
        tool to wrap your elements in a frame that will then allow you to turn
        it into code. This dialog can be accessed using the <b>AI Settings</b>{" "}
        <InlineButton icon={OpenAIIcon} />.
      </p>

      <FilledButton
        className="MagicSettings__confirm"
        size="large"
        label="Confirm"
        onClick={onConfirm}
      />
    </Dialog>
  );
};
