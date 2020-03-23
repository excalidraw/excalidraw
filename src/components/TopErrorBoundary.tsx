import React from "react";
import { resetCursor } from "../utils";
import { t } from "../i18n";

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

  render() {
    return this.state.hasError ? this.errorSplash() : this.props.children;
  }

  componentDidCatch(error: Error) {
    resetCursor();
    const _localStorage: any = {};
    for (const [key, value] of Object.entries({ ...localStorage })) {
      try {
        _localStorage[key] = JSON.parse(value);
      } catch (error) {
        _localStorage[key] = value;
      }
    }
    this.setState((state) => ({
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
        } catch (error) {
          console.error(error);
          stack += error.stack || "";
        }
      }

      this.setState((state) => ({
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
    } catch (error) {
      console.error(error);
    }

    window.open(
      `https://github.com/excalidraw/excalidraw/issues/new?body=${body}`,
    );
  }

  private errorSplash() {
    return (
      <div className="ErrorSplash">
        <div className="ErrorSplash-messageContainer">
          <div className="ErrorSplash-paragraph bigger align-center">
            {t("errorSplash.headingMain_pre")}
            <button onClick={() => window.location.reload()}>
              {t("errorSplash.headingMain_button")}
            </button>
          </div>
          <div className="ErrorSplash-paragraph align-center">
            {t("errorSplash.clearCanvasMessage")}
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >
              {t("errorSplash.clearCanvasMessage_button")}
            </button>
            <br />
            <div className="smaller">
              <span role="img" aria-label="warning">
                ⚠️
              </span>
              {t("errorSplash.clearCanvasCaveat")}
              <span role="img" aria-hidden="true">
                ⚠️
              </span>
            </div>
          </div>
          <div>
            <div className="ErrorSplash-paragraph">
              {t("errorSplash.openIssueMessage_pre")}
              <button onClick={this.createGithubIssue}>
                {t("errorSplash.openIssueMessage_button")}
              </button>
              {t("errorSplash.openIssueMessage_post")}
            </div>
            <div className="ErrorSplash-paragraph">
              <div className="ErrorSplash-details">
                <label>{t("errorSplash.errorStack")}</label>
                <textarea
                  rows={10}
                  onPointerDown={this.selectTextArea}
                  readOnly={true}
                  value={
                    this.state.unresolvedError
                      ? t("errorSplash.errorStack_loading")
                      : this.state.stack
                  }
                />
                <label>{t("errorSplash.sceneContent")}</label>
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
}
