import React, { createRef, Fragment, Component } from "react";

type InputState = {
  initialValue: string;
  value: string;
  edit: boolean;
};

type Props = {
  value: string;
  updateName: (name: string) => void;
};

export default class EditableInput extends Component<Props, InputState> {
  constructor(props: Props) {
    super(props);
    const { value } = props;

    this.state = {
      initialValue: value,
      value,
      edit: false
    };
  }

  private inputRef = createRef<HTMLInputElement>();

  private handleEdit(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ value: e.target.value });
  }

  private handleBlur() {
    const { value, initialValue } = this.state;

    if (!value) {
      this.setState({ value: initialValue, edit: false });
      return;
    }
    this.props.updateName(value);
    this.setState({ edit: false, initialValue: value });
  }

  private focusInput() {
    const input = this.inputRef.current;
    if (input) {
      input.focus();
    }
    this.setState({ edit: true });
  }

  public render() {
    const { value, edit } = this.state;

    return (
      <Fragment>
        {edit ? (
          <input
            className="project-name-input"
            name="name"
            maxLength={25}
            value={value}
            onChange={e => this.handleEdit(e)}
            onBlur={() => this.handleBlur()}
            ref={this.inputRef}
          />
        ) : (
          <span onClick={() => this.focusInput()} className="project-name">
            {value}
          </span>
        )}
      </Fragment>
    );
  }
}
