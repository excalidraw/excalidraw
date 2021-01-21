import React from "react";

export const createInverseContext = <T extends unknown = null>(
  initialValue: T,
) => {
  const Context = React.createContext(initialValue) as React.Context<T> & {
    __updateProviderValue?: (value: T) => void;
  };

  class InverseConsumer extends React.Component {
    state = { value: initialValue };
    constructor(props: any) {
      super(props);
      Context.__updateProviderValue = (value: T) => this.setState({ value });
    }
    render() {
      return (
        <Context.Provider value={this.state.value}>
          {this.props.children}
        </Context.Provider>
      );
    }
  }

  class InverseProvider extends React.Component<{ value: T }> {
    componentDidMount() {
      Context.__updateProviderValue?.(this.props.value);
    }
    componentDidUpdate() {
      Context.__updateProviderValue?.(this.props.value);
    }
    render() {
      return <Context.Consumer>{() => this.props.children}</Context.Consumer>;
    }
  }

  return {
    Context,
    Consumer: InverseConsumer,
    Provider: InverseProvider,
  };
};
