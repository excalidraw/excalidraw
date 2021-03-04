import React from "react";

import { LoadingMessage } from "./LoadingMessage";
import { defaultLang, Language, languages, setLanguage } from "../i18n";

interface Props {
  langCode: Language["code"];
}
interface State {
  isLoading: boolean;
}
export class InitializeApp extends React.Component<Props, State> {
  public state: { isLoading: boolean } = {
    isLoading: true,
  };

  async componentDidMount() {
    const currentLang =
      languages.find((lang) => lang.code === this.props.langCode) ||
      defaultLang;
    await setLanguage(currentLang);
    this.setState({
      isLoading: false,
    });
  }

  public render() {
    return this.state.isLoading ? <LoadingMessage /> : this.props.children;
  }
}
