import React from "react";
import { resetCursor } from "../utils";

interface TopErrorBoundaryState {
  unresolvedError: Error[] | null;
  hasError: boolean;
  stack: string;
  localStorage: string;
}

export class TopErrorBoundary extends React.Component<
  any,
  TopErrorBoundaryState
> {
  state: TopErrorBoundaryState = {
    unresolvedError: null,
    hasError: false,
    stack: "",
    localStorage: "",
  };

  componentDidCatch(error: Error) {
    resetCursor();
    const _localStorage: any = {};
    for (const [key, value] of Object.entries({ ...localStorage })) {
      try {
        _localStorage[key] = JSON.parse(value);
      } catch (err) {
        _localStorage[key] = value;
      }
    }
    this.setState(state => ({
      hasError: true,
      unresolvedError: state.unresolvedError
        ? state.unresolvedError.concat(error)
        : [error],
      localStorage: JSON.stringify(_localStorage),
    }));
  }

  async componentDidUpdate() {
    if (this.state.unresolvedError !== null) {
      let stack = "";
      for (const error of this.state.unresolvedError) {
        if (stack) {
          stack += `\n\n================\n\n`;
        }
        stack += `${error.message}:\n\n`;
        try {
          const StackTrace = await import("stacktrace-js");
          stack += (await StackTrace.fromError(error)).join("\n");
        } catch (err) {
          console.error(err);
          stack += error.stack || "";
        }
      }

      this.setState(state => ({
        unresolvedError: null,
        stack: `${
          state.stack ? `${state.stack}\n\n================\n\n${stack}` : stack
        }`,
      }));
    }
  }

  private selectTextArea(event: React.MouseEvent<HTMLTextAreaElement>) {
    if (event.target !== document.activeElement) {
      event.preventDefault();
      (event.target as HTMLTextAreaElement).select();
    }
  }

  private async createGithubIssue() {
    let body = "";
    try {
      const templateStr = (await import("../bug-issue-template")).default;
      if (typeof templateStr === "string") {
        body = encodeURIComponent(templateStr);
      }
    } catch {}

    window.open(
      `https://github.com/excalidraw/excalidraw/issues/new?body=${body}`,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ErrorSplash">
          <div className="ErrorSplash-messageContainer">
            <div className="ErrorSplash-paragraph bigger align-center">
              Encountered an error. Try{" "}
              <button onClick={() => window.location.reload()}>
                reloading the page.
              </button>
            </div>
            <div className="ErrorSplash-paragraph align-center">
              If reloading doesn't work, try{" "}
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                clearing the canvas.
              </button>
              <br />
              <div className="smaller">
                <span role="img" aria-label="warning">
                  ⚠️
                </span>{" "}
                This will result in loss of work{" "}
                <span role="img" aria-hidden="true">
                  ⚠️
                </span>
              </div>
            </div>
            <div>
              <div className="ErrorSplash-paragraph">
                Before doing so, we'd appreciate if you opened an issue on our{" "}
                <button onClick={this.createGithubIssue}>bug tracker.</button>{" "}
                Please include the following error stack trace (and if it's not
                private, also the scene content):
              </div>
              <div className="ErrorSplash-paragraph">
                <div className="ErrorSplash-details">
                  <label>Error stack trace:</label>
                  <textarea
                    rows={10}
                    onPointerDown={this.selectTextArea}
                    readOnly={true}
                    value={
                      this.state.unresolvedError
                        ? "Loading data. please wait..."
                        : this.state.stack
                    }
                  />
                  <label>Scene content:</label>
                  <textarea
                    rows={5}
                    onPointerDown={this.selectTextArea}
                    readOnly={true}
                    value={this.state.localStorage}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
