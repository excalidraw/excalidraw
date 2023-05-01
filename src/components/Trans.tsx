import React from "react";

import { useI18n } from "../i18n";

const REGEXP = /{{(.+?)}}/g;

const getTransChildren = (format: string, props: { [key: string]: any }) => {
  const stack: { name: string; children: any[] }[] = [
    {
      name: "",
      children: [],
    },
  ];
  format.split(REGEXP).forEach((match, index) => {
    // Pushing the content on both side of the Regex to stack
    // eg for string - "Hello {{name}} Whats up?"
    // "Hello" and "Whats up" will be pushed
    if (index % 2 === 0) {
      if (match.length === 0) {
        return;
      }

      stack[stack.length - 1].children.push(match);

      // If the match ends with last stack variable appended with "End"
      // This means we need to now replace the content with its actual value in prop
      // eg format = "Please {{connectLinkStart}}click the button{{connectLinkEnd}} to continue", match = "connectLinkEnd", stack last item name = "connectLink"
      // and props.connectLink = (el: any) => <a href="https://example.com">{el}</a>
      // then its prop value will be pushed to "connectLink"'s children so on DOM when rendering its rendered as
      // <a href="https://example.com">click the button</a>
    } else if (match === `${stack[stack.length - 1].name}End`) {
      const item = stack.pop()!;
      const itemChildren = React.createElement(
        React.Fragment,
        {},
        ...item.children,
      );
      const fn = props[item.name];
      stack[stack.length - 1].children.push(fn(itemChildren));

      // Check if the match value is present in props and set the prop value
      // as children of last stack item
      // eg format = Hello {{name}}, match = "name" and props.name = "Excalidraw"
      // then its prop value will be pushed to "name"'s children so its
      // rendered on DOM as "Hello Excalidraw"
    } else if (props.hasOwnProperty(match)) {
      stack[stack.length - 1].children.push(props[match]);

      // Compute the actual key and set the key as the name if its one of the props, eg for "Please {{connectLinkStart}}click the button{{connectLinkEnd}} to continue"
      // key = "connectLink" and props contain "connectLink" then it will be pushed to stack
    } else if (/Start$/.test(match)) {
      const name = match.slice(0, match.length - 5);
      if (props.hasOwnProperty(name)) {
        stack.push({
          name,
          children: [],
        });
      } else {
        console.warn(
          `Trans: missed to pass in variable start/end ${match} for interpolating ${format}`,
        );
      }
    } else {
      console.warn(
        `Trans: missed to pass in variable ${match} for interpolating ${format}`,
      );
    }
  });

  if (stack.length !== 1) {
    console.warn(`Trans: stack not empty for interpolating ${format}`);
  }

  return stack[0].children;
};

const Trans = ({
  i18nKey,
  children,
  ...props
}: {
  i18nKey: string;
  [key: string]: any;
}) => {
  const { t } = useI18n();

  return React.createElement.apply(
    React.createElement,
    [React.Fragment, {}].concat(getTransChildren(t(i18nKey), props)) as any,
  );
};

export default Trans;
