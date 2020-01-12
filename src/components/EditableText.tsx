import "./EditableText.css";

import React, { Component } from "react";

type InputState = {
  value: string;
  edit: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export class EditableText extends Component<Props, InputState> {
  width: number | undefined;
  constructor(props: Props) {
    super(props);

    this.state = {
      value: props.value,
      edit: false
    };
  }

  UNSAFE_componentWillReceiveProps(props: Props) {
    if (this.props.value !== props.value) {
      this.setState({ value: props.value });
    }
  }

  private handleEdit(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ value: e.target.value });
  }

  private handleBlur() {
    const { value } = this.state;

    if (!value) {
      this.setState({ value: this.props.value, edit: false });
      return;
    }
    this.props.onChange(value);
    this.setState({ edit: false });
  }

  public render() {
    const { value, edit } = this.state;

    return (
      <div className="project-name-wrapper">
        {edit && (
          <input
            className="project-name-input"
            name="name"
            maxLength={25}
            style={{ minWidth: this.width }}
            value={value}
            onChange={e => this.handleEdit(e)}
            onBlur={() => this.handleBlur()}
            onKeyDown={e => {
              if (e.key === "Enter") {
                this.handleBlur();
              }
            }}
            autoFocus
          />
        )}
        <button
          onClick={() => this.setState({ edit: true })}
          className="project-name"
          disabled={edit}
          ref={el => (this.width = el?.offsetWidth || this.width)}
        >
          {this.props.value}
        </button>
      </div>
    );
  }
}
