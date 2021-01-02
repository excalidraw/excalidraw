import React from "react";

import { LoadingMessage } from "./LoadingMessage";
import {
  defaultLang,
  Language,
  languages,
  setLanguageFirstTime,
} from "../i18n";

interface Props {
  lang: Language["lng"];
  onLangChange?: (lang: Language["lng"]) => void;
}
interface State {
  isLoading: boolean;
}
export class InitializeApp extends React.Component<Props, State> {
  public state: { isLoading: boolean } = {
    isLoading: true,
  };

  async componentDidMount() {
    const currentLanguage =
      languages.find((language) => language.lng === this.props.lang) ||
      defaultLang;
    await setLanguageFirstTime(currentLanguage);
    this.props.onLangChange?.(currentLanguage.lng);
    this.setState({
      isLoading: false,
    });
  }

  public render() {
    return this.state.isLoading ? <LoadingMessage /> : this.props.children;
  }
}
