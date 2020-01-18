import "./EditableText.css";

import React, { Component } from "react";
import { selectNode, removeSelection } from "../utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export class EditableText extends Component<Props> {
  private handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    selectNode(e.currentTarget);
  };

  private handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const value = e.currentTarget.innerText.trim();
    if (value !== this.props.value) this.props.onChange(value);
    removeSelection();
  };

  private handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  public render() {
    return (
      <span
        suppressContentEditableWarning
        contentEditable="true"
        data-type="wysiwyg"
        className="project-name"
        onBlur={this.handleBlur}
        onKeyDown={this.handleKeyDown}
        onFocus={this.handleFocus}
      >
        {this.props.value}
      </span>
    );
  }
}
