import "./TextInput.scss";

import React, { Component } from "react";
import { focusNearestParent } from "../utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  isNameEditable: boolean;
};

type State = {
  fileName: string;
};
export class ProjectName extends Component<Props, State> {
  state = {
    fileName: this.props.value,
  };
  private handleBlur = (event: any) => {
    focusNearestParent(event.target);
    const value = event.target.value;
    if (value !== this.props.value) {
      this.props.onChange(value);
    }
  };

  private handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.nativeEvent.isComposing || event.keyCode === 229) {
        return;
      }
      event.currentTarget.blur();
    }
  };

  public render() {
    return (
      <>
        <label htmlFor="file-name">
          {`${this.props.label}${this.props.isNameEditable ? "" : ":"}`}
        </label>
        {this.props.isNameEditable ? (
          <input
            className="TextInput"
            onBlur={this.handleBlur}
            onKeyDown={this.handleKeyDown}
            id="file-name"
            value={this.state.fileName}
            onChange={(event) =>
              this.setState({ fileName: event.target.value })
            }
          />
        ) : (
          <span className="TextInput TextInput--readonly" id="file-name">
            {this.props.value}
          </span>
        )}
      </>
    );
  }
}
