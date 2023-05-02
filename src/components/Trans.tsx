import React from "react";

import { useI18n } from "../i18n";

const REGEXP = /({{\w+?}})|(<\w+?>)|(<\/\w+?>)/g;
const KEY_REGEXP = /{{(\w+?)}}/;
const TAG_START_REGEXP = /<(\w+?)>/;
const TAG_END_REGEXP = /<\/(\w+?)>/;

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

  format.split(REGEXP).forEach((match) => {
    if (match === undefined || match.length === 0) {
      return;
    }

    const tagStartMatch = match.match(TAG_START_REGEXP);

    if (tagStartMatch !== null) {
      // Set the tag name as the name if it's one of the props, eg for "Please
      // <link>click the button</link> to continue" tagStartMatch[1] = "link"
      // and props contain "link" then it will be pushed to stack.
      const name = tagStartMatch[1];
      if (props.hasOwnProperty(name)) {
        stack.push({
          name,
          children: [],
        });
      } else {
        console.warn(
          `Trans: missed to pass in prop ${name} for interpolating ${format}`,
        );
      }

      return;
    }

    const tagEndMatch = match.match(TAG_END_REGEXP);

    if (tagEndMatch !== null) {
      // The match is </tag>. This means we need to now replace the content with
      // its actual value in prop eg format = "Please <link>click the
      // button</link> to continue", match = "</link>", stack last item name =
      // "link" and props.link = (el) => <a href="https://example.com">{el}</a>
      // then its prop value will be pushed to "link"'s children so on DOM when
      // rendering it's rendered as <a href="https://example.com">click the
      // button</a>

      if (tagEndMatch[1] === stack[stack.length - 1].name) {
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
      } else {
        console.warn(
          `Trans: unexpected end tag ${match} for interpolating ${format}`,
        );
      }

      return;
    }

    const keyMatch = match.match(KEY_REGEXP);

    if (keyMatch !== null) {
      // Check if the match value is present in props and set the prop value as
      // children of last stack item e.g. format = Hello {{name}}, keyMatch[1] =
      // "name" and props.name = "Excalidraw" then its prop value will be pushed
      // to "name"'s children so it's rendered on DOM as "Hello Excalidraw"
      if (props.hasOwnProperty(keyMatch[1])) {
        stack[stack.length - 1].children.push(
          props[keyMatch[1]] as React.ReactNode,
        );
      } else {
        console.warn(
          `Trans: key ${match} not in props for interpolating ${format}`,
        );
      }

      return;
    }

    // Pushing the content on both side of the Regex to stack eg for string -
    // "Hello {{name}} Whats up?" "Hello" and "Whats up" will be pushed
    stack[stack.length - 1].children.push(match);
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
