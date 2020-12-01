import "./TextInput.scss";

import React, { Component } from "react";
import { selectNode, removeSelection } from "../utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

export class ProjectName extends Component<Props> {
  private handleFocus = (event: React.FocusEvent<HTMLElement>) => {
    selectNode(event.currentTarget);
  };

  private handleBlur = (event: React.FocusEvent<HTMLElement>) => {
    const value = event.currentTarget.innerText.trim();
    if (value !== this.props.value) {
      this.props.onChange(value);
    }
    removeSelection();
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
  private makeEditable = (editable: HTMLSpanElement | null) => {
    if (!editable) {
      return;
    }
    try {
      editable.contentEditable = "plaintext-only";
    } catch {
      editable.contentEditable = "true";
    }
  };

  public render() {
    return (
      <span
        suppressContentEditableWarning
        ref={this.makeEditable}
        data-type="wysiwyg"
        className="TextInput"
        role="textbox"
        aria-label={this.props.label}
        onBlur={this.handleBlur}
        onKeyDown={this.handleKeyDown}
        onFocus={this.handleFocus}
      >
        {this.props.value}
      </span>
    );
  }
}
