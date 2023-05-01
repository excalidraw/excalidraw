import React from "react";

import { useI18n } from "../i18n";

const REGEXP = /{{(.+?)}}/g;

const getTransChildren = (
  format: string,
  props: {
    [key: string]: React.ReactNode | ((el: React.ReactNode) => React.ReactNode);
  },
) => {
  const stack: { name: string; children: React.ReactNode[] }[] = [
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
      // and props.connectLink = (el) => <a href="https://example.com">{el}</a>
      // then its prop value will be pushed to "connectLink"'s children so on DOM when rendering it's rendered as
      // <a href="https://example.com">click the button</a>
    } else if (match === `${stack[stack.length - 1].name}End`) {
      const item = stack.pop()!;
      const itemChildren = React.createElement(
        React.Fragment,
        {},
        ...item.children,
      );
      const fn = props[item.name];
      if (typeof fn === "function") {
        stack[stack.length - 1].children.push(fn(itemChildren));
      }

      // Check if the match value is present in props and set the prop value
      // as children of last stack item
      // eg format = Hello {{name}}, match = "name" and props.name = "Excalidraw"
      // then its prop value will be pushed to "name"'s children so it's
      // rendered on DOM as "Hello Excalidraw"
    } else if (props.hasOwnProperty(match)) {
      stack[stack.length - 1].children.push(props[match] as React.ReactNode);

      // Compute the actual key and set the key as the name if it's one of the props, eg for "Please {{connectLinkStart}}click the button{{connectLinkEnd}} to continue"
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
  [key: string]: React.ReactNode | ((el: React.ReactNode) => React.ReactNode);
}) => {
  const { t } = useI18n();

  // This is needed to avoid unique key error in list which gets rendered from getTransChildren
  return React.createElement(
    React.Fragment,
    {},
    ...getTransChildren(t(i18nKey), props),
  );
};

export default Trans;
