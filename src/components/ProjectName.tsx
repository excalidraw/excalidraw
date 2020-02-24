import "./ProjectName.css";

import React, { Component } from "react";
import { selectNode, removeSelection } from "../utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

export class ProjectName extends Component<Props> {
  private handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    selectNode(e.currentTarget);
  };

  private handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const value = e.currentTarget.innerText.trim();
    if (value !== this.props.value) {
      this.props.onChange(value);
    }
    removeSelection();
  };

  private handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }
      e.currentTarget.blur();
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
        className="ProjectName"
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
