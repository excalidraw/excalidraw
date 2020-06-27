import React from "react";

import { LoadingMessage } from "./LoadingMessage";
import { setLanguageFirstTime } from "../i18n";

export class InitializeApp extends React.Component<
  any,
  { isLoading: boolean }
> {
  public state: { isLoading: boolean } = {
    isLoading: true,
  };

  async componentDidMount() {
    await setLanguageFirstTime();
    this.setState({
      isLoading: false,
    });
  }

  public render() {
    return this.state.isLoading ? <LoadingMessage /> : this.props.children;
  }
}
