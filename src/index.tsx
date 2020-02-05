import React from "react";
import ReactDOM from "react-dom";

import { App } from "./App";

const rootElement = document.getElementById("root");

class TopErrorBoundary extends React.Component {
  state = { hasError: false, stack: "", localStorage: "" };

  static getDerivedStateFromError(error: any) {
    console.error(error);
    return {
      hasError: true,
      localStorage: JSON.stringify({ ...localStorage }),
      stack: error.stack,
    };
  }

  private selectTextArea(event: React.MouseEvent<HTMLTextAreaElement>) {
    (event.target as HTMLTextAreaElement).select();
  }

  private async createGithubIssue() {
    let body = "";
    try {
      const templateStr = (await import("./bug-issue-template")).default;
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
            <div className="ErrorSplash-paragraph bigger">
              Encountered an error. Please{" "}
              <button onClick={() => window.location.reload()}>
                reload the page
              </button>
              .
            </div>
            <div className="ErrorSplash-paragraph">
              If reloading doesn't work. Try{" "}
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                clearing the canvas
              </button>
              .<br />
              <div className="smaller">
                (This will unfortunately result in loss of work.)
              </div>
            </div>
            <div>
              <div className="ErrorSplash-paragraph">
                Before doing so, we'd appreciate if you opened an issue on our{" "}
                <button onClick={this.createGithubIssue}>bug tracker</button>.
                Please include the following error stack trace & localStorage
                content (provided it's not private):
              </div>
              <div className="ErrorSplash-paragraph">
                <div className="ErrorSplash-details">
                  <label>Error stack trace:</label>
                  <textarea
                    rows={10}
                    onClick={this.selectTextArea}
                    defaultValue={this.state.stack}
                  />
                  <label>LocalStorage content:</label>
                  <textarea
                    rows={5}
                    onClick={this.selectTextArea}
                    defaultValue={this.state.localStorage}
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

ReactDOM.render(
  <TopErrorBoundary>
    <App />
  </TopErrorBoundary>,
  rootElement,
);
