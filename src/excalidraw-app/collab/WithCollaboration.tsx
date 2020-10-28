import React from "react";

import { CollabConsumer } from "./CollabContext";

export function WithCollaboration(Component: any) {
  return function (props: any) {
    return (
      <CollabConsumer>
        {(state: any) => <Component {...props} context={state} />}
      </CollabConsumer>
    );
  };
}
